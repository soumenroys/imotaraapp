import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file

function buildThankYouHtml(firstName: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Thank you for applying — Imotara</title>
  <style>
    body { margin: 0; padding: 0; background: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrap { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .logo { font-size: 28px; margin-bottom: 8px; }
    .brand { font-size: 13px; font-weight: 600; color: #a1a1aa; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 32px; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; }
    .flower { font-size: 36px; display: block; margin-bottom: 16px; }
    h1 { margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #f4f4f5; line-height: 1.3; }
    p { margin: 0 0 14px; font-size: 14px; line-height: 1.75; color: #a1a1aa; }
    p:last-child { margin-bottom: 0; }
    .highlight { color: #e4e4e7; }
    .divider { height: 1px; background: #27272a; margin: 24px 0; }
    .footer { margin-top: 32px; font-size: 12px; color: #52525b; line-height: 1.6; }
    .footer a { color: #6366f1; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">🌿</div>
    <div class="brand">Imotara</div>

    <div class="card">
      <span class="flower">🌸</span>

      <h1>Thank you, ${firstName} — we've received your application.</h1>

      <p>
        We're genuinely glad you took the time to reach out. Every application we receive
        is read personally by our team — not filtered by a keyword scanner, not routed
        through an automated shortlist. Real eyes, real attention.
      </p>

      <p>
        We'll be reviewing applications over the coming days. If your profile resonates
        with what we're looking for, someone from our team will reach out directly.
        Either way, thank you for believing in what we're trying to build.
      </p>

      <div class="divider"></div>

      <p>
        <span class="highlight">What we're building at Imotara:</span> a quiet,
        private companion for emotions — no ads, no noise, no manipulation.
        Just presence, memory, and care. The person who joins us will help carry
        that story into the world, one honest piece of content at a time.
      </p>

      <p>
        We hope to speak with you soon. Until then, take good care.
      </p>

      <p style="margin-top: 20px; color: #71717a; font-size: 13px;">
        Warmly,<br />
        <span class="highlight">The Imotara Team</span>
      </p>
    </div>

    <div class="footer">
      <p>
        This message was sent because you applied for the Digital Content Creator
        role at <a href="https://www.imotara.com">imotara.com</a>.
        If this was a mistake, you can safely ignore this email.
      </p>
      <p style="margin-top: 8px; color: #3f3f46;">
        Imotara · Not a medical or crisis service.
      </p>
    </div>
  </div>
</body>
</html>
`.trim();
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const name  = (formData.get("name")  as string | null)?.trim() ?? "";
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const cv    = formData.get("cv")    as File | null;
  const photo = formData.get("photo") as File | null;

  if (!name)  return NextResponse.json({ error: "Name is required."  }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
  if (!cv || cv.size === 0) {
    return NextResponse.json({ error: "CV is required." }, { status: 400 });
  }
  if (cv.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "CV must be under 10 MB." }, { status: 400 });
  }
  if (photo && photo.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Photo must be under 10 MB." }, { status: 400 });
  }

  const user = process.env.ALERT_GMAIL_USER;
  const pass = process.env.ALERT_GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.error("[careers/apply] ALERT_GMAIL_USER or ALERT_GMAIL_APP_PASSWORD not set");
    return NextResponse.json({ error: "Mail service not configured." }, { status: 500 });
  }

  const cvBuffer = Buffer.from(await cv.arrayBuffer());
  const attachments: nodemailer.SendMailOptions["attachments"] = [
    { filename: cv.name || "cv.pdf", content: cvBuffer, contentType: cv.type || "application/pdf" },
  ];

  if (photo && photo.size > 0) {
    const photoBuffer = Buffer.from(await photo.arrayBuffer());
    attachments.push({
      filename: photo.name || "photo.jpg",
      content: photoBuffer,
      contentType: photo.type || "image/jpeg",
    });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  try {
    // 1. Notify publisher with attachments
    await transporter.sendMail({
      from: `"Imotara Careers" <${user}>`,
      to: "publisher@imotara.com",
      replyTo: email,
      subject: `New Application — Digital Content Creator (${name})`,
      text: [
        `Name:  ${name}`,
        `Email: ${email}`,
        "",
        photo && photo.size > 0
          ? "Attachments: CV + Passport Photo"
          : "Attachments: CV only",
      ].join("\n"),
      attachments,
    });

    // 2. Thank-you confirmation to the applicant
    const firstName = name.split(" ")[0];
    await transporter.sendMail({
      from: `"Imotara Team" <${user}>`,
      to: email,
      subject: "We received your application — Imotara",
      html: buildThankYouHtml(firstName),
      text: [
        `Hi ${firstName},`,
        "",
        "Thank you for applying for the Digital Content Creator role at Imotara.",
        "",
        "We read every application personally and will be in touch if your profile resonates with what we're looking for.",
        "",
        "Warmly,",
        "The Imotara Team",
        "https://www.imotara.com",
      ].join("\n"),
    });
  } catch (err) {
    console.error("[careers/apply] Failed to send email:", err);
    return NextResponse.json({ error: "Failed to send application. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
