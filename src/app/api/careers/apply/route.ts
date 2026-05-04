import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const cv    = formData.get("cv")    as File | null;
  const photo = formData.get("photo") as File | null;

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

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Imotara Careers" <${user}>`,
      to: "publisher@imotara.com",
      subject: "New Application — Digital Content Creator",
      text: [
        "A new application has been submitted for the Digital Content Creator role.",
        "",
        photo && photo.size > 0
          ? "Attachments: CV + Passport Photo"
          : "Attachments: CV only (no photo provided)",
        "",
        "— Imotara Careers Form",
      ].join("\n"),
      attachments,
    });
  } catch (err) {
    console.error("[careers/apply] Failed to send email:", err);
    return NextResponse.json({ error: "Failed to send application. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
