// src/components/connect/ConsultantCard.tsx
"use client";

import { useState } from "react";
import { Star, Globe, CircleDot, MessageCircle, Mic, Video } from "lucide-react";
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
  is_online: boolean;
  rating_avg: number;
  rating_count: number;
  sessions_completed: number;
}

interface Props {
  consultant: Consultant;
  razorpayKeyId: string;
  onTalkNow: (consultantId: string) => void;
  onRequestMeeting: (consultantId: string) => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", AUD: "A$",
};

const DISCLAIMER =
  "Imotara Connect provides peer wellness companionship only. Companions are not licensed therapists or medical professionals.";

export default function ConsultantCard({ consultant, razorpayKeyId, onTalkNow, onRequestMeeting }: Props) {
  const [showRecharge, setShowRecharge] = useState(false);
  const sym = CURRENCY_SYMBOLS[consultant.currency_code] ?? consultant.currency_code;

  return (
    <>
      <div className="imotara-glass-card flex flex-col rounded-2xl p-5 shadow-lg transition hover:shadow-xl">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
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
            {consultant.is_online && (
              <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 bg-emerald-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-zinc-50">{consultant.display_name}</h3>
              {consultant.is_online ? (
                <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  Online
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-500">
                  Offline
                </span>
              )}
            </div>

            {consultant.role_category && (
              <div className="mt-0.5">
                <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-400">
                  {ROLE_CATEGORY_LABELS[consultant.role_category] ?? consultant.role_category}
                </span>
              </div>
            )}

            <div className="mt-0.5 flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                <span className="text-xs font-medium text-zinc-300">
                  {consultant.rating_avg > 0 ? consultant.rating_avg.toFixed(1) : "New"}
                </span>
                {consultant.rating_count > 0 && (
                  <span className="text-xs text-zinc-500">({consultant.rating_count})</span>
                )}
              </div>
              <span className="text-zinc-600">·</span>
              <span className="text-xs text-zinc-400">{consultant.sessions_completed} sessions</span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-base font-semibold text-violet-300">{sym}{consultant.rate_per_min}</p>
            <p className="text-xs text-zinc-500">/min</p>
          </div>
        </div>

        {/* Bio */}
        {consultant.bio && (
          <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-zinc-300">{consultant.bio}</p>
        )}

        {/* Tags */}
        {consultant.expertise_tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {consultant.expertise_tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-zinc-400 border border-white/8">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Languages */}
        {consultant.languages.length > 0 && (
          <div className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500">
            <Globe size={11} />
            <span>{consultant.languages.slice(0, 3).join(", ")}</span>
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
        <div className="flex gap-2">
          {consultant.is_online ? (
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

        {/* Non-clinical disclaimer */}
        <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">{DISCLAIMER}</p>
      </div>

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
