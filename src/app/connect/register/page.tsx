// src/app/connect/register/page.tsx
// 5-step consultant registration form.
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  CheckCircle2, Loader2, ChevronRight, ChevronLeft,
  Upload, Link2, X, Plus, Clock, FileText, AlertTriangle,
} from "lucide-react";

// ─── Static data ────────────────────────────────────────────────────────────

const EXPERTISE_OPTIONS = [
  "Stress & Anxiety", "Loneliness", "Grief & Loss", "Relationship Issues",
  "Work & Career Pressure", "Self-Esteem", "Family Conflicts", "Life Transitions",
  "Emotional Regulation", "Mindfulness", "General Wellness",
];
const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" }, { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" }, { code: "mr", label: "Marathi" },
  { code: "ta", label: "Tamil" },   { code: "te", label: "Telugu" },
  { code: "gu", label: "Gujarati" }, { code: "pa", label: "Punjabi" },
  { code: "kn", label: "Kannada" }, { code: "ml", label: "Malayalam" },
  { code: "ur", label: "Urdu" },    { code: "ar", label: "Arabic" },
  { code: "es", label: "Spanish" }, { code: "fr", label: "French" },
  { code: "de", label: "German" },  { code: "pt", label: "Portuguese" },
];
const CURRENCIES = [
  { code: "INR", label: "₹ Indian Rupee" },
  { code: "USD", label: "$ US Dollar" },
  { code: "EUR", label: "€ Euro" },
  { code: "GBP", label: "£ British Pound" },
  { code: "AED", label: "د.إ UAE Dirham" },
  { code: "SGD", label: "S$ Singapore Dollar" },
  { code: "AUD", label: "A$ Australian Dollar" },
];
const DAYS_OF_WEEK  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_ABBR: Record<string,string> = { Monday:"Mon",Tuesday:"Tue",Wednesday:"Wed",Thursday:"Thu",Friday:"Fri",Saturday:"Sat",Sunday:"Sun" };
const MONTHS_OF_YEAR = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_ABBR: Record<string,string> = { January:"Jan",February:"Feb",March:"Mar",April:"Apr",May:"May",June:"Jun",July:"Jul",August:"Aug",September:"Sep",October:"Oct",November:"Nov",December:"Dec" };
const TIMEZONES = [
  { value:"Asia/Kolkata",        label:"IST — India (UTC+5:30)" },
  { value:"Asia/Dhaka",          label:"BST — Bangladesh (UTC+6)" },
  { value:"Asia/Karachi",        label:"PKT — Pakistan (UTC+5)" },
  { value:"Asia/Colombo",        label:"SLST — Sri Lanka (UTC+5:30)" },
  { value:"Asia/Kathmandu",      label:"NPT — Nepal (UTC+5:45)" },
  { value:"Asia/Dubai",          label:"GST — UAE (UTC+4)" },
  { value:"Asia/Riyadh",         label:"AST — Saudi Arabia (UTC+3)" },
  { value:"Asia/Singapore",      label:"SGT — Singapore (UTC+8)" },
  { value:"Asia/Kuala_Lumpur",   label:"MYT — Malaysia (UTC+8)" },
  { value:"Asia/Bangkok",        label:"ICT — Thailand (UTC+7)" },
  { value:"Asia/Manila",         label:"PHT — Philippines (UTC+8)" },
  { value:"Asia/Hong_Kong",      label:"HKT — Hong Kong (UTC+8)" },
  { value:"Asia/Tokyo",          label:"JST — Japan (UTC+9)" },
  { value:"Asia/Seoul",          label:"KST — South Korea (UTC+9)" },
  { value:"Europe/London",       label:"GMT/BST — UK (UTC+0/+1)" },
  { value:"Europe/Paris",        label:"CET/CEST — France (UTC+1/+2)" },
  { value:"Europe/Berlin",       label:"CET/CEST — Germany (UTC+1/+2)" },
  { value:"America/New_York",    label:"EST/EDT — US Eastern (UTC-5/-4)" },
  { value:"America/Chicago",     label:"CST/CDT — US Central (UTC-6/-5)" },
  { value:"America/Los_Angeles", label:"PST/PDT — US Pacific (UTC-8/-7)" },
  { value:"America/Toronto",     label:"EST/EDT — Toronto (UTC-5/-4)" },
  { value:"America/Sao_Paulo",   label:"BRT — Brazil (UTC-3)" },
  { value:"Australia/Sydney",    label:"AEST/AEDT — Sydney (UTC+10/+11)" },
  { value:"Africa/Nairobi",      label:"EAT — East Africa (UTC+3)" },
  { value:"UTC",                 label:"UTC — Coordinated Universal Time" },
];
const YEAR_OPTIONS = ["all", ...Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() + i))];

const SESSION_TYPE_OPTIONS = [
  { key: "chat",  label: "Text / Chat",  icon: "💬", desc: "Text-based messaging sessions" },
  { key: "audio", label: "Audio Call",   icon: "🎙️", desc: "Voice-only audio sessions" },
  { key: "video", label: "Video Call",   icon: "📹", desc: "Face-to-face video sessions" },
] as const;

const ROLE_CATEGORIES = [
  { key: "wellness_companion", label: "Wellness Companion", icon: "🧘", desc: "Empathetic peer support for emotional wellness", phase: 1 },
  { key: "friend",             label: "Friend",             icon: "🤝", desc: "A caring peer friend figure",                   phase: 2 },
  { key: "dad",                label: "Dad",                icon: "👨", desc: "A supportive father figure",                    phase: 2 },
  { key: "mom",                label: "Mom",                icon: "👩", desc: "A nurturing mother figure",                     phase: 2 },
  { key: "sister",             label: "Sister",             icon: "👧", desc: "A caring sister figure",                       phase: 2 },
  { key: "brother",            label: "Brother",            icon: "👦", desc: "A supportive brother figure",                  phase: 2 },
  { key: "grandfather",        label: "Grandfather",        icon: "👴", desc: "A wise grandfather figure",                    phase: 2 },
  { key: "grandmother",        label: "Grandmother",        icon: "👵", desc: "A warm grandmother figure",                    phase: 2 },
  { key: "yoga_instructor",    label: "Yoga Instructor",    icon: "🧘", desc: "Yoga and mindfulness guidance",                phase: 3 },
  { key: "fitness_companion",  label: "Fitness Companion",  icon: "💪", desc: "Physical wellness and fitness support",        phase: 3 },
] as const;

const COUNTRY_CODES = [
  { code: "+91",  name: "India",           flag: "🇮🇳", tz: "Asia/Kolkata" },
  { code: "+1",   name: "USA",             flag: "🇺🇸", tz: "America/New_York" },
  { code: "+1",   name: "Canada",          flag: "🇨🇦", tz: "America/Toronto" },
  { code: "+44",  name: "UK",              flag: "🇬🇧", tz: "Europe/London" },
  { code: "+971", name: "UAE",             flag: "🇦🇪", tz: "Asia/Dubai" },
  { code: "+65",  name: "Singapore",       flag: "🇸🇬", tz: "Asia/Singapore" },
  { code: "+61",  name: "Australia",       flag: "🇦🇺", tz: "Australia/Sydney" },
  { code: "+49",  name: "Germany",         flag: "🇩🇪", tz: "Europe/Berlin" },
  { code: "+33",  name: "France",          flag: "🇫🇷", tz: "Europe/Paris" },
  { code: "+31",  name: "Netherlands",     flag: "🇳🇱", tz: "Europe/Amsterdam" },
  { code: "+41",  name: "Switzerland",     flag: "🇨🇭", tz: "Europe/Zurich" },
  { code: "+46",  name: "Sweden",          flag: "🇸🇪", tz: "Europe/Stockholm" },
  { code: "+880", name: "Bangladesh",      flag: "🇧🇩", tz: "Asia/Dhaka" },
  { code: "+92",  name: "Pakistan",        flag: "🇵🇰", tz: "Asia/Karachi" },
  { code: "+94",  name: "Sri Lanka",       flag: "🇱🇰", tz: "Asia/Colombo" },
  { code: "+977", name: "Nepal",           flag: "🇳🇵", tz: "Asia/Kathmandu" },
  { code: "+966", name: "Saudi Arabia",    flag: "🇸🇦", tz: "Asia/Riyadh" },
  { code: "+60",  name: "Malaysia",        flag: "🇲🇾", tz: "Asia/Kuala_Lumpur" },
  { code: "+63",  name: "Philippines",     flag: "🇵🇭", tz: "Asia/Manila" },
  { code: "+66",  name: "Thailand",        flag: "🇹🇭", tz: "Asia/Bangkok" },
  { code: "+62",  name: "Indonesia",       flag: "🇮🇩", tz: "Asia/Jakarta" },
  { code: "+81",  name: "Japan",           flag: "🇯🇵", tz: "Asia/Tokyo" },
  { code: "+82",  name: "South Korea",     flag: "🇰🇷", tz: "Asia/Seoul" },
  { code: "+86",  name: "China",           flag: "🇨🇳", tz: "Asia/Shanghai" },
  { code: "+852", name: "Hong Kong",       flag: "🇭🇰", tz: "Asia/Hong_Kong" },
  { code: "+55",  name: "Brazil",          flag: "🇧🇷", tz: "America/Sao_Paulo" },
  { code: "+52",  name: "Mexico",          flag: "🇲🇽", tz: "America/Mexico_City" },
  { code: "+27",  name: "South Africa",    flag: "🇿🇦", tz: "Africa/Johannesburg" },
  { code: "+254", name: "Kenya",           flag: "🇰🇪", tz: "Africa/Nairobi" },
  { code: "+234", name: "Nigeria",         flag: "🇳🇬", tz: "Africa/Lagos" },
  { code: "+64",  name: "New Zealand",     flag: "🇳🇿", tz: "Pacific/Auckland" },
  { code: "+7",   name: "Russia",          flag: "🇷🇺", tz: "Europe/Moscow" },
  { code: "+20",  name: "Egypt",           flag: "🇪🇬", tz: "Africa/Cairo" },
  { code: "+974", name: "Qatar",           flag: "🇶🇦", tz: "Asia/Qatar" },
  { code: "+965", name: "Kuwait",          flag: "🇰🇼", tz: "Asia/Kuwait" },
  { code: "+973", name: "Bahrain",         flag: "🇧🇭", tz: "Asia/Bahrain" },
  { code: "+968", name: "Oman",            flag: "🇴🇲", tz: "Asia/Muscat" },
];

// Detect the user's country dial code from their browser timezone
function detectDialCode(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = COUNTRY_CODES.find(c => c.tz === tz);
    return match?.code ?? "+91";
  } catch { return "+91"; }
}

const DOC_FIELDS = [
  { key: "selfie",        label: "Verification Selfie *", hint: "A clear photo of your face taken right now, holding your Photo ID open so both your face and the ID text are visible. Use your webcam, phone camera, or any recent photo." },
  { key: "photo_id",      label: "Photo ID Proof *",      hint: "Passport, Aadhaar, Driving Licence, National ID, Voter ID" },
  { key: "address_proof", label: "Address Proof *",       hint: "Utility bill / bank statement (≤3 months old), Passport, Aadhaar" },
  { key: "age_proof",     label: "Age Proof *",           hint: "Passport, Birth Certificate, Aadhaar, School Leaving Certificate" },
  { key: "eligibility",   label: "Eligibility Proof *",   hint: "Psychology/counselling degree, wellness coaching cert, mental health first-aid cert, or any relevant qualification. Peer support: upload a signed declaration." },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

type AvailWindow = { days: string[]; months: string[]; start: string; end: string; timezone: string; year: string; };
type DocEntry    = { path: string; name: string; public_url?: string; same_as_profile?: boolean } | null;
type DocMap      = Record<string, DocEntry>;
type PayoutMethod = "upi" | "paypal" | "bank_in" | "bank_int";

// ─── ReviewRow helper ────────────────────────────────────────────────────────

function ReviewRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[11px] text-zinc-500">{label}</span>
      <span className={`text-right text-xs break-all ${ok === false ? "text-rose-400" : "text-zinc-300"}`}>{value || "—"}</span>
    </div>
  );
}

// ─── Auth gate ───────────────────────────────────────────────────────────────

function SignInGate() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?redirectTo=/connect/register` },
    });
  }
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="imotara-glass-card w-full max-w-sm rounded-2xl p-8 text-center">
        <div className="mb-4 text-5xl">🔒</div>
        <h2 className="mb-2 text-xl font-bold text-zinc-50">Sign in to apply</h2>
        <p className="mb-6 text-sm text-zinc-400 leading-relaxed">
          You need a free Imotara account to apply as a Wellness Companion.
        </p>
        <button
          onClick={signInWithGoogle}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
        <a href="/connect" className="mt-4 block text-xs text-zinc-600 hover:text-zinc-400 transition">
          ← Back to Connect
        </a>
      </div>
    </main>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RegisterConsultantPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) return null;
  if (!isLoggedIn)  return <SignInGate />;

  const TOTAL_STEPS = 5;
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Step 1 — Basic info
  const [displayName, setDisplayName]   = useState("");
  const [gender, setGender]             = useState<"male"|"female"|"">("");
  const [roleCategory, setRoleCategory] = useState("wellness_companion");
  const [contactEmail, setContactEmail] = useState("");
  const [countryCode, setCountryCode]   = useState("+91");
  const [contactPhone, setContactPhone] = useState("");
  const [websiteUrl, setWebsiteUrl]     = useState("");
  const [socialLinks, setSocialLinks]   = useState<string[]>([""]);
  const [photoUrl, setPhotoUrl]         = useState("");
  const [photoMode, setPhotoMode]       = useState<"upload"|"url">("upload");
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState("");
  const [previewError, setPreviewError] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const [expertiseTags, setExpertiseTags] = useState<string[]>([]);
  const [languages, setLanguages]       = useState<string[]>([]);
  const [sessionTypes, setSessionTypes] = useState<string[]>([]);

  // Step 2 — Profile, rate, availability
  const [bio, setBio]               = useState("");
  const [ratePerMin, setRatePerMin] = useState("");
  const [currency, setCurrency]     = useState("INR");
  const [timezone, setTimezone]     = useState("Asia/Kolkata");
  const [availWindows, setAvailWindows] = useState<AvailWindow[]>([]);
  const [bDays, setBDays]   = useState<string[]>([]);
  const [bMonths, setBMonths] = useState<string[]>([]);
  const [bYear, setBYear]   = useState("all");
  const [bStart, setBStart] = useState("09:00");
  const [bEnd, setBEnd]     = useState("17:00");
  const [bError, setBError] = useState("");

  // Step 3 — Documents + payout
  const [selfieSameAsProfile, setSelfieSameAsProfile] = useState(false);
  const [docs, setDocs]           = useState<DocMap>({});
  const [docUploading, setDocUploading] = useState<Record<string,boolean>>({});
  const [docError, setDocError]   = useState<Record<string,string>>({});
  const docRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("upi");
  const [upiId, setUpiId]         = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName]   = useState("");
  const [ifscCode, setIfscCode]   = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [ibanNumber, setIbanNumber] = useState("");

  // Auto-detect country dial code from browser timezone on mount
  useEffect(() => {
    setCountryCode(detectDialCode());
  }, []);

  // Step 4 — Legal agreement
  const [agreeAdult, setAgreeAdult]         = useState(false);
  const [agreeCoc, setAgreeCoc]             = useState(false);
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false);
  const [agreePeer, setAgreePeer]           = useState(false);
  const [agreeTax, setAgreeTax]             = useState(false);

  // Step 5 — Review & Sign
  const [agreeInfoTrue, setAgreeInfoTrue]   = useState(false);
  const [digitalSignature, setDigitalSignature] = useState("");

  // ── Photo helpers ──────────────────────────────────────────────────────────
  function convertDriveUrl(raw: string): string {
    const m = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    return raw.trim();
  }
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError(""); setPreviewError(false); setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/connect/upload-photo", { method:"POST", body:fd, credentials:"include" });
      const d = await res.json();
      if (d.ok) setPhotoUrl(d.url); else setUploadError(d.error ?? "Upload failed");
    } catch { setUploadError("Network error"); }
    finally { setUploading(false); if (photoRef.current) photoRef.current.value = ""; }
  }

  // ── Document upload helpers ────────────────────────────────────────────────
  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>, docType: string) {
    const file = e.target.files?.[0]; if (!file) return;
    setDocError(prev => ({ ...prev, [docType]: "" }));
    setDocUploading(prev => ({ ...prev, [docType]: true }));
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("doc_type", docType);
      const res = await fetch("/api/connect/upload-doc", { method:"POST", body:fd, credentials:"include" });
      const d = await res.json();
      if (d.ok) setDocs(prev => ({ ...prev, [docType]: { path: d.path, name: d.name } }));
      else setDocError(prev => ({ ...prev, [docType]: d.error ?? "Upload failed" }));
    } catch { setDocError(prev => ({ ...prev, [docType]: "Network error" })); }
    finally {
      setDocUploading(prev => ({ ...prev, [docType]: false }));
      const ref = docRefs.current[docType]; if (ref) ref.value = "";
    }
  }

  // ── Social link helpers ────────────────────────────────────────────────────
  function updateSocialLink(i: number, val: string) {
    setSocialLinks(prev => prev.map((l, idx) => idx === i ? val : l));
  }
  function addSocialLink() {
    if (socialLinks.length < 5) setSocialLinks(prev => [...prev, ""]);
  }
  function removeSocialLink(i: number) {
    setSocialLinks(prev => prev.filter((_, idx) => idx !== i));
  }

  // ── Availability builder helpers ───────────────────────────────────────────
  function addWindow() {
    if (bDays.length === 0) { setBError("Select at least one day."); return; }
    if (bStart >= bEnd)     { setBError("End time must be after start time."); return; }
    setBError("");
    setAvailWindows(prev => [...prev, { days:bDays, months:bMonths, start:bStart, end:bEnd, timezone, year:bYear }]);
    setBDays([]); setBMonths([]);
  }
  function windowLabel(w: AvailWindow): string {
    const days   = w.days.map(d => DAY_ABBR[d] ?? d).join(", ");
    const months = w.months.length > 0 ? w.months.map(m => MONTH_ABBR[m] ?? m).join(", ") : "All months";
    const year   = w.year === "all" ? "Every year" : w.year;
    const tz     = TIMEZONES.find(t => t.value === w.timezone)?.label.split(" — ")[0] ?? w.timezone;
    return `${days} · ${months} · ${year} · ${w.start}–${w.end} ${tz}`;
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validateStep(s: number): string {
    if (s === 1) {
      if (!displayName.trim()) return "Display name is required.";
      if (!gender) return "Please select your gender.";
      if (!contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
        return "Enter a valid contact email address.";
      if (!contactPhone.trim()) return "Enter a contact phone number.";
      if (expertiseTags.length === 0) return "Select at least one expertise area.";
      if (languages.length === 0) return "Select at least one language.";
      if (sessionTypes.length === 0) return "Select at least one session type (Chat, Audio, or Video).";
    }
    if (s === 2) {
      if (bio.trim().length < 30) return "Bio must be at least 30 characters.";
      if (bio.length > 500)       return "Bio must be 500 characters or less.";
      if (!ratePerMin || isNaN(Number(ratePerMin)) || Number(ratePerMin) <= 0)
        return "Enter a valid rate per minute (greater than 0).";
    }
    if (s === 3) {
      const required = ["selfie","photo_id","address_proof","age_proof","eligibility"] as const;
      for (const k of required) {
        if (!docs[k]) return `Please upload your ${DOC_FIELDS.find(d => d.key === k)?.label.replace(" *","") ?? k}.`;
      }
      if (payoutMethod === "upi" && !upiId.trim())
        return "Enter your UPI ID.";
      if (payoutMethod === "paypal" && !paypalEmail.trim())
        return "Enter your PayPal email.";
      if ((payoutMethod === "bank_in" || payoutMethod === "bank_int") && (!bankHolder.trim() || !bankAccount.trim() || !bankName.trim()))
        return "Enter complete bank account details.";
      if (payoutMethod === "bank_in" && !ifscCode.trim())
        return "Enter the IFSC code.";
      if (payoutMethod === "bank_int" && (!swiftCode.trim() || !ibanNumber.trim()))
        return "Enter SWIFT code and IBAN.";
    }
    if (s === 4) {
      if (!agreeAdult)     return "You must confirm you are 18 years or older.";
      if (!agreeCoc)       return "You must agree to the Code of Conduct.";
      if (!agreeDisclaimer)return "You must accept the platform disclaimer.";
      if (!agreePeer)      return "You must acknowledge the peer-support nature of this platform.";
      if (!agreeTax)       return "You must accept responsibility for tax obligations.";
    }
    if (s === 5) {
      if (!agreeInfoTrue)  return "You must confirm that all submitted information is true.";
      if (!digitalSignature.trim()) return "Please type your full name as a digital signature.";
    }
    return "";
  }

  function next() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(""); setStep(s => s + 1);
  }

  async function submit() {
    const err = validateStep(5);
    if (err) { setError(err); return; }
    setLoading(true); setError("");

    const payoutInfo: Record<string,string> = { method: payoutMethod };
    if (payoutMethod === "upi")     payoutInfo.upi_id = upiId.trim();
    if (payoutMethod === "paypal")  payoutInfo.paypal_email = paypalEmail.trim();
    if (payoutMethod === "bank_in" || payoutMethod === "bank_int") {
      payoutInfo.account_holder = bankHolder.trim();
      payoutInfo.account_number = bankAccount.trim();
      payoutInfo.bank_name      = bankName.trim();
      if (payoutMethod === "bank_in")  payoutInfo.ifsc_code  = ifscCode.trim();
      if (payoutMethod === "bank_int") { payoutInfo.swift_code = swiftCode.trim(); payoutInfo.iban = ibanNumber.trim(); }
    }

    try {
      const res = await fetch("/api/connect/consultant/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name:        displayName.trim(),
          gender,
          role_category:       roleCategory,
          contact_email:       contactEmail.trim(),
          contact_phone:       contactPhone.trim() ? `${countryCode}${contactPhone.trim()}` : "",
          website_url:         websiteUrl.trim() || null,
          social_links:        socialLinks.map(l => l.trim()).filter(Boolean),
          photo_url:           photoUrl.trim() || null,
          bio:                 bio.trim(),
          expertise_tags:      expertiseTags,
          languages,
          session_types:       sessionTypes,
          rate_per_min:        Number(ratePerMin),
          currency_code:       currency,
          availability_windows: availWindows.length > 0 ? availWindows : null,
          availability_note:   availWindows.length > 0 ? availWindows.map(windowLabel).join("; ") : null,
          verification_docs:   docs,
          payout_info:         payoutInfo,
          coc_agreed:          true,
          digital_signature:   digitalSignature.trim(),
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Submission failed. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  // ── Submitted ──────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
        <div className="imotara-glass-card w-full rounded-2xl p-8">
          <CheckCircle2 className="mx-auto mb-4 text-emerald-400" size={40} />
          <h1 className="text-xl font-semibold text-zinc-50">Application Submitted!</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Your application and documents are under review. You&apos;ll receive an email once approved or if we need more information.
          </p>
          <p className="mt-2 text-xs text-zinc-500">Document verification typically takes 2–5 business days.</p>
          <button onClick={() => router.push("/connect")}
            className="mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500">
            Back to Connect
          </button>
        </div>
      </main>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Apply</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Become a Wellness Companion</h1>
        <p className="mt-1 text-xs text-zinc-500">Step {step} of {TOTAL_STEPS}</p>
      </div>

      {/* Progress bar */}
      <div className="mb-6 flex gap-1.5">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(n => (
          <div key={n} className={`h-1.5 flex-1 rounded-full transition-all ${n <= step ? "bg-violet-500" : "bg-white/10"}`} />
        ))}
      </div>

      <div className="imotara-glass-card rounded-2xl p-6">

        {/* ══════════════════════════════════════════════════════════════
            STEP 1 — Basic Information
        ══════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-zinc-100">Basic Information</h2>

            {/* Display name */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">Display Name *</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name or alias"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500" />
            </div>

            {/* Gender */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">Gender *</label>
              <div className="flex gap-2">
                {(["female","male"] as const).map(g => (
                  <button key={g} type="button" onClick={() => setGender(g)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm transition ${gender === g ? "border-violet-500 bg-violet-500/20 font-medium text-violet-300" : "border-white/10 text-zinc-400 hover:border-white/20"}`}>
                    {g === "female" ? "👩 Female" : "👨 Male"}
                  </button>
                ))}
              </div>
            </div>

            {/* Role Category */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Role Category *
                <span className="ml-2 normal-case font-normal text-zinc-600">— defines the relationship type you will offer</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ROLE_CATEGORIES.map((rc) => {
                  const active = roleCategory === rc.key;
                  const locked = rc.phase > 1;
                  return (
                    <button
                      key={rc.key}
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && setRoleCategory(rc.key)}
                      className={`relative flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition
                        ${active ? "border-violet-500 bg-violet-500/15" : locked ? "border-white/5 opacity-50 cursor-not-allowed" : "border-white/10 hover:border-white/20 cursor-pointer"}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{rc.icon}</span>
                        <span className={`text-sm font-medium ${active ? "text-violet-300" : "text-zinc-300"}`}>{rc.label}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-tight">{rc.desc}</p>
                      {locked && (
                        <span className="absolute right-2 top-2 rounded-full bg-zinc-700/60 px-1.5 py-0.5 text-[9px] text-zinc-500">
                          Phase {rc.phase}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contact email */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">Contact Email *</label>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                placeholder="your@email.com — for Imotara admin use only, not shown to users"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500" />
            </div>

            {/* Contact phone */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">Contact Phone *</label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={e => setCountryCode(e.target.value)}
                  className="w-36 shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500"
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={`${c.code}-${c.name}`} value={c.code} className="bg-zinc-900">
                      {c.flag} {c.code}  {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="98765 43210 — for admin use only"
                  className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Website */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Website <span className="text-zinc-600 normal-case">(optional)</span>
              </label>
              <input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500" />
            </div>

            {/* Social media links */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Social Media <span className="text-zinc-600 normal-case">(optional — up to 5 links)</span>
              </label>
              <div className="space-y-2">
                {socialLinks.map((link, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="url" value={link} onChange={e => updateSocialLink(i, e.target.value)}
                      placeholder="https://instagram.com/you  or  linkedin.com/in/you"
                      className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500" />
                    {socialLinks.length > 1 && (
                      <button type="button" onClick={() => removeSocialLink(i)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-zinc-500 transition hover:border-rose-500/40 hover:text-rose-400">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
                {socialLinks.length < 5 && (
                  <button type="button" onClick={addSocialLink}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-violet-400">
                    <Plus size={11} /> Add another link
                  </button>
                )}
              </div>
            </div>

            {/* Profile photo */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Profile Photo <span className="text-zinc-600 normal-case">(optional — shown to users)</span>
              </label>
              <div className="mb-2 flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                <button type="button" onClick={() => { setPhotoMode("upload"); setUploadError(""); }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition ${photoMode === "upload" ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
                  <Upload size={11} /> Upload from PC
                </button>
                <button type="button" onClick={() => { setPhotoMode("url"); setUploadError(""); }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition ${photoMode === "url" ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
                  <Link2 size={11} /> Paste URL / Drive link
                </button>
              </div>
              {photoMode === "upload" && (
                <div>
                  <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  <button type="button" onClick={() => photoRef.current?.click()} disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/3 py-3 text-sm text-zinc-400 transition hover:border-violet-500/50 hover:text-zinc-200 disabled:opacity-50">
                    {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Choose photo (JPG, PNG, WebP — max 5 MB)</>}
                  </button>
                  {uploadError && <p className="mt-1.5 text-xs text-rose-400">{uploadError}</p>}
                </div>
              )}
              {photoMode === "url" && (
                <input value={photoUrl} onChange={e => { setPreviewError(false); setPhotoUrl(convertDriveUrl(e.target.value)); }}
                  placeholder="https://… or Google Drive share link"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500" />
              )}
              {photoUrl && (
                <div className="mt-3 flex items-center gap-3">
                  {previewError
                    ? <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] text-zinc-500">No preview</div>
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={photoUrl} alt="Preview" onError={() => setPreviewError(true)} onLoad={() => setPreviewError(false)} className="h-16 w-16 rounded-full border border-white/15 object-cover" />
                  }
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-zinc-400">{photoUrl}</p>
                    <button type="button" onClick={() => { setPhotoUrl(""); setPreviewError(false); }}
                      className="mt-1 flex items-center gap-1 text-[11px] text-rose-400 transition hover:text-rose-300">
                      <X size={10} /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Expertise */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Expertise Areas * <span className="text-zinc-600 normal-case">(select all that apply)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {EXPERTISE_OPTIONS.map(tag => (
                  <button key={tag} type="button"
                    onClick={() => setExpertiseTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag])}
                    className={`rounded-full border px-3 py-1 text-xs transition ${expertiseTags.includes(tag) ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-white/10 text-zinc-400 hover:border-white/20"}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Languages * <span className="text-zinc-600 normal-case">(select all you speak fluently)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map(l => (
                  <button key={l.code} type="button"
                    onClick={() => setLanguages(p => p.includes(l.code) ? p.filter(x => x !== l.code) : [...p, l.code])}
                    className={`rounded-full border px-3 py-1 text-xs transition ${languages.includes(l.code) ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-white/10 text-zinc-400 hover:border-white/20"}`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Session types */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Session Types * <span className="text-zinc-600 normal-case">(select all modalities you can offer)</span>
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {SESSION_TYPE_OPTIONS.map(opt => {
                  const active = sessionTypes.includes(opt.key);
                  return (
                    <button key={opt.key} type="button"
                      onClick={() => setSessionTypes(p => p.includes(opt.key) ? p.filter(x => x !== opt.key) : [...p, opt.key])}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-violet-500 bg-violet-500/15 text-violet-200"
                          : "border-white/10 bg-white/3 text-zinc-400 hover:border-white/20"
                      }`}>
                      <span className="text-2xl leading-none">{opt.icon}</span>
                      <div>
                        <p className="text-sm font-semibold">{opt.label}</p>
                        <p className="text-[11px] text-zinc-500">{opt.desc}</p>
                      </div>
                      {active && <span className="ml-auto shrink-0 text-violet-400">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 2 — Profile, Rate & Availability
        ══════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-zinc-100">Profile, Rate & Availability</h2>

            {/* Bio */}
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-widest text-zinc-500">
                <span>Bio / Experience *</span>
                <span className={bio.length > 450 ? "text-amber-400" : "text-zinc-600"}>{bio.length}/500</span>
              </label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500} rows={4}
                placeholder="Describe your background, approach, and what you offer as a wellness companion…"
                className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500" />
            </div>

            {/* Rate + currency */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">Rate per Minute *</label>
                <input type="number" min={0} step={0.5} value={ratePerMin} onChange={e => setRatePerMin(e.target.value)} placeholder="e.g. 5"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500" />
              </div>
              <div className="w-40">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">Currency *</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500">
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
            </div>
            {ratePerMin && Number(ratePerMin) > 0 && (
              <p className="text-xs text-zinc-500">
                Users pay {CURRENCIES.find(c => c.code === currency)?.label.split(" ")[0]}{Number(ratePerMin).toFixed(2)}/min.
                You earn 80% ({CURRENCIES.find(c => c.code === currency)?.label.split(" ")[0]}{(Number(ratePerMin) * 0.80).toFixed(2)}/min) after the 20% platform fee.
              </p>
            )}

            {/* Availability Schedule */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                <Clock size={11} /> Availability Schedule
                <span className="text-zinc-600 normal-case font-normal">(optional)</span>
              </label>
              <div className="mb-3">
                <p className="mb-1 text-[11px] uppercase tracking-widest text-zinc-500">Your Timezone</p>
                <select value={timezone} onChange={e => setTimezone(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500">
                  {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">Days of Week *</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map(d => (
                      <button key={d} type="button" onClick={() => setBDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${bDays.includes(d) ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-white/10 text-zinc-400 hover:border-white/25"}`}>
                        {DAY_ABBR[d]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                    Months <span className="text-zinc-600 normal-case font-normal">(leave empty = every month)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MONTHS_OF_YEAR.map(m => (
                      <button key={m} type="button" onClick={() => setBMonths(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m])}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${bMonths.includes(m) ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-white/10 text-zinc-400 hover:border-white/25"}`}>
                        {MONTH_ABBR[m]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">Year</p>
                  <div className="flex flex-wrap gap-1.5">
                    {YEAR_OPTIONS.map(y => (
                      <button key={y} type="button" onClick={() => setBYear(y)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${bYear === y ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-white/10 text-zinc-400 hover:border-white/25"}`}>
                        {y === "all" ? "Every year" : y}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">Time Range</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="mb-1 text-[10px] text-zinc-600">From</p>
                      <input type="time" value={bStart} onChange={e => setBStart(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500" />
                    </div>
                    <span className="mt-5 text-zinc-500">→</span>
                    <div className="flex-1">
                      <p className="mb-1 text-[10px] text-zinc-600">To</p>
                      <input type="time" value={bEnd} onChange={e => setBEnd(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500" />
                    </div>
                  </div>
                </div>
                {bError && <p className="text-xs text-rose-400">{bError}</p>}
                <button type="button" onClick={addWindow}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600/70 py-2.5 text-sm font-medium text-white transition hover:bg-violet-600">
                  <Plus size={14} /> Add Window
                </button>
              </div>
              {availWindows.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">Your Schedule</p>
                  {availWindows.map((w, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/5 px-3 py-2.5">
                      <p className="text-xs text-zinc-300">{windowLabel(w)}</p>
                      <button type="button" onClick={() => setAvailWindows(p => p.filter((_, idx) => idx !== i))} className="shrink-0 text-zinc-600 hover:text-rose-400 transition"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 3 — Verification Documents & Payout
        ══════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Identity & Document Verification</h2>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                All documents are stored securely and reviewed only by Imotara administrators. They are never shared with users.
                Accepted formats: JPG, PNG, WebP, PDF (max 10 MB each).
              </p>
            </div>

            {/* Document upload fields */}
            {DOC_FIELDS.map(({ key, label, hint }) => (
              <div key={key}>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">{label}</label>
                <p className="mb-2 text-[11px] text-zinc-600 leading-relaxed">{hint}</p>

                {/* Selfie: offer "same as profile photo" shortcut */}
                {key === "selfie" && (
                  <label className={`mb-2 flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selfieSameAsProfile ? "border-violet-500/40 bg-violet-500/8" : "border-white/10 bg-white/3 hover:bg-white/5"}`}>
                    <input
                      type="checkbox"
                      checked={selfieSameAsProfile}
                      className="accent-violet-500"
                      onChange={e => {
                        const checked = e.target.checked;
                        setSelfieSameAsProfile(checked);
                        if (checked && photoUrl) {
                          setDocs(p => ({ ...p, selfie: { path: "", name: "Same as profile photo", public_url: photoUrl, same_as_profile: true } }));
                        } else {
                          setDocs(p => { const n = {...p}; delete n["selfie"]; return n; });
                        }
                      }}
                    />
                    <div className="flex flex-1 items-center gap-2.5">
                      <span className="text-xs text-zinc-300">Same as profile photo above</span>
                      {photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoUrl} alt="Profile" className="h-7 w-7 rounded-full border border-white/15 object-cover" />
                      )}
                    </div>
                    {!photoUrl && (
                      <span className="text-[11px] text-zinc-600">Upload a profile photo in Step 1 to use this option</span>
                    )}
                  </label>
                )}

                {/* Hide file upload when selfie is set to "same as profile" */}
                {!(key === "selfie" && selfieSameAsProfile) && (
                  <>
                    <input
                      ref={el => { docRefs.current[key] = el; }}
                      type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => handleDocUpload(e, key)} />
                    {docs[key] && !docs[key]?.same_as_profile ? (
                      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                        <p className="min-w-0 flex-1 truncate text-xs text-emerald-300">{docs[key]?.name}</p>
                        <button type="button" onClick={() => setDocs(p => { const n = {...p}; delete n[key]; return n; })}
                          className="shrink-0 text-zinc-500 hover:text-rose-400 transition"><X size={13} /></button>
                      </div>
                    ) : !docs[key] ? (
                      <button type="button" onClick={() => docRefs.current[key]?.click()} disabled={docUploading[key]}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/3 py-3 text-sm text-zinc-400 transition hover:border-violet-500/50 hover:text-zinc-200 disabled:opacity-50">
                        {docUploading[key]
                          ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                          : <><FileText size={14} /> Upload {label.replace(" *","")}</>}
                      </button>
                    ) : null}
                  </>
                )}

                {/* Show confirmation when selfie = same as profile */}
                {key === "selfie" && selfieSameAsProfile && docs["selfie"] && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                    <p className="text-xs text-emerald-300">Using profile photo as verification selfie</p>
                  </div>
                )}

                {docError[key] && <p className="mt-1 text-xs text-rose-400">{docError[key]}</p>}
              </div>
            ))}

            {/* Payout Method */}
            <div>
              <h3 className="mb-1 text-base font-semibold text-zinc-100">Payout Method</h3>
              <p className="mb-3 text-xs text-zinc-500 leading-relaxed">
                Imotara pays out earnings every Monday for the prior week&apos;s completed sessions.
                Minimum threshold: ₹500 / $10. Platform commission: 20% (you keep 80%).
                Payouts are processed via <strong className="text-zinc-300">Razorpay Payouts</strong> (India) and
                <strong className="text-zinc-300"> PayPal Business</strong> (international).
              </p>

              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {([
                  { key:"upi",     label:"🇮🇳 UPI / RazorpayX", sub:"For India" },
                  { key:"paypal",  label:"🌐 PayPal",            sub:"International" },
                  { key:"bank_in", label:"🏦 Bank — NEFT/IMPS",  sub:"India" },
                  { key:"bank_int",label:"🏦 Wire / SWIFT",      sub:"International" },
                ] as const).map(opt => (
                  <button key={opt.key} type="button" onClick={() => setPayoutMethod(opt.key)}
                    className={`rounded-xl border p-3 text-left transition ${payoutMethod === opt.key ? "border-violet-500 bg-violet-500/15" : "border-white/10 hover:border-white/20"}`}>
                    <p className={`text-sm font-medium ${payoutMethod === opt.key ? "text-violet-300" : "text-zinc-300"}`}>{opt.label}</p>
                    <p className="text-[11px] text-zinc-500">{opt.sub}</p>
                  </button>
                ))}
              </div>

              {/* UPI */}
              {payoutMethod === "upi" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">UPI ID *</label>
                  <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi or yourname@okaxis"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500" />
                  <p className="mt-1.5 text-[11px] text-zinc-600">Payments via Razorpay Payouts. Ensure your UPI ID is active and linked to a valid bank account.</p>
                </div>
              )}

              {/* PayPal */}
              {payoutMethod === "paypal" && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">PayPal Business Email *</label>
                    <input type="email" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="your@paypal-business.com"
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500" />
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-300 leading-relaxed">
                    <strong>Important:</strong> A <strong>PayPal Business</strong> account is required to receive payments.
                    Personal PayPal accounts may have receiving limits or restrictions in some countries.
                    <a href="https://www.paypal.com/in/webapps/mpp/account-selection" target="_blank" rel="noreferrer"
                      className="ml-1 underline underline-offset-2 hover:text-amber-200">Upgrade to Business →</a>
                  </div>
                </div>
              )}

              {/* India Bank */}
              {payoutMethod === "bank_in" && (
                <div className="space-y-3">
                  {[
                    { label:"Account Holder Name *", value:bankHolder, set:setBankHolder, placeholder:"As per bank records" },
                    { label:"Account Number *",      value:bankAccount, set:setBankAccount, placeholder:"e.g. 1234567890" },
                    { label:"Bank Name *",           value:bankName, set:setBankName, placeholder:"e.g. SBI, HDFC, ICICI" },
                    { label:"IFSC Code *",           value:ifscCode, set:setIfscCode, placeholder:"e.g. SBIN0001234" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">{f.label}</label>
                      <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500" />
                    </div>
                  ))}
                </div>
              )}

              {/* International Wire */}
              {payoutMethod === "bank_int" && (
                <div className="space-y-3">
                  {[
                    { label:"Account Holder Name *", value:bankHolder, set:setBankHolder, placeholder:"As per bank records" },
                    { label:"Bank Name *",           value:bankName, set:setBankName, placeholder:"e.g. Barclays, Chase" },
                    { label:"IBAN / Account Number *", value:ibanNumber, set:setIbanNumber, placeholder:"e.g. GB29NWBK60161331926819" },
                    { label:"SWIFT / BIC Code *",    value:swiftCode, set:setSwiftCode, placeholder:"e.g. NWBKGB2L" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">{f.label}</label>
                      <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 4 — Code of Conduct & Legal Agreement
        ══════════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Code of Conduct & Legal Agreement</h2>
              <p className="mt-1 text-xs text-zinc-500">Please read carefully. All terms are legally binding.</p>
            </div>

            {/* Code of Conduct */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-4 text-xs text-zinc-300 leading-relaxed space-y-3 max-h-72 overflow-y-auto">
              <p className="font-semibold text-zinc-100 text-sm">Code of Conduct for Wellness Companions</p>

              <p><strong className="text-zinc-200">1. Peer Support Only.</strong> I am a peer wellness companion offering emotional support based on lived experience. I am NOT a licensed therapist, psychologist, psychiatrist, counsellor, or any regulated mental health professional unless I have declared and verified such credentials with Imotara. I will not represent or imply myself as a professional.</p>

              <p><strong className="text-zinc-200">2. No Clinical or Professional Advice.</strong> I will not provide medical, clinical, psychiatric, psychological, legal, financial, nutritional, or religious advice. I will not diagnose any condition, prescribe or suggest medications, recommend specific treatments, or provide any guidance that requires professional licensure.</p>

              <p><strong className="text-zinc-200">3. Crisis & Emergency Protocol.</strong> If a user expresses suicidal ideation, self-harm intentions, or any immediate risk to life, I will immediately and clearly direct them to local emergency services (India: 112 / iCall: 9152987821 / Vandrevala Foundation: 1860-2662-345; USA: 988 / 911; UK: 999 / 116123; Australia: 000 / Lifeline: 13 11 14) and report the session to Imotara. I will not attempt to manage a crisis alone.</p>

              <p><strong className="text-zinc-200">4. Personal Conduct & Boundaries.</strong> I will treat all users with dignity and unconditional respect. I will not make romantic, sexual, or intimate advances. I will maintain professional boundaries at all times and will not solicit or develop personal relationships outside the platform&apos;s intended purpose.</p>

              <p><strong className="text-zinc-200">5. Financial Integrity.</strong> I will not solicit money, gifts, loans, subscriptions, or any financial benefit from users outside the Imotara platform. All compensation must flow exclusively through Imotara&apos;s official payment system.</p>

              <p><strong className="text-zinc-200">6. Privacy & Confidentiality.</strong> I will keep all session content strictly confidential. I will not share, disclose, publish, or sell any user information, session recordings, or personal data to any third party, under any circumstances. I will not exchange personal contact details, social media handles, phone numbers, email addresses, or external communication channels with users.</p>

              <p><strong className="text-zinc-200">7. Geographic & Legal Compliance.</strong> I am solely responsible for ensuring that my activities comply with all applicable laws in my jurisdiction, including but not limited to: professional licensing and registration requirements, data protection laws (India DPDP Act 2023, GDPR, CCPA), consumer protection laws (India Consumer Protection Act 2019), and the Indian Mental Healthcare Act 2017. Imotara does not guarantee compliance with the laws of every jurisdiction.</p>

              <p><strong className="text-zinc-200">8. Tax Obligations.</strong> All earnings received through Imotara constitute taxable income in most jurisdictions. I am solely and exclusively responsible for declaring, reporting, and remitting all applicable taxes — including income tax, GST, VAT, self-employment tax, or any other applicable levy — to the relevant tax authority in my jurisdiction. Imotara may deduct Tax Deducted at Source (TDS) for Indian companions as required by Indian law.</p>

              <p><strong className="text-zinc-200">9. Indemnification.</strong> I agree to fully indemnify, defend, and hold harmless Imotara Technologies and its parent companies, subsidiaries, affiliates, officers, directors, shareholders, employees, contractors, and agents from and against any and all claims, liabilities, damages, losses, penalties, fines, and legal expenses (including reasonable attorney fees) arising from: (a) any service I provide through the platform; (b) my violation of these terms or applicable law; (c) any misrepresentation I make regarding my qualifications; (d) any third-party claim arising from my conduct on the platform.</p>

              <p><strong className="text-zinc-200">10. Platform Authority.</strong> Imotara reserves the right to suspend, restrict, or permanently terminate my account at any time, for any violation of these terms, at its sole discretion, with or without prior notice, without liability to me.</p>

              <p><strong className="text-zinc-200">11. Governing Law & Dispute Resolution.</strong> These terms are governed exclusively by the laws of India. Any dispute arising from this agreement shall first be attempted through good-faith mediation. If unresolved within 30 days, it shall be submitted to binding arbitration under the Arbitration and Conciliation Act, 1996 (India), seated in Kolkata, West Bengal, India. The language of arbitration shall be English.</p>
            </div>

            {/* Platform Disclaimer */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-zinc-300 leading-relaxed space-y-3 max-h-56 overflow-y-auto">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                <p className="font-semibold text-amber-200 text-sm">Platform Disclaimer & Limitation of Liability</p>
              </div>

              <p><strong className="text-zinc-200">Non-Medical Service.</strong> Imotara Connect is a technology platform facilitating peer-to-peer emotional wellness conversations. It is NOT a healthcare provider, medical service, mental health clinic, hospital, psychological service, or regulated therapeutic service. It is NOT regulated as a healthcare entity in any jurisdiction. Sessions on Imotara Connect do not constitute professional therapy, counselling, psychotherapy, clinical treatment, or any regulated health service.</p>

              <p><strong className="text-zinc-200">No Professional Relationship.</strong> No professional-client, doctor-patient, therapist-client, or fiduciary relationship is formed between companions and users, or between Imotara and users or companions.</p>

              <p><strong className="text-zinc-200">Limitation of Liability.</strong> To the maximum extent permitted by applicable law, Imotara Technologies shall not be liable for: (a) any physical, psychological, or financial harm arising from sessions; (b) decisions made by users based on conversations with companions; (c) the quality, accuracy, completeness, or appropriateness of any companion&apos;s statements; (d) technical failures, service interruptions, data loss, or breaches; (e) any direct, indirect, incidental, special, punitive, or consequential damages, even if Imotara was advised of the possibility of such damages. Imotara&apos;s aggregate liability, if any, shall not exceed the total platform fees collected from the relevant session.</p>

              <p><strong className="text-zinc-200">Companion Independence.</strong> Companions are independent contractors and not employees, agents, partners, or representatives of Imotara. Imotara does not supervise, endorse, validate, or guarantee the qualifications, credentials, or the quality of any companion&apos;s services.</p>

              <p><strong className="text-zinc-200">Geographic Restrictions.</strong> The platform is intended for use in jurisdictions where peer wellness support services are legally permitted. Companions are solely responsible for ensuring their activities comply with applicable local laws, including professional licensing requirements. Imotara makes no representation that the platform is lawful to use in all locations.</p>

              <p><strong className="text-zinc-200">Emergency Situations.</strong> Neither Imotara nor its companions are equipped to handle psychiatric or medical emergencies. In any crisis situation, users and companions must contact local emergency services immediately.</p>

              <p><strong className="text-zinc-200">Governing Law.</strong> This disclaimer and the platform&apos;s terms of service are governed by the laws of India, including the Information Technology Act 2000 (as amended), the Indian Contract Act 1872, and applicable consumer protection legislation.</p>
            </div>

            {/* Consent checkboxes */}
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Your Agreement (all required)</p>

              {[
                { state: agreeAdult,     set: setAgreeAdult,      text: "I confirm that I am 18 years of age or older. I understand that minors are not permitted to register as companions." },
                { state: agreeCoc,       set: setAgreeCoc,        text: "I have read, understood, and agree to abide by the Imotara Wellness Companion Code of Conduct in its entirety." },
                { state: agreeDisclaimer,set: setAgreeDisclaimer, text: "I have read and accept the Platform Disclaimer and Limitation of Liability, and agree that Imotara bears no responsibility for outcomes of sessions I conduct." },
                { state: agreePeer,      set: setAgreePeer,       text: "I understand and acknowledge that Imotara Connect is a peer support platform only — not a medical, clinical, or therapeutic service — and I will clearly communicate this to users during sessions." },
                { state: agreeTax,       set: setAgreeTax,        text: "I accept full responsibility for declaring and paying all applicable taxes on earnings received through Imotara in my jurisdiction, and indemnify Imotara against any tax-related claims." },
              ].map((item, i) => (
                <label key={i} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 transition hover:bg-white/8">
                  <input type="checkbox" checked={item.state} onChange={e => item.set(e.target.checked)} className="mt-0.5 shrink-0 accent-violet-500" />
                  <span className="text-xs text-zinc-300 leading-relaxed">{item.text}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 5 — Review & Sign
        ══════════════════════════════════════════════════════════════ */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Review & Sign</h2>
              <p className="mt-1 text-xs text-zinc-500">Please verify all details before submitting. Once signed, your application is binding.</p>
            </div>

            {/* ── Personal Info ── */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Personal Information</p>
              <div className="flex items-center gap-3">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Profile" className="h-12 w-12 rounded-full object-cover border border-white/15" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg">👤</div>
                )}
                <div>
                  <p className="font-medium text-zinc-100">{displayName}</p>
                  <p className="text-xs text-zinc-500 capitalize">{gender}</p>
                  <p className="text-xs text-violet-400">{ROLE_CATEGORIES.find(r => r.key === roleCategory)?.label ?? roleCategory}</p>
                </div>
              </div>
              <ReviewRow label="Contact Email" value={contactEmail} />
              <ReviewRow label="Contact Phone" value={`${countryCode} ${contactPhone}`} />
              {websiteUrl && <ReviewRow label="Website" value={websiteUrl} />}
              {socialLinks.filter(Boolean).length > 0 && (
                <ReviewRow label="Social Links" value={socialLinks.filter(Boolean).join(", ")} />
              )}
              <ReviewRow label="Expertise" value={expertiseTags.join(", ") || "—"} />
              <ReviewRow label="Languages" value={languages.map(c => LANGUAGE_OPTIONS.find(l => l.code === c)?.label ?? c).join(", ") || "—"} />
              <ReviewRow label="Session Types" value={sessionTypes.map(k => SESSION_TYPE_OPTIONS.find(o => o.key === k)?.label ?? k).join(", ") || "—"} ok={sessionTypes.length > 0 ? undefined : false} />
            </div>

            {/* ── Profile & Rate ── */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Profile & Rate</p>
              <p className="text-xs text-zinc-300 leading-relaxed">{bio}</p>
              <ReviewRow label="Rate" value={`${CURRENCIES.find(c => c.code === currency)?.label.split(" ")[0]}${Number(ratePerMin).toFixed(2)} / min (${currency})`} />
              {availWindows.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] text-zinc-500">Availability</p>
                  <div className="space-y-1">
                    {availWindows.map((w, i) => (
                      <p key={i} className="text-xs text-zinc-400">{windowLabel(w)}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Documents & Payout ── */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Documents & Payout</p>
              {DOC_FIELDS.map(f => {
                const doc = docs[f.key];
                return (
                  <ReviewRow key={f.key}
                    label={f.label.replace(" *","")}
                    value={doc ? (doc.same_as_profile ? "Same as profile photo" : doc.name) : "—"}
                    ok={!!doc}
                  />
                );
              })}
              <ReviewRow label="Payout Method" value={
                payoutMethod === "upi"      ? `UPI — ${upiId}` :
                payoutMethod === "paypal"   ? `PayPal — ${paypalEmail}` :
                payoutMethod === "bank_in"  ? `Bank (India) — ${bankName}` :
                                             `International Wire — ${bankName}`
              } />
            </div>

            {/* ── Legal ── */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Legal Agreements</p>
              {[
                { ok: agreeAdult,      label: "18+ age confirmation" },
                { ok: agreeCoc,        label: "Code of Conduct agreed" },
                { ok: agreeDisclaimer, label: "Platform Disclaimer accepted" },
                { ok: agreePeer,       label: "Peer-support nature acknowledged" },
                { ok: agreeTax,        label: "Tax responsibility accepted" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={item.ok ? "text-emerald-400" : "text-rose-400"}>{item.ok ? "✓" : "✗"}</span>
                  <span className="text-xs text-zinc-400">{item.label}</span>
                </div>
              ))}
            </div>

            {/* ── Attestation & Digital Signature ── */}
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Declaration & Digital Signature</p>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 transition hover:bg-white/8">
                <input type="checkbox" checked={agreeInfoTrue} onChange={e => setAgreeInfoTrue(e.target.checked)}
                  className="mt-0.5 shrink-0 accent-violet-500" />
                <span className="text-xs text-zinc-200 leading-relaxed">
                  I solemnly declare that all information I have submitted in this application — including my personal details, credentials, documents, and availability — is <strong>true, accurate, and complete</strong> to the best of my knowledge and belief. I am submitting this application consciously, voluntarily, and with full awareness of its legal implications. I understand that any false or misleading information may result in immediate termination of my account and may expose me to legal liability.
                </span>
              </label>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-400">
                  Digital Signature — Type your full legal name *
                </label>
                <input
                  value={digitalSignature}
                  onChange={e => setDigitalSignature(e.target.value)}
                  placeholder="Your full name exactly as on your ID"
                  className="w-full rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 text-base italic text-violet-200 placeholder-zinc-600 outline-none focus:border-violet-400"
                  style={{ fontFamily: "'Georgia', serif" }}
                />
                {digitalSignature.trim() && (
                  <p className="mt-1.5 text-[11px] text-zinc-500">
                    Signed as: <span className="italic text-violet-300">{digitalSignature.trim()}</span> · {new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex gap-3">
          {step > 1 && (
            <button type="button" onClick={() => { setError(""); setStep(s => s - 1); }}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-400 transition hover:text-zinc-200">
              <ChevronLeft size={14} /> Back
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button type="button" onClick={next}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500">
              Continue <ChevronRight size={14} />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Submit Application
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
