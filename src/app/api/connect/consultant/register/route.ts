// POST /api/connect/consultant/register
// Auth required. Creates a pending consultant application.
// Body: { display_name, gender, role_category?, photo_url?, bio, expertise_tags, languages,
//         rate_per_min, currency_code, availability_note?, coc_agreed }

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import nodemailer from "nodemailer";

const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD"];
const VALID_ROLE_CATEGORIES = [
  "wellness_companion", "friend", "dad", "mom", "sister", "brother",
  "grandfather", "grandmother", "yoga_instructor", "fitness_companion",
];

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const {
    display_name, gender, role_category, contact_email, contact_phone, website_url, social_links,
    photo_url, bio, expertise_tags, languages, session_types,
    rate_per_min, currency_code, availability_note, availability_windows,
    verification_docs, payout_info, coc_agreed, digital_signature,
  } = body;

  if (!display_name?.trim()) {
    return NextResponse.json({ ok: false, error: "display_name is required" }, { status: 400 });
  }
  if (!["male", "female"].includes(gender)) {
    return NextResponse.json({ ok: false, error: "gender must be male or female" }, { status: 400 });
  }
  const normalizedCategory = role_category && VALID_ROLE_CATEGORIES.includes(role_category)
    ? role_category
    : "wellness_companion";
  if (!bio?.trim() || bio.length > 500) {
    return NextResponse.json({ ok: false, error: "bio is required (max 500 chars)" }, { status: 400 });
  }
  if (!Array.isArray(expertise_tags) || expertise_tags.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one expertise tag required" }, { status: 400 });
  }
  if (!Array.isArray(languages) || languages.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one language required" }, { status: 400 });
  }
  if (!rate_per_min || isNaN(Number(rate_per_min)) || Number(rate_per_min) <= 0) {
    return NextResponse.json({ ok: false, error: "rate_per_min must be a positive number" }, { status: 400 });
  }
  if (!SUPPORTED_CURRENCIES.includes(currency_code)) {
    return NextResponse.json({ ok: false, error: "Unsupported currency" }, { status: 400 });
  }
  if (coc_agreed !== true) {
    return NextResponse.json({ ok: false, error: "You must agree to the Code of Conduct" }, { status: 400 });
  }
  const VALID_SESSION_TYPES = ["chat", "audio", "video"];
  const normalizedSessionTypes = Array.isArray(session_types)
    ? session_types.filter((t: string) => VALID_SESSION_TYPES.includes(t))
    : ["chat"];
  if (normalizedSessionTypes.length === 0) {
    return NextResponse.json({ ok: false, error: "Select at least one session type (chat, audio, or video)" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Insert consultant row
  const { data: consultant, error } = await supabase
    .from("connect_consultants")
    .insert({
      user_id:              user.id,
      display_name:         display_name.trim(),
      gender,
      role_category:        normalizedCategory,
      contact_email:        contact_email?.trim() ?? null,
      contact_phone:        contact_phone?.trim() ?? null,
      website_url:          website_url?.trim() || null,
      social_links:         Array.isArray(social_links) ? social_links : null,
      photo_url:            photo_url ?? null,
      bio:                  bio.trim(),
      expertise_tags,
      languages,
      rate_per_min:         Number(rate_per_min),
      currency_code,
      availability_note:    availability_note ?? null,
      availability_windows: availability_windows ?? null,
      verification_docs:    verification_docs ?? null,
      payout_info:          payout_info ?? null,
      session_types:        normalizedSessionTypes,
      coc_agreed:           true,
      digital_signature:    digital_signature?.trim() ?? null,
      status:               "pending",
    })
    .select("id, status")
    .single();

  if (error || !consultant) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  // Ensure wallet row exists for this user
  await supabase
    .from("connect_wallet")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

  // Notify admin + confirm receipt to applicant (non-blocking)
  const applicantEmail = contact_email?.trim() || user.email || "";
  await sendRegistrationEmails({
    display_name,
    applicant_email: applicantEmail,
    auth_email: user.email ?? "",
    currency_code,
    rate_per_min,
  });

  return NextResponse.json({ ok: true, id: consultant.id, status: "pending" }, { status: 201 });
}

function makeTransporter() {
  const gmailUser = process.env.ALERT_GMAIL_USER?.trim();
  const gmailPass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
  if (!gmailUser || !gmailPass) {
    console.error("[Connect email] ALERT_GMAIL_USER or ALERT_GMAIL_APP_PASSWORD env var not set");
    return null;
  }
  return {
    transporter: nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.hostinger.com", port: 465, secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    }),
    from: `"Imotara Connect" <${gmailUser}>`,
  };
}

async function sendRegistrationEmails(data: {
  display_name: string;
  applicant_email: string;
  auth_email: string;
  currency_code: string;
  rate_per_min: number;
}) {
  const t = makeTransporter();
  if (!t) return;

  // Notify admin
  try {
    await t.transporter.sendMail({
      from:    t.from,
      to:      "publisher@imotara.com",
      subject: `[Connect] New companion application — ${data.display_name}`,
      text: [
        `A new companion has applied on Imotara Connect.`,
        ``,
        `Name:          ${data.display_name}`,
        `Auth email:    ${data.auth_email}`,
        `Contact email: ${data.applicant_email || "(not provided)"}`,
        `Rate:          ${data.rate_per_min} ${data.currency_code}/min`,
        ``,
        `Review at: https://imotara.com/admin → Connect tab`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("[Connect email] Failed to send admin notification:", err);
  }

  // Confirm receipt to applicant
  const recipientEmail = data.applicant_email || data.auth_email;
  if (!recipientEmail) return;
  try {
    await t.transporter.sendMail({
      from:    t.from,
      to:      recipientEmail,
      subject: `[Imotara Connect] We've received your application`,
      text: [
        `Hi ${data.display_name},`,
        ``,
        `Thank you for applying to become a Wellness Companion on Imotara Connect!`,
        ``,
        `We've received your application and our team will review it carefully. This usually takes 1–3 business days.`,
        ``,
        `You'll receive another email as soon as a decision has been made.`,
        ``,
        `In the meantime, if you have any questions, please reply to this email.`,
        ``,
        `With warmth,`,
        `The Imotara Team`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("[Connect email] Failed to send applicant confirmation:", err);
  }
}
