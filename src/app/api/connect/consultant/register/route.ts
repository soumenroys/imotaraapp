// POST /api/connect/consultant/register
// Auth required. Creates a pending consultant application.
// Body: { display_name, gender, photo_url?, bio, expertise_tags, languages,
//         rate_per_min, currency_code, availability_note?, coc_agreed }

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import nodemailer from "nodemailer";

const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD"];

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const {
    display_name, gender, contact_email, contact_phone, website_url, social_links,
    photo_url, bio, expertise_tags, languages,
    rate_per_min, currency_code, availability_note, availability_windows,
    verification_docs, payout_info, coc_agreed, digital_signature,
  } = body;

  if (!display_name?.trim()) {
    return NextResponse.json({ ok: false, error: "display_name is required" }, { status: 400 });
  }
  if (!["male", "female"].includes(gender)) {
    return NextResponse.json({ ok: false, error: "gender must be male or female" }, { status: 400 });
  }
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

  const supabase = getSupabaseAdmin();

  // Check: user doesn't already have an application
  const { data: existing } = await supabase
    .from("connect_consultants")
    .select("id, status")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "Application already exists", status: existing.status },
      { status: 409 }
    );
  }

  // Insert consultant row
  const { data: consultant, error } = await supabase
    .from("connect_consultants")
    .insert({
      user_id:              user.id,
      display_name:         display_name.trim(),
      gender,
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

  // Notify admin
  await sendAdminNotification({ display_name, email: user.email ?? "", currency_code, rate_per_min });

  return NextResponse.json({ ok: true, id: consultant.id, status: "pending" }, { status: 201 });
}

async function sendAdminNotification(data: {
  display_name: string;
  email: string;
  currency_code: string;
  rate_per_min: number;
}) {
  const gmailUser = process.env.ALERT_GMAIL_USER?.trim();
  const gmailPass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
  if (!gmailUser || !gmailPass) return;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from:    `"Imotara Alerts" <${gmailUser}>`,
      to:      "publisher@imotara.com",
      subject: `[Connect] New consultant application — ${data.display_name}`,
      text: [
        `A new consultant has applied on Imotara Connect.`,
        ``,
        `Name:     ${data.display_name}`,
        `Email:    ${data.email}`,
        `Rate:     ${data.rate_per_min} ${data.currency_code}/min`,
        ``,
        `Review at: https://imotara.com/admin → Connect tab`,
      ].join("\n"),
    });
  } catch {
    // email failure is non-blocking
  }
}
