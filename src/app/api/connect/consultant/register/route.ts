export const preferredRegion = ["sin1"];

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
    verification_docs, payout_info, coc_agreed, digital_signature, preferred_lang,
  } = body;

  if (!display_name?.trim()) {
    return NextResponse.json({ ok: false, error: "display_name is required" }, { status: 400 });
  }
  if (display_name.trim().length > 100) {
    return NextResponse.json({ ok: false, error: "display_name must be 100 characters or fewer" }, { status: 400 });
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
  if (expertise_tags.length > 20 || expertise_tags.some((t: unknown) => typeof t !== "string" || t.length > 50)) {
    return NextResponse.json({ ok: false, error: "expertise_tags: max 20 items, each max 50 characters" }, { status: 400 });
  }
  if (!Array.isArray(languages) || languages.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one language required" }, { status: 400 });
  }
  if (languages.length > 20 || languages.some((l: unknown) => typeof l !== "string" || l.length > 20)) {
    return NextResponse.json({ ok: false, error: "languages: max 20 items, each max 20 characters" }, { status: 400 });
  }
  if (availability_note && availability_note.length > 500) {
    return NextResponse.json({ ok: false, error: "availability_note must be 500 characters or fewer" }, { status: 400 });
  }
  if (!rate_per_min || isNaN(Number(rate_per_min)) || Number(rate_per_min) <= 0) {
    return NextResponse.json({ ok: false, error: "rate_per_min must be a positive number" }, { status: 400 });
  }
  if (Number(rate_per_min) > 10000) {
    return NextResponse.json({ ok: false, error: "rate_per_min cannot exceed 10000" }, { status: 400 });
  }
  if (!SUPPORTED_CURRENCIES.includes(currency_code)) {
    return NextResponse.json({ ok: false, error: "Unsupported currency" }, { status: 400 });
  }
  if (coc_agreed !== true) {
    return NextResponse.json({ ok: false, error: "You must agree to the Code of Conduct" }, { status: 400 });
  }
  // URL scheme allow-list prevents javascript: and other dangerous schemes from being
  // stored and later rendered as <img src> or <a href> in the browse UI.
  if (photo_url !== undefined && photo_url !== null) {
    const scheme = String(photo_url).trim().toLowerCase().slice(0, 10);
    if (String(photo_url).trim() !== "" && !scheme.startsWith("https://")) {
      return NextResponse.json({ ok: false, error: "photo_url must be a valid https:// URL" }, { status: 400 });
    }
  }
  if (website_url !== undefined && website_url !== null && String(website_url).trim() !== "") {
    const scheme = String(website_url).trim().toLowerCase().slice(0, 10);
    if (!scheme.startsWith("https://")) {
      return NextResponse.json({ ok: false, error: "website_url must be a valid https:// URL" }, { status: 400 });
    }
  }
  const VALID_SESSION_TYPES = ["chat", "audio", "video"];
  const normalizedSessionTypes = Array.isArray(session_types)
    ? session_types.filter((t: string) => VALID_SESSION_TYPES.includes(t))
    : ["chat"];
  if (normalizedSessionTypes.length === 0) {
    return NextResponse.json({ ok: false, error: "Select at least one session type (chat, audio, or video)" }, { status: 400 });
  }
  if (contact_email !== undefined && contact_email !== null && String(contact_email).trim() !== "") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contact_email).trim())) {
      return NextResponse.json({ ok: false, error: "contact_email must be a valid email address" }, { status: 400 });
    }
  }
  if (social_links !== undefined && social_links !== null) {
    if (JSON.stringify(social_links).length > 4096) {
      return NextResponse.json({ ok: false, error: "social_links payload too large" }, { status: 400 });
    }
    if (Array.isArray(social_links)) {
      const ALLOWED_LINK_KEYS = new Set(["platform", "url", "handle", "label"]);
      for (const link of social_links) {
        if (!link || typeof link !== "object" || Array.isArray(link)) {
          return NextResponse.json({ ok: false, error: "Each social_links entry must be an object" }, { status: 400 });
        }
        for (const k of Object.keys(link as Record<string, unknown>)) {
          if (!ALLOWED_LINK_KEYS.has(k)) {
            return NextResponse.json({ ok: false, error: `social_links: unexpected key '${k}'` }, { status: 400 });
          }
        }
        if (link && typeof link.url === "string" && link.url.trim() !== "") {
          if (!link.url.trim().toLowerCase().startsWith("https://")) {
            return NextResponse.json({ ok: false, error: "All social_links URLs must use https://" }, { status: 400 });
          }
        }
      }
    }
  }
  if (verification_docs !== undefined && verification_docs !== null) {
    if (JSON.stringify(verification_docs).length > 4096) {
      return NextResponse.json({ ok: false, error: "verification_docs payload too large" }, { status: 400 });
    }
    // Key names must be safe identifiers (no HTML/script injection via key rendering in admin UI)
    if (typeof verification_docs === "object" && !Array.isArray(verification_docs)) {
      for (const key of Object.keys(verification_docs as Record<string, unknown>)) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,49}$/.test(key)) {
          return NextResponse.json({ ok: false, error: "verification_docs keys must be alphanumeric identifiers" }, { status: 400 });
        }
      }
    }
  }
  if (payout_info !== undefined && payout_info !== null) {
    if (JSON.stringify(payout_info).length > 2048) {
      return NextResponse.json({ ok: false, error: "payout_info payload too large" }, { status: 400 });
    }
  }
  if (contact_phone !== undefined && contact_phone !== null && String(contact_phone).trim().length > 30) {
    return NextResponse.json({ ok: false, error: "contact_phone must be 30 characters or fewer" }, { status: 400 });
  }
  if (digital_signature !== undefined && digital_signature !== null && String(digital_signature).trim().length > 200) {
    return NextResponse.json({ ok: false, error: "digital_signature must be 200 characters or fewer" }, { status: 400 });
  }
  if (availability_windows !== undefined && availability_windows !== null) {
    if (!Array.isArray(availability_windows) || availability_windows.length > 28 || JSON.stringify(availability_windows).length > 8192) {
      return NextResponse.json({ ok: false, error: "availability_windows is invalid or too large" }, { status: 400 });
    }
    const ALLOWED_DAYS = new Set(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]);
    const TIME_RE = /^\d{2}:\d{2}$/;
    const ALLOWED_WIN_KEYS = new Set(["day","start_time","end_time"]);
    for (const w of availability_windows) {
      if (!w || typeof w !== "object" || Array.isArray(w)) {
        return NextResponse.json({ ok: false, error: "Each availability_windows entry must be an object" }, { status: 400 });
      }
      for (const k of Object.keys(w as Record<string, unknown>)) {
        if (!ALLOWED_WIN_KEYS.has(k)) {
          return NextResponse.json({ ok: false, error: `availability_windows: unexpected key '${k}'` }, { status: 400 });
        }
      }
      const win = w as Record<string, unknown>;
      if (typeof win.day !== "string" || !ALLOWED_DAYS.has(win.day.toLowerCase())) {
        return NextResponse.json({ ok: false, error: "availability_windows: day must be a day of the week" }, { status: 400 });
      }
      if (typeof win.start_time !== "string" || !TIME_RE.test(win.start_time)) {
        return NextResponse.json({ ok: false, error: "availability_windows: start_time must be HH:MM" }, { status: 400 });
      }
      if (typeof win.end_time !== "string" || !TIME_RE.test(win.end_time)) {
        return NextResponse.json({ ok: false, error: "availability_windows: end_time must be HH:MM" }, { status: 400 });
      }
    }
  }

  const supabase = getSupabaseAdmin();

  // Prevent duplicate registrations
  const { data: existing, error: existingErr } = await supabase
    .from("connect_consultants")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingErr) {
    console.error("[consultant/register] duplicate check failed:", existingErr.message);
    return NextResponse.json({ ok: false, error: "Registration check failed. Please try again." }, { status: 500 });
  }
  if (existing) {
    const msg = existing.status === "pending"
      ? "You already have a pending application"
      : "You are already registered as a consultant";
    return NextResponse.json({ ok: false, error: msg, existing_status: existing.status }, { status: 409 });
  }

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
      preferred_lang:       (typeof preferred_lang === "string" && ["en","hi","bn","mr","ta","te","gu","pa","kn","ml","or","ur","ar","he","ru","zh","ja","es","fr","de","pt"].includes(preferred_lang.trim())) ? preferred_lang.trim() : "en",
      status:               "pending",
    })
    .select("id, status")
    .single();

  if (error || !consultant) {
    console.error("[consultant/register] insert failed:", error?.message);
    return NextResponse.json({ ok: false, error: "Registration failed. Please try again." }, { status: 500 });
  }

  // Ensure wallet row exists for this user
  await supabase
    .from("connect_wallet")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

  // Notify admin + confirm receipt to applicant (fire-and-forget — SMTP latency must not block the response)
  const applicantEmail = contact_email?.trim() || user.email || "";
  void sendRegistrationEmails({
    display_name,
    applicant_email: applicantEmail,
    auth_email: user.email ?? "",
    currency_code,
    rate_per_min,
  }).catch((e) => console.error("[consultant/register] email error:", e));

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
