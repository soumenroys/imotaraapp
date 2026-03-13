// src/app/chat/page.tsx
"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Download,
  Eraser,
  RefreshCw,
  Mic,
  MicOff,
  Search,
  X as XIcon,
  Star,
  Wind,
} from "lucide-react";
import Toast, { type ToastType } from "@/components/imotara/Toast";
import BreathingWidget from "@/components/imotara/BreathingWidget";
import MoodSummaryCard from "@/components/imotara/MoodSummaryCard";
import type { AppMessage } from "@/lib/imotara/useAnalysis";
import { syncHistory } from "@/lib/imotara/syncHistoryAdapter";
import ConflictReviewButton from "@/components/imotara/ConflictReviewButton";
import AnalysisConsentToggle from "@/components/imotara/AnalysisConsentToggle";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";
import type { AnalysisResult } from "@/types/analysis";
import { runLocalAnalysis } from "@/lib/imotara/runLocalAnalysis";
import { runAnalysisWithConsent } from "@/lib/imotara/runAnalysisWithConsent";
import { runRespondWithConsent } from "@/lib/imotara/runRespondWithConsent";
import { saveSample } from "@/lib/imotara/history";
import type { Emotion } from "@/types/history";
import TopBar from "@/components/imotara/TopBar";
import { buildTeenInsight } from "@/lib/imotara/buildTeenInsight";
import ReplyOriginBadge from "@/components/imotara/ReplyOriginBadge";
import { getChatToneCopy } from "@/lib/imotara/chatTone";
import { adaptReflectionTone } from "@/lib/imotara/reflectionTone";
import { getReflectionSeedCard } from "@/lib/imotara/reflectionSeedContract";
import type { ReflectionSeed } from "@/lib/ai/response/responseBlueprint";
import { buildLocalReply } from "@/lib/ai/local/localReplyEngine";
import {
  getImotaraProfile,
  isCompanionContextEnabled,
  type ImotaraProfileV1,
} from "@/lib/imotara/profile";
import { deriveResponseToneFromToneContext, buildEmotionMemorySummary } from "@/lib/imotara/promptProfile";
import { debugDetectEmotion } from "@/lib/emotion/keywordMaps";
import { detectAdultContent, buildAdultSafetyRefusal } from "@/lib/safety/adultContentGuard";
import { hapticTap, hapticEmotion } from "@/lib/imotara/haptic";

type Role = "user" | "assistant" | "system";
type DebugEmotionSource = "analysis" | "fallback" | "unknown";

type Message = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  sessionId?: string;
  debugEmotion?: string;
  debugEmotionSource?: DebugEmotionSource;
  replySource?: "openai" | "fallback";

  // ✅ NEW: parity response metadata (from /api/respond)
  reflectionSeed?: ReflectionSeed;
  followUp?: string;

  // ✅ Debug/diagnostics metadata (optional; report-only)
  meta?: {
    compatibility?: any;
    analysisSource?: "local" | "cloud";
  };
};

type Thread = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
};

const LEGACY_CHAT_KEY = "imotara.chat.v1";

// ✅ Scope per local user/profile
const PROFILE_KEY = "imotara.profile.v1";
const LOCAL_USER_KEY = "imotara.localUserId.v1";

// ✅ Remote consent key (shared with Settings)
const CONSENT_KEY = "imotara.consent.v1";

// ✅ Optional “Link Key” for cross-device continuity (same person on web + mobile)
// If present, this becomes the remote user scope.
// (We’ll add UI for this later; for now it’s just a storage hook.)
const CHAT_LINK_KEY = "imotara.linkKey.v1";
const CHAT_USER_HEADER = "x-imotara-user";

function getAllowRemote(): boolean {
  if (typeof window === "undefined") return false;

  // 1) New mirror key (if present)
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.allowRemote === "boolean") return parsed.allowRemote;
    }
  } catch {
    // ignore
  }

  // 2) Primary key used by your app today
  try {
    const raw = window.localStorage.getItem("imotara.analysisConsent.v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      // Supports either { mode: "allow-remote" | ... } OR { allowRemote: boolean }
      if (typeof parsed?.allowRemote === "boolean") return parsed.allowRemote;
      if (typeof parsed?.mode === "string")
        return parsed.mode === "allow-remote";
    }
  } catch {
    // ignore
  }

  // 3) Legacy/simple flag
  try {
    const raw = window.localStorage.getItem("imotara:allow-remote-analysis");
    if (raw != null) {
      const v = raw.trim().toLowerCase();
      if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
      if (v === "false" || v === "0" || v === "no" || v === "off") return false;
      // If someone stored JSON boolean
      if (v === "null" || v === "undefined" || v === "") return false;
    }
  } catch {
    // ignore
  }

  return false;
}

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getOrCreateLocalUserId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(LOCAL_USER_KEY);
  if (existing && existing.trim()) return existing.trim();

  const created =
    Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
  window.localStorage.setItem(LOCAL_USER_KEY, created);
  return created;
}

function getUserScopeId(): string {
  if (typeof window === "undefined") return "";
  const prof = safeParseJSON<{ id?: string }>(
    window.localStorage.getItem(PROFILE_KEY),
  );
  const pid = typeof prof?.id === "string" ? prof.id.trim() : "";
  return pid || getOrCreateLocalUserId();
}

function getLocalChatKey(): string {
  if (typeof window === "undefined") return LEGACY_CHAT_KEY;
  const uid = getUserScopeId(); // profile id if present, else local user id
  return `imotara.chat.v1.${uid}`;
}

function getChatRemoteScope(): string {
  if (typeof window === "undefined") return "";
  if (!getAllowRemote()) return "";
  try {
    const link = (window.localStorage.getItem(CHAT_LINK_KEY) ?? "").trim();
    if (link) return link.slice(0, 80); // keep consistent with server sanitization
  } catch {
    // ignore
  }
  // Fallback: local profile/local id (device scoped)
  return getUserScopeId();
}

async function pushChatMessageToRemote(args: {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAtMs: number;
  meta?: any;
}): Promise<void> {
  const scope = getChatRemoteScope();
  if (!scope) return;

  try {
    const iso = new Date(args.createdAtMs).toISOString();
    await fetch("/api/chat/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CHAT_USER_HEADER]: scope,
      },
      body: JSON.stringify({
        messages: [
          {
            id: args.id,
            thread_id: args.threadId,
            role: args.role,
            content: args.content,
            created_at: iso,
            updated_at: iso,
            meta: args.meta ?? {},
          },
        ],
      }),
    });
  } catch {
    // fire-and-forget: never block UI
  }
}

type RemoteChatRow = {
  id?: string;
  thread_id?: string;
  threadId?: string;
  role?: "user" | "assistant" | "system" | string;
  content?: string;
  created_at?: string;
  createdAt?: string;
  meta?: any;
};

async function fetchRemoteChatMessages(): Promise<RemoteChatRow[]> {
  const scope = getChatRemoteScope();
  if (!scope) return [];

  try {
    const res = await fetch("/api/chat/messages", {
      method: "GET",
      headers: { "x-imotara-user": scope },
    });
    if (!res.ok) return [];

    const data: any = await res.json();

    // Support: array OR { items: [...] } OR { records: [...] }
    if (Array.isArray(data)) return data as RemoteChatRow[];
    if (data && typeof data === "object") {
      if (Array.isArray(data.items)) return data.items as RemoteChatRow[];
      if (Array.isArray(data.records)) return data.records as RemoteChatRow[];
    }
    return [];
  } catch {
    return [];
  }
}

function toMs(ts: unknown): number {
  if (!ts) return Date.now();
  if (typeof ts === "number") return ts < 1e12 ? ts * 1000 : ts;
  const s = String(ts);
  const d = new Date(s);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function mergeRemoteChatIntoThreads(
  current: Thread[],
  remoteRows: RemoteChatRow[],
): Thread[] {
  // Normalize rows -> Message, grouped by threadId
  const byThread = new Map<string, Message[]>();

  for (const r of remoteRows) {
    const id = (r.id ?? "").toString().trim();
    const threadId = (r.thread_id ?? r.threadId ?? "").toString().trim();
    const role = (r.role ?? "user") as any;
    const content = (r.content ?? "").toString();
    if (!id || !threadId || !content) continue;

    const createdAt = toMs(r.created_at ?? r.createdAt);

    const msg: Message = {
      id,
      role: role === "assistant" || role === "system" ? role : "user",
      content,
      createdAt,
      sessionId: threadId,
      meta: r.meta,
    };

    const list = byThread.get(threadId) ?? [];
    list.push(msg);
    byThread.set(threadId, list);
  }

  // Build a fast lookup of existing message ids per thread
  const existingByThread = new Map<string, Set<string>>();
  for (const t of current) {
    existingByThread.set(t.id, new Set(t.messages.map((m) => m.id)));
  }

  // Merge
  const merged: Thread[] = [...current];

  for (const [threadId, incoming] of byThread.entries()) {
    incoming.sort((a, b) => a.createdAt - b.createdAt);

    const idx = merged.findIndex((t) => t.id === threadId);

    if (idx === -1) {
      // New thread from remote
      const firstUser = incoming.find((m) => m.role === "user");
      const titleBase = (firstUser?.content ?? "Conversation").trim();
      const title = titleBase.slice(0, 40) + (titleBase.length > 40 ? "…" : "");

      merged.push({
        id: threadId,
        title,
        createdAt: incoming[0]?.createdAt ?? Date.now(),
        messages: incoming,
      });
      continue;
    }

    // Existing thread: add only missing messages
    const seen = existingByThread.get(threadId) ?? new Set<string>();
    const toAdd = incoming.filter((m) => !seen.has(m.id));

    if (toAdd.length) {
      const next = [...merged[idx].messages, ...toAdd].sort(
        (a, b) => a.createdAt - b.createdAt,
      );
      merged[idx] = { ...merged[idx], messages: next };
    }
  }

  // Keep newest threads first (optional)
  merged.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return merged;
}

// Public release: hide remote sync controls until fully stable
const ENABLE_REMOTE_SYNC = false;

// Build-time analysis implementation mode
const ANALYSIS_IMPL: "local" | "api" =
  (process.env.NEXT_PUBLIC_IMOTARA_ANALYSIS as "local" | "api") === "api"
    ? "api"
    : "local";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function emotionGlowClass(e?: string | null): string {
  const k = (e ?? "").toLowerCase().trim();

  // Subtle emotion-aware glow for Aurora Calm theme
  if (["joy", "happy", "happiness"].includes(k))
    return "ring-1 ring-emerald-300/25 shadow-[0_0_0_1px_rgba(16,185,129,0.10),0_18px_40px_rgba(16,185,129,0.08)]";

  if (["sad", "sadness", "lonely", "isolation"].includes(k))
    return "ring-1 ring-sky-300/25 shadow-[0_0_0_1px_rgba(56,189,248,0.10),0_18px_40px_rgba(56,189,248,0.08)]";

  if (["anger", "angry"].includes(k))
    return "ring-1 ring-rose-300/25 shadow-[0_0_0_1px_rgba(244,63,94,0.10),0_18px_40px_rgba(244,63,94,0.08)]";

  if (["fear", "anxious", "anxiety", "stress", "stressed"].includes(k))
    return "ring-1 ring-amber-300/25 shadow-[0_0_0_1px_rgba(251,191,36,0.10),0_18px_40px_rgba(251,191,36,0.08)]";

  if (["surprise"].includes(k))
    return "ring-1 ring-violet-300/25 shadow-[0_0_0_1px_rgba(167,139,250,0.10),0_18px_40px_rgba(167,139,250,0.08)]";

  // neutral / mixed / unknown
  return "ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_40px_rgba(2,6,23,0.35)]";
}

function DateText({ ts }: { ts: number }) {
  const text = useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        // Important: use user's local timezone (do NOT force UTC)
      });
      return fmt.format(new Date(ts));
    } catch {
      return "";
    }
  }, [ts]);
  return <span suppressHydrationWarning>{text}</span>;
}

function isAppMessage(m: Message): m is AppMessage {
  return m.role === "user" || m.role === "assistant";
}

// #20: Tiered crisis detection — English
const CRISIS_TIER2_RE =
  /\b(suicide|suicidal|end my life|end it all|kill myself|don't want to (be here|live|exist)|can't go on|no reason to live|want to die|hurt myself|self.?harm|cut myself|overdose)\b/i;
const CRISIS_TIER1_RE =
  /\b(hopeless|helpless|worthless|nothing matters|give up|can't take (it|this) anymore|breaking down|falling apart|no one cares|all alone|empty inside|numbing|numb(ing)?|disappear)\b/i;

// #20: Indian language crisis signals — Unicode script (hi/mr Devanagari, bn, ta, te, kn, ml, gu, pa)
const CRISIS_INDIC_TIER2_RE = new RegExp(
  [
    // Hindi / Marathi (Devanagari)
    "मरना चाहता","मरना चाहती","मर जाना","जीना नहीं","आत्महत्या","खुद को नुकसान","जिंदगी खत्म",
    "मरायचंय","जगायचं नाही","आत्महत्या करायची","मरून जातो","मरून जाते",
    // Bengali
    "মরতে চাই","বাঁচতে চাই না","আত্মহত্যা","মরে যেতে চাই","নিজেকে কষ্ট দিতে চাই",
    // Tamil
    "வாழ வேண்டாம்","தற்கொலை","இறந்துவிட","சாக வேண்டும்",
    // Telugu
    "చనిపోవాలి","ఆత్మహత్య","బతకాలని లేదు","నన్ను నేను హాని",
    // Kannada
    "ಸಾಯಬೇಕು","ಆತ್ಮಹತ್ಯೆ","ಬದುಕಬೇಕಾಗಿಲ್ಲ",
    // Malayalam
    "മരിക്കണം","ആത്മഹത്യ","ജീവിക്കണ്ട","ജീവിതം വേണ്ട",
    // Gujarati
    "મરવું છે","આત્મહત્યા","જીવવું નથી",
    // Punjabi (Gurmukhi)
    "ਮਰਨਾ ਚਾਹੁੰਦਾ","ਆਤਮਹੱਤਿਆ","ਜਿਉਣਾ ਨਹੀਂ",
  ].join("|"),
);

// #20: Indian language crisis signals — romanised (very common in Indian chat)
const CRISIS_ROMAN_INDIC_TIER2_RE =
  /marna\s+chah|mar\s+jaana|mar\s+jaun|jeena\s+nahi|zindagi\s+khatam|khud\s+ko\s+hurt|aatmahatya|maraycha|jagaych\s+nahi|morte\s+chai|bachte\s+chai\s+na|atmahatya|chanipovali|saayabeku|marikknam|marikkanam|jeevanam\s+venda|saaga\s+beku/i;

// #20: Indian language tier-1 (distress but not immediate crisis) — Unicode
const CRISIS_INDIC_TIER1_RE = new RegExp(
  [
    // Hindi
    "उम्मीद नहीं","बेकार हूं","निराश हूं","थक गया","थक गई","कोई परवाह नहीं","सब बेकार है",
    // Marathi
    "आशा नाही","निराश आहे","थकलोय","कोणाला काही देणं नाही",
    // Bengali
    "আশা নেই","হতাশ","একা","কেউ নেই",
    // Tamil
    "நம்பிக்கையில்லை","பயனில்லை","தனிமை","யாரும் இல்லை",
    // Telugu
    "ఆశ లేదు","నిరాశగా","ఒంటరిగా","ఎవరూ లేరు",
    // Kannada
    "ಆಶೆ ಇಲ್ಲ","ನಿರಾಶೆ","ಒಂಟಿ","ಯಾರೂ ಇಲ್ಲ",
    // Malayalam
    "പ്രതീക്ഷ ഇല്ല","നിരാശ","ഒറ്റയ്ക്ക്",
    // Gujarati
    "આશા નથી","નિરાશ","એકલા",
    // Punjabi
    "ਉਮੀਦ ਨਹੀਂ","ਨਿਰਾਸ਼","ਇਕੱਲਾ",
  ].join("|"),
);

// #20: Romanised Indian tier-1
const CRISIS_ROMAN_INDIC_TIER1_RE =
  /umeed\s+nahi|bekaar\s+hoon|nirash\s+hoon|thak\s+gay[ao]|koi\s+parwah\s+nahi|asha\s+nahi|hotas\s+hoon|ekla\s+hoon|akela\s+hoon|akeli\s+hoon/i;

// #4: Localized crisis banner texts (EN + 10 Indian languages)
const CRISIS_BANNER_BY_LANG: Record<string, { tier2: string; tier1: string; link: string }> = {
  en: { tier2: "It sounds like you may be going through something really heavy right now. You don't have to face this alone —", tier1: "It sounds like things feel really hard right now. I'm listening. If it ever feels like too much,", link: "free crisis support is available 24/7" },
  hi: { tier2: "लगता है आप इस वक्त कुछ बहुत भारी झेल रहे हैं। आपको यह अकेले नहीं झेलना है —", tier1: "लगता है अभी चीज़ें बहुत कठिन लग रही हैं। मैं सुन रहा/रही हूँ। अगर यह बहुत ज़्यादा लगे,", link: "24/7 सहायता उपलब्ध है" },
  mr: { tier2: "वाटतंय तुम्ही आत्ता खूप जड काहीतरी सहन करत आहात. हे एकट्याने झेलण्याची गरज नाही —", tier1: "वाटतंय आत्ता सगळं खूप कठीण वाटतंय. मी ऐकतोय. खूप जड झालं तर,", link: "२४/७ मदत उपलब्ध आहे" },
  bn: { tier2: "মনে হচ্ছে তুমি এখন অনেক ভারী কিছুর মধ্যে দিয়ে যাচ্ছ। তোমাকে একা এটা বহন করতে হবে না —", tier1: "মনে হচ্ছে এখন সবকিছু অনেক কঠিন লাগছে। আমি শুনছি। যদি অনেক বেশি মনে হয়,", link: "২৪/৭ সহায়তা পাওয়া যাচ্ছে" },
  ta: { tier2: "நீங்கள் இப்போது மிகவும் கடினமான ஒன்றை சந்திக்கிறீர்கள் என்று தெரிகிறது. தனியாக எதிர்கொள்ள வேண்டியதில்லை —", tier1: "இப்போது எல்லாம் மிகவும் கஷ்டமாக உணர்கிறீர்கள் என்று தெரிகிறது. நான் கேட்கிறேன். மிகவும் அதிகமாக இருந்தால்,", link: "24/7 நெருக்கடி ஆதரவு கிடைக்கிறது" },
  te: { tier2: "మీరు ఇప్పుడు చాలా భారమైన ఏదో అనుభవిస్తున్నారు అనిపిస్తోంది. ఒంటరిగా భరించాల్సిన అవసరం లేదు —", tier1: "ఇప్పుడు అన్నీ చాలా కష్టంగా అనిపిస్తున్నాయి. నేను వింటున్నాను. ఎక్కువగా అనిపిస్తే,", link: "24/7 సహాయం అందుబాటులో ఉంది" },
  kn: { tier2: "ನೀವು ಈಗ ತುಂಬಾ ಭಾರವಾದ ಏನನ್ನೋ ಅನುಭವಿಸುತ್ತಿದ್ದೀರಿ. ಒಂಟಿಯಾಗಿ ಎದುರಿಸಬೇಕಾಗಿಲ್ಲ —", tier1: "ಈಗ ಎಲ್ಲವೂ ತುಂಬಾ ಕಷ್ಟ ಎನಿಸುತ್ತಿದೆ. ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ. ತುಂಬಾ ಜಾಸ್ತಿ ಅನಿಸಿದರೆ,", link: "24/7 ಬೆಂಬಲ ಲಭ್ಯವಿದೆ" },
  ml: { tier2: "നിങ്ങൾ ഇപ്പോൾ വളരെ ഭാരമേറിയ ഒന്ന് അനുഭവിക്കുന്നുണ്ടെന്ന് തോന്നുന്നു. ഒറ്റയ്ക്ക് ഇതിനെ നേരിടേണ്ടതില്ല —", tier1: "ഇപ്പോൾ എല്ലാം വളരെ കഷ്ടമായി തോന്നുന്നുണ്ടെന്ന് തോന്നുന്നു. ഞാൻ കേൾക്കുന്നു. ഇത് കൂടുതലാകുന്നതായി തോന്നിയാൽ,", link: "24/7 പ്രതിസന്ധി സഹായം ലഭ്യമാണ്" },
  gu: { tier2: "લાગે છે તમે અત્યારે ઘણું ભારે સહન કરી રહ્યા છો. આ એકલા ઝેલવું ન પડે —", tier1: "લાગે છે અત્યારે બધું ઘણું અઘરું લાગી રહ્યું છે. હું સાંભળું છું. ઘણું વધારે લાગે તો,", link: "24/7 સહાય ઉપલબ્ધ છે" },
  pa: { tier2: "ਲੱਗਦਾ ਹੈ ਤੁਸੀਂ ਹੁਣ ਕੁਝ ਬਹੁਤ ਭਾਰਾ ਝੱਲ ਰਹੇ ਹੋ। ਇਹ ਇਕੱਲੇ ਝੱਲਣ ਦੀ ਲੋੜ ਨਹੀਂ —", tier1: "ਲੱਗਦਾ ਹੈ ਹੁਣ ਸਭ ਕੁਝ ਬਹੁਤ ਔਖਾ ਲੱਗ ਰਿਹਾ ਹੈ। ਮੈਂ ਸੁਣ ਰਿਹਾ/ਰਹੀ ਹਾਂ। ਜੇ ਬਹੁਤ ਜ਼ਿਆਦਾ ਲੱਗੇ,", link: "24/7 ਸਹਾਇਤਾ ਉਪਲਬਧ ਹੈ" },
  or: { tier2: "ମନେ ହୁଏ ଆପଣ ଏବେ ବହୁ ଭାରୀ କିଛି ସହୁଛନ୍ତି। ଏହାକୁ ଏକୁଟିଆ ଝେଲିବାର ଦରକାର ନାହିଁ —", tier1: "ମନେ ହୁଏ ଏବେ ସବୁ ବହୁ କଷ୍ଟ ଲାଗୁଛି। ମୁଁ ଶୁଣୁଛି। ଯଦି ଅତ୍ୟଧିକ ଲାଗେ,", link: "24/7 ସଂକଟ ସହାୟତା ଉପଲବ୍ଧ" },
};

// #11: Composer sentiment seeds — quick-tap mood hint chips
const SENTIMENT_SEEDS_BY_LANG: Record<string, [string, string, string]> = {
  en: ["Feeling heavy", "Need to vent", "Just thinking out loud"],
  hi: ["मन भारी है", "मन की भड़ास निकालनी है", "बस सोच रहा/रही हूँ"],
  mr: ["मन जड आहे", "मन मोकळं करायचंय", "विचार करतोय/करतेय"],
  bn: ["মন ভারী", "মনের কথা বলতে চাই", "শুধু ভাবছি"],
  ta: ["மனம் கனமாக இருக்கிறது", "மனசு காலி செய்யணும்", "யோசிக்கிறேன்"],
  te: ["మనసు భారంగా ఉంది", "మనసు తేలిక చేసుకోవాలి", "ఆలోచిస్తున్నాను"],
  kn: ["ಮನಸ್ಸು ಭಾರ", "ಮನಸ್ಸು ಹಗುರ ಮಾಡಬೇಕು", "ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ"],
  ml: ["മനസ്സ് ഭാരം", "മനസ്സ് ഒഴിക്കണം", "ആലോചിക്കുന്നു"],
  gu: ["મન ભારે છે", "મન ઠાળવવું છે", "વિચારી રહ્યો/રહી છું"],
  pa: ["ਮਨ ਭਾਰਾ ਹੈ", "ਮਨ ਹੌਲਾ ਕਰਨਾ ਹੈ", "ਸੋਚ ਰਿਹਾ/ਰਹੀ ਹਾਂ"],
  or: ["ମନ ଭାରୀ ଅଛି", "ମନ ହାଲୁକା କରିବାକୁ ଚାହୁଁଛି", "ଭାବୁଛି"],
};

// #6: Weekly mood recap text — localised
function getWeeklyRecapText(topEmotion: string, count: number, lang: string): string {
  const RECAP: Record<string, (e: string, c: number) => string> = {
    en: (e, c) => `Last 7 days: "${e}" was your most frequent feeling (${c} times). Want to reflect on what's been driving it?`,
    hi: (e, c) => `पिछले 7 दिन: "${e}" सबसे ज़्यादा महसूस हुआ (${c} बार)। इसके पीछे क्या है, सोचना चाहेंगे?`,
    mr: (e, c) => `गेले 7 दिवस: "${e}" सर्वाधिक जाणवलं (${c} वेळा). यामागे काय आहे यावर विचार करायचा आहे का?`,
    bn: (e, c) => `গত ৭ দিন: "${e}" সবচেয়ে বেশি অনুভব হয়েছে (${c} বার)। এর পেছনে কী আছে ভাবতে চাও?`,
    ta: (e, c) => `கடந்த 7 நாட்கள்: "${e}" அதிகமாக உணர்ந்தீர்கள் (${c} முறை). இதற்கு பின்னால் என்ன என்று சிந்திக்க விரும்புகிறீர்களா?`,
    te: (e, c) => `గత 7 రోజులు: "${e}" అత్యధికంగా అనిపించింది (${c} సార్లు). దీని వెనక ఏముందో ఆలోచించాలనుకుంటున్నారా?`,
    kn: (e, c) => `ಕಳೆದ 7 ದಿನಗಳು: "${e}" ಅತ್ಯಧಿಕ ಅನಿಸಿತು (${c} ಬಾರಿ). ಇದರ ಹಿಂದೆ ಏನಿದೆ ಎಂದು ಯೋಚಿಸಬೇಕಾ?`,
    ml: (e, c) => `കഴിഞ്ഞ 7 ദിവസം: "${e}" ഏറ്റവും കൂടുതൽ (${c} തവണ). ഇതിന് പിന്നിൽ എന്തുണ്ടെന്ന് ചിന്തിക്കാൻ ആഗ്രഹിക്കുന്നോ?`,
    gu: (e, c) => `છેલ્લા 7 દિવસ: "${e}" સૌથી વધુ (${c} વખત). આ પાછળ શું છે, વિચારવું છે?`,
    pa: (e, c) => `ਪਿਛਲੇ 7 ਦਿਨ: "${e}" ਸਭ ਤੋਂ ਵੱਧ (${c} ਵਾਰ). ਇਸ ਪਿੱਛੇ ਕੀ ਹੈ, ਸੋਚਣਾ ਚਾਹੋਗੇ?`,
    or: (e, c) => `ଗତ 7 ଦିନ: "${e}" ସବୁଠୁ ଅଧିକ (${c} ଥର). ଏହା ପଛରେ କ'ଣ ଅଛି ଭାବିବାକୁ ଚାହୁଁଛନ୍ତି?`,
  };
  return (RECAP[lang] ?? RECAP.en)(topEmotion, count);
}

type CrisisTier = 0 | 1 | 2;

function detectCrisisTier(messages: Message[]): CrisisTier {
  const recentUser = messages
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => m.content ?? "");

  for (const text of recentUser) {
    if (
      CRISIS_TIER2_RE.test(text) ||
      CRISIS_INDIC_TIER2_RE.test(text) ||
      CRISIS_ROMAN_INDIC_TIER2_RE.test(text)
    ) return 2;
  }

  const tier1Count = recentUser.filter(
    (t) =>
      CRISIS_TIER1_RE.test(t) ||
      CRISIS_INDIC_TIER1_RE.test(t) ||
      CRISIS_ROMAN_INDIC_TIER1_RE.test(t),
  ).length;
  if (tier1Count >= 2) return 2;
  if (tier1Count >= 1) return 1;
  return 0;
}

/**
 * Fetch remote history for sync.
 * Supports:
 *   • raw array              -> [ ...records ]
 *   • { items: [...] }       -> { items }
 *   • { records: [...] }     -> { records, syncToken, ... }  (new envelope)
 */
async function fetchRemoteHistory(): Promise<unknown[]> {
  try {
    const res = await fetch("/api/history", {
      method: "GET",
      headers: { "x-imotara-user": getUserScopeId() },
    });

    if (!res.ok) return [];
    const data: unknown = await res.json();

    if (Array.isArray(data)) return data;

    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.records)) return obj.records as unknown[];
      if (Array.isArray(obj.items)) return obj.items as unknown[];
    }

    return [];
  } catch {
    return [];
  }
}

async function persistMergedHistory(merged: unknown): Promise<void> {
  try {
    const mod: Record<string, unknown> = await import("@/lib/imotara/history");
    const setHistory = mod.setHistory as
      | ((items: unknown) => Promise<void> | void)
      | undefined;
    const saveLocalHistory = mod.saveLocalHistory as
      | ((items: unknown) => Promise<void> | void)
      | undefined;
    const saveHistory = mod.saveHistory as
      | ((items: unknown) => Promise<void> | void)
      | undefined;

    if (typeof setHistory === "function")
      return void (await setHistory(merged));
    if (typeof saveLocalHistory === "function")
      return void (await saveLocalHistory(merged));
    if (typeof saveHistory === "function")
      return void (await saveHistory(merged));
  } catch {
    // ignore
  }
}

// Emotion logging helpers
type HistoryEmotionOptions = {
  emotion?: Emotion;
  intensity?: number;
};

/**
 * Push a minimal EmotionRecord to the backend /api/history store.
 * This is additive and does not replace any existing local logging.
 */
async function pushToRemoteHistory(entry: {
  id: string;
  message: string;
  emotion: Emotion;
  intensity: number;
  createdAt: number;
  updatedAt: number;
  source: "user" | "assistant";
}): Promise<void> {
  try {
    await fetch("/api/history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-imotara-user": getUserScopeId(),
      },
      body: JSON.stringify([entry]),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[imotara] pushToRemoteHistory failed:", err);
  }
}

async function logUserMessageToHistory(
  msg: Message,
  opts?: HistoryEmotionOptions,
): Promise<void> {
  try {
    const text = msg.content.trim();
    if (!text) return;

    let emotion: Emotion = opts?.emotion ?? "neutral";
    let intensity: number =
      typeof opts?.intensity === "number" ? opts.intensity : 0.3;

    if (!opts) {
      try {
        const res = (await runLocalAnalysis([msg] as any, 1)) as any;
        const summary = res?.summary;
        const inferredEmotion =
          summary?.primaryEmotion ?? summary?.emotion ?? summary?.tag ?? null;
        const inferredIntensity =
          typeof summary?.intensity === "number" ? summary.intensity : null;

        if (inferredEmotion) {
          emotion = inferredEmotion as Emotion;
        }
        if (inferredIntensity !== null) {
          intensity = inferredIntensity;
        }
      } catch (e) {
        console.warn(
          "[imotara] local analysis for history logging failed, using neutral:",
          e,
        );
      }
    }

    const payload: any = {
      message: text,
      emotion,
      intensity,
      source: "local",
      createdAt: msg.createdAt,
      updatedAt: msg.createdAt,
      sessionId: msg.sessionId,
      messageId: msg.id,
      entryKind: "user",
    };

    // Existing local / history.ts logging (unchanged)
    await saveSample(payload);

    // NEW: push a normalized EmotionRecord to backend store
    await pushToRemoteHistory({
      id: msg.id,
      message: text,
      emotion,
      intensity,
      createdAt: msg.createdAt,
      updatedAt: msg.createdAt,
      source: "user",
    });
  } catch (err) {
    console.error("[imotara] failed to log chat message to history:", err);
  }
}

async function logAssistantMessageToHistory(msg: Message): Promise<void> {
  try {
    const text = msg.content.trim();
    if (!text) return;

    const payload: any = {
      message: text,
      emotion: "neutral",
      intensity: 0,
      source: "local",
      createdAt: msg.createdAt,
      updatedAt: msg.createdAt,
      sessionId: msg.sessionId,
      messageId: msg.id,
      entryKind: "assistant",
      replySource: msg.replySource ?? "fallback",
    };

    // Existing local / history.ts logging (unchanged)
    await saveSample(payload);

    // NEW: push a normalized EmotionRecord to backend store
    await pushToRemoteHistory({
      id: msg.id,
      message: text,
      emotion: "neutral",
      intensity: 0,
      createdAt: msg.createdAt,
      updatedAt: msg.createdAt,
      source: "assistant",
    });
  } catch (err) {
    console.error("[imotara] failed to log assistant message to history:", err);
  }
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const urlSessionId = (searchParams?.get("sessionId") ?? "").trim();
  const urlMessageId = (searchParams?.get("messageId") ?? "").trim();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const messageTargetRef = useRef<HTMLDivElement | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const usedMessageIdRef = useRef<string | null>(null);

  // 🔒 Idempotency guard: remember last user message we replied to
  const lastReplyKeyRef = useRef<string | null>(null);

  // 🔒 Idempotency guard: prevent duplicate analysis calls for the same last-user message
  const lastAnalysisKeyRef = useRef<string | null>(null);

  // #3: Track which thread IDs have already received a re-entry message this session
  const reentryShownRef = useRef<Set<string>>(new Set());

  // #18: Message undo — pending reply timer + undo state
  const [pendingUndo, setPendingUndo] = useState<{ messageId: string; threadId: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // #19: Voice input
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // #10: Message reactions — local emoji stamps (messageId → emoji)
  const [reactions, setReactions] = useState<Record<string, string>>({});

  // Bookmarks — starred message IDs
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  // Breathing widget visibility
  const [showBreathing, setShowBreathing] = useState(false);
  // #8: Grow nudge dismissed flag
  const [growNudgeDismissed, setGrowNudgeDismissed] = useState(false);
  // #6: Weekly recap text (computed once on mount)
  const [weeklyRecap, setWeeklyRecap] = useState<string | null>(null);
  const [weeklyRecapDismissed, setWeeklyRecapDismissed] = useState(false);

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Soft clear confirm (replaces window.confirm)
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Toast
  const [chatToast, setChatToast] = useState<{ message: string; type?: ToastType } | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // ✅ NEW: header details toggle (collapses long header content by default)
  const [showHeaderDetails, setShowHeaderDetails] = useState(false);

  // Reactive companion name — shown in chat header, updates when profile changes
  const [companionDisplayName, setCompanionDisplayName] = useState<string | null>(null);
  // SSR-safe preferred language — always "en" on server, real value after mount
  const [preferredLang, setPreferredLang] = useState<string>("en");
  useEffect(() => {
    function syncName(p?: ImotaraProfileV1 | null) {
      const c = p?.companion;
      if (c?.enabled && c.name?.trim()) {
        setCompanionDisplayName(c.name.trim());
      } else {
        setCompanionDisplayName(null);
      }
      setPreferredLang(p?.user?.preferredLang ?? "en");
    }
    syncName(getImotaraProfile());
    const handler = (e: Event) => syncName((e as CustomEvent).detail as ImotaraProfileV1 | null);
    window.addEventListener("imotara:profile-updated", handler);
    return () => window.removeEventListener("imotara:profile-updated", handler);
  }, []);

  const { mode } = useAnalysisConsent();
  const remoteAllowed = mode === "allow-remote";
  const consentLabel =
    mode === "allow-remote" ? "Remote analysis allowed" : "On-device only";
  // ✅ SSR-stable placeholder to avoid hydration mismatch
  // Server render must NOT depend on localStorage / client-only settings.
  const [composerPlaceholder, setComposerPlaceholder] = useState(
    "Write what’s on your mind… (Enter to send, Shift+Enter for newline)",
  );

  // #10: Load reactions from localStorage on mount
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem("imotara.reactions.v1");
      if (raw) setReactions(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [mounted]);

  // #10: Persist reactions whenever they change
  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem("imotara.reactions.v1", JSON.stringify(reactions)); } catch { /* ignore */ }
  }, [mounted, reactions]);

  // Bookmarks: load on mount
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem("imotara.bookmarks.v1");
      if (raw) setBookmarks(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, [mounted]);

  // Bookmarks: persist on change
  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem("imotara.bookmarks.v1", JSON.stringify([...bookmarks])); } catch { /* ignore */ }
  }, [mounted, bookmarks]);

  function toggleBookmark(id: string) {
    hapticTap();
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // #6: Compute weekly mood recap on mount
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem("imotara:history:v1");
      if (!raw) return;
      const all = JSON.parse(raw) as any[];
      if (!Array.isArray(all)) return;
      const now = Date.now();
      const weekMs = 7 * 86_400_000;
      const thisWeek = all.filter(
        (r) => !r.deleted && r.createdAt >= now - weekMs && r.emotion && r.emotion !== "neutral",
      );
      if (thisWeek.length < 5) return;
      const freq: Record<string, number> = {};
      for (const r of thisWeek) freq[r.emotion] = (freq[r.emotion] ?? 0) + 1;
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
      const lang = getImotaraProfile()?.user?.preferredLang ?? "en";
      setWeeklyRecap(getWeeklyRecapText(top[0], top[1], lang));
    } catch { /* ignore */ }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const p = getChatToneCopy()?.placeholder;
      if (typeof p === "string" && p.trim().length > 0) {
        setComposerPlaceholder(p.trim());
      }
    } catch {
      // keep default
    }
  }, [mounted]);

  // Load threads (client only)
  useEffect(() => {
    if (!mounted) return;

    try {
      const key = getLocalChatKey();
      const raw =
        localStorage.getItem(key) ?? localStorage.getItem(LEGACY_CHAT_KEY);

      // One-time migrate legacy chats into the per-user key (keep legacy key for safety)
      if (!localStorage.getItem(key) && raw) {
        try {
          localStorage.setItem(key, raw);
        } catch {
          // ignore
        }
      }

      if (raw) {
        const parsed = JSON.parse(raw) as {
          threads: Thread[];
          activeId?: string | null;
        };
        const t = Array.isArray(parsed.threads) ? parsed.threads : [];

        // ✅ Timestamp hardening: normalize legacy seconds -> ms (10-digit -> 13-digit)
        const normalizeTs = (ts: unknown): number => {
          const n = typeof ts === "number" ? ts : Number(ts);
          if (!Number.isFinite(n)) return Date.now();
          return n < 1e12 ? n * 1000 : n;
        };

        const hardened = t.map((th) => ({
          ...th,
          createdAt: normalizeTs((th as any).createdAt),
          messages: Array.isArray((th as any).messages)
            ? (th as any).messages.map((m: any) => ({
              ...m,
              createdAt: normalizeTs(m?.createdAt),
            }))
            : [],
        }));

        // Normalize old data: if title is default but messages exist, derive a title
        const normalized = hardened.map((th) => {
          const title = (th?.title ?? "").trim();
          const isDefaultTitle =
            !title || title.toLowerCase() === "new conversation";
          const firstUser = (th?.messages ?? []).find(
            (m: any) => m?.role === "user",
          );
          const firstText = (firstUser?.content ?? "").trim();

          if (isDefaultTitle && firstText) {
            const clipped =
              firstText.slice(0, 40) + (firstText.length > 40 ? "…" : "");
            return { ...th, title: clipped };
          }

          return th;
        });

        const a = parsed.activeId ?? normalized[0]?.id ?? null;
        setThreads(normalized);
        setActiveId(a);
        return;
      }
    } catch {
      // ignore
    }

    const seedId = uid();
    const now = Date.now();
    const seed: Thread = {
      id: seedId,
      title: "First conversation",
      createdAt: now,
      messages: [
        {
          id: uid(),
          role: "assistant",
          content:
            "Hi, I’m Imotara — a quiet companion. Try sending me a message.",
          createdAt: now,
          sessionId: seedId,
        },
      ],
    };
    setThreads([seed]);
    setActiveId(seedId);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const found = threads.find((t) => t.id === activeId);
    if (!found && threads.length > 0) setActiveId(threads[0].id);
  }, [mounted, threads, activeId]);

  useEffect(() => {
    if (!mounted) return;
    if (!urlSessionId) return;
    const match = threads.find((t) => t.id === urlSessionId);
    if (match && match.id !== activeId) {
      setActiveId(match.id);
    }
  }, [mounted, urlSessionId, threads, activeId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId],
  );

  // Emotion-reactive ambient glow — derived from latest non-neutral emotion in current thread
  const latestEmotion = useMemo(() => {
    if (!activeThread?.messages?.length) return null;
    for (let i = activeThread.messages.length - 1; i >= 0; i--) {
      const m = activeThread.messages[i];
      if (m.debugEmotion && m.debugEmotion !== "neutral") return m.debugEmotion.toLowerCase();
    }
    return null;
  }, [activeThread?.messages]);

  const EMOTION_GLOW_COLOR: Record<string, string> = {
    joy: "rgba(251,191,36,0.10)", happy: "rgba(251,191,36,0.10)", happiness: "rgba(251,191,36,0.10)",
    sad: "rgba(56,189,248,0.09)", sadness: "rgba(56,189,248,0.09)", lonely: "rgba(56,189,248,0.09)",
    angry: "rgba(244,63,94,0.09)", anger: "rgba(244,63,94,0.09)",
    anxious: "rgba(245,158,11,0.09)", anxiety: "rgba(245,158,11,0.09)", stressed: "rgba(245,158,11,0.09)", stress: "rgba(245,158,11,0.09)",
    fear: "rgba(167,139,250,0.09)",
    surprise: "rgba(240,171,252,0.09)",
  };
  const emotionGlowColor = latestEmotion ? (EMOTION_GLOW_COLOR[latestEmotion] ?? null) : null;

  useEffect(() => {
    if (!mounted) return;
    if (!urlMessageId) return;
    if (!activeThread) return;
    if (usedMessageIdRef.current === urlMessageId) return;

    const exists = activeThread.messages.some((m) => m.id === urlMessageId);
    if (!exists) return;

    usedMessageIdRef.current = urlMessageId;
    setHighlightedMessageId(urlMessageId);

    setTimeout(() => {
      const el = messageTargetRef.current;
      if (el && listRef.current) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  }, [mounted, urlMessageId, activeThread]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const t = window.setTimeout(() => setHighlightedMessageId(null), 4000);
    return () => window.clearTimeout(t);
  }, [highlightedMessageId]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(
        getLocalChatKey(),
        JSON.stringify({ threads, activeId }),
      );
    } catch {
      // ignore
    }
  }, [mounted, threads, activeId]);

  const appMessages: AppMessage[] = useMemo(() => {
    const msgs = activeThread?.messages ?? [];
    return msgs.filter(isAppMessage);
  }, [activeThread?.messages]);

  // #20: Tiered crisis detection — recompute whenever messages change
  const crisisTier = useMemo(
    () => detectCrisisTier(activeThread?.messages ?? []),
    [activeThread?.messages],
  );

  // analysis side-effect (AnalysisResult stays on analysis pipeline)
  useEffect(() => {
    if (!mounted) return;
    const msgs = activeThread?.messages ?? [];

    if (msgs.length === 0) {
      setAnalysis(null);
      lastAnalysisKeyRef.current = null;
      return;
    }

    const last = msgs[msgs.length - 1];

    // ✅ Key idea: only run analysis when the *user* has just spoken.
    // This avoids the "double-trigger" (user message → assistant message) that can
    // cause aborted signals even though the server returns 200 OK.
    if (!last || last.role !== "user") return;

    const key = [
      String((last as any)?.id ?? ""),
      String((last as any)?.createdAt ?? ""),
      String((last as any)?.content ?? "").slice(0, 120),
      `len=${msgs.length}`,
    ].join("|");

    if (lastAnalysisKeyRef.current === key) return;
    lastAnalysisKeyRef.current = key;

    let cancelled = false;
    (async () => {
      try {
        const res = (await runAnalysisWithConsent(
          msgs,
          10,
        )) as AnalysisResult | null;

        if (!cancelled) {
          setAnalysis(res);
          if (res?.snapshot?.dominant && res.snapshot.dominant !== "neutral") hapticEmotion();
          console.log("[imotara] analysis:", res?.summary?.headline, res);
        }
      } catch (err) {
        console.error("[imotara] analysis failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, activeThread?.messages]);

  useEffect(() => {
    if (!mounted) return;
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [mounted, activeThread?.messages?.length]);

  // #3: Session continuity — soft re-entry message when returning after ≥1 hour
  useEffect(() => {
    if (!mounted) return;
    if (!activeThread) return;
    if (reentryShownRef.current.has(activeThread.id)) return;

    const msgs = activeThread.messages;
    if (msgs.length < 2) return; // too few messages to be a real returning session

    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.role !== "assistant") return; // user left mid-reply — don't interrupt

    const elapsedMs = Date.now() - (lastMsg.createdAt ?? 0);
    const hourMs = 3_600_000;
    if (elapsedMs < hourMs) return; // same-hour session — no re-entry needed

    reentryShownRef.current.add(activeThread.id);

    const profile = getImotaraProfile();
    const firstName = profile?.user?.name?.trim().split(/\s+/)[0] ?? "";
    const lang = (profile?.user?.preferredLang ?? "en") as string;

    // #3: Language-aware re-entry messages
    // Slot 0 = short gap (<6h), 1 = next-day, 2 = within week, 3 = longer
    type ReentrySet = [string, string, string, string];
    const REENTRY: Record<string, ReentrySet> = {
      hi: [
        "{name}वापस आ गए। मैं यहाँ हूँ — कोई जल्दी नहीं।",
        "{name}अच्छा लगा वापस देखकर। जहाँ छोड़ा था वहाँ से शुरू करें, या कुछ नया।",
        "थोड़ा वक्त हो गया था। वापसी पर स्वागत है — जब भी तैयार हों।",
        "काफी वक्त बाद आए। वापसी पर स्वागत है। अपना समय लें — मैं सुन रहा/रही हूँ।",
      ],
      mr: [
        "{name}परत आलात. मी इथेच आहे — घाई नाही.",
        "{name}परत भेटून बरं वाटलं. जिथे सोडलं होतं तिथून सुरू करू, किंवा नवीन काही.",
        "थोडा वेळ गेला होता. स्वागत आहे — तयार असाल तेव्हा बोला.",
        "बराच वेळ झाला होता. परत आलात, बरं वाटलं. वेळ घ्या — मी ऐकतोय.",
      ],
      bn: [
        "{name}ফিরে এলে। আমি এখানেই আছি — তাড়া নেই।",
        "{name}আবার দেখে ভালো লাগলো। যেখানে ছিলে সেখান থেকে শুরু করো, বা নতুন কিছু।",
        "একটু সময় হয়ে গিয়েছিল। স্বাগতম — যখন প্রস্তুত থাকবে বলো।",
        "অনেক দিন পরে এলে। স্বাগতম। সময় নাও — আমি শুনছি।",
      ],
      ta: [
        "{name}திரும்பி வந்தீர்கள். நான் இங்கே இருக்கிறேன் — அவசரமில்லை।",
        "{name}மீண்டும் வந்தது மகிழ்ச்சி. நிறுத்தினதிலிருந்து தொடரலாம் அல்லது புதிதாக துவங்கலாம்.",
        "சிறிது நேரம் ஆனது. வரவேற்கிறேன் — தயாரானதும் பேசுங்கள்.",
        "நீண்ட நாளாகிவிட்டது. வரவேற்கிறேன். நேரம் எடுங்கள் — கேட்கிறேன்.",
      ],
      te: [
        "{name}తిరిగి వచ్చారు. నేను ఇక్కడే ఉన్నాను — తొందర లేదు।",
        "{name}మళ్ళీ కలిశారు, చాలా సంతోషం. ఆగిన చోటి నుండి మొదలుపెట్టవచ్చు లేదా కొత్తగా.",
        "కొంచెం సమయం అయింది. స్వాగతం — మీరు సిద్ధంగా ఉన్నప్పుడు మాట్లాడండి.",
        "చాలా రోజులయింది. స్వాగతం. సమయం తీసుకోండి — వింటున్నాను.",
      ],
      kn: [
        "{name}ಮರಳಿ ಬಂದಿರಿ. ನಾನು ಇಲ್ಲಿದ್ದೇನೆ — ಅವಸರವಿಲ್ಲ.",
        "{name}ಮತ್ತೆ ಭೇಟಿ ಸಂತೋಷ. ನಿಲ್ಲಿಸಿದ ಕಡೆಯಿಂದ ಮುಂದುವರಿಯೋಣ ಅಥವಾ ಹೊಸದಾಗಿ.",
        "ಸ್ವಲ್ಪ ಸಮಯ ಆಯಿತು. ಸ್ವಾಗತ — ತಯಾರಾದಾಗ ಹೇಳಿ.",
        "ತುಂಬಾ ದಿನಗಳಾಯಿತು. ಸ್ವಾಗತ. ಸಮಯ ತೆಗೆದುಕೊಳ್ಳಿ — ಕೇಳುತ್ತಿದ್ದೇನೆ.",
      ],
      ml: [
        "{name}തിരിച്ചെത്തി. ഞാൻ ഇവിടെ ഉണ്ട് — ധൃതി വേണ്ട.",
        "{name}വീണ്ടും കണ്ടതിൽ സന്തോഷം. നിർത്തിയ ഇടത്തു നിന്ന് തുടരാം അല്ലെങ്കിൽ പുതുതായി.",
        "കുറച്ചു സമയം ആയി. സ്വാഗതം — തയ്യാറാകുമ്പോൾ പറയൂ.",
        "വളരെ നാളായി. സ്വാഗതം. സമയം എടുക്കൂ — ഞാൻ കേൾക്കുന്നു.",
      ],
      gu: [
        "{name}પાછા આવ્યા. હું અહીં છું — કોઈ ઉતાવળ નથી.",
        "{name}ફરી મળ્યા, ખૂબ ખુશી. જ્યાં છોડ્યું ત્યાંથી શરૂ કરીએ અથવા નવું.",
        "થોડો સમય થઈ ગયો. સ્વાગત — તૈયાર હો ત્યારે જણાવો.",
        "ઘણો સમય થઈ ગયો. સ્વાગત. સમય લો — સાંભળું છું.",
      ],
      pa: [
        "{name}ਵਾਪਸ ਆ ਗਏ। ਮੈਂ ਇੱਥੇ ਹਾਂ — ਕੋਈ ਕਾਹਲੀ ਨਹੀਂ।",
        "{name}ਫਿਰ ਮਿਲ ਕੇ ਚੰਗਾ ਲੱਗਾ। ਜਿੱਥੇ ਛੱਡਿਆ ਸੀ ਉੱਥੋਂ ਸ਼ੁਰੂ ਕਰੀਏ ਜਾਂ ਕੁਝ ਨਵਾਂ।",
        "ਥੋੜਾ ਸਮਾਂ ਹੋ ਗਿਆ। ਜੀ ਆਇਆਂ — ਜਦੋਂ ਤਿਆਰ ਹੋਵੋ ਦੱਸੋ।",
        "ਕਾਫ਼ੀ ਸਮਾਂ ਹੋ ਗਿਆ। ਜੀ ਆਇਆਂ। ਸਮਾਂ ਲਓ — ਸੁਣ ਰਿਹਾ ਹਾਂ।",
      ],
      or: [
        "{name}ଫେରିଆସିଲ। ମୁଁ ଏଠି ଅଛି — ଅସୁବିଧା ନାହିଁ।",
        "{name}ପୁଣି ଦେଖି ଭଲ ଲାଗିଲା। ଯେଉଁଠି ଛାଡ଼ିଥିଲ ସେଠୁ ଆରମ୍ଭ କରିବା।",
        "ଟିକେ ସମୟ ହୋଇଗଲା। ସ୍ୱାଗତ — ପ୍ରସ୍ତୁତ ହେଲେ କୁହ।",
        "ବହୁ ସମୟ ହୋଇଗଲା। ସ୍ୱାଗତ। ସମୟ ନିଅ — ଶୁଣୁଛି।",
      ],
    };

    const dayMs = 86_400_000;
    const slotIndex =
      elapsedMs < 6 * hourMs ? 0 :
      elapsedMs < 2 * dayMs ? 1 :
      elapsedMs < 7 * dayMs ? 2 : 3;

    const nameToken = firstName ? `${firstName}, ` : "";
    const set = REENTRY[lang] ?? null;
    let reentryText: string;

    if (set) {
      reentryText = set[slotIndex].replace("{name}", nameToken);
    } else {
      // English fallback
      const EN: ReentrySet = [
        `${nameToken}you're back. I'm still here — no rush.`,
        `${nameToken}good to have you back. We can pick up where we left off, or start something new.`,
        "It's been a little while. Welcome back — I'm here whenever you're ready.",
        "It's been a while. Welcome back. Take your time — I'm listening.",
      ];
      reentryText = EN[slotIndex];
    }

    // Capitalise first letter (for English fallback)
    reentryText = reentryText.charAt(0).toUpperCase() + reentryText.slice(1);

    const reentryMsg: Message = {
      id: uid(),
      role: "assistant",
      content: reentryText,
      createdAt: Date.now(),
      sessionId: activeThread.id,
    };

    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? { ...t, messages: [...t.messages, reentryMsg] }
          : t,
      ),
    );
  }, [mounted, activeThread]);

  useEffect(() => {
    if (!mounted) return;
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(200, el.scrollHeight) + "px";
  }, [mounted, draft]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const remoteRaw = await fetchRemoteHistory();
      const merged = await syncHistory(remoteRaw);
      await persistMergedHistory(merged);
      setSyncedCount(Array.isArray(merged) ? merged.length : null);
      setLastSyncAt(Date.now());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setSyncError(msg);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) void runSync();
  }, [mounted, runSync]);

  const pulledRemoteChatRef = useRef(false);

  useEffect(() => {
    if (!mounted) return;
    if (pulledRemoteChatRef.current) return;
    pulledRemoteChatRef.current = true;

    // ✅ Respect user consent: only pull remote chat when allowRemote is ON
    if (!getAllowRemote()) return;

    (async () => {
      const remote = await fetchRemoteChatMessages();
      if (!remote.length) return;

      setThreads((prev) => mergeRemoteChatIntoThreads(prev, remote));
    })();
  }, [mounted]);

  async function triggerAnalyze() {
    if (!activeThread?.messages?.length) return;
    setAnalyzing(true);
    try {
      const res = (await runAnalysisWithConsent(
        activeThread.messages,
        10,
      )) as AnalysisResult | null;

      setAnalysis(res);
      console.log("[imotara] manual analysis:", res?.summary?.headline, res);
    } catch (err) {
      console.error("[imotara] manual analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  }

  function deriveEmotionFromSummaryAndText(
    summary: any,
    msgsForAnalysis: Message[],
  ): { emotion: string; source: DebugEmotionSource } {
    const rawFromSummary =
      summary?.primaryEmotion ?? summary?.emotion ?? summary?.tag ?? "";

    let emotion = String(rawFromSummary || "")
      .toLowerCase()
      .trim();
    let source: DebugEmotionSource = "unknown";

    const aliasMap: Record<string, string> = {
      down: "sad",
      depressed: "sad",
      joy: "happy",
      joyful: "happy",
      excited: "happy",
      optimistic: "happy",
      worried: "anxious",
      nervous: "anxious",
      furious: "angry",
      irritated: "angry",
      frustrated: "angry",
      overwhelmed: "stressed",
      "burnt out": "stressed",
      "burned out": "stressed",
      isolated: "lonely",
    };
    if (emotion && aliasMap[emotion]) {
      emotion = aliasMap[emotion];
    }

    const neutralish = new Set([
      "",
      "neutral",
      "mixed",
      "balanced",
      "even",
      "even and steady",
      "steady",
      "ok",
      "fine",
      "normal",
    ]);

    const lastUser = [...msgsForAnalysis]
      .slice()
      .reverse()
      .find((m) => m.role === "user");
    const text = (lastUser?.content ?? "").toLowerCase();

    if (emotion && !neutralish.has(emotion)) {
      source = "analysis";
      return { emotion, source };
    }

    return deriveEmotionFromUserText(text);
  }

  function deriveEmotionFromUserText(
    rawText: string,
  ): { emotion: string; source: DebugEmotionSource } {
    const raw = String(rawText || "").trim();
    const text = raw.toLowerCase();

    if (!text) {
      return { emotion: "neutral", source: "unknown" };
    }

    const shared = debugDetectEmotion(text);
    if (shared === "sad") {
      return { emotion: "sad", source: "fallback" };
    }
    if (shared === "stressed") {
      return { emotion: "stressed", source: "fallback" };
    }
    if (shared === "confused") {
      return { emotion: "confused", source: "fallback" };
    }

    // Telugu / Gujarati / Kannada / Odia conservative fallback cues
    if (
      /chaala pressure|pressure ga undi|naaku chaala kashtam|kashtam ga undi|bharam ga undi|ಒತ್ತಡ|ತುಂಬ ಒತ್ತಡ|ಖುಬ್ ಒತ್ತಡ|ତଣାବ|ଖୁବ ତଣାବ|ତଣାପୋଡ଼|તણાવ|બહુ તણાવ/.test(
        text,
      )
    ) {
      return { emotion: "stressed", source: "fallback" };
    }

    if (
      /baadha|chaala bhaaram|ಖರಾಪ|ଖରାପ ଲାଗୁଛି|મને ખોટું લાગે છે|બહુ ખરાબ લાગે છે|kashtam ga undi|kashtama irukku|bharam laga undi/.test(
        text,
      )
    ) {
      return { emotion: "sad", source: "fallback" };
    }

    if (
      /lonely|alone|isolated|nobody cares|no one cares|eka lagche|ekla|akele|akela/.test(
        text,
      )
    ) {
      return { emotion: "lonely", source: "fallback" };
    }

    if (
      /angry|furious|rage|irritated|annoyed|frustrated|pissed|gussa|rag|rosh/.test(
        text,
      )
    ) {
      return { emotion: "angry", source: "fallback" };
    }

    if (
      /happy|excited|joy|joyful|glad|grateful|thankful|optimistic|hopeful|thrilled|khushi|khush|bhalo lagche|valo lagche|ভালো লাগছে/.test(
        text,
      )
    ) {
      return { emotion: "happy", source: "fallback" };
    }

    return { emotion: "neutral", source: "unknown" };
  }

  const teenInsight = useMemo(() => {
    if (!analysis?.summary) return null;
    const summary: any = analysis.summary;
    const msgs = activeThread?.messages ?? [];
    if (!msgs.length) return null;

    const lastUser = [...msgs]
      .slice()
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUser) return null;

    const derived = deriveEmotionFromSummaryAndText(summary, msgs);
    const emotion = derived.emotion;

    const reflectionRaw =
      summary.reflection ??
      summary.explanation ??
      summary.coachingTip ??
      summary.nextStep ??
      summary.adviceLong ??
      summary.adviceShort ??
      "";

    const reflection = String(reflectionRaw || "").trim();
    if (!emotion || !reflection) return null;

    return buildTeenInsight({
      message: lastUser.content,
      emotion,
      reflection,
    });
  }, [analysis, activeThread?.messages]);

  // Assistant reply generator
  async function generateAssistantReply(
    threadId: string,
    msgsForAnalysis: Message[],
    userMessageId: string,
  ) {
    const replyKey = `${threadId}:${userMessageId}`;
    if (lastReplyKeyRef.current === replyKey) {
      return;
    }
    lastReplyKeyRef.current = replyKey;

    // ── Adult content safety gate ─────────────────────────────────────────
    const lastUserText = msgsForAnalysis[msgsForAnalysis.length - 1]?.content ?? "";
    if (detectAdultContent(lastUserText)) {
      const profile = getImotaraProfile();
      const lang = profile?.user?.preferredLang ?? "en";
      const userAge = profile?.user?.ageRange ?? undefined;
      const safetyMsg: Message = {
        id: uid(),
        role: "assistant",
        content: buildAdultSafetyRefusal(lang, userAge),
        createdAt: Date.now(),
        sessionId: threadId,
        replySource: "fallback",
      };
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? { ...t, messages: [...t.messages, safetyMsg] }
            : t,
        ),
      );
      setAnalyzing(false);
      return;
    }
    // ─────────────────────────────────────────────────────────────────────

    setAnalyzing(true);
    try {
      let debugEmotion: string | undefined;
      let debugEmotionSource: DebugEmotionSource = "unknown";
      let summary: any = {};

      try {
        const res = (await runAnalysisWithConsent(
          msgsForAnalysis,
          10,
        )) as AnalysisResult | null;
        summary = res?.summary ?? {};

        const derived = deriveEmotionFromSummaryAndText(
          summary,
          msgsForAnalysis,
        );
        debugEmotion = derived.emotion;
        debugEmotionSource = derived.source;
      } catch (err) {
        console.error("[imotara] reply analysis failed:", err);
      }
      let aiReply: string | null = null;
      let aiMetaFrom: string | null = null;
      let reflectionSeed: ReflectionSeed | undefined;
      let followUp: string | undefined;

      // ✅ MUST be declared before ANY conditional usage
      let analysisSource: "local" | "cloud" | null = null;

      // Optional diagnostics (report-only)
      let compatibility: any | undefined;

      if (remoteAllowed && ANALYSIS_IMPL === "api") {
        try {
          const resp = await runRespondWithConsent(
            // last user message
            msgsForAnalysis[msgsForAnalysis.length - 1]?.content ?? "",
            remoteAllowed,
            {
              threadId,

              // ✅ Baby Step 9.2 — parity with mobile
              recentMessages: msgsForAnalysis.slice(-6).map((m) => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.content,
              })),
            } as any,
          );

          const text = (resp?.message ?? "").toString().trim();
          if (text) {
            aiReply = text;
            reflectionSeed = resp.reflectionSeed;
            followUp = resp.followUp;

            // ✅ Compatibility Gate (report-only): capture meta if present
            compatibility =
              (resp as any)?.meta?.compatibility ??
              (resp as any)?.response?.meta?.compatibility;

            analysisSource = ((resp as any)?.meta?.analysisSource ??
              (resp as any)?.response?.meta?.analysisSource ??
              null) as "local" | "cloud" | null;

            aiMetaFrom = "openai";
            console.log(
              "[imotara] using /api/respond reply:",
              text.slice(0, 120),
            );
          }
        } catch (err) {
          console.warn("[imotara] /api/respond failed, falling back:", err);
        }
      }

      if (aiReply) {
        const assistantMsg: Message = {
          id: uid(),
          role: "assistant",
          content: aiReply,
          createdAt: Date.now(),
          sessionId: threadId,
          debugEmotion,
          debugEmotionSource,
          replySource:
            analysisSource === "local"
              ? "fallback"
              : aiMetaFrom === "openai"
                ? "openai"
                : "fallback",

          // ✅ NEW: parity metadata from /api/respond
          reflectionSeed,
          followUp,

          // ✅ Debug/diagnostics metadata (optional; report-only)
          meta:
            compatibility || analysisSource
              ? {
                ...(compatibility ? { compatibility } : {}),
                ...(analysisSource !== null ? { analysisSource } : {}),
              }
              : undefined,
        };

        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? { ...t, messages: [...t.messages, assistantMsg] }
              : t,
          ),
        );

        void pushChatMessageToRemote({
          id: assistantMsg.id,
          threadId,
          role: "assistant",
          content: assistantMsg.content,
          createdAtMs: assistantMsg.createdAt,
          meta: { replySource: assistantMsg.replySource ?? "fallback" },
        });

        void logAssistantMessageToHistory(assistantMsg);

        // Auto-focus composer when assistant reply arrives
        setTimeout(() => composerRef.current?.focus(), 0);

        return;
      }

      let fallbackReply: string | null = null;

      try {
        // ✅ derive user message safely from msgsForAnalysis
        const lastUser = [...msgsForAnalysis]
          .slice()
          .reverse()
          .find((m) => m.role === "user");

        const userText = (lastUser?.content ?? "").trim();

        const profile = getImotaraProfile();
        const companion = profile?.companion;

        const userAgeForLocal = profile?.user?.ageRange ?? undefined;
        const userGenderForLocal = profile?.user?.gender ?? undefined;
        const userNameForLocal = profile?.user?.name?.trim() || undefined;
        const responseStyleForLocal = profile?.user?.responseStyle ?? undefined; // #16

        // #9: count user turns in this thread so each turn gets a different seed offset
        const sessionTurn = msgsForAnalysis.filter((m) => m.role === "user").length;

        const localToneContext =
          profile && companion && isCompanionContextEnabled(profile)
            ? {
              companion: {
                name: companion.name?.trim() || "Imotara",
                relationship: companion.relationship ?? undefined,
                gender: companion.gender ?? undefined,
                ageRange: companion.ageRange ?? undefined,
                tone: deriveResponseToneFromToneContext({
                  companion: {
                    enabled: !!companion.enabled,
                    name: companion.name ?? undefined,
                    ageRange: companion.ageRange ?? undefined,
                    gender: companion.gender ?? undefined,
                    relationship: companion.relationship ?? undefined,
                  },
                }),
              },
              userName: userNameForLocal,
              userAge: userAgeForLocal,
              userGender: userGenderForLocal,
              sessionTurn,
              preferredResponseStyle: responseStyleForLocal,
            }
            : (userAgeForLocal || userGenderForLocal || userNameForLocal || responseStyleForLocal)
              ? { userName: userNameForLocal, userAge: userAgeForLocal, userGender: userGenderForLocal, sessionTurn, preferredResponseStyle: responseStyleForLocal }
              : { sessionTurn };

        // #1: Expand context window — pass last 8 user texts (excluding current) for language smoothing + follow-up memory
        const recentUserTexts = msgsForAnalysis
          .filter((m) => m.role === "user")
          .map((m) => m.content?.trim() ?? "")
          .filter(Boolean)
          .slice(-9, -1); // up to 8 prior user turns

        // #1: Also pass recent assistant texts for follow-up memory
        const recentAssistantTexts = msgsForAnalysis
          .filter((m) => m.role === "assistant")
          .map((m) => m.content?.trim() ?? "")
          .filter(Boolean)
          .slice(-4);

        // #12: Language smoothing — derive the last detected language from recent user messages
        const lastDetectedLanguage = recentUserTexts.length > 0
          ? (() => {
              const last = recentUserTexts[recentUserTexts.length - 1] ?? "";
              if (/[\u0980-\u09ff]/.test(last)) return "bn";
              if (/[\u0900-\u097f]/.test(last)) return "hi";
              if (/[\u0B80-\u0BFF]/.test(last)) return "ta";
              if (/[\u0C00-\u0C7F]/.test(last)) return "te";
              if (/[\u0A80-\u0AFF]/.test(last)) return "gu";
              if (/[\u0A00-\u0A7F]/.test(last)) return "pa";
              if (/[\u0C80-\u0CFF]/.test(last)) return "kn";
              if (/[\u0D00-\u0D7F]/.test(last)) return "ml";
              if (/[\u0B00-\u0B7F]/.test(last)) return "or";
              return undefined;
            })()
          : undefined;

        const local = buildLocalReply(userText, localToneContext, {
          recentUserTexts,
          recentAssistantTexts,
          lastDetectedLanguage,
          emotionMemory: buildEmotionMemorySummary(30),
        });

        fallbackReply = local.message;

        const localDerived = deriveEmotionFromUserText(userText);
        debugEmotion = localDerived.emotion;
        debugEmotionSource = localDerived.source;

        // ✅ ensure ReflectionSeed type safety
        reflectionSeed = local.reflectionSeed
          ? {
            intent: local.reflectionSeed.intent,
            title: local.reflectionSeed.title ?? "",
            prompt: local.reflectionSeed.prompt,
          }
          : undefined;

        analysisSource = "local";
      } catch (err) {
        console.error("[imotara] local fallback reply failed:", err);
      }

      const safeReply =
        (fallbackReply && fallbackReply.trim()) ||
        "I hear you. I may not have the perfect words yet, but I’m here to stay with you and keep listening.";

      const assistantMsg: Message = {
        id: uid(),
        role: "assistant",
        content: safeReply,
        createdAt: Date.now(),
        sessionId: threadId,
        debugEmotion,
        debugEmotionSource,
        replySource: "fallback",
      };

      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? { ...t, messages: [...t.messages, assistantMsg] }
            : t,
        ),
      );

      void pushChatMessageToRemote({
        id: assistantMsg.id,
        threadId,
        role: "assistant",
        content: assistantMsg.content,
        createdAtMs: assistantMsg.createdAt,
        meta: { replySource: assistantMsg.replySource ?? "fallback" },
      });

      void logAssistantMessageToHistory(assistantMsg);

      // Focus when fallback reply is shown
      setTimeout(() => composerRef.current?.focus(), 0);
    } finally {
      setAnalyzing(false);
    }
  }

  function newThread() {
    const createdAt = Date.now();

    const th = {
      id: crypto.randomUUID(),
      title: `Conversation — ${new Date(createdAt).toLocaleString()}`,
      messages: [],
      createdAt,
    };

    // Prepend new thread to the existing list
    setThreads((prev) => [th, ...prev]);

    // Make it active
    setActiveId(th.id);

    // Clear draft input
    setDraft("");
  }

  function deleteThread(id: string) {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeId === id) {
      const remaining = threads.filter((t) => t.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
  }

  function renameActive(title: string) {
    if (!activeThread) return;
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThread.id ? { ...t, title } : t)),
    );
  }

  function sendMessage() {
    // ✅ Guard: don't allow sending a new user message while assistant reply is generating
    if (analyzing) return;

    const text = draft.trim();
    if (!text) return;

    let targetId = activeId;
    let createdNewThread = false;

    if (!targetId) {
      const t: Thread = {
        id: uid(),
        title: "New conversation",
        createdAt: Date.now(),
        messages: [],
      };
      setThreads((prev) => [t, ...prev]);
      setActiveId(t.id);
      targetId = t.id;
      createdNewThread = true;
    }

    if (!targetId) return;

    const now = Date.now();

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: now,
      sessionId: targetId,
    };

    let existingThread: Thread | undefined;
    if (!createdNewThread && targetId) {
      existingThread = threads.find((t) => t.id === targetId);
    }
    const baseMessages = existingThread?.messages ?? [];
    const msgsForAnalysis = [...baseMessages, userMsg];

    setThreads((prev) =>
      prev.map((t) =>
        t.id === targetId
          ? {
            ...t,
            title:
              t.messages.length === 0
                ? text.slice(0, 40) + (text.length > 40 ? "…" : "")
                : t.title,
            messages: [...t.messages, userMsg],
          }
          : t,
      ),
    );

    void pushChatMessageToRemote({
      id: userMsg.id,
      threadId: targetId,
      role: "user",
      content: userMsg.content,
      createdAtMs: userMsg.createdAt,
      meta: { sessionId: userMsg.sessionId ?? targetId },
    });

    void logUserMessageToHistory(userMsg);

    // #18: 5-second undo window — delay generateAssistantReply
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setPendingUndo({ messageId: userMsg.id, threadId: targetId });
    undoTimerRef.current = setTimeout(() => {
      setPendingUndo(null);
      undoTimerRef.current = null;
      void generateAssistantReply(targetId!, msgsForAnalysis, userMsg.id);
    }, 5000);

    setDraft("");
  }

  function toggleVoice() {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
        : null;
    if (!SpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    // #19: Set recognition language from user profile, fall back to browser default
    const LANG_TO_BCP47: Record<string, string> = {
      hi: "hi-IN", mr: "mr-IN", bn: "bn-IN", ta: "ta-IN",
      te: "te-IN", kn: "kn-IN", ml: "ml-IN", gu: "gu-IN",
      pa: "pa-IN", or: "or-IN", en: "en-IN",
    };
    const profileLang = getImotaraProfile()?.user?.preferredLang ?? "";
    rec.lang = LANG_TO_BCP47[profileLang] ?? "";
    recognitionRef.current = rec;

    rec.onresult = (e: any) => {
      const transcript: string = e.results[0]?.[0]?.transcript ?? "";
      if (transcript.trim()) {
        setDraft((prev) => (prev.trim() ? `${prev} ${transcript.trim()}` : transcript.trim()));
      }
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    rec.start();
    setIsListening(true);
  }

  function handleUndo() {
    if (!pendingUndo) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    const { messageId, threadId } = pendingUndo;
    setPendingUndo(null);
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? { ...t, messages: t.messages.filter((m) => m.id !== messageId) }
          : t,
      ),
    );
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    if (!activeThread) return;
    setShowClearConfirm(true);
  }

  function confirmClear() {
    if (!activeThread) return;
    setShowClearConfirm(false);
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThread.id ? { ...t, messages: [] } : t)),
    );
    setChatToast({ message: "Conversation cleared", type: "info" });
  }

  // #22 + #23: Full data export — chat + reflections + history + profile
  function exportJSON() {
    const safeRead = (key: string) => {
      try { return JSON.parse(window.localStorage.getItem(key) ?? "null"); } catch { return null; }
    };
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      chat: { threads },
      reflections: safeRead("imotara.reflections.v1") ?? [],
      emotionHistory: safeRead("imotara:history:v1") ?? safeRead("imotara.history.v1") ?? [],
      profile: safeRead("imotara.profile.v1") ?? null,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `imotara_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setChatToast({ message: "Export downloaded ✓" });
  }

  return (
    <>
      {chatToast && (
        <Toast message={chatToast.message} type={chatToast.type} onDismiss={() => setChatToast(null)} />
      )}
      <div className="mx-auto w-full max-w-7xl px-3 pt-3 sm:px-4">
        <TopBar title="Chat" showSyncChip showConflictsButton />
      </div>

      <div className="mx-auto flex h-[calc(100vh-0px)] w-full max-w-7xl px-3 py-4 text-zinc-100 sm:px-4">
        {/* Sidebar */}
        <aside className="hidden w-72 flex-col gap-3 p-4 sm:flex imotara-glass-card">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Conversations
            </h2>
            <button
              onClick={newThread}
              className="inline-flex items-center gap-1 rounded-xl border border-sky-400/25 bg-gradient-to-r from-indigo-500/20 via-sky-500/15 to-emerald-400/15 px-3 py-1.5 text-xs text-zinc-100 shadow-sm backdrop-blur-sm transition hover:brightness-110 hover:-translate-y-0.5 hover:shadow-md duration-150 sm:text-sm"
              aria-label="New conversation"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>

          <div className="flex-1 space-y-1 overflow-auto pr-1">
            {!mounted ? (
              <div
                className="select-none rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-zinc-400"
                suppressHydrationWarning
              >
                Loading…
              </div>
            ) : threads.length === 0 ? (
              <div className="select-none rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-zinc-400">
                No conversations yet. Create one.
              </div>
            ) : (
              threads.map((t) => {
                const isActive = t.id === activeId;
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveId(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveId(t.id);
                      }
                    }}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${isActive
                      ? "bg-white/10 shadow-md"
                      : "hover:bg-white/5 hover:-translate-y-0.5 hover:shadow-sm duration-150"
                      }`}
                  >
                    <div className="min-w-0">
                      {/* Conversation title */}
                      <p
                        className={`truncate text-sm font-medium ${isActive ? "text-zinc-50" : "text-zinc-100"
                          }`}
                        title={t.title}
                      >
                        {t.title || "Conversation"}
                      </p>

                      {/* Meta row: date + (optional) small mode badge */}
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="line-clamp-1 text-xs text-zinc-500">
                          <DateText ts={t.createdAt} />
                        </p>
                      </div>
                    </div>
                    <button
                      className="ml-2 hidden rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-sm transition duration-150 group-hover:block"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteThread(t.id);
                      }}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="flex flex-1 flex-col">
          {/* HEADER */}
          <header className="px-3 pt-2 sm:px-4 sm:pt-3">
            <div className="imotara-glass-card px-3 py-2 sm:py-3">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-9 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-white shadow-[0_10px_30px_rgba(15,23,42,0.8)] sm:h-10 sm:w-12">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-50 sm:text-base">
                        <span suppressHydrationWarning>
                          {mounted
                            ? (activeThread?.title ?? "Conversation")
                            : ""}
                        </span>
                      </p>
                      <p className="text-[11px] text-zinc-400 sm:hidden">
                        {companionDisplayName ? (
                          <>
                            <span className="text-zinc-300">{companionDisplayName}</span>
                            <span className="text-zinc-500"> · </span>
                          </>
                        ) : null}
                        A calm space to talk about your feelings.
                        <span className="text-zinc-500"> · </span>
                        Local-first by default.
                      </p>

                      {/* Desktop: keep the "nice" header line always. Collapse only the extra details by default. */}
                      <div className="hidden space-y-0.5 sm:block">
                        <p
                          className={`text-sm text-zinc-400 ${showHeaderDetails ? "mb-3" : "mb-1"
                            }`}
                        >
                          {companionDisplayName ? (
                            <><span className="font-medium text-zinc-300">{companionDisplayName}</span> · </>
                          ) : null}
                          A calm space to talk about your feelings. Analysis and
                          replies respect your consent settings.
                        </p>

                        {showHeaderDetails && (
                          <div className="mb-3 space-y-2 text-xs text-zinc-500">
                            <p>
                              You can{" "}
                              <Link
                                href="/privacy"
                                className="underline decoration-indigo-400/60 underline-offset-2 hover:text-indigo-300"
                              >
                                download or delete what’s stored on this device
                              </Link>{" "}
                              anytime.
                            </p>

                            <p>
                              Note: Private/Incognito windows may not keep
                              messages after you close them (browser privacy
                              behavior).
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ✅ PARITY: top capsules become a single row on desktop */}
                  <div className="w-full sm:ml-auto sm:max-w-[720px]">
                    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
                      {/* Status chip: Sync status */}
                      <div
                        className="inline-flex h-7 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 text-xs text-white/90 backdrop-blur-sm"
                        title={
                          syncError
                            ? syncError
                            : syncing
                              ? "Sync in progress"
                              : lastSyncAt
                                ? `Last synced: ${syncedCount ?? 0} records`
                                : "Not synced yet"
                        }
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${syncing
                            ? "bg-amber-400"
                            : syncError
                              ? "bg-red-500"
                              : lastSyncAt
                                ? "bg-emerald-400"
                                : "bg-zinc-500"
                            }`}
                        />
                        <span>
                          {syncing
                            ? "Syncing…"
                            : lastSyncAt
                              ? `Synced ${syncedCount ?? 0}`
                              : "Not synced"}
                        </span>
                      </div>

                      {/* Action button: Sync now (hidden for public release until stable) */}
                      {ENABLE_REMOTE_SYNC ? (
                        <button
                          onClick={runSync}
                          disabled={syncing}
                          className="inline-flex h-7 w-full items-center justify-center gap-2 rounded-full border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 px-3 text-xs font-medium text-white backdrop-blur-sm transition hover:brightness-110 disabled:opacity-60"
                          type="button"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`}
                          />
                          Sync now
                        </button>
                      ) : (
                        // keep layout stable (3-column grid) without exposing broken control
                        <span
                          className="inline-flex h-7 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 text-xs text-white/60 backdrop-blur-sm"
                          title="Cloud sync will be available in a future update"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                          Cloud (Soon)
                        </span>
                      )}

                      {/* Status chip: Analysis mode */}
                      <div
                        className={`inline-flex h-7 w-full items-center justify-center gap-2 rounded-full px-3 text-xs backdrop-blur-sm ${mode === "allow-remote"
                          ? "border border-emerald-300/50 bg-emerald-500/10 text-emerald-200"
                          : "border border-white/15 bg-black/25 text-white/90"
                          }`}
                        title="Emotion analysis mode"
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote"
                            ? "bg-emerald-400"
                            : "bg-zinc-400"
                            }`}
                        />
                        {mode === "allow-remote"
                          ? "Remote allowed"
                          : "Local only"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ✅ PARITY: compact left stack + consistent alignment on desktop */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-2 sm:w-[340px] sm:flex-none sm:pt-1">
                    {/* Label kept (mobile-style: small + subtle) */}
                    <p className="text-xs font-medium text-zinc-400">
                      Emotion analysis mode
                    </p>

                    {/* Show/Hide details toggle — fixed width */}
                    <div className="flex w-full max-w-[320px] items-center gap-1.5">
                      <button
                        onClick={() => setShowHeaderDetails((v) => !v)}
                        className="inline-flex h-7 flex-1 items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 text-xs text-white/90 backdrop-blur-sm transition duration-150 hover:bg-white/10"
                        type="button"
                        aria-expanded={showHeaderDetails}
                        aria-label={showHeaderDetails ? "Hide header details" : "Show header details"}
                      >
                        {showHeaderDetails ? "Hide details" : "Show details"}
                      </button>
                      {/* Search toggle */}
                      <button
                        type="button"
                        onClick={() => { setShowSearch((v) => !v); setSearchQuery(""); }}
                        title="Search messages"
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition duration-150 ${
                          showSearch
                            ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-300"
                            : "border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                        }`}
                      >
                        <Search className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Headline capsule — fixed width + truncate (prevents text spilling above) */}
                    {analysis?.summary?.headline ? (
                      <span
                        className="inline-flex h-7 w-full max-w-[320px] items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 px-3 text-xs text-zinc-100 backdrop-blur-sm"
                        title={analysis.summary.headline}
                      >
                        <span className="w-full truncate text-center">
                          {analysis.summary.headline}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex h-7 w-full max-w-[320px] items-center justify-center rounded-full border border-dashed border-white/20 bg-black/30 px-3 text-xs text-zinc-400 backdrop-blur-sm">
                        No analysis yet
                      </span>
                    )}

                    {/* Collapsible header details: Teen Insight, guidance, engine text */}
                    {showHeaderDetails && teenInsight && (
                      <div className="mt-1 hidden rounded-2xl border border-violet-500/35 bg-violet-500/10 px-3 py-3 text-xs text-violet-50 shadow-sm sm:block">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-200/90">
                          Teen Insight
                        </div>
                        <div className="whitespace-pre-line text-[12px] leading-relaxed text-violet-50/95">
                          {teenInsight}
                        </div>
                      </div>
                    )}

                    {/* Local/Cloud toggle — same width as pills above */}
                    <div className="w-full max-w-[320px]">
                      <div className="h-9 w-full">
                        <AnalysisConsentToggle showHelp={showHeaderDetails} />
                      </div>
                    </div>

                    {showHeaderDetails && (
                      <div className="mt-1 max-w-[520px] space-y-2 text-left">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                          <p className="text-xs leading-5 text-zinc-300/90">
                            Your choice is stored only on this device. Right
                            now, Imotara analyzes emotions locally in your
                            browser.
                          </p>

                          <p className="mt-2 text-xs leading-5 text-zinc-300/90">
                            Your words stay on-device unless you explicitly
                            allow remote.
                          </p>

                          {mounted &&
                            typeof window !== "undefined" &&
                            window.localStorage.getItem("imotaraQa") ===
                            "1" && (
                              <>
                                <div className="mt-3 h-px w-full bg-white/10" />
                                <p className="mt-3 text-[11px] leading-5 text-zinc-400">
                                  Tip: You can switch between on-device and
                                  remote analysis anytime using the toggle
                                  above.
                                </p>
                              </>
                            )}

                          {/* Compatibility Gate (report-only): Debug UI surface */}
                          {(() => {
                            const compat =
                              (analysis as any)?.response?.meta
                                ?.compatibility ??
                              (analysis as any)?.meta?.compatibility;

                            if (!compat) return null;

                            const summary =
                              typeof compat?.summary === "string"
                                ? compat.summary
                                : compat?.ok === true
                                  ? "OK"
                                  : "NOT OK";

                            return (
                              <>
                                <div className="mt-3 h-px w-full bg-white/10" />
                                <div className="mt-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
                                      Compatibility Gate
                                    </div>
                                    <div className="text-[11px] text-zinc-200">
                                      {summary}
                                    </div>
                                  </div>

                                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-200">
                                    {JSON.stringify(compat, null, 2)}
                                  </pre>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:w-full sm:max-w-[720px] sm:grid-cols-3 sm:justify-items-stretch">
                    <Link
                      href={
                        activeThread
                          ? `/history?sessionId=${encodeURIComponent(activeThread.id)}${urlMessageId
                            ? `&messageId=${encodeURIComponent(urlMessageId)}`
                            : ""
                          }`
                          : "/history"
                      }
                      className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 px-5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:border-indigo-300/45 hover:from-indigo-500/20 hover:via-sky-500/15 hover:to-emerald-400/15 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                      title="Open Emotion History filtered to this chat session"
                    >
                      History
                    </Link>

                    <button
                      onClick={triggerAnalyze}
                      disabled={analyzing || !activeThread?.messages?.length}
                      aria-busy={analyzing ? true : undefined}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 px-5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:border-indigo-300/45 hover:from-indigo-500/20 hover:via-sky-500/15 hover:to-emerald-400/15 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 disabled:opacity-60"
                      title="Run emotion analysis now (respects your consent setting)"
                      type="button"
                    >
                      {analyzing ? (
                        <RefreshCw className="h-3 w-3 animate-spin sm:h-4 sm:w-4" />
                      ) : null}
                      Re-analyze
                    </button>

                    <Link
                      href="/privacy"
                      className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 px-5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:border-indigo-300/45 hover:from-indigo-500/20 hover:via-sky-500/15 hover:to-emerald-400/15 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                      title="See how Imotara handles your data and privacy"
                    >
                      Privacy
                    </Link>

                    {showClearConfirm ? (
                      <div className="w-full rounded-2xl border border-red-400/30 bg-red-950/50 px-3 py-2 text-xs text-red-200">
                        <p className="mb-2 font-medium">Clear all messages?</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={confirmClear}
                            className="rounded-full bg-red-500/80 px-3 py-1 font-medium text-white transition hover:bg-red-500"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowClearConfirm(false)}
                            className="rounded-full border border-white/10 px-3 py-1 text-zinc-300 transition hover:bg-white/10"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={clearChat}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 px-5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:border-indigo-300/45 hover:from-indigo-500/20 hover:via-sky-500/15 hover:to-emerald-400/15 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                        title="Clear current conversation"
                        type="button"
                      >
                        <Eraser className="h-3 w-3 sm:h-4 sm:w-4" /> Clear
                      </button>
                    )}

                    <button
                      onClick={exportJSON}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 px-5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:border-indigo-300/45 hover:from-indigo-500/20 hover:via-sky-500/15 hover:to-emerald-400/15 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                      title="Download all conversations as JSON"
                      type="button"
                    >
                      <Download className="h-3 w-3 sm:h-4 sm:w-4" /> Export
                    </button>

                    <button
                      onClick={newThread}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/25 via-sky-500/20 to-emerald-400/20 px-5 text-sm font-medium text-white shadow-[0_12px_34px_rgba(15,23,42,0.65)] backdrop-blur-sm transition hover:border-indigo-300/55 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                      type="button"
                    >
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4" /> New
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* BODY */}
          <div className="relative flex-1 min-h-0">
            {/* Emotion-reactive ambient glow — subtle radial tint that shifts with mood */}
            {emotionGlowColor && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 transition-all duration-[2000ms]"
                style={{
                  background: `radial-gradient(ellipse at 75% 12%, ${emotionGlowColor} 0%, transparent 55%)`,
                }}
              />
            )}
          <div
            ref={listRef}
            className="relative z-10 h-full overflow-y-auto px-4 py-4 sm:px-6"
          >
            {!mounted ? (
              <div className="mx-auto max-w-3xl">
                <div
                  className="mt-8 rounded-2xl border border-dashed border-white/20 bg-black/30 p-8 text-center text-zinc-400"
                  suppressHydrationWarning
                >
                  Loading…
                </div>
              </div>
            ) : !activeThread || activeThread.messages.length === 0 ? (
              <EmptyState
                onChipSelect={(text) => { setDraft(text); }}
                lang={preferredLang}
              />
            ) : (
              <div className="mx-auto max-w-3xl space-y-4">
                {/* #21: Local mode indicator — shown when remote is off */}
                {!remoteAllowed && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-zinc-400">
                    <span>
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-zinc-500 align-middle" />
                      On-device mode — replies use local templates (no AI).
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowHeaderDetails(true)}
                      className="shrink-0 text-indigo-400/80 underline underline-offset-2 hover:text-indigo-300 transition"
                    >
                      Enable cloud replies
                    </button>
                  </div>
                )}

                <div className="imotara-glass-card p-4">
                  <MoodSummaryCard
                    messages={appMessages}
                    windowSize={10}
                    mode="local"
                  />
                </div>

                {/* Reflection Seed Card (quiet prompts; optional) */}
                {analysis?.reflectionSeedCard?.prompts?.length ? (
                  <div className="imotara-glass-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-50">
                          Reflection seeds
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          If you want, pick one to reflect on — no pressure.
                        </p>
                      </div>

                      <span className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[11px] text-zinc-300">
                        Optional
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {analysis.reflectionSeedCard.prompts.map((p, i) => (
                        <button
                          key={`${i}-${p}`}
                          type="button"
                          onClick={() => {
                            const next = p.trim();
                            if (!next) return;
                            setDraft((prev) =>
                              prev?.trim() ? `${prev}\n\n${next}` : next,
                            );
                            // keep it tiny: no auto-send, just helps start writing
                            setTimeout(() => composerRef.current?.focus(), 0);
                          }}
                          className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-left text-[12px] text-zinc-100 shadow-sm transition hover:bg-white/10 hover:brightness-110"
                          title="Add to composer"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Search bar */}
                {showSearch && (
                  <div className="mb-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                    <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                    <input
                      autoFocus
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search messages…"
                      className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery("")} className="text-zinc-500 hover:text-zinc-300 transition">
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="text-zinc-500 hover:text-zinc-300 transition text-[11px]">
                      Close
                    </button>
                  </div>
                )}

                {activeThread.messages
                  .filter((m) =>
                    !searchQuery.trim() ||
                    m.content.toLowerCase().includes(searchQuery.toLowerCase()),
                  )
                  .map((m) => (
                  <Bubble
                    key={m.id}
                    id={m.id}
                    role={m.role}
                    content={m.content}
                    time={m.createdAt}
                    highlighted={m.id === highlightedMessageId}
                    sessionId={m.sessionId ?? activeThread.id}
                    debugEmotion={m.debugEmotion}
                    debugEmotionSource={m.debugEmotionSource}
                    replySource={m.replySource}
                    attachRef={
                      m.id === urlMessageId
                        ? (el) => {
                          if (el) {
                            messageTargetRef.current = el;
                          }
                        }
                        : undefined
                    }
                    reflectionSeed={m.reflectionSeed}
                    followUp={m.followUp}
                    meta={m.meta}
                    reaction={reactions[m.id]}
                    onReact={(emoji) =>
                      setReactions((prev) => {
                        const next = { ...prev };
                        if (next[m.id] === emoji) delete next[m.id]; // toggle off
                        else next[m.id] = emoji;
                        return next;
                      })
                    }
                    bookmarked={bookmarks.has(m.id)}
                    onBookmark={() => toggleBookmark(m.id)}
                  />
                ))}

                {/* #9: Typing indicator — shows while Imotara is composing a reply */}
                {analyzing && !pendingUndo && (
                  <div className="flex justify-start pl-1">
                    <div className="rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-slate-900/80 to-indigo-950/80 px-4 py-3 text-sm backdrop-blur-md">
                      <span className="inline-flex items-center gap-1 text-zinc-400">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400/70 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400/70 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/70 [animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>{/* end emotion-ambient wrapper */}

          {/* #6: Weekly mood recap banner */}
          {weeklyRecap && !weeklyRecapDismissed && (
            <div className="mx-auto mb-1 flex max-w-3xl items-start justify-between gap-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-2.5 text-xs text-indigo-200">
              <span>{weeklyRecap}</span>
              <div className="flex shrink-0 items-center gap-2">
                <a href="/grow" className="font-semibold underline underline-offset-2 hover:text-indigo-100 transition">
                  Reflect →
                </a>
                <button type="button" onClick={() => setWeeklyRecapDismissed(true)} className="opacity-50 hover:opacity-100 transition" aria-label="Dismiss">✕</button>
              </div>
            </div>
          )}

          {/* #8: Reflection bridge — nudge to Grow after 3+ user messages */}
          {!growNudgeDismissed &&
            (activeThread?.messages.filter((m) => m.role === "user").length ?? 0) >= 3 &&
            !analyzing && (
            <div className="mx-auto mb-1 flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-500/8 px-4 py-2 text-xs text-emerald-300">
              <span>You&apos;ve been opening up — would a short reflection help?</span>
              <div className="flex shrink-0 items-center gap-2">
                <a href="/grow" className="font-semibold underline underline-offset-2 hover:text-emerald-200 transition">
                  Grow →
                </a>
                <button type="button" onClick={() => setGrowNudgeDismissed(true)} className="opacity-50 hover:opacity-100 transition" aria-label="Dismiss">✕</button>
              </div>
            </div>
          )}

          {/* #4: Crisis intervention banner — localized */}
          {crisisTier >= 1 && (() => {
            const txt = CRISIS_BANNER_BY_LANG[preferredLang] ?? CRISIS_BANNER_BY_LANG.en;
            return (
              <div className={`mx-auto mb-1 max-w-3xl rounded-2xl border px-4 py-3 text-sm ${
                crisisTier === 2
                  ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                  : "border-amber-400/30 bg-amber-500/10 text-amber-200"
              }`}>
                <p>
                  {crisisTier === 2 ? txt.tier2 : txt.tier1}{" "}
                  <a
                    href="https://findahelpline.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-2 hover:opacity-80"
                  >
                    {txt.link}
                  </a>
                  {crisisTier === 2 ? ". I\u2019m still here too." : " can help."}
                </p>
              </div>
            );
          })()}

          {/* #18: Undo toast with countdown drain bar */}
          {pendingUndo && (
            <div className="mx-auto mb-1 max-w-3xl overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-500/10 text-xs text-amber-200">
              {/* Draining progress bar */}
              <div className="h-0.5 w-full bg-amber-900/40">
                <div className="h-0.5 bg-amber-400/70 animate-undo-drain" />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2">
                <span>Sending in a moment…</span>
                <button
                  type="button"
                  onClick={handleUndo}
                  className="font-semibold underline underline-offset-2 hover:text-amber-100 transition"
                >
                  Undo
                </button>
              </div>
            </div>
          )}

          {/* COMPOSER */}
          <div className="border-t border-white/10 px-3 pb-1 pt-1 sm:px-4">
            {/* Breathing widget — shown above composer when toggled */}
            {showBreathing && (
              <div className="mx-auto mb-3 max-w-3xl">
                <BreathingWidget onClose={() => setShowBreathing(false)} />
              </div>
            )}
            {/* #11: Sentiment seed chips — quick-tap mood hints for active conversations */}
            {activeThread && activeThread.messages.length > 0 && !draft.trim() && (
              <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-1.5">
                {(SENTIMENT_SEEDS_BY_LANG[preferredLang] ?? SENTIMENT_SEEDS_BY_LANG.en).map((seed) => (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => { setDraft(seed); setTimeout(() => composerRef.current?.focus(), 0); }}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                  >
                    {seed}
                  </button>
                ))}
              </div>
            )}
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={composerPlaceholder}
                suppressHydrationWarning
                rows={1}
                className="max-h-[200px] flex-1 resize-none rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-indigo-400/70 focus:ring-1 focus:ring-indigo-500/60"
              />
              {/* #19: Voice input mic button */}
              {mounted &&
                ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  title={isListening ? "Stop listening" : "Speak your message"}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                    isListening
                      ? "border-rose-400/50 bg-rose-500/20 text-rose-300 animate-pulse"
                      : "border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                  }`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              {/* Breathing widget toggle */}
              <button
                type="button"
                onClick={() => setShowBreathing((v) => !v)}
                title="Breathing exercise"
                className={`h-11 w-11 inline-flex items-center justify-center rounded-2xl border transition ${
                  showBreathing
                    ? "border-sky-400/50 bg-sky-500/20 text-sky-300"
                    : "border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                <Wind className="h-4 w-4" />
              </button>

              <button
                onClick={sendMessage}
                disabled={analyzing || !draft.trim()}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/15 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-4 text-sm font-medium text-white shadow-lg transition hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(129,140,248,0.7)] duration-150 disabled:opacity-50"
                type="button"
              >
                <Send className="h-4 w-4" /> Send
              </button>
            </div>
            {/* Crisis note */}
            <p className="mx-auto mt-1.5 max-w-3xl text-center text-[10px] text-zinc-600">
              If you&apos;re in crisis or need immediate help, please reach out to a{" "}
              <a
                href="https://findahelpline.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-zinc-400"
              >
                crisis helpline
              </a>
              . Imotara is a reflection companion, not a substitute for professional support.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

const STARTER_CHIPS = [
  "I'm feeling a bit overwhelmed today.",
  "Something good happened and I want to share it.",
  "I'm not sure how I feel right now.",
  "I've been anxious lately and can't pinpoint why.",
  "I had a tough conversation with someone I care about.",
];

// #17: Mood check-in options — per language
type MoodOption = { emoji: string; label: string; starter: string };

const MOOD_OPTIONS_BY_LANG: Record<string, MoodOption[]> = {
  en: [
    { emoji: "😊", label: "Good",       starter: "I'm feeling pretty good today." },
    { emoji: "😔", label: "Sad",        starter: "I've been feeling sad and I'm not sure why." },
    { emoji: "😰", label: "Stressed",   starter: "I've been feeling really stressed lately." },
    { emoji: "😤", label: "Frustrated", starter: "I'm frustrated and I need to let it out." },
    { emoji: "😟", label: "Anxious",    starter: "I've been feeling anxious and worried." },
    { emoji: "🌧️", label: "Lonely",     starter: "I feel kind of lonely right now." },
  ],
  hi: [
    { emoji: "😊", label: "अच्छा",      starter: "आज मैं काफी अच्छा/अच्छी महसूस कर रहा/रही हूँ।" },
    { emoji: "😔", label: "उदास",       starter: "पता नहीं क्यों, लेकिन आज मन उदास है।" },
    { emoji: "😰", label: "तनाव",       starter: "कुछ समय से बहुत तनाव में हूँ।" },
    { emoji: "😤", label: "गुस्सा",     starter: "बहुत गुस्सा है, बाहर निकालना है।" },
    { emoji: "😟", label: "चिंता",      starter: "काफी परेशान और चिंतित हूँ।" },
    { emoji: "🌧️", label: "अकेलापन",  starter: "अभी काफी अकेलापन महसूस हो रहा है।" },
  ],
  mr: [
    { emoji: "😊", label: "बरं",        starter: "आज मला खूप बरं वाटतंय।" },
    { emoji: "😔", label: "उदास",       starter: "का कोणास ठाऊक, मन उदास आहे।" },
    { emoji: "😰", label: "ताण",        starter: "बऱ्याच दिवसांपासून खूप ताण आहे।" },
    { emoji: "😤", label: "राग",        starter: "खूप राग आलाय, बोलायचंय।" },
    { emoji: "😟", label: "काळजी",     starter: "खूप काळजी वाटतेय।" },
    { emoji: "🌧️", label: "एकटं",      starter: "आत्ता खूप एकटं वाटतंय।" },
  ],
  bn: [
    { emoji: "😊", label: "ভালো",       starter: "আজ বেশ ভালো লাগছে।" },
    { emoji: "😔", label: "মন খারাপ",  starter: "কেন জানি না, মন খারাপ।" },
    { emoji: "😰", label: "চাপ",        starter: "অনেকদিন ধরে খুব চাপে আছি।" },
    { emoji: "😤", label: "রাগ",        starter: "রাগ জমে আছে, বলতে চাই।" },
    { emoji: "😟", label: "উদ্বেগ",    starter: "অনেক উদ্বিগ্ন আছি।" },
    { emoji: "🌧️", label: "একা",        starter: "এখন খুব একা একা লাগছে।" },
  ],
  ta: [
    { emoji: "😊", label: "நலம்",      starter: "இன்று நன்றாக உணர்கிறேன்।" },
    { emoji: "😔", label: "சோர்வு",    starter: "ஏனோ மனம் சோர்வாக இருக்கிறது।" },
    { emoji: "😰", label: "அழுத்தம்", starter: "சில நாட்களாக மிகவும் மன அழுத்தமாக இருக்கிறது।" },
    { emoji: "😤", label: "கோபம்",     starter: "மிகவும் கோபமாக இருக்கிறது, சொல்ல வேண்டும்।" },
    { emoji: "😟", label: "கவலை",     starter: "மிகவும் கவலையாகவும் பதட்டமாகவும் இருக்கிறேன்।" },
    { emoji: "🌧️", label: "தனிமை",   starter: "இப்போது மிகவும் தனிமையாக உணர்கிறேன்।" },
  ],
  te: [
    { emoji: "😊", label: "బాగుంది",  starter: "ఈరోజు చాలా బాగుంది అనిపిస్తోంది।" },
    { emoji: "😔", label: "విచారం",   starter: "ఎందుకో మనసు నిరాశగా ఉంది।" },
    { emoji: "😰", label: "ఒత్తిడి",  starter: "చాలా రోజులుగా చాలా ఒత్తిడిగా ఉంది।" },
    { emoji: "😤", label: "కోపం",     starter: "చాలా కోపంగా ఉంది, చెప్పాలని ఉంది।" },
    { emoji: "😟", label: "ఆందోళన",  starter: "చాలా ఆందోళనగా ఉంది।" },
    { emoji: "🌧️", label: "ఒంటరి",   starter: "ఇప్పుడు చాలా ఒంటరిగా అనిపిస్తోంది।" },
  ],
  kn: [
    { emoji: "😊", label: "ಚೆನ್ನಾಗಿದೆ", starter: "ಇಂದು ತುಂಬಾ ಚೆನ್ನಾಗಿ ಅನಿಸುತ್ತಿದೆ." },
    { emoji: "😔", label: "ದುಃಖ",       starter: "ಯಾಕೋ ಮನಸ್ಸು ನಿರಾಶವಾಗಿದೆ." },
    { emoji: "😰", label: "ಒತ್ತಡ",      starter: "ಕೆಲವು ದಿನಗಳಿಂದ ತುಂಬಾ ಒತ್ತಡ ಇದೆ." },
    { emoji: "😤", label: "ಕೋಪ",        starter: "ತುಂಬಾ ಕೋಪ ಬಂದಿದೆ, ಹೇಳಬೇಕು." },
    { emoji: "😟", label: "ಆತಂಕ",      starter: "ತುಂಬಾ ಆತಂಕ ಆಗುತ್ತಿದೆ." },
    { emoji: "🌧️", label: "ಒಂಟಿ",       starter: "ಈಗ ತುಂಬಾ ಒಂಟಿ ಅನಿಸುತ್ತಿದೆ." },
  ],
  ml: [
    { emoji: "😊", label: "നന്നായി",   starter: "ഇന്ന് വളരെ നന്നായി തോന്നുന്നു." },
    { emoji: "😔", label: "സങ്കടം",    starter: "എന്തുകൊണ്ടോ മനസ്സ് വിഷമത്തിലാണ്." },
    { emoji: "😰", label: "സമ്മർദ്ദം", starter: "കുറച്ച് ദിവസമായി വളരെ സമ്മർദ്ദം ഉണ്ട്." },
    { emoji: "😤", label: "ദേഷ്യം",    starter: "വളരെ ദേഷ്യം ഉണ്ട്, പറയണം." },
    { emoji: "😟", label: "ഉത്കണ്ഠ",  starter: "വളരെ ഉത്കണ്ഠ തോന്നുന്നു." },
    { emoji: "🌧️", label: "ഒറ്റപ്പെടൽ", starter: "ഇപ്പോൾ വളരെ ഒറ്റയ്ക്ക് തോന്നുന്നു." },
  ],
  gu: [
    { emoji: "😊", label: "સારું",     starter: "આજ ઘણું સારું લાગે છે." },
    { emoji: "😔", label: "ઉદાસ",      starter: "કેમ ખબર નહીં, મન ઉદાસ છે." },
    { emoji: "😰", label: "તણાવ",      starter: "ઘણા દિવસોથી ખૂબ તણાવ છે." },
    { emoji: "😤", label: "ગુસ્સો",    starter: "ખૂબ ગુસ્સો આવ્યો છે, કહેવું છે." },
    { emoji: "😟", label: "ચિંતા",     starter: "ઘણી ચિંતા થઈ રહી છે." },
    { emoji: "🌧️", label: "એકલાપણું", starter: "અત્યારે ઘણું એકલું લાગે છે." },
  ],
  pa: [
    { emoji: "😊", label: "ਚੰਗਾ",      starter: "ਅੱਜ ਬਹੁਤ ਚੰਗਾ ਲੱਗ ਰਿਹਾ ਹੈ।" },
    { emoji: "😔", label: "ਉਦਾਸ",      starter: "ਪਤਾ ਨਹੀਂ ਕਿਉਂ, ਮਨ ਉਦਾਸ ਹੈ।" },
    { emoji: "😰", label: "ਤਣਾਅ",      starter: "ਕੁਝ ਦਿਨਾਂ ਤੋਂ ਬਹੁਤ ਤਣਾਅ ਵਿੱਚ ਹਾਂ।" },
    { emoji: "😤", label: "ਗੁੱਸਾ",     starter: "ਬਹੁਤ ਗੁੱਸਾ ਹੈ, ਬਾਹਰ ਕੱਢਣਾ ਹੈ।" },
    { emoji: "😟", label: "ਚਿੰਤਾ",     starter: "ਬਹੁਤ ਚਿੰਤਾ ਹੋ ਰਹੀ ਹੈ।" },
    { emoji: "🌧️", label: "ਇਕੱਲਾਪਣ", starter: "ਹੁਣ ਬਹੁਤ ਇਕੱਲਾਪਣ ਮਹਿਸੂਸ ਹੋ ਰਿਹਾ ਹੈ।" },
  ],
  or: [
    { emoji: "😊", label: "ଭଲ",        starter: "ଆଜି ବେଶ ଭଲ ଲାଗୁଛି।" },
    { emoji: "😔", label: "ଦୁଃଖ",      starter: "କାହିଁକି ଜାଣି ନାହିଁ, ମନ ଖରାପ ଅଛି।" },
    { emoji: "😰", label: "ଚାପ",       starter: "କିଛି ଦିନ ଧରି ଖୁବ ଚାପ ଅନୁଭବ ହେଉଛି।" },
    { emoji: "😤", label: "ରାଗ",       starter: "ଖୁବ ରାଗ ହେଉଛି, ବାହାର କରିବାକୁ ଚାହୁଁଛି।" },
    { emoji: "😟", label: "ଚିନ୍ତା",   starter: "ଖୁବ ଚିନ୍ତା ଲାଗୁଛି।" },
    { emoji: "🌧️", label: "ଏକୁଟିଆ",   starter: "ଏବେ ଖୁବ ଏକୁଟିଆ ଲାଗୁଛି।" },
  ],
};

// How are you feeling — localised header
const MOOD_HEADING: Record<string, string> = {
  en: "How are you feeling?",
  hi: "आप कैसा महसूस कर रहे हैं?",
  mr: "तुम्हाला कसं वाटतंय?",
  bn: "আপনি কেমন অনুভব করছেন?",
  ta: "நீங்கள் எப்படி உணர்கிறீர்கள்?",
  te: "మీరు ఎలా అనిపిస్తున్నారు?",
  kn: "ನೀವು ಹೇಗೆ ಅನಿಸುತ್ತಿದ್ದೀರಿ?",
  ml: "നിങ്ങൾക്ക് എങ്ങനെ തോന്നുന്നു?",
  gu: "તમને કેવું લાગે છે?",
  pa: "ਤੁਸੀਂ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ?",
  or: "ଆପଣ କିପରି ଅନୁଭବ କରୁଛନ୍ତି?",
};

const OR_TYPE_BELOW: Record<string, string> = {
  en: "or start typing below",
  hi: "या नीचे लिखना शुरू करें",
  mr: "किंवा खाली टाइप करा",
  bn: "অথবা নিচে লিখুন",
  ta: "அல்லது கீழே தட்டச்சு செய்யுங்கள்",
  te: "లేదా క్రింద టైప్ చేయండి",
  kn: "ಅಥವಾ ಕೆಳಗೆ ಟೈಪ್ ಮಾಡಿ",
  ml: "അല്ലെങ്കിൽ താഴെ ടൈപ്പ് ചെയ്യൂ",
  gu: "અથવા નીચે ટાઇપ કરો",
  pa: "ਜਾਂ ਹੇਠਾਂ ਟਾਈਪ ਕਰੋ",
  or: "ଅଥବା ନୀଚରେ ଟାଇପ୍ କରନ୍ତୁ",
};

const GREETING_BY_LANG: Record<string, { morning: string; afternoon: string; evening: string; night: string }> = {
  en: { morning: "Good morning 🌅", afternoon: "Good afternoon ☀️", evening: "Good evening 🌙", night: "Still up? 🌟" },
  hi: { morning: "शुभ प्रभात 🌅", afternoon: "शुभ दोपहर ☀️", evening: "शुभ संध्या 🌙", night: "अभी भी जाग रहे हो? 🌟" },
  mr: { morning: "शुभ सकाळ 🌅", afternoon: "शुभ दुपार ☀️", evening: "शुभ संध्याकाळ 🌙", night: "अजूनही जागे आहात? 🌟" },
  bn: { morning: "শুভ সকাল 🌅", afternoon: "শুভ বিকেল ☀️", evening: "শুভ সন্ধ্যা 🌙", night: "এখনও জেগে? 🌟" },
  ta: { morning: "காலை வணக்கம் 🌅", afternoon: "மதிய வணக்கம் ☀️", evening: "மாலை வணக்கம் 🌙", night: "இன்னும் விழித்திருக்கிறீர்களா? 🌟" },
  te: { morning: "శుభోదయం 🌅", afternoon: "శుభ మధ్యాహ్నం ☀️", evening: "శుభ సాయంత్రం 🌙", night: "ఇంకా మేల్కొని ఉన్నారా? 🌟" },
  kn: { morning: "ಶುಭ ಬೆಳಿಗ್ಗೆ 🌅", afternoon: "ಶುಭ ಮಧ್ಯಾಹ್ನ ☀️", evening: "ಶುಭ ಸಂಜೆ 🌙", night: "ಇನ್ನೂ ಎಚ್ಚರವಾಗಿದ್ದೀರಾ? 🌟" },
  ml: { morning: "ശുഭ പ്രഭാതം 🌅", afternoon: "ശുഭ ഉച്ചക്ക് ☀️", evening: "ശുഭ സന്ധ്യ 🌙", night: "ഇനിയും ഉണർന്നിരിക്കുന്നോ? 🌟" },
  gu: { morning: "શુભ સવાર 🌅", afternoon: "શુભ બપોર ☀️", evening: "શુભ સાંજ 🌙", night: "હજી જાગો છો? 🌟" },
  pa: { morning: "ਸ਼ੁਭ ਸਵੇਰ 🌅", afternoon: "ਸ਼ੁਭ ਦੁਪਹਿਰ ☀️", evening: "ਸ਼ੁਭ ਸ਼ਾਮ 🌙", night: "ਅਜੇ ਵੀ ਜਾਗ ਰਹੇ ਹੋ? 🌟" },
  or: { morning: "ଶୁଭ ସକାଳ 🌅", afternoon: "ଶୁଭ ଅପରାହ୍ନ ☀️", evening: "ଶୁଭ ସନ୍ଧ୍ୟା 🌙", night: "ଏখনও ଜାଗ୍ରତ? 🌟" },
};

function getGreeting(lang: string): string {
  const h = new Date().getHours();
  const g = GREETING_BY_LANG[lang] ?? GREETING_BY_LANG.en;
  if (h >= 5 && h < 12) return g.morning;
  if (h >= 12 && h < 17) return g.afternoon;
  if (h >= 17 && h < 21) return g.evening;
  return g.night;
}

function EmptyState({ onChipSelect, lang = "en" }: { onChipSelect: (text: string) => void; lang?: string }) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("");

  useEffect(() => { setGreeting(getGreeting(lang)); }, [lang]);

  const moodOptions = MOOD_OPTIONS_BY_LANG[lang] ?? MOOD_OPTIONS_BY_LANG.en;
  const moodHeading = MOOD_HEADING[lang] ?? MOOD_HEADING.en;
  const orTypeLine = OR_TYPE_BELOW[lang] ?? OR_TYPE_BELOW.en;

  function pickMood(starter: string, emoji: string) {
    setSelectedMood(emoji);
    onChipSelect(starter);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mt-8 rounded-2xl border border-dashed border-white/20 bg-black/30 p-8 text-center text-zinc-200">
        {greeting && (
          <p className="mb-1 text-lg font-semibold text-zinc-100 animate-fade-in" suppressHydrationWarning>
            {greeting}
          </p>
        )}
        <p className="text-base font-medium">Start a conversation</p>
        <p className="mt-1 text-sm text-zinc-400">
          Messages are saved in your browser, and analysis/replies respect your
          consent settings.
        </p>

        {/* #17: Mood check-in row */}
        <div className="mt-5">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
            {moodHeading}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {moodOptions.map(({ emoji, label, starter }) => (
              <button
                key={emoji}
                type="button"
                onClick={() => pickMood(starter, emoji)}
                title={label}
                className={`flex flex-col items-center gap-0.5 rounded-2xl border px-3 py-2 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
                  selectedMood === emoji
                    ? "border-indigo-400/60 bg-indigo-500/20 text-zinc-50"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-zinc-100"
                }`}
              >
                <span className="text-xl">{emoji}</span>
                <span className="text-[10px]">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] text-zinc-600">{orTypeLine}</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {STARTER_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => onChipSelect(chip)}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const REACTION_EMOJIS = ["❤️", "💙", "✨", "🙏", "💛"];

function Bubble({
  id,
  role,
  content,
  time,
  highlighted,
  attachRef,
  sessionId,
  debugEmotion,
  debugEmotionSource,
  replySource,
  reflectionSeed,
  followUp,
  meta,
  reaction,
  onReact,
  bookmarked,
  onBookmark,
}: {
  id: string;
  role: Role;
  content: string;
  time: number;
  highlighted?: boolean;
  attachRef?: (el: HTMLDivElement | null) => void;
  sessionId?: string;
  debugEmotion?: string;
  debugEmotionSource?: DebugEmotionSource;
  replySource?: "openai" | "fallback";
  reflectionSeed?: ReflectionSeed;
  followUp?: string;
  meta?: {
    compatibility?: any;
    analysisSource?: "local" | "cloud";
    softEnforcement?: any;
  };
  reaction?: string;
  onReact?: (emoji: string) => void;
  bookmarked?: boolean;
  onBookmark?: () => void;
}) {
  const isUser = role === "user";

  const seed = !isUser
    ? getReflectionSeedCard({ message: content, reflectionSeed } as any)
    : null;

  const assistantBase = [
    "relative",
    "bg-gradient-to-br from-slate-900/85 via-slate-900/80 to-indigo-950/85",
    "text-zinc-100",
    "border border-indigo-400/40",
    "backdrop-blur-md",
    "shadow-[0_18px_40px_rgba(15,23,42,0.9)]",
    "before:absolute before:-left-1.5 before:top-2 before:bottom-2 before:w-[3px]",
    "before:rounded-full",
    "before:bg-gradient-to-b",
    "before:from-indigo-400/90 before:via-sky-400/85 before:to-emerald-400/90",
    "animate-imotaraAssistantIn",
    "im-assistant-breath-glow",
  ];

  if (replySource === "openai") {
    assistantBase.push(
      "border-emerald-400/60",
      "shadow-[0_18px_40px_rgba(16,185,129,0.8)]",
    );
  }

  const assistantHover: string[] = [];
  if (!isUser) {
    assistantHover.push(
      "hover:scale-[1.01]",
      "hover:shadow-[0_0_28px_rgba(129,140,248,0.7)]",
      "hover:brightness-110",
      "hover:saturate-125",
    );
    if (replySource === "openai") {
      assistantHover.push(
        "hover:shadow-[0_0_36px_rgba(52,211,153,0.85)]",
        "hover:translate-y-[-1px]",
      );
    }
  }

  const bubbleClass = [
    "min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-sm sm:max-w-[75%] transition-all",
    isUser
      ? "animate-msg-appear bg-gradient-to-br from-indigo-500/80 via-sky-500/80 to-emerald-400/80 text-white shadow-[0_18px_40px_rgba(15,23,42,0.85)]"
      : assistantBase.join(" "),
    ...assistantHover,
    highlighted
      ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-black/40 animate-pulse"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const showDebug =
    role === "assistant" &&
    (debugEmotion || debugEmotionSource || replySource);

  const originForBadge =
    replySource === "openai"
      ? "openai"
      : replySource
        ? "local-fallback"
        : "unknown";

  // ✅ Avoid duplicate rendering:
  // Sometimes `content` already contains the same followUp line (because we now use it as the bridge).
  // In that case, don't render followUp separately in the bubble.
  const normForFollowUp = (s: string): string =>
    String(s ?? "")
      .replace(/\.\.\./g, "…")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/[\s\.!?؟؟…]+$/g, "");

  const fuNorm = normForFollowUp(followUp?.trim() ?? "");
  const contentNorm = normForFollowUp(content ?? "");

  const shouldShowFollowUp =
    role === "assistant" && fuNorm.length > 0 && !contentNorm.includes(fuNorm);

  return (
    <div
      ref={attachRef}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={bubbleClass}>
        {!isUser && seed ? (
          <div className="mb-2 rounded-2xl border border-white/15 bg-black/30 px-3 py-2 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-semibold text-zinc-100">
                {seed.title}
              </p>
              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300">
                {seed.label}
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-200/90">
              {seed.prompt}
            </p>
          </div>
        ) : null}

        <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {content}
        </div>
        {shouldShowFollowUp ? (
          <div className="mt-2 text-sm text-zinc-200/90">
            {followUp!.trim()}
          </div>
        ) : null}

        <div
          className={`mt-1 text-[11px] ${isUser ? "text-zinc-100/80" : "text-zinc-300"
            }`}
        >
          <DateText ts={time} /> · {isUser ? "You" : "Imotara"}
          {!isUser && meta?.compatibility ? (
            <span
              className={[
                "ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
                meta.compatibility.ok === true
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                  : "border-rose-400/40 bg-rose-400/10 text-rose-100",
              ].join(" ")}
            >
              {typeof meta.compatibility.summary === "string"
                ? meta.compatibility.summary
                : meta.compatibility.ok === true
                  ? "OK"
                  : "Issues"}
            </span>
          ) : null}
          {!isUser && meta?.softEnforcement ? (
            <SoftEnforcementNotes meta={meta} />
          ) : null}
          {isUser && sessionId ? (
            <>
              {" · "}
              <Link
                href={`/history?sessionId=${encodeURIComponent(
                  sessionId,
                )}&messageId=${encodeURIComponent(id)}`}
                className="underline decoration-amber-300/70 underline-offset-2 hover:text-amber-300"
              >
                View in History →
              </Link>
            </>
          ) : null}
        </div>

        {showDebug && (
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
            {replySource && (
              <>
                <ReplyOriginBadge origin={originForBadge as any} />
                <span className="text-zinc-600">·</span>
              </>
            )}
            <span>
              emotion:{" "}
              <span className="font-medium">{debugEmotion ?? "unknown"}</span>,
              derived:{" "}
              <span className="font-medium">
                {debugEmotionSource ?? "unknown"}
              </span>
            </span>
          </div>
        )}

        {/* #10: Emoji reactions + bookmark — only on assistant messages */}
        {!isUser && (onReact || onBookmark) && (
          <div className="mt-2 flex items-center gap-1">
            {onReact && REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                title={reaction === emoji ? "Remove reaction" : `React with ${emoji}`}
                className={`rounded-full px-1.5 py-0.5 text-sm transition hover:scale-110 ${
                  reaction === emoji
                    ? "bg-white/15 ring-1 ring-white/30"
                    : "opacity-40 hover:opacity-80"
                }`}
              >
                {emoji}
              </button>
            ))}
            {reaction && (
              <span className="ml-1 text-[10px] text-zinc-500">you reacted</span>
            )}
            {onBookmark && (
              <button
                type="button"
                onClick={onBookmark}
                title={bookmarked ? "Remove bookmark" : "Bookmark this message"}
                className={`ml-auto rounded-full p-1 transition hover:scale-110 ${
                  bookmarked
                    ? "text-amber-400 animate-star-pop"
                    : "text-zinc-600 hover:text-amber-300"
                }`}
              >
                <Star className="h-3.5 w-3.5" fill={bookmarked ? "currentColor" : "none"} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SoftEnforcementNotes({ meta }: { meta: any }) {
  const [qa] = useState(() => {
    // Public-release lock: QA UI must never activate in production
    if (process.env.NODE_ENV === "production") return false;
    try {
      return window.localStorage.getItem("imotaraQa") === "1";
    } catch {
      return false;
    }
  });

  if (process.env.NODE_ENV === "production") return null;
  if (!qa) return null;

  const msgNotes: string[] = meta?.softEnforcement?.message?.notes ?? [];
  const fuNotes: string[] = meta?.softEnforcement?.followUp?.notes ?? [];
  const all = [
    ...msgNotes.map((n) => `message: ${n}`),
    ...fuNotes.map((n) => `followUp: ${n}`),
  ];

  if (!all.length) {
    return (
      <details className="ml-2 inline-block align-middle">
        <summary className="cursor-pointer select-none text-[11px] text-zinc-400">
          QA notes
        </summary>
        <div className="mt-1 rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-zinc-300">
          (none)
        </div>
      </details>
    );
  }

  return (
    <details className="ml-2 inline-block align-middle">
      <summary className="cursor-pointer select-none text-[11px] text-amber-200/80">
        QA notes
      </summary>
      <div className="mt-1 rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-zinc-200">
        <ul className="list-inside list-disc space-y-0.5">
          {all.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
