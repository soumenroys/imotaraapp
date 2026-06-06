// src/components/connect/ConsultantCard.tsx
"use client";

import { useState } from "react";
import { Star, Globe, CircleDot, MessageCircle, Mic, Video, Heart, X, Loader2, Clock } from "lucide-react";
import RechargeModal from "./RechargeModal";

const ROLE_CATEGORY_LABELS: Record<string, string> = {
  wellness_companion: "🧘 Wellness Companion",
  friend:             "🤝 Friend",
  dad:                "👨 Dad",
  mom:                "👩 Mom",
  sister:             "👧 Sister",
  brother:            "👦 Brother",
  grandfather:        "👴 Grandfather",
  grandmother:        "👵 Grandmother",
  yoga_instructor:    "🧘 Yoga Instructor",
  fitness_companion:  "💪 Fitness Companion",
};

const LANGUAGE_MAP: Record<string, string> = {
  en: "English", hi: "Hindi",    bn: "Bengali",    mr: "Marathi",
  ta: "Tamil",   te: "Telugu",   gu: "Gujarati",   pa: "Punjabi",
  kn: "Kannada", ml: "Malayalam",ur: "Urdu",       ar: "Arabic",
  es: "Spanish", fr: "French",   de: "German",     pt: "Portuguese",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", AUD: "A$",
};

interface Consultant {
  id: string;
  display_name: string;
  gender: "male" | "female" | null;
  photo_url: string | null;
  bio: string | null;
  expertise_tags: string[];
  languages: string[];
  session_types: string[];
  role_category: string;
  rate_per_min: number;
  currency_code: string;
  availability_note: string | null;
  is_online: boolean;
  is_busy: boolean;
  rating_avg: number;
  rating_count: number;
  sessions_completed: number;
}

interface Props {
  consultant: Consultant;
  razorpayKeyId: string;
  isFavorite?: boolean;
  favLoading?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  onTalkNow: (consultantId: string) => void;
  onRequestMeeting: (consultantId: string) => void;
}

export default function ConsultantCard({
  consultant, razorpayKeyId, isFavorite, favLoading, onToggleFavorite,
  onTalkNow, onRequestMeeting,
}: Props) {
  const [showRecharge, setShowRecharge] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const sym = CURRENCY_SYMBOLS[consultant.currency_code] ?? consultant.currency_code;
  const langNames = consultant.languages.map((c) => LANGUAGE_MAP[c] ?? c);

  return (
    <>
      {/* ── Card ── */}
      <div
        className="imotara-glass-card flex flex-col rounded-2xl p-5 shadow-lg transition hover:shadow-xl cursor-pointer"
        onClick={() => setShowProfile(true)}
      >
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            {consultant.photo_url ? (
              <img
                src={consultant.photo_url}
                alt={consultant.display_name}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-white/10"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/20 text-2xl ring-2 ring-white/10">
                {consultant.gender === "female" ? "👩" : "👨"}
              </div>
            )}
            {/* Online dot */}
            <span className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 ${consultant.is_online ? "bg-emerald-400" : "bg-zinc-600"}`} />
          </div>

          {/* Name / role / rating */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-base font-semibold text-zinc-50 leading-snug">{consultant.display_name}</h3>
              {consultant.is_busy ? (
                <span className="shrink-0 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-400">In Session</span>
              ) : consultant.is_online ? (
                <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">● Online</span>
              ) : (
                <span className="shrink-0 rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-500">Offline</span>
              )}
            </div>

            {consultant.role_category && (
              <span className="mt-0.5 inline-block rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-400">
                {ROLE_CATEGORY_LABELS[consultant.role_category] ?? consultant.role_category}
              </span>
            )}

            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <Star size={11} className="fill-amber-400 text-amber-400" />
              <span className="font-medium text-zinc-300">
                {consultant.rating_avg > 0 ? consultant.rating_avg.toFixed(1) : "New"}
              </span>
              {consultant.rating_count > 0 && (
                <span className="text-zinc-500">({consultant.rating_count})</span>
              )}
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400">{consultant.sessions_completed} sessions</span>
            </div>
          </div>

          {/* Price + heart — right column */}
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {onToggleFavorite && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(e); }}
                disabled={favLoading}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-zinc-400 transition hover:text-rose-400"
                title={isFavorite ? "Remove from favorites" : "Save to favorites"}
              >
                {favLoading
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Heart size={13} className={isFavorite ? "fill-rose-400 text-rose-400" : ""} />
                }
              </button>
            )}
            <div className="text-right">
              <p className="text-base font-semibold text-violet-300">{sym}{consultant.rate_per_min}</p>
              <p className="text-xs text-zinc-500">/min</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        {consultant.bio && (
          <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-zinc-300">{consultant.bio}</p>
        )}

        {/* Expertise tags */}
        {consultant.expertise_tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {consultant.expertise_tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-zinc-400 border border-white/8">
                {tag}
              </span>
            ))}
            {consultant.expertise_tags.length > 4 && (
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-zinc-500 border border-white/8">
                +{consultant.expertise_tags.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Languages */}
        {langNames.length > 0 && (
          <div className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500">
            <Globe size={11} />
            <span>{langNames.slice(0, 3).join(" · ")}</span>
            {langNames.length > 3 && <span>+{langNames.length - 3}</span>}
          </div>
        )}

        {/* Session types */}
        {(consultant.session_types ?? []).length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(consultant.session_types ?? []).map((t) => (
              <span key={t} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                t === "chat"  ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                : t === "audio" ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-violet-500/30 bg-violet-500/10 text-violet-400"
              }`}>
                {t === "chat" ? <MessageCircle size={9} /> : t === "audio" ? <Mic size={9} /> : <Video size={9} />}
                {t === "chat" ? "Chat" : t === "audio" ? "Audio" : "Video"}
              </span>
            ))}
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {consultant.is_online && !consultant.is_busy ? (
            <button
              onClick={() => onTalkNow(consultant.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              <CircleDot size={14} />
              Talk Now
            </button>
          ) : (
            <button
              onClick={() => onRequestMeeting(consultant.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
            >
              <MessageCircle size={14} />
              Request Meeting
            </button>
          )}
          <button
            onClick={() => setShowRecharge(true)}
            className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2.5 text-sm font-medium text-violet-400 transition hover:bg-violet-500/20"
            title="Add balance"
          >
            + Balance
          </button>
        </div>
      </div>

      {/* ── Profile modal ── */}
      {showProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowProfile(false)}
        >
          <div
            className="imotara-glass-card w-full max-w-md rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start gap-4 mb-5">
              <div className="relative shrink-0">
                {consultant.photo_url ? (
                  <img src={consultant.photo_url} alt={consultant.display_name}
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-white/10" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/20 text-4xl ring-2 ring-white/10">
                    {consultant.gender === "female" ? "👩" : "👨"}
                  </div>
                )}
                <span className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 ${consultant.is_online ? "bg-emerald-400" : "bg-zinc-600"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-zinc-50">{consultant.display_name}</h2>
                {consultant.role_category && (
                  <span className="inline-block mt-0.5 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-400">
                    {ROLE_CATEGORY_LABELS[consultant.role_category] ?? consultant.role_category}
                  </span>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {consultant.is_busy ? (
                    <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[11px] font-medium text-orange-400">In Session</span>
                  ) : consultant.is_online ? (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400">● Online now</span>
                  ) : (
                    <span className="rounded-full bg-zinc-700/50 px-2 py-0.5 text-[11px] text-zinc-500">Offline</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-400">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  <span>{consultant.rating_avg > 0 ? consultant.rating_avg.toFixed(1) : "New"}</span>
                  {consultant.rating_count > 0 && <span className="text-zinc-500">({consultant.rating_count} reviews)</span>}
                  <span className="text-zinc-600">·</span>
                  <span>{consultant.sessions_completed} sessions</span>
                </div>
              </div>
              <button onClick={() => setShowProfile(false)}
                className="shrink-0 rounded-full p-1.5 text-zinc-500 hover:text-zinc-300 transition">
                <X size={18} />
              </button>
            </div>

            {/* Price */}
            <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-zinc-400">Rate</span>
              <span className="text-xl font-bold text-violet-300">{sym}{consultant.rate_per_min}<span className="text-sm font-normal text-zinc-500">/min</span></span>
            </div>

            {/* Bio */}
            {consultant.bio && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">About</p>
                <p className="text-sm leading-relaxed text-zinc-300">{consultant.bio}</p>
              </div>
            )}

            {/* Specialties */}
            {consultant.expertise_tags.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">Specialties</p>
                <div className="flex flex-wrap gap-1.5">
                  {consultant.expertise_tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/5 border border-white/8 px-2.5 py-0.5 text-[11px] text-zinc-400">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {langNames.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">Languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {langNames.map((l) => (
                    <span key={l} className="rounded-full bg-white/5 border border-white/8 px-2.5 py-0.5 text-[11px] text-zinc-400">{l}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Session types */}
            {(consultant.session_types ?? []).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">Session Types</p>
                <div className="flex flex-wrap gap-1.5">
                  {(consultant.session_types ?? []).map((t) => (
                    <span key={t} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      t === "chat"  ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                      : t === "audio" ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-violet-500/30 bg-violet-500/10 text-violet-400"
                    }`}>
                      {t === "chat" ? <MessageCircle size={10} /> : t === "audio" ? <Mic size={10} /> : <Video size={10} />}
                      {t === "chat" ? "Text Chat" : t === "audio" ? "Audio Call" : "Video Call"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Availability note */}
            {consultant.availability_note && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">Availability</p>
                <div className="flex items-start gap-2 text-sm text-zinc-400">
                  <Clock size={13} className="mt-0.5 shrink-0" />
                  <span>{consultant.availability_note}</span>
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="flex gap-2 mt-2">
              {consultant.is_online && !consultant.is_busy ? (
                <button
                  onClick={() => { setShowProfile(false); onTalkNow(consultant.id); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  <CircleDot size={14} />
                  Talk Now
                </button>
              ) : (
                <button
                  onClick={() => { setShowProfile(false); onRequestMeeting(consultant.id); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
                >
                  <MessageCircle size={14} />
                  Request Meeting
                </button>
              )}
              <button
                onClick={() => { setShowProfile(false); setShowRecharge(true); }}
                className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2.5 text-sm font-medium text-violet-400 transition hover:bg-violet-500/20"
              >
                + Balance
              </button>
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-zinc-600">
              Imotara Connect provides peer wellness companionship only. Companions are not licensed therapists or medical professionals.
            </p>
          </div>
        </div>
      )}

      {showRecharge && (
        <RechargeModal
          consultant={consultant}
          razorpayKeyId={razorpayKeyId}
          onSuccess={() => setShowRecharge(false)}
          onClose={() => setShowRecharge(false)}
        />
      )}
    </>
  );
}
