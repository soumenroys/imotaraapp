// src/app/connect/register/page.tsx
// Multi-step consultant registration form (3 steps).
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ChevronRight, ChevronLeft, Upload } from "lucide-react";

const EXPERTISE_OPTIONS = [
  "Stress & Anxiety", "Loneliness", "Grief & Loss", "Relationship Issues",
  "Work & Career Pressure", "Self-Esteem", "Family Conflicts", "Life Transitions",
  "Emotional Regulation", "Mindfulness", "General Wellness",
];

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" }, { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" }, { code: "mr", label: "Marathi" },
  { code: "ta", label: "Tamil" },  { code: "te", label: "Telugu" },
  { code: "gu", label: "Gujarati" }, { code: "pa", label: "Punjabi" },
  { code: "kn", label: "Kannada" }, { code: "ml", label: "Malayalam" },
  { code: "ur", label: "Urdu" },   { code: "ar", label: "Arabic" },
  { code: "es", label: "Spanish" }, { code: "fr", label: "French" },
  { code: "de", label: "German" }, { code: "pt", label: "Portuguese" },
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

const COC_TEXT =
  "I will not provide clinical, medical, or legal advice; will not make romantic or sexual advances; " +
  "will not solicit money outside the platform. Violations result in immediate suspension.";

export default function RegisterConsultantPage() {
  const router = useRouter();
  const [step, setStep]   = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Step 1
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender]           = useState<"male" | "female" | "">("");
  const [photoUrl, setPhotoUrl]       = useState("");
  const [expertiseTags, setExpertiseTags] = useState<string[]>([]);
  const [languages, setLanguages]     = useState<string[]>([]);

  // Step 2
  const [bio, setBio]                   = useState("");
  const [ratePerMin, setRatePerMin]     = useState("");
  const [currency, setCurrency]         = useState("INR");
  const [availabilityNote, setAvailNote] = useState("");

  // Step 3
  const [cocAgreed, setCocAgreed] = useState(false);

  function toggleTag(tag: string) {
    setExpertiseTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function toggleLang(code: string) {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  }

  function validateStep(s: number): string {
    if (s === 1) {
      if (!displayName.trim()) return "Display name is required.";
      if (!gender) return "Please select your gender.";
      if (expertiseTags.length === 0) return "Select at least one expertise area.";
      if (languages.length === 0) return "Select at least one language.";
    }
    if (s === 2) {
      if (bio.trim().length < 30) return "Bio must be at least 30 characters.";
      if (bio.length > 500) return "Bio must be 500 characters or less.";
      if (!ratePerMin || isNaN(Number(ratePerMin)) || Number(ratePerMin) <= 0) {
        return "Enter a valid rate per minute (must be greater than 0).";
      }
    }
    if (s === 3) {
      if (!cocAgreed) return "You must agree to the Code of Conduct to apply.";
    }
    return "";
  }

  function next() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => s + 1);
  }

  async function submit() {
    const err = validateStep(3);
    if (err) { setError(err); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/connect/consultant/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name:     displayName.trim(),
          gender,
          photo_url:        photoUrl.trim() || null,
          bio:              bio.trim(),
          expertise_tags:   expertiseTags,
          languages,
          rate_per_min:     Number(ratePerMin),
          currency_code:    currency,
          availability_note: availabilityNote.trim() || null,
          coc_agreed:       true,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!data.ok) {
        if (data.status) {
          setError(`An application already exists with status: ${data.status}`);
        } else {
          setError(data.error ?? "Submission failed. Please try again.");
        }
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
        <div className="imotara-glass-card w-full rounded-2xl p-8">
          <CheckCircle2 className="mx-auto mb-4 text-emerald-400" size={40} />
          <h1 className="text-xl font-semibold text-zinc-50">Application Submitted!</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Your application is under review. You&apos;ll receive an email once it has been approved or if we need more information.
          </p>
          <p className="mt-2 text-xs text-zinc-500">This usually takes 1–3 business days.</p>
          <button
            onClick={() => router.push("/connect")}
            className="mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            Back to Connect
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Apply</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Become a Wellness Companion</h1>
      </div>

      {/* Progress */}
      <div className="mb-6 flex gap-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              n <= step ? "bg-violet-500" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <div className="imotara-glass-card rounded-2xl p-6">

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-zinc-100">Basic Information</h2>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Display Name *
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name or alias"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Gender *
              </label>
              <div className="flex gap-2">
                {(["female", "male"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm transition ${
                      gender === g
                        ? "border-violet-500 bg-violet-500/20 font-medium text-violet-300"
                        : "border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    {g === "female" ? "👩 Female" : "👨 Male"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Profile Photo URL <span className="text-zinc-600">(optional)</span>
              </label>
              <input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Expertise Areas * <span className="text-zinc-600 normal-case">(select all that apply)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {EXPERTISE_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      expertiseTags.includes(tag)
                        ? "border-violet-500 bg-violet-500/20 text-violet-300"
                        : "border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Languages * <span className="text-zinc-600 normal-case">(select all you speak fluently)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => toggleLang(l.code)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      languages.includes(l.code)
                        ? "border-violet-500 bg-violet-500/20 text-violet-300"
                        : "border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-zinc-100">Profile & Rate</h2>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-widest text-zinc-500">
                <span>Bio / Experience *</span>
                <span className={bio.length > 450 ? "text-amber-400" : "text-zinc-600"}>
                  {bio.length}/500
                </span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={5}
                placeholder="Describe your background, approach, and what you offer as a wellness companion…"
                className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                  Rate per Minute *
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={ratePerMin}
                  onChange={(e) => setRatePerMin(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
                />
              </div>
              <div className="w-40">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                  Currency *
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {ratePerMin && Number(ratePerMin) > 0 && (
              <p className="text-xs text-zinc-500">
                Users pay {CURRENCIES.find((c) => c.code === currency)?.label.split(" ")[0]}{Number(ratePerMin).toFixed(2)}/min.
                You earn 80% per minute ({CURRENCIES.find((c) => c.code === currency)?.label.split(" ")[0]}{(Number(ratePerMin) * 0.80).toFixed(2)}/min).
              </p>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
                Availability Note <span className="text-zinc-600 normal-case">(optional)</span>
              </label>
              <input
                value={availabilityNote}
                onChange={(e) => setAvailNote(e.target.value)}
                placeholder="e.g. Weekday evenings IST, 7–9 PM"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
              />
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-zinc-100">Code of Conduct</h2>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-zinc-300">
              <p className="mb-2 font-medium text-zinc-100">As an Imotara Wellness Companion, I agree that:</p>
              <p>{COC_TEXT}</p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/8">
              <input
                type="checkbox"
                checked={cocAgreed}
                onChange={(e) => setCocAgreed(e.target.checked)}
                className="mt-0.5 accent-violet-500"
              />
              <span className="text-sm text-zinc-200">
                I have read and agree to Imotara&apos;s Code of Conduct. I understand violations result in immediate suspension.
              </span>
            </label>

            <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/60 p-4 text-xs text-zinc-400 leading-relaxed">
              <strong className="text-zinc-300">Review & Disclaimer:</strong> Imotara Connect provides peer wellness companionship only. As a companion, you are not a licensed therapist. Do not provide clinical, medical, or legal advice. Always encourage users to seek professional help for serious mental health concerns.
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
            <button
              onClick={() => { setError(""); setStep((s) => s - 1); }}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-400 transition hover:text-zinc-200"
            >
              <ChevronLeft size={14} />
              Back
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={next}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Continue
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Submit Application
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
