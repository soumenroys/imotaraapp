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
  Copy,
  Check as CheckIcon,
  Volume2,
  VolumeX,
  Pencil,
  ChevronDown,
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
import { getUserScopeId as getSharedScopeId } from "@/lib/imotara/userScope";
import TopBar from "@/components/imotara/TopBar";
import { buildTeenInsight } from "@/lib/imotara/buildTeenInsight";
import ReplyOriginBadge from "@/components/imotara/ReplyOriginBadge";
import { getChatToneCopy } from "@/lib/imotara/chatTone";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { isWithinLaunchOffer } from "@/lib/imotara/license";
import useLicense from "@/hooks/useLicense";
import { adaptReflectionTone } from "@/lib/imotara/reflectionTone";
import { getReflectionSeedCard } from "@/lib/imotara/reflectionSeedContract";
import type { ReflectionSeed } from "@/lib/ai/response/responseBlueprint";
import { buildLocalReply } from "@/lib/ai/local/localReplyEngine";
import {
  detectAndUpdateOpenLoops,
  loadOpenLoops,
  dismissLoop,
  deferLoop,
  getActiveLoop,
  getLoopPrompt,
  type OpenLoop,
} from "@/lib/imotara/openLoops";
import OpenLoopCard from "@/components/imotara/OpenLoopCard";
import CompanionInsightCard from "@/components/imotara/CompanionInsightCard";
import UnsentLetterModal, { buildUnsentLetterSystemPrompt, type UnsentLetterSetup } from "@/components/imotara/UnsentLetterModal";
import { isLetterDue, loadStoredLetter, generateCompanionLetter, getConversationDepth } from "@/lib/imotara/companionLetter";
import { isArcDue, loadStoredArc, generateEmotionalArc } from "@/lib/imotara/emotionalArc";
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
const LAST_SENT_KEY = "imotara.lastSentTs.v1";
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

function getUserScopeId(): string {
  return getSharedScopeId();
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
  if (ts === null || ts === undefined) return Date.now();
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

// Public release: remote sync controls are enabled during the launch offer.
// Launch offer is controlled via NEXT_PUBLIC_IMOTARA_LAUNCH_DATE / NEXT_PUBLIC_IMOTARA_FREE_DAYS.
const ENABLE_REMOTE_SYNC =
  process.env.NEXT_PUBLIC_IMOTARA_LAUNCH_DATE
    ? isWithinLaunchOffer()
    : true;

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
  /\b(suicide|suicidal|end my life|end it all|kill myself|don'?t want to (be here|live|exist)|can'?t go on|no reason to live|want to die|hurt myself|self.?harm|cut myself|overdose|better off dead|wish i was dead|thinking (about|of) suicide|plan(ning)? to (kill|end|harm) (myself|my life)|sexual assault|being raped?|domestic violence|i'?m not safe|not safe right now|in immediate danger|being abused)\b/i;
const CRISIS_TIER1_RE =
  /\b(hopeless|helpless|worthless|nothing matters|give up|can'?t take (it|this) anymore|breaking down|falling apart|no one cares|all alone|empty inside|numbing|numb(ing)?|disappear|feel like a burden|i'?m a burden|everyone (would be )?better off without me|don'?t deserve to (live|be here|exist)|trapped|feel(ing)? trapped|no way out|no escape|can'?t see a future|no future for me|thinking about (death|ending|disappearing)|thoughts of (death|ending it)|pointless|life is pointless)\b/i;

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
    // Hindi additions
    "मैं बोझ हूं","मैं बेकार हूं","कोई रास्ता नहीं",
    // Bengali additions
    "আমি বোঝা","কোনো পথ নেই",
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
  he: { tier2: "נראה שאתה עובר משהו כבד מאוד כרגע...", tier1: "נראה שהדברים מרגישים קשים מאוד כרגע...", link: "תמיכה בחינם זמינה 24/7" },
  ar: { tier2: "يبدو أنك تمر بشيء صعب جداً الآن...", tier1: "يبدو أن الأمور تبدو صعبة جداً الآن...", link: "الدعم المجاني متاح على مدار الساعة" },
  de: { tier2: "Es klingt, als würdest du gerade etwas sehr Schweres durchmachen...", tier1: "Es klingt, als wäre gerade alles sehr schwer...", link: "kostenlose Krisenunterstützung ist rund um die Uhr verfügbar" },
  ja: { tier2: "今、とても辛いことを経験されているようです...", tier1: "今、物事がとても辛く感じられているようです...", link: "24時間無料のサポートが利用できます" },
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
  he: ["מרגיש כבד", "צריך להוציא את זה", "רק חושב בקול"],
  ar: ["أشعر بثقل", "أحتاج للتعبير", "أفكر بصوت عالٍ"],
  de: ["Fühle mich schwer", "Muss mal reden", "Denke laut nach"],
  ja: ["気持ちが重い", "話を聞いてほしい", "ただ考えを整理したい"],
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

/** Map short API emotionLabel → canonical Emotion union value. */
function toCanonicalEmotion(label: string): Emotion {
  const map: Record<string, Emotion> = {
    sad: "sadness",
    sadness: "sadness",
    anxious: "fear",
    anxiety: "fear",
    fear: "fear",
    angry: "anger",
    anger: "anger",
    joy: "joy",
    happy: "joy",
    disgust: "disgust",
    surprise: "surprise",
    gratitude: "gratitude",
  };
  return map[label.toLowerCase()] ?? "neutral";
}

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

async function logAssistantMessageToHistory(
  msg: Message,
  emotionRaw = "neutral",
  intensity = 0,
): Promise<void> {
  try {
    const text = msg.content.trim();
    if (!text) return;

    const emotion = toCanonicalEmotion(emotionRaw);

    const payload: any = {
      message: text,
      emotion,
      intensity,
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
      emotion,
      intensity,
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

  // First-time onboarding hint — shown until user sends their first ever message
  const [showFirstTimeTip, setShowFirstTimeTip] = useState(false);
  const [showUnsentHint, setShowUnsentHint] = useState(false);
  const unsentHintShownRef = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    try {
      if (!localStorage.getItem("imotara.onboarding.firstMsgSeen.v1")) {
        setShowFirstTimeTip(true);
      }
    } catch { /* ignore */ }
  }, [mounted]);

  // NF-5: Anonymous Collective Pulse state
  const [collectivePulse, setCollectivePulse] = useState<{ heavyPercent: number } | null>(null);
  const [pulseDismissed, setPulseDismissed] = useState(false);
  useEffect(() => {
    if (!mounted) return;
    fetch("/api/pulse").then((r) => r.json()).then((data) => {
      if (data.available && data.heavyPercent >= 15) setCollectivePulse({ heavyPercent: data.heavyPercent });
    }).catch(() => {});
  }, [mounted]);

  // NF-1: Milestone celebration state — set when an open loop transitions to "closed"
  const [milestoneLoop, setMilestoneLoop] = useState<{ themeName: string } | null>(null);

  // P1/P3/P5/P4 state — effects wired after threads is declared below
  const [activeOpenLoop, setActiveOpenLoop] = useState<OpenLoop | null>(null);
  const openLoopCheckedRef = useRef(false);
  const [companionInsight, setCompanionInsight] = useState<{
    variant: "letter" | "arc";
    title: string;
    body: string;
  } | null>(null);
  const insightCheckedRef = useRef(false);
  const [unsentLetterModalOpen, setUnsentLetterModalOpen] = useState(false);
  const [unsentLetterSetup, setUnsentLetterSetup] = useState<UnsentLetterSetup | null>(null);

  // Feature discovery cards — state and helpers (effect wired after activeThread is declared)
  type DiscoveryCardId = "trends" | "companion" | "offline" | "unsent_letter";
  const DISCOVERY_CARD_ORDER: DiscoveryCardId[] = ["trends", "companion", "offline", "unsent_letter"];
  const DISCOVERY_CARDS_KEY = "imotara.onboarding.discovery.v1";
  const [discoveryCard, setDiscoveryCard] = useState<DiscoveryCardId | null>(null);
  const discoveryShownRef = useRef(false);

  function dismissDiscoveryCard() {
    if (!discoveryCard) return;
    const id = discoveryCard;
    setDiscoveryCard(null);
    try {
      const dismissed: DiscoveryCardId[] = JSON.parse(localStorage.getItem(DISCOVERY_CARDS_KEY) ?? "[]");
      if (!dismissed.includes(id)) {
        localStorage.setItem(DISCOVERY_CARDS_KEY, JSON.stringify([...dismissed, id]));
      }
    } catch { /* ignore */ }
  }

  const isOnline = useOnlineStatus();
  const license = useLicense();

  // Trial countdown banner — shown once per day when ≤14 days remain on trial
  const [showTrialBanner, setShowTrialBanner] = useState(false);

  // EN-3 — Daily micro check-in
  const DAILY_CHECKIN_KEY = "imotara.dailycheckin.lastDate.v1";
  const [showDailyCheckin, setShowDailyCheckin] = useState(false);
  useEffect(() => {
    if (!mounted) return;
    try {
      const stored = localStorage.getItem(DAILY_CHECKIN_KEY);
      const today = new Date().toISOString().slice(0, 10);
      if (stored !== today) setShowDailyCheckin(true);
    } catch {}
  }, [mounted]);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // UX-4 state — effect wired after activeThread is declared
  const [sessionGreeting, setSessionGreeting] = useState<string | null>(null);
  const greetingCheckedForRef = useRef<string | null>(null);

  // P1 — Emotional Open Loops effect + NF-1 milestone celebration
  useEffect(() => {
    if (!mounted || openLoopCheckedRef.current || threads.length < 3) return;
    const totalUserMessages = threads.reduce(
      (sum, t) => sum + t.messages.filter((m) => m.role === "user").length,
      0
    );
    if (totalUserMessages < 10) return;
    openLoopCheckedRef.current = true;
    // NF-1: capture state before update to detect newly-closed loops
    const prevLoops = loadOpenLoops();
    const loops = detectAndUpdateOpenLoops(threads);
    // NF-1: find any loop that just transitioned to "closed"
    const newlyClosed = loops.find(
      (l) => l.status === "closed" &&
        prevLoops.some((p) => p.id === l.id && p.status !== "closed")
    );
    if (newlyClosed) setMilestoneLoop({ themeName: newlyClosed.themeName });
    setActiveOpenLoop(getActiveLoop(loops));
  }, [mounted, threads.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // P3/P5 — Companion insight effect
  useEffect(() => {
    if (!mounted || insightCheckedRef.current || threads.length < 2) return;
    insightCheckedRef.current = true;
    (async () => {
      if (isLetterDue()) {
        const stored = loadStoredLetter();
        if (stored) {
          setCompanionInsight({ variant: "letter", title: `A letter from ${stored.companionName}`, body: stored.body });
          return;
        }
        const profile = (await import("@/lib/imotara/profile")).getImotaraProfile();
        const letter = await generateCompanionLetter(threads, profile).catch(() => null);
        if (letter) {
          setCompanionInsight({ variant: "letter", title: `A letter from ${letter.companionName}`, body: letter.body });
          return;
        }
      }
      if (isArcDue()) {
        const stored = loadStoredArc();
        if (stored) {
          setCompanionInsight({ variant: "arc", title: `Your ${stored.periodLabel}`, body: stored.narrative });
          return;
        }
        const profile = (await import("@/lib/imotara/profile")).getImotaraProfile();
        const userName = profile?.user?.name ?? "you";
        const arc = await generateEmotionalArc(threads, userName).catch(() => null);
        if (arc) {
          setCompanionInsight({ variant: "arc", title: `Your ${arc.periodLabel}`, body: arc.narrative });
        }
      }
    })();
  }, [mounted, threads.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Stop mic on unmount — prevents microphone staying active after navigation
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  // Clear undo timer on unmount — prevents generateAssistantReply firing after navigation
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

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

  // Return check-in banner (shown after >24h since last message)
  const [showReturnGreeting, setShowReturnGreeting] = useState(false);

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Soft clear confirm (replaces window.confirm)
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Confirm before deleting a thread
  const [deleteThreadConfirmId, setDeleteThreadConfirmId] = useState<string | null>(null);

  // Toast
  const [chatToast, setChatToast] = useState<{ message: string; type?: ToastType } | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [streamingReply, setStreamingReply] = useState<string>("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ✅ NEW: header details toggle (collapses long header content by default)
  const [showHeader, setShowHeader] = useState(false);
  const [showHeaderDetails, setShowHeaderDetails] = useState(false);

  // Reactive companion name — shown in chat header, updates when profile changes
  const [companionDisplayName, setCompanionDisplayName] = useState<string | null>(null);
  // Avatar pins — user (top) and companion (bottom) of the chat body
  const [userAvatarData, setUserAvatarData] = useState<{ src: string; name: string } | null>(null);
  const [compAvatarData, setCompAvatarData] = useState<{ src: string; name: string } | null>(null);
  const [avatarPlaying, setAvatarPlaying] = useState<"user" | "comp" | null>(null);
  const avatarAudioRef = useRef<HTMLAudioElement | null>(null);
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

      // User avatar pin
      const uGender = p?.user?.gender;
      const uAge = p?.user?.avatarAge;
      if ((uGender === "male" || uGender === "female") && typeof uAge === "number") {
        setUserAvatarData({ src: `/avatars/${uGender}/${uAge}.png`, name: p?.user?.name?.trim() ?? "" });
      } else {
        setUserAvatarData(null);
      }

      // Companion avatar pin
      const cGender = c?.gender;
      const cAge = c?.avatarAge;
      if (c?.enabled && (cGender === "male" || cGender === "female") && typeof cAge === "number") {
        setCompAvatarData({ src: `/avatars/${cGender}/${cAge}.png`, name: c?.name?.trim() ?? "" });
      } else {
        setCompAvatarData(null);
      }
    }
    syncName(getImotaraProfile());
    const handler = (e: Event) => syncName((e as CustomEvent).detail as ImotaraProfileV1 | null);
    window.addEventListener("imotara:profile-updated", handler);
    return () => window.removeEventListener("imotara:profile-updated", handler);
  }, []);

  function playAvatarPreview(role: "user" | "comp") {
    const p = getImotaraProfile();
    const lang = p?.user?.preferredLang ?? "en";
    const rawGender = role === "user" ? (p?.user?.gender ?? "female") : (p?.companion?.gender ?? "female");
    const genderFile: "male" | "female" = rawGender === "male" ? "male" : "female";

    const stopAll = () => {
      avatarAudioRef.current?.pause();
      avatarAudioRef.current = null;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };

    if (avatarPlaying === role) { stopAll(); setAvatarPlaying(null); return; }
    stopAll();
    setAvatarPlaying(role);

    if (lang !== "en") {
      const audio = new Audio(`/tts-preview/${lang}-${genderFile}.mp3`);
      audio.playbackRate = 0.95;
      avatarAudioRef.current = audio;
      const done = () => { avatarAudioRef.current = null; setAvatarPlaying(null); };
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
      return;
    }

    if (typeof window === "undefined" || !window.speechSynthesis) { setAvatarPlaying(null); return; }
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    const MALE_PAT = /\b(male|man|alex|tom|daniel|liam|david|james|mark|aaron|evan|reed|bruce|fred|gordon|lee|rishi|aarav|hemant|kabir)\b/i;
    const FEMALE_PAT = /\b(female|woman|samantha|karen|victoria|veena|kanya|kate|susan|fiona|alice|moira|tessa|lekha|damayanti)\b/i;
    const pool = voices.filter(v => v.lang === "en-US" || v.lang.startsWith("en-") || v.lang === "en");
    const src = pool.length > 0 ? pool : voices;
    const isMaleV = (v: SpeechSynthesisVoice) => MALE_PAT.test(v.name.toLowerCase());
    const isFemV = (v: SpeechSynthesisVoice) => FEMALE_PAT.test(v.name.toLowerCase());
    const voice = genderFile === "male"
      ? (src.find(isMaleV) ?? src.find(v => !isFemV(v)) ?? src[0])
      : (src.find(isFemV) ?? src.find(v => !isMaleV(v)) ?? src[0]);
    const utter = new SpeechSynthesisUtterance("Hi, I'm Imotara. I'm here with you.");
    if (voice) utter.voice = voice;
    utter.lang = "en-US";
    utter.rate = 0.95;
    utter.onend = () => setAvatarPlaying(null);
    utter.onerror = () => setAvatarPlaying(null);
    synth.speak(utter);
  }

  // Return check-in: show banner if user hasn't chatted in >24h
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LAST_SENT_KEY);
      if (!raw) return; // first-time user — skip
      const lastTs = Number(raw);
      if (!Number.isFinite(lastTs) || lastTs <= 0) return;
      const gapMs = Date.now() - lastTs;
      if (gapMs > 24 * 60 * 60 * 1000) {
        setShowReturnGreeting(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // Trial countdown: show once per day when ≤14 days remain on free trial
  useEffect(() => {
    if (license.loading || license.status !== "trial" || !license.expiresAt) return;
    const msLeft = new Date(license.expiresAt).getTime() - Date.now();
    const daysLeft = Math.ceil(msLeft / 86_400_000);
    if (daysLeft <= 0 || daysLeft > 14) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const dismissed = typeof window !== "undefined"
        ? localStorage.getItem("imotara.trial.bannerDismissed.v1")
        : null;
      if (dismissed !== today) setShowTrialBanner(true);
    } catch { /* ignore */ }
  }, [license.loading, license.status, license.expiresAt]);

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

  function syncMessageMetaToRemote(messageId: string, patch: { bookmarked?: boolean; reaction?: string | null }) {
    const msg = activeThread?.messages.find((m) => m.id === messageId);
    if (!msg || !activeThread) return;
    void pushChatMessageToRemote({
      id: msg.id,
      threadId: activeThread.id,
      role: msg.role,
      content: msg.content,
      createdAtMs: msg.createdAt,
      meta: {
        ...(msg.meta ?? {}),
        ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      },
    });
  }

  function toggleBookmark(id: string) {
    hapticTap();
    const isAdding = !bookmarks.has(id);
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setChatToast({ message: isAdding ? "Bookmarked ✓" : "Bookmark removed" });
    syncMessageMetaToRemote(id, { bookmarked: isAdding });
  }

  function handleReact(messageId: string, emoji: string) {
    let finalEmoji: string | null = null;
    setReactions((prev) => {
      const next = { ...prev };
      if (next[messageId] === emoji) { delete next[messageId]; }
      else { next[messageId] = emoji; finalEmoji = emoji; }
      return next;
    });
    syncMessageMetaToRemote(messageId, { reaction: finalEmoji });
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
      if (showFirstTimeTip) {
        setComposerPlaceholder("Try: 'I've been feeling anxious about work lately'");
        return;
      }
      const p = getChatToneCopy()?.placeholder;
      if (typeof p === "string" && p.trim().length > 0) {
        setComposerPlaceholder(p.trim());
      }
    } catch {
      // keep default
    }
  }, [mounted, showFirstTimeTip]);

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

  // UX-4 + EN-2 — emotion continuation greeting + topic-specific re-opener
  useEffect(() => {
    if (!activeId || !activeThread || greetingCheckedForRef.current === activeId) return;
    greetingCheckedForRef.current = activeId;
    setSessionGreeting(null);
    const msgs = activeThread.messages;
    if (msgs.length < 2) return;
    const lastMsg = [...msgs].sort((a, b) => b.createdAt - a.createdAt)[0];
    const gapHours = (Date.now() - (lastMsg?.createdAt ?? Date.now())) / 3_600_000;
    if (gapHours < 2) return;

    // EN-2: attempt topic-specific re-opener from last user messages
    const EN2_TOPICS: Array<{ pattern: RegExp; reOpener: string }> = [
      { pattern: /\b(work|job|boss|deadline|career|burnout|workload|promotion|fired|manager|office|salary)\b/i,
        reOpener: "Last time you were navigating some work stress. How has that been since we spoke?" },
      { pattern: /\b(lonely|loneliness|alone|isolated|no friends|disconnected|left out|no one cares)\b/i,
        reOpener: "Last time you were feeling a bit lonely. How are you doing today?" },
      { pattern: /\b(anxious|anxiety|worry|worried|nervous|panic|overwhelmed|overthinking|dread)\b/i,
        reOpener: "Last time you were carrying some anxiety. How is that sitting with you now?" },
      { pattern: /\b(grief|grieving|loss|lost someone|died|death|passed away|miss them|mourning)\b/i,
        reOpener: "Last time you were sitting with some grief. How have you been holding up?" },
      { pattern: /\b(relationship|partner|boyfriend|girlfriend|husband|wife|breakup|broke up|divorce|fight|conflict)\b/i,
        reOpener: "Last time there was some relationship tension on your mind. How have things been?" },
      { pattern: /\b(can'?t sleep|insomnia|sleepless|exhausted|no energy|fatigue|nightmares|awake all night)\b/i,
        reOpener: "Last time you were struggling with sleep. Has that improved at all?" },
      { pattern: /\b(worthless|not good enough|failure|shame|hate myself|self.hate|inadequate|imposter|don'?t deserve)\b/i,
        reOpener: "Last time some questions of self-worth were coming up for you. How are you feeling today?" },
      { pattern: /\b(family|parents?|toxic|controlling|expectations|family pressure|family conflict)\b/i,
        reOpener: "Last time there was some family tension weighing on you. How has that been?" },
    ];

    const recentUserText = msgs
      .filter((m) => m.role === "user")
      .slice(-4)
      .map((m) => m.content)
      .join(" ");

    const matched = EN2_TOPICS.find((t) => t.pattern.test(recentUserText));
    if (matched) {
      setSessionGreeting(matched.reOpener);
      return;
    }

    // UX-4 fallback: generic heavy-emotion greeting
    const heavyPattern = /low|tense|worried|upset|frustrated|stuck|sad|anxious|overwhelmed|hurt|difficult|hard time|heavy/i;
    const lastBotMsgs = msgs.filter((m) => m.role === "assistant").slice(-3);
    const isHeavy = lastBotMsgs.some((m) => heavyPattern.test(m.content));
    if (isHeavy) {
      const h = new Date().getHours();
      const timeGreet = h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening.";
      setSessionGreeting(`${timeGreet} Last time you were carrying something heavy. How are you feeling now?`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeThread?.messages.length]);

  // Feature discovery card trigger — needs activeThread, so placed after its declaration
  const userMessageCount = activeThread?.messages.filter((m) => m.role === "user").length ?? 0;
  useEffect(() => {
    if (!mounted || userMessageCount < 3 || discoveryShownRef.current || discoveryCard) return;
    try {
      const dismissed: DiscoveryCardId[] = JSON.parse(localStorage.getItem(DISCOVERY_CARDS_KEY) ?? "[]");
      const next = DISCOVERY_CARD_ORDER.find((id) => !dismissed.includes(id)) ?? null;
      if (next) {
        setDiscoveryCard(next);
        discoveryShownRef.current = true;
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, userMessageCount]);

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
    } catch (e: any) {
      if (e?.name === "QuotaExceededError" || e?.code === 22) {
        setChatToast({ message: "Storage full — export your data to free up space.", type: "error" });
      }
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

  // Cross-thread context: compact breadcrumb of what the user talked about in past threads.
  // Zero latency — built from localStorage thread titles + last user messages, no LLM.
  // Keeps the AI aware of long-term topics without sending full past conversations.
  function buildCrossThreadContext(): string {
    const pastThreads = threads
      .filter((t) => t.id !== activeId && t.messages.length > 0)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
    if (pastThreads.length === 0) return "";
    const lines = pastThreads.map((t) => {
      const daysAgo = Math.round((Date.now() - t.createdAt) / (1000 * 60 * 60 * 24));
      const when = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo}d ago`;
      const lastUserMsgs = t.messages
        .filter((m) => m.role === "user")
        .slice(-2)
        .map((m) => String(m.content).slice(0, 100).trim())
        .filter(Boolean)
        .join(" / ");
      const title = (t.title || "").slice(0, 40);
      return `• [${when}] ${title}${lastUserMsgs ? ` — ${lastUserMsgs}` : ""}`;
    });
    return lines.join("\n");
  }

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
      let respEmotionLabel = "neutral";
      let respEmotionIntensity = 0;

      // Optional diagnostics (report-only)
      let compatibility: any | undefined;

      if (remoteAllowed && ANALYSIS_IMPL === "api") {
        try {
          // P4 — Unsent Letter: prepend role-play context so AI responds in recipient's voice
          const lastUserContent = msgsForAnalysis[msgsForAnalysis.length - 1]?.content ?? "";
          const aiMessageContent = unsentLetterSetup
            ? `${buildUnsentLetterSystemPrompt(unsentLetterSetup)}\n\nThe user's letter:\n${lastUserContent}`
            : lastUserContent;

          const resp = await runRespondWithConsent(
            aiMessageContent,
            remoteAllowed,
            {
              threadId,

              // Send last 12 turns (matches MAX_TURNS on server)
              recentMessages: msgsForAnalysis.slice(-12).map((m) => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.content,
              })),

              // Rolling context: compact breadcrumb of user messages older than the 12-turn window
              // Works for all languages — no LLM summarization, zero latency overhead
              ...(msgsForAnalysis.length > 12 ? {
                olderContext: msgsForAnalysis
                  .slice(0, -12)
                  .filter((m) => m.role === "user")
                  .slice(-6)
                  .map((m) => String(m.content).slice(0, 150).trim())
                  .filter(Boolean)
                  .join(" | "),
              } : {}),

              // Cross-thread memory: compact summary of past conversation threads
              ...((() => { const c = buildCrossThreadContext(); return c ? { crossThreadContext: c } : {}; })()),
            } as any,
            (partial) => setStreamingReply(partial),
          );
          setStreamingReply("");

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

            respEmotionLabel = (resp as any)?.meta?.emotionLabel ?? debugEmotion ?? "neutral";
            respEmotionIntensity = (resp as any)?.meta?.emotion?.intensity ?? 0;

            aiMetaFrom = "openai";
          }
        } catch (err) {
          setStreamingReply("");
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

        // UX-5: pacing delay on heavy emotions — typing indicator stays visible during wait
        const HEAVY_EMOTIONS = new Set(["sad", "sadness", "grief", "anxious", "anxiety", "fear", "overwhelmed", "hopeless", "lonely", "anger", "frustrated", "hurt", "depressed", "depression", "lost", "empty"]);
        if (debugEmotion && HEAVY_EMOTIONS.has(debugEmotion.toLowerCase())) {
          await new Promise<void>((resolve) => setTimeout(resolve, 1500));
        }

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

        void logAssistantMessageToHistory(assistantMsg, respEmotionLabel, respEmotionIntensity);

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
          preferredLang: profile?.user?.preferredLang ?? undefined,
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

      // UX-5: pacing delay on heavy emotions (fallback path)
      const HEAVY_EMOTIONS_FB = new Set(["sad", "sadness", "grief", "anxious", "anxiety", "fear", "overwhelmed", "hopeless", "lonely", "anger", "frustrated", "hurt", "depressed", "depression", "lost", "empty"]);
      if (debugEmotion && HEAVY_EMOTIONS_FB.has(debugEmotion.toLowerCase())) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      }

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

      void logAssistantMessageToHistory(assistantMsg, debugEmotion ?? "neutral", 0);

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
    setDeleteThreadConfirmId(null);
  }

  function renameActive(title: string) {
    if (!activeThread) return;
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThread.id ? { ...t, title } : t)),
    );
  }

  function sendMessage(override?: string) {
    // ✅ Guard: don't allow sending a new user message while assistant reply is generating
    if (analyzing) return;

    const text = (override ?? draft).trim();
    if (!text) return;
    if (text.length > 2000) return; // enforced by UI counter; silently block

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

    // Track last-sent time for return check-in detection
    try { localStorage.setItem(LAST_SENT_KEY, String(Date.now())); } catch { /* ignore */ }
    setShowReturnGreeting(false);

    // Dismiss first-time onboarding hint on first send
    if (showFirstTimeTip) {
      setShowFirstTimeTip(false);
      try { localStorage.setItem("imotara.onboarding.firstMsgSeen.v1", "1"); } catch { /* ignore */ }
    }

    // UX-3 — contextual unsent-letter hint
    if (!unsentHintShownRef.current && !unsentLetterModalOpen) {
      const relKeywords = /\b(can't say|never told|wish i could tell|unsent|dear |letter to|miss you|hurt me|forgive|goodbye|i love you|you left|you never|i need you to know|i wanted to say|never got to)\b/i;
      if (relKeywords.test(text)) {
        try {
          if (!localStorage.getItem("imotara.unsent_letter.tried.v1")) {
            unsentHintShownRef.current = true;
            setShowUnsentHint(true);
          }
        } catch {}
      }
    }

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

  // EN-3 — complete the daily check-in ritual
  function handleDailyCheckin(label: string) {
    try { localStorage.setItem(DAILY_CHECKIN_KEY, new Date().toISOString().slice(0, 10)); } catch {}
    setShowDailyCheckin(false);
    sendMessage(`Feeling ${label.toLowerCase()} today.`);
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
      ar: "ar-SA", he: "he-IL", de: "de-DE",
    };
    const profileLang = getImotaraProfile()?.user?.preferredLang ?? "";
    rec.lang = LANG_TO_BCP47[profileLang] ?? "en-US";
    recognitionRef.current = rec;

    rec.onresult = (e: any) => {
      const transcript: string = e.results[0]?.[0]?.transcript ?? "";
      if (transcript.trim()) {
        setDraft((prev) => (prev.trim() ? `${prev} ${transcript.trim()}` : transcript.trim()));
      }
    };
    rec.onerror = (e: any) => {
      setIsListening(false);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setChatToast({ message: "Microphone access denied — allow it in your browser settings.", type: "error" });
      }
    };
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
      type: "application/json; charset=utf-8",
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

      {!isOnline && (
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4">
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            <span className="shrink-0">⚠</span>
            <span>No internet connection — messages will be queued and sent when you&apos;re back online.</span>
          </div>
        </div>
      )}

      <div className="mx-auto flex h-[calc(100vh-160px)] w-full max-w-7xl px-3 py-4 text-zinc-100 sm:px-4">
        {/* Sidebar */}
        <aside className="hidden w-72 flex-col gap-3 p-4 sm:flex imotara-glass-card">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Conversations
            </h2>
            <button
              onClick={() => { setUnsentLetterSetup(null); newThread(); }}
              className="inline-flex items-center gap-1 rounded-xl border border-sky-400/25 bg-gradient-to-r from-indigo-500/20 via-sky-500/15 to-emerald-400/15 px-3 py-1.5 text-xs text-zinc-100 shadow-sm backdrop-blur-sm transition hover:brightness-110 hover:-translate-y-0.5 hover:shadow-md duration-150 sm:text-sm"
              aria-label="New conversation"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>

          {/* User avatar card — top of sidebar */}
          {mounted && userAvatarData && (
            <div
              role="button"
              tabIndex={0}
              title="Preview your voice"
              onClick={() => playAvatarPreview("user")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playAvatarPreview("user"); } }}
              className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2 cursor-pointer transition duration-150 select-none ${avatarPlaying === "user" ? "border-sky-400/60 bg-sky-500/10 shadow-md" : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"}`}
            >
              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl">
                <img src={userAvatarData.src} alt={userAvatarData.name || "You"} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-zinc-200">{userAvatarData.name || "You"}</p>
                <p className="text-[10px] text-zinc-500">You</p>
              </div>
              {avatarPlaying === "user"
                ? <Volume2 className="h-3.5 w-3.5 flex-shrink-0 text-sky-400 animate-pulse" />
                : <Volume2 className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600 opacity-0 group-hover:opacity-100" />
              }
            </div>
          )}

          <div className="flex-1 space-y-1 overflow-auto pr-1">
            {!mounted ? (
              <div className="space-y-1.5" suppressHydrationWarning aria-label="Loading conversations">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded-xl bg-white/5" style={{ opacity: 1 - i * 0.18 }} />
                ))}
              </div>
            ) : threads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-5 text-center">
                <p className="mb-1 text-xs text-indigo-300/80 italic">When you&apos;re ready to talk, I&apos;m here.</p>
                <p className="mb-3 text-[10px] text-zinc-600">Your conversations stay private.</p>
                <button
                  onClick={() => { setUnsentLetterSetup(null); newThread(); }}
                  className="rounded-full bg-indigo-500/20 border border-indigo-500/40 px-4 py-1.5 text-xs text-indigo-300 transition hover:bg-indigo-500/30"
                >
                  Begin →
                </button>
              </div>
            ) : (
              threads.map((t) => {
                const isActive = t.id === activeId;
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    aria-label={t.title || "Conversation thread"}
                    onClick={() => { if (renamingId !== t.id) setActiveId(t.id); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (renamingId !== t.id) setActiveId(t.id);
                      }
                    }}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${isActive
                      ? "bg-white/10 shadow-md"
                      : "hover:bg-white/5 hover:-translate-y-0.5 hover:shadow-sm duration-150"
                      }`}
                  >
                    <div className="min-w-0 flex-1">
                      {/* Conversation title — inline editable */}
                      {renamingId === t.id ? (
                        <input
                          autoFocus
                          className="w-full rounded-md bg-white/10 px-1.5 py-0.5 text-sm font-medium text-zinc-50 outline-none ring-1 ring-indigo-400/60 focus:ring-indigo-400"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const trimmed = renameValue.trim();
                              if (trimmed) renameActive(trimmed);
                              setRenamingId(null);
                            } else if (e.key === "Escape") {
                              setRenamingId(null);
                            }
                          }}
                          onBlur={() => {
                            const trimmed = renameValue.trim();
                            if (trimmed) renameActive(trimmed);
                            setRenamingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          maxLength={60}
                        />
                      ) : (
                        <p
                          className={`truncate text-sm font-medium ${isActive ? "text-zinc-50" : "text-zinc-100"}`}
                          title={t.title}
                        >
                          {t.title || "Conversation"}
                        </p>
                      )}

                      {/* Meta row: date */}
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="line-clamp-1 text-xs text-zinc-500">
                          <DateText ts={t.createdAt} />
                        </p>
                      </div>
                    </div>
                    <div className="ml-2 hidden shrink-0 items-center gap-0.5 group-hover:flex">
                      <button
                        className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 transition duration-150"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(t.id);
                          setRenameValue(t.title || "");
                        }}
                        aria-label="Rename"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded-lg p-1 text-zinc-400 hover:text-red-400 hover:bg-white/10 transition duration-150"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteThreadConfirmId(t.id);
                        }}
                        aria-label="Delete thread"
                        title="Delete thread"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Companion avatar card — bottom of sidebar */}
          {mounted && compAvatarData && (
            <div
              role="button"
              tabIndex={0}
              title="Preview companion voice"
              onClick={() => playAvatarPreview("comp")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playAvatarPreview("comp"); } }}
              className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2 cursor-pointer transition duration-150 select-none ${avatarPlaying === "comp" ? "border-indigo-400/60 bg-indigo-500/10 shadow-md" : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"}`}
            >
              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl">
                <img src={compAvatarData.src} alt={compAvatarData.name || "Companion"} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-zinc-200">{compAvatarData.name || "Companion"}</p>
                <p className="text-[10px] text-zinc-500">Companion</p>
              </div>
              {avatarPlaying === "comp"
                ? <Volume2 className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400 animate-pulse" />
                : <Volume2 className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600 opacity-0 group-hover:opacity-100" />
              }
            </div>
          )}

          {/* Delete-thread confirmation inline panel */}
          {deleteThreadConfirmId && (
            <div className="mx-2 mb-2 rounded-xl border border-red-400/30 bg-red-950/60 px-3 py-2 text-xs text-red-200 backdrop-blur-md">
              <p className="mb-2 font-medium">Delete this conversation?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => deleteThread(deleteThreadConfirmId)}
                  className="rounded-full bg-red-500/80 px-3 py-1 font-medium text-white transition hover:bg-red-500"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteThreadConfirmId(null)}
                  className="rounded-full border border-white/10 px-3 py-1 text-zinc-300 transition hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="flex flex-1 flex-col">
          {/* HEADER — 3-level collapsible */}
          <header className="px-3 pt-2 sm:px-4 sm:pt-3">
            <div className="imotara-glass-card px-3 py-2">

              {/* ── LEVEL 0: always-visible slim bar ── */}
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-white shadow-[0_6px_20px_rgba(15,23,42,0.7)]">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
                  <span suppressHydrationWarning>{mounted ? (activeThread?.title ?? "Conversation") : ""}</span>
                </p>
                {/* Local/Cloud toggle — always visible */}
                <div className="w-28 shrink-0">
                  <AnalysisConsentToggle showHelp={false} />
                </div>
                {/* New conversation */}
                <button
                  type="button"
                  onClick={() => { setUnsentLetterSetup(null); newThread(); }}
                  title="New conversation"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 text-zinc-200 transition hover:brightness-110"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                {/* Level 0 → 1 expand toggle */}
                <button
                  type="button"
                  onClick={() => { setShowHeader((v) => !v); if (showHeader) setShowHeaderDetails(false); }}
                  title={showHeader ? "Collapse header" : "Expand header"}
                  aria-expanded={showHeader}
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border transition hover:bg-white/10 hover:text-zinc-200 ${
                    showHeader ? "border-white/20 bg-white/10 text-zinc-200" : "border-white/10 bg-white/5 text-zinc-500"
                  }`}
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showHeader ? "rotate-180" : ""}`} />
                </button>
              </div>

              {/* ── LEVEL 1: full tile (matches original layout) ── */}
              {showHeader && (
                <div className="mt-2 space-y-3 border-t border-white/10 pt-2">

                  {/* Title + description + sync/mode chips */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-50">
                        <span suppressHydrationWarning>{mounted ? (activeThread?.title ?? "Conversation") : ""}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {companionDisplayName && (
                          <><span className="font-medium text-zinc-300">{companionDisplayName}</span> · </>
                        )}
                        A calm space to talk about your feelings. Analysis and replies respect your consent settings.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {ENABLE_REMOTE_SYNC ? (
                        <button
                          onClick={runSync}
                          disabled={syncing}
                          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 px-3 text-xs font-medium text-white backdrop-blur-sm transition hover:brightness-110 disabled:opacity-60"
                          type="button"
                        >
                          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                          Sync now
                        </button>
                      ) : (
                        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/15 bg-black/25 px-3 text-xs text-white/60" title="Cloud sync coming soon">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                          Cloud (Soon)
                        </span>
                      )}
                      <div className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs ${
                        mode === "allow-remote"
                          ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-200"
                          : "border-white/15 bg-black/25 text-white/90"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote" ? "bg-emerald-400" : "bg-zinc-400"}`} />
                        {mode === "allow-remote" ? "Remote allowed" : "Local only"}
                      </div>
                    </div>
                  </div>

                  {/* Analysis controls + action buttons */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left: analysis mode controls */}
                    <div className="flex flex-col gap-2 sm:w-[300px] sm:flex-none">
                      <p className="text-xs font-medium text-zinc-400">Emotion analysis mode</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowHeaderDetails((v) => !v)}
                          aria-expanded={showHeaderDetails}
                          className="inline-flex h-7 flex-1 items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 text-xs text-white/90 transition hover:bg-white/10"
                        >
                          {showHeaderDetails ? "Hide details" : "Show details"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowSearch((v) => !v); setSearchQuery(""); }}
                          title="Search messages"
                          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                            showSearch
                              ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-300"
                              : "border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                          }`}
                        >
                          <Search className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {analysis?.summary?.headline ? (
                        <span
                          className="inline-flex h-7 w-full max-w-[300px] items-center overflow-hidden rounded-full border border-white/15 bg-white/5 px-3 text-xs text-zinc-100"
                          title={analysis.summary.headline}
                        >
                          <span className="w-full truncate text-center">{analysis.summary.headline}</span>
                        </span>
                      ) : (
                        <span className="inline-flex h-7 w-full max-w-[300px] items-center justify-center rounded-full border border-dashed border-white/20 bg-black/30 px-3 text-xs text-zinc-400">
                          No analysis yet
                        </span>
                      )}
                      <div className="h-9 w-full max-w-[300px]">
                        <AnalysisConsentToggle showHelp={showHeaderDetails} />
                      </div>
                    </div>

                    {/* Right: action buttons grid */}
                    <div className="grid grid-cols-3 gap-2 sm:w-[300px] sm:flex-none">
                      {([
                        <Link
                          key="history"
                          href={activeThread ? `/history?sessionId=${encodeURIComponent(activeThread.id)}${urlMessageId ? `&messageId=${encodeURIComponent(urlMessageId)}` : ""}` : "/history"}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 text-sm font-medium text-white shadow-[0_10px_30px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:brightness-110"
                        >History</Link>,
                        <button
                          key="reanalyze"
                          type="button"
                          onClick={triggerAnalyze}
                          disabled={analyzing || !activeThread?.messages?.length}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 text-sm font-medium text-white shadow-[0_10px_30px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:brightness-110 disabled:opacity-60"
                        >
                          {analyzing && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                          Re-analyze
                        </button>,
                        <Link
                          key="privacy"
                          href="/privacy"
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 text-sm font-medium text-white shadow-[0_10px_30px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:brightness-110"
                        >Privacy</Link>,
                        showClearConfirm ? (
                          <div key="clear-confirm" className="col-span-3 flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-950/50 px-3 py-2 text-xs text-red-200">
                            <span className="flex-1 font-medium">Clear all messages?</span>
                            <button type="button" onClick={confirmClear} className="rounded-full bg-red-500/80 px-3 py-1 font-medium text-white transition hover:bg-red-500">Clear</button>
                            <button type="button" onClick={() => setShowClearConfirm(false)} className="rounded-full border border-white/10 px-3 py-1 text-zinc-300 transition hover:bg-white/10">Cancel</button>
                          </div>
                        ) : (
                          <button
                            key="clear"
                            type="button"
                            onClick={clearChat}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 text-sm font-medium text-white shadow-[0_10px_30px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:brightness-110"
                          >
                            <Eraser className="h-3.5 w-3.5" /> Clear
                          </button>
                        ),
                        <button
                          key="export"
                          type="button"
                          onClick={exportJSON}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-emerald-400/10 text-sm font-medium text-white shadow-[0_10px_30px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:brightness-110"
                        >
                          <Download className="h-3.5 w-3.5" /> Export
                        </button>,
                        <button
                          key="new"
                          type="button"
                          onClick={() => { setUnsentLetterSetup(null); newThread(); }}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/25 via-sky-500/20 to-emerald-400/20 text-sm font-medium text-white shadow-[0_12px_34px_rgba(15,23,42,0.65)] backdrop-blur-sm transition hover:brightness-110"
                        >
                          <Plus className="h-3.5 w-3.5" /> New
                        </button>,
                      ] as React.ReactNode[])}
                    </div>
                  </div>

                  {/* ── LEVEL 2: show-details content ── */}
                  {showHeaderDetails && (
                    <div className="space-y-2 border-t border-white/10 pt-2">
                      {/* Teen insight */}
                      {teenInsight && (
                        <div className="rounded-2xl border border-violet-500/35 bg-violet-500/10 px-3 py-3 text-xs text-violet-50">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-200/90">Teen Insight</div>
                          <div className="whitespace-pre-line text-[12px] leading-relaxed text-violet-50/95">{teenInsight}</div>
                        </div>
                      )}
                      {/* Privacy / data notice */}
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs leading-5 text-zinc-300/90">
                          Your choice is stored only on this device. Right now, Imotara analyzes emotions locally in your browser.
                        </p>
                        <p className="mt-2 text-xs leading-5 text-zinc-300/90">
                          Your words stay on-device unless you explicitly allow remote. You can{" "}
                          <Link href="/privacy" className="underline decoration-indigo-400/60 underline-offset-2 hover:text-indigo-300">download or delete what's stored on this device</Link>{" "}
                          anytime.
                        </p>
                        <p className="mt-2 text-xs leading-5 text-zinc-400">
                          Note: Private/Incognito windows may not keep messages after you close them.
                        </p>
                        {mounted && typeof window !== "undefined" && window.localStorage.getItem("imotaraQa") === "1" && (
                          <p className="mt-2 text-[11px] leading-5 text-zinc-400">
                            Tip: You can switch between on-device and remote analysis anytime using the toggle above.
                          </p>
                        )}
                      </div>
                      {/* Compatibility Gate (QA/debug) */}
                      {(() => {
                        const compat =
                          (analysis as any)?.response?.meta?.compatibility ??
                          (analysis as any)?.meta?.compatibility;
                        if (!compat) return null;
                        const summary = typeof compat?.summary === "string" ? compat.summary : compat?.ok === true ? "OK" : "NOT OK";
                        return (
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                            <div className="flex items-center justify-between gap-3 text-[11px]">
                              <span className="font-semibold uppercase tracking-wide text-zinc-300">Compatibility Gate</span>
                              <span className="text-zinc-200">{summary}</span>
                            </div>
                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-200">
                              {JSON.stringify(compat, null, 2)}
                            </pre>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

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
            {/* EN-3 — Daily micro check-in pulse (once per day) */}
            {mounted && showDailyCheckin && (
              <div className="mx-auto mb-4 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-900/10 px-4 py-3">
                  <span className="mr-1 shrink-0 text-xs font-medium text-sky-300/80">How are you feeling today?</span>
                  {[
                    { emoji: "😔", label: "Heavy" }, { emoji: "😟", label: "Anxious" }, { emoji: "😐", label: "Okay" },
                    { emoji: "🙂", label: "Good" }, { emoji: "😊", label: "Grateful" }, { emoji: "⚡", label: "Energized" },
                  ].map(({ emoji, label }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleDailyCheckin(label)}
                      className="flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-900/20 px-2.5 py-1 text-xs text-sky-200 transition hover:bg-sky-500/20 hover:text-white"
                    >
                      <span>{emoji}</span><span>{label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { try { localStorage.setItem(DAILY_CHECKIN_KEY, new Date().toISOString().slice(0, 10)); } catch {} setShowDailyCheckin(false); }}
                    className="ml-auto text-[10px] text-zinc-600 transition hover:text-zinc-400"
                  >
                    Later
                  </button>
                </div>
              </div>
            )}

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
                threads={threads}
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
                      aria-label="Search messages"
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

                {/* Return check-in banner — shown after >24h since last message */}
                {showReturnGreeting && (
                  <div className="animate-fade-in mb-3 flex items-start gap-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm text-zinc-100 backdrop-blur-sm">
                    <span className="mt-0.5 text-lg" aria-hidden="true">💙</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-indigo-200">Welcome back</p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        It&apos;s been a while. How are you feeling today? You can just type one word if you like.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowReturnGreeting(false)}
                      aria-label="Dismiss check-in"
                      className="shrink-0 text-zinc-500 hover:text-zinc-300 transition"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* P4 — Unsent Letter mode banner */}
                {unsentLetterSetup && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/8 px-3 py-2 text-xs text-violet-300">
                    <Pencil className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">
                      Writing to <span className="font-semibold">{unsentLetterSetup.recipientName}</span> — Imotara will respond in their voice.
                    </span>
                    <button
                      onClick={() => setUnsentLetterSetup(null)}
                      className="text-zinc-500 hover:text-zinc-300 transition"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Trial countdown banner — once per day, ≤14 days before free trial ends */}
                {showTrialBanner && license.expiresAt && (() => {
                  const daysLeft = Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / 86_400_000);
                  if (daysLeft <= 0) return null;
                  return (
                    <div className="animate-fade-in mb-3 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-zinc-100 backdrop-blur-sm">
                      <span className="mt-0.5 text-lg" aria-hidden="true">⏳</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-amber-200">
                          {daysLeft === 1 ? "Last day of your free trial" : `${daysLeft} days left in your free trial`}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          After your trial, Imotara continues to work — with on-device replies.{" "}
                          <a href="/settings" className="text-amber-300 underline underline-offset-2 hover:text-amber-200">
                            Explore plans →
                          </a>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTrialBanner(false);
                          try {
                            const today = new Date().toISOString().slice(0, 10);
                            localStorage.setItem("imotara.trial.bannerDismissed.v1", today);
                          } catch { /* ignore */ }
                        }}
                        aria-label="Dismiss trial notice"
                        className="shrink-0 text-zinc-500 hover:text-zinc-300 transition"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })()}

                {/* NF-1 — Emotional Milestone Celebration */}
                {milestoneLoop && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="max-w-[82%] rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-900/40 to-teal-900/30 px-4 py-3 text-sm backdrop-blur-md">
                      <p className="text-emerald-300 font-medium mb-0.5">You closed a loop ✦</p>
                      <p className="text-zinc-300 text-xs leading-relaxed">
                        The theme of <span className="text-emerald-200 italic">{milestoneLoop.themeName}</span> that kept returning — it looks like you found some resolution. That&apos;s real growth.
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss milestone"
                      onClick={() => setMilestoneLoop(null)}
                      className="ml-1 self-start text-zinc-600 hover:text-zinc-400 transition"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* NF-5 — Anonymous Collective Pulse */}
                {collectivePulse && !pulseDismissed && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="max-w-[82%] rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-slate-800/60 to-indigo-950/40 px-4 py-2.5 text-xs backdrop-blur-md">
                      <p className="text-zinc-400 leading-relaxed">
                        <span className="text-indigo-300 font-medium">{collectivePulse.heavyPercent}% of people</span> are carrying something heavy today. You&apos;re not alone.
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss pulse"
                      onClick={() => setPulseDismissed(true)}
                      className="ml-1 self-start text-zinc-600 hover:text-zinc-400 transition"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* UX-4 — emotion continuation greeting */}
                {sessionGreeting && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="max-w-[82%] rounded-2xl bg-gradient-to-br from-slate-700/60 to-slate-800/60 px-4 py-3 text-sm text-zinc-200 border border-white/10">
                      {sessionGreeting}
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss greeting"
                      onClick={() => setSessionGreeting(null)}
                      className="ml-1 self-start text-zinc-600 hover:text-zinc-400 transition"
                    >
                      ×
                    </button>
                  </div>
                )}

                {activeThread.messages
                  .filter((m) =>
                    !searchQuery.trim() ||
                    m.content.toLowerCase().includes(searchQuery.toLowerCase()),
                  )
                  .map((m, mi, arr) => (
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
                    avatarSrc={m.role === "assistant" ? (compAvatarData?.src ?? undefined) : undefined}
                    reaction={reactions[m.id]}
                    onReact={(emoji) => handleReact(m.id, emoji)}
                    bookmarked={bookmarks.has(m.id)}
                    onBookmark={() => toggleBookmark(m.id)}
                    onRetry={
                      m.role === "assistant" && m.replySource === "fallback"
                        ? () => {
                            const prev = arr[mi - 1];
                            if (!prev || prev.role !== "user") return;
                            setThreads((ts) =>
                              ts.map((t) =>
                                t.id === activeThread.id
                                  ? { ...t, messages: t.messages.filter((x) => x.id !== m.id) }
                                  : t,
                              ),
                            );
                            setDraft(prev.content);
                          }
                        : undefined
                    }
                  />
                ))}

                {/* #9: Typing indicator — shows while Imotara is composing a reply */}
                {analyzing && !pendingUndo && (
                  <div className="flex justify-start pl-1">
                    <div className="rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-slate-900/80 to-indigo-950/80 px-4 py-3 text-sm backdrop-blur-md max-w-[80%]">
                      {streamingReply ? (
                        <span className="text-zinc-200 leading-relaxed whitespace-pre-wrap">
                          {streamingReply}
                          <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-indigo-400 animate-pulse align-middle" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-zinc-400">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400/70 [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400/70 [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/70 [animation-delay:300ms]" />
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>{/* end emotion-ambient wrapper */}

          {/* End-of-session insight — shown when thread has ≥3 user messages + analysis ready */}
          {!analyzing &&
            analysis?.summary?.headline &&
            (activeThread?.messages.filter((m) => m.role === "user").length ?? 0) >= 3 && (
            <div className="mx-auto mb-1 max-w-3xl animate-fade-in rounded-2xl border border-indigo-400/15 bg-gradient-to-r from-indigo-500/8 via-sky-500/6 to-emerald-500/6 px-4 py-3">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70">
                Session insight
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed">{analysis.summary.headline}</p>
              {analysis.summary.details && (
                <p className="mt-0.5 text-[11px] text-zinc-500">{analysis.summary.details}</p>
              )}
              <div className="mt-2 flex items-center gap-3">
                <a href="/grow" className="text-[11px] text-indigo-400/80 underline underline-offset-2 hover:text-indigo-300 transition">
                  Reflect on this →
                </a>
                <a href="/history" className="text-[11px] text-zinc-500 hover:text-zinc-300 transition underline underline-offset-2">
                  View history →
                </a>
              </div>
            </div>
          )}

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
            {/* P3/P5 — Companion Insight Card */}
            {companionInsight && (
              <div className="mx-auto max-w-3xl">
                <CompanionInsightCard
                  variant={companionInsight.variant}
                  title={companionInsight.title}
                  body={companionInsight.body}
                  onDismiss={() => setCompanionInsight(null)}
                />
              </div>
            )}

            {/* P1 — Open Loop Card */}
            {activeOpenLoop && (
              <div className="mx-auto max-w-3xl">
                <OpenLoopCard
                  loop={activeOpenLoop}
                  onExplore={() => {
                    const prompt = getLoopPrompt(activeOpenLoop.themeKey);
                    dismissLoop(activeOpenLoop.id);
                    setActiveOpenLoop(null);
                    setUnsentLetterSetup(null);
                    newThread();
                    setDraft(prompt);
                  }}
                  onDefer={() => {
                    deferLoop(activeOpenLoop.id);
                    setActiveOpenLoop(null);
                  }}
                  onDismiss={() => {
                    dismissLoop(activeOpenLoop.id);
                    setActiveOpenLoop(null);
                  }}
                />
              </div>
            )}

            {/* Feature discovery card — one per session, after 3+ user messages */}
            {discoveryCard && (
              <div className="mx-auto mb-2 max-w-3xl flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/8 px-3.5 py-2 text-xs text-indigo-200/80">
                <span className="shrink-0 text-base">
                  {discoveryCard === "trends" ? "📊" : discoveryCard === "companion" ? "✨" : discoveryCard === "unsent_letter" ? "✉️" : "📡"}
                </span>
                <span className="flex-1 leading-snug">
                  {discoveryCard === "trends" && "Your mood over time — see your emotional patterns in"}
                  {discoveryCard === "companion" && "Make Imotara yours — personalize your companion's name and tone in"}
                  {discoveryCard === "offline" && "Always here, even offline — Imotara replies without internet using local mode."}
                  {discoveryCard === "unsent_letter" && "Write to someone you can't reach — the Unsent Letter space is here for you."}
                  {(discoveryCard === "trends" || discoveryCard === "companion") && (
                    <a
                      href={discoveryCard === "trends" ? "/history" : "/settings"}
                      onClick={dismissDiscoveryCard}
                      className="ml-1 font-semibold text-indigo-300 underline underline-offset-2 hover:text-indigo-200 transition"
                    >
                      {discoveryCard === "trends" ? "History & Trends →" : "Settings →"}
                    </a>
                  )}
                  {discoveryCard === "unsent_letter" && (
                    <button
                      type="button"
                      onClick={() => { dismissDiscoveryCard(); setUnsentLetterModalOpen(true); }}
                      className="ml-1 font-semibold text-indigo-300 underline underline-offset-2 hover:text-indigo-200 transition"
                    >
                      Try it →
                    </button>
                  )}
                </span>
                <button
                  type="button"
                  onClick={dismissDiscoveryCard}
                  aria-label="Dismiss tip"
                  className="shrink-0 text-zinc-500 hover:text-zinc-300 transition"
                >
                  ✕
                </button>
              </div>
            )}

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
            {draft.length > 800 && (
              <div className={`mx-auto mb-1 flex max-w-3xl justify-end text-[10px] font-semibold ${draft.length >= 2000 ? "text-red-500" : draft.length > 1800 ? "text-red-400" : "text-amber-400"}`}>
                {draft.length >= 2000 ? "2000 / 2000 — limit reached" : `${draft.length} / 2000${draft.length > 1800 ? " — approaching limit" : ""}`}
              </div>
            )}
            {showFirstTimeTip && !showUnsentHint && (
              <p className="mx-auto mb-2 max-w-3xl text-center text-[11px] italic text-zinc-500">
                Just talk — Imotara listens without judgment.
              </p>
            )}
            {/* UX-3 — contextual unsent-letter hint */}
            {showUnsentHint && (
              <div className="mx-auto mb-2 max-w-3xl flex items-center gap-3 animate-fade-in rounded-xl border border-violet-500/25 bg-violet-500/8 px-3.5 py-2 text-xs text-violet-200/85">
                <span className="shrink-0">✉️</span>
                <span className="flex-1 leading-snug">
                  Sounds like there's something you might want to say to someone.{" "}
                  <button
                    type="button"
                    onClick={() => { setShowUnsentHint(false); setUnsentLetterModalOpen(true); try { localStorage.setItem("imotara.unsent_letter.tried.v1", "1"); } catch {} }}
                    className="font-semibold text-violet-300 underline underline-offset-2 hover:text-violet-200 transition"
                  >
                    Try the Unsent Letter →
                  </button>
                </span>
                <button
                  type="button"
                  onClick={() => setShowUnsentHint(false)}
                  aria-label="Dismiss"
                  className="shrink-0 text-zinc-500 hover:text-zinc-300 transition"
                >✕</button>
              </div>
            )}
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={composerPlaceholder}
                aria-label="Message Imotara"
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
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
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
                aria-label={showBreathing ? "Close breathing exercise" : "Open breathing exercise"}
                className={`h-11 w-11 inline-flex items-center justify-center rounded-2xl border transition ${
                  showBreathing
                    ? "border-sky-400/50 bg-sky-500/20 text-sky-300"
                    : "border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                <Wind className="h-4 w-4" />
              </button>

              {/* P4 — Unsent Letter button */}
              <button
                onClick={() => setUnsentLetterModalOpen(true)}
                title="Write an unsent letter"
                className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                  unsentLetterSetup
                    ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                    : "border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
                type="button"
              >
                <Pencil className="h-4 w-4" />
              </button>

              <button
                onClick={() => sendMessage()}
                disabled={analyzing || !draft.trim() || streamingReply.length > 0}
                className="im-cta-bg inline-flex h-11 items-center gap-2 rounded-2xl border border-white/15 px-4 text-sm font-medium text-white shadow-lg transition hover:brightness-110 hover:-translate-y-0.5 duration-150 disabled:opacity-50"
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

      {/* P4 — Unsent Letter modal */}
      <UnsentLetterModal
        visible={unsentLetterModalOpen}
        onStart={(setup) => {
          setUnsentLetterSetup(setup);
          setUnsentLetterModalOpen(false);
          newThread();
          setDraft(`Dear ${setup.recipientName},\n\n`);
        }}
        onCancel={() => setUnsentLetterModalOpen(false)}
      />
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
  he: [
    { emoji: "😊", label: "טוב",       starter: "אני מרגיש/ה די טוב היום." },
    { emoji: "😔", label: "עצוב",      starter: "לא יודע/ת למה, אבל אני מרגיש/ה עצוב/ה." },
    { emoji: "😟", label: "חרד",       starter: "אני מרגיש/ה חרדה וחשש." },
    { emoji: "😤", label: "כועס",      starter: "אני כועס/ת ורוצה לשחרר את זה." },
    { emoji: "😵", label: "מבולבל",    starter: "אני מבולבל/ת ולא יודע/ת מה לעשות." },
    { emoji: "😶", label: "קהה",       starter: "אני מרגיש/ה קהות, בלי רגשות." },
  ],
  ar: [
    { emoji: "😊", label: "بخير",      starter: "أشعر بخير اليوم نسبياً." },
    { emoji: "😔", label: "حزين",      starter: "لا أعرف لماذا، لكنني أشعر بالحزن." },
    { emoji: "😟", label: "قلق",       starter: "أشعر بالقلق والتوتر." },
    { emoji: "😤", label: "غاضب",      starter: "أنا غاضب/ة وأريد أن أعبر عن ذلك." },
    { emoji: "😵", label: "مرتبك",     starter: "أنا مرتبك/ة ولا أعرف ماذا أفعل." },
    { emoji: "😶", label: "خدر",       starter: "أشعر بالخدر، بدون مشاعر." },
  ],
  de: [
    { emoji: "😊", label: "Gut",       starter: "Heute fühle ich mich eigentlich ganz gut." },
    { emoji: "😔", label: "Traurig",   starter: "Ich weiß nicht warum, aber ich bin traurig." },
    { emoji: "😟", label: "Ängstlich", starter: "Ich fühle mich ängstlich und besorgt." },
    { emoji: "😤", label: "Wütend",    starter: "Ich bin wütend und muss das rauslassen." },
    { emoji: "😵", label: "Verwirrt",  starter: "Ich bin verwirrt und weiß nicht, was ich tun soll." },
    { emoji: "😶", label: "Gefühllos", starter: "Ich fühle mich gefühllos, wie betäubt." },
  ],
  ja: [
    { emoji: "😊", label: "元気",   starter: "今日は気分がいいです。" },
    { emoji: "😔", label: "悲しい", starter: "なぜか悲しい気持ちです。" },
    { emoji: "😰", label: "不安",   starter: "不安で落ち着かない気持ちです。" },
    { emoji: "😤", label: "怒り",   starter: "今、怒りを感じています。" },
    { emoji: "😕", label: "混乱",   starter: "頭が混乱していて、どうしたらいいかわかりません。" },
    { emoji: "😶", label: "無感覚", starter: "何も感じられない状態です。" },
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
  he: "איך אתה מרגיש?",
  ar: "كيف تشعر؟",
  de: "Wie fühlst du dich?",
  ja: "今の気持ちは？",
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
  he: "או התחל להקליד למטה",
  ar: "أو ابدأ الكتابة أدناه",
  de: "oder unten eintippen",
  ja: "または下に入力してください",
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
  he: { morning: "בוקר טוב 🌅", afternoon: "צהריים טובים ☀️", evening: "ערב טוב 🌙", night: "עוד ער? 🌟" },
  ar: { morning: "صباح الخير 🌅", afternoon: "مساء الخير ☀️", evening: "مساء النور 🌙", night: "لا تزال مستيقظاً؟ 🌟" },
  de: { morning: "Guten Morgen 🌅", afternoon: "Guten Tag ☀️", evening: "Guten Abend 🌙", night: "Noch wach? 🌟" },
  ja: { morning: "おはようございます 🌅", afternoon: "こんにちは ☀️", evening: "こんばんは 🌙", night: "まだ起きていますか？ 🌟" },
};

function getGreeting(lang: string): string {
  const h = new Date().getHours();
  const g = GREETING_BY_LANG[lang] ?? GREETING_BY_LANG.en;
  if (h >= 5 && h < 12) return g.morning;
  if (h >= 12 && h < 17) return g.afternoon;
  if (h >= 17 && h < 21) return g.evening;
  return g.night;
}

const INTAKE_DONE_KEY = "imotara.intake.done.v1";

const INTAKE_QUESTIONS = [
  { q: "How are you feeling right now?", chips: ["Overwhelmed", "Anxious", "Low", "Okay", "Good", "Just exploring"] },
  { q: "What brings you here today?", chips: ["Something happened", "Processing something hard", "Wanting support", "Just checking in", "Curiosity"] },
  { q: "What would feel most helpful?", chips: ["Someone to listen", "Gentle guidance", "Space to reflect", "Just being heard"] },
];

const DEPTH_COMPANION_LINE: Record<0 | 1 | 2 | 3, string> = {
  0: "I'm here with you. How are you feeling right now?",
  1: "We've been talking for a while now — I'm glad you're here. How are you today?",
  2: "It's been good walking alongside you lately. What's on your heart today?",
  3: "You know I'm always here. How are you carrying things today?",
};

function EmptyState({ onChipSelect, lang = "en", threads = [] }: { onChipSelect: (text: string) => void; lang?: string; threads?: Array<{ messages: Array<{ role: string }> }> }) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("");
  const [intakeStep, setIntakeStep] = useState<0 | 1 | 2 | 3>(0);
  const [intakeAnswers, setIntakeAnswers] = useState<[string, string, string]>(["", "", ""]);

  const depthLine = DEPTH_COMPANION_LINE[getConversationDepth(threads).level];

  useEffect(() => { setGreeting(getGreeting(lang)); }, [lang]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(INTAKE_DONE_KEY)) setIntakeStep(1);
    } catch {}
  }, []);

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
        <p className="mt-1 text-sm text-zinc-300 italic">{depthLine}</p>

        {/* UX-1 — first-chat intake arc */}
        {intakeStep > 0 && intakeStep <= 3 ? (
          <div className="mt-5 animate-fade-in">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Step {intakeStep} of 3
            </p>
            <p className="mb-4 text-sm font-medium text-zinc-200">
              {INTAKE_QUESTIONS[intakeStep - 1].q}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {INTAKE_QUESTIONS[intakeStep - 1].chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    const updated = [...intakeAnswers] as [string, string, string];
                    updated[intakeStep - 1] = chip;
                    setIntakeAnswers(updated);
                    if (intakeStep < 3) {
                      setIntakeStep((intakeStep + 1) as 1 | 2 | 3);
                    } else {
                      const combined = `I'm feeling ${updated[0].toLowerCase()}. I'm here because: ${updated[1].toLowerCase()}. What I need most: ${updated[2].toLowerCase()}.`;
                      setIntakeStep(0);
                      try { localStorage.setItem(INTAKE_DONE_KEY, "1"); } catch {}
                      onChipSelect(combined);
                    }
                  }}
                  className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs text-indigo-200 transition hover:bg-indigo-500/20 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                >
                  {chip}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setIntakeStep(0); try { localStorage.setItem(INTAKE_DONE_KEY, "1"); } catch {}}}
              className="mt-4 text-[11px] text-zinc-600 hover:text-zinc-400 transition"
            >
              Skip →
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

const REACTION_EMOJIS = ["❤️", "💙", "✨", "🙏", "💛"];

// BCP-47 tags for all languages supported in the user profile
const LANG_TO_BCP47: Record<string, string> = {
  // Indian languages
  en: "en-US", hi: "hi-IN", mr: "mr-IN", bn: "bn-IN",
  ta: "ta-IN", te: "te-IN", gu: "gu-IN", pa: "pa-IN",
  kn: "kn-IN", ml: "ml-IN", or: "or-IN", ur: "ur-PK",
  // Foreign languages
  ar: "ar-SA", zh: "zh-CN", es: "es-ES", fr: "fr-FR",
  pt: "pt-BR", ru: "ru-RU", id: "id-ID",
  he: "he-IL", de: "de-DE", ja: "ja-JP",
};

// Detect the dominant script from Unicode ranges — covers all Indic + CJK
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs,     "$1")
    .replace(/^#{1,6}\s+/gm,    "")
    .replace(/^[-*+]\s+/gm,     "")
    .replace(/`(.+?)`/gs,       "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\n{3,}/g,         "\n\n")
    .trim();
}

function detectScriptLang(text: string): string | null {
  if (/[\u0590-\u05FF]/.test(text)) return "he-IL";   // Hebrew
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";   // Devanagari (Hindi/Marathi)
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN";   // Bengali
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";   // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";   // Telugu
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN";   // Gujarati
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa-IN";   // Gurmukhi (Punjabi)
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN";   // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN";   // Malayalam
  if (/[\u0B00-\u0B7F]/.test(text)) return "or-IN";   // Odia
  if (/[\u0600-\u06FF]/.test(text)) return "ar-SA";   // Arabic
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh-CN";   // Chinese
  if (/[\u3040-\u30FF]/.test(text)) return "ja-JP";   // Japanese
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko-KR";   // Korean
  return null;
}

function resolveTTSLang(text: string): string {
  // 1. Unicode script detection (highest confidence for non-Latin text)
  const fromScript = detectScriptLang(text);
  if (fromScript) return fromScript;
  // 2. Fall back to the user's saved preferredLang in their profile
  try {
    const raw = localStorage.getItem("imotara.profile.v1");
    if (raw) {
      const profile = JSON.parse(raw);
      const saved: string = profile?.user?.preferredLang ?? "en";
      if (saved && saved !== "auto" && LANG_TO_BCP47[saved]) return LANG_TO_BCP47[saved];
    }
  } catch { /* ignore */ }
  return "en-US";
}

// Known female/male name patterns used by browser TTS engines across platforms:
// macOS: Samantha/Victoria/Karen/Moira (f), Alex/Tom/Daniel (m)
// Windows: Zira/Aria/Jenny (f), David/Mark/James (m)
// Chrome: "Google XX Language Female" / "Google XX Language Male"
const FEMALE_PATTERNS =
  /\b(female|woman|girl|samantha|victoria|karen|moira|tessa|fiona|zira|aria|jenny|emily|nancy|lisa|kate|susan|natasha|anna|helium)\b/i;
const MALE_PATTERNS =
  /\b(male|man|alex|tom|daniel|liam|david|james|mark|richard|rishi|aaron|evan|reed|bruce|fred|junior)\b/i;

/** Score a voice for how well it matches the requested gender (higher = better). */
function genderScore(voice: SpeechSynthesisVoice, gender: string): number {
  const n = voice.name.toLowerCase();
  if (gender === "female") {
    if (FEMALE_PATTERNS.test(n)) return 2;
    if (MALE_PATTERNS.test(n)) return -1; // penalize opposite
    return 1; // neutral — acceptable
  }
  if (gender === "male") {
    if (MALE_PATTERNS.test(n)) return 2;
    if (FEMALE_PATTERNS.test(n)) return -1;
    return 1;
  }
  return 1; // prefer_not / nonbinary / unknown — no preference
}

function pickVoice(
  synth: SpeechSynthesis,
  lang: string,
  genderPref?: string,
): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  const langBase = lang.split("-")[0];

  // Collect all voices that match the language (exact locale, then base)
  const exact = voices.filter((v) => v.lang === lang);
  const broad = voices.filter((v) => v.lang.startsWith(langBase));
  const candidates = exact.length > 0 ? exact : broad;

  if (candidates.length === 0) return null;

  // If no gender preference or only one candidate, return best language match
  if (!genderPref || genderPref === "prefer_not" || genderPref === "other") {
    return candidates[0];
  }

  // Score candidates by gender match, pick the best
  const scored = candidates.map((v) => ({ v, score: genderScore(v, genderPref) }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].v;
}

/** Read the TTS gender preference from the user's saved profile. */
function getTTSGenderPref(): string {
  try {
    const raw = localStorage.getItem("imotara.profile.v1");
    if (!raw) return "prefer_not";
    const profile = JSON.parse(raw);
    // Companion gender controls Imotara's voice; fall back to user gender
    const compEnabled = !!profile?.companion?.enabled;
    const compGender: string = profile?.companion?.gender ?? "";
    const userGender: string = profile?.user?.gender ?? "prefer_not";
    return (compEnabled && compGender && compGender !== "prefer_not")
      ? compGender
      : userGender;
  } catch {
    return "prefer_not";
  }
}

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
  onRetry,
  avatarSrc,
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
  onRetry?: () => void;
  avatarSrc?: string;
}) {
  const isUser = role === "user";

  // ── Copy ──────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  function copyMessage() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {/* ignore */});
  }

  // ── TTS ───────────────────────────────────────────────────────────
  const [speaking, setSpeaking] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  async function doSpeak() {
    const bcp47  = resolveTTSLang(content);
    const lang   = bcp47.split("-")[0]; // "hi-IN" → "hi" for the API
    const gender = getTTSGenderPref();
    setSpeaking(true);
    try {
      const res = await fetch("/api/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: stripMarkdown(content), lang, gender }),
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = 0.95;
      ttsAudioRef.current = audio;
      const cleanup = () => { URL.revokeObjectURL(url); ttsAudioRef.current = null; setSpeaking(false); };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      await audio.play();
    } catch {
      // Azure unavailable — fall back to browser speech
      setSpeaking(false);
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const synth = window.speechSynthesis;
      const utt   = new SpeechSynthesisUtterance(content);
      utt.lang    = bcp47;
      utt.rate    = 0.95;
      utt.pitch   = 1.0;
      const voice = pickVoice(synth, bcp47, gender);
      if (voice) utt.voice = voice;
      setSpeaking(true);
      utt.onend  = () => setSpeaking(false);
      utt.onerror = () => setSpeaking(false);
      synth.speak(utt);
    }
  }

  function toggleSpeak() {
    if (typeof window === "undefined") return;
    if (speaking) {
      ttsAudioRef.current?.pause();
      ttsAudioRef.current = null;
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }
    void doSpeak();
  }

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
      ? "animate-msg-appear im-user-bubble-bg text-white shadow-[0_18px_40px_rgba(15,23,42,0.85)]"
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
      className={`flex items-start gap-2 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* UX-2 — companion avatar pinned to bot messages */}
      {!isUser && (
        avatarSrc
          ? <img src={avatarSrc} alt="Companion" className="mt-1 h-6 w-6 shrink-0 rounded-full object-cover" />
          : <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/25 text-[9px] font-bold text-indigo-300">I</div>
      )}
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
            {/* Copy */}
            <button
              type="button"
              onClick={copyMessage}
              title="Copy message"
              className={`ml-auto rounded-full p-1 transition hover:scale-110 ${
                copied ? "text-emerald-400" : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>

            {/* TTS */}
            {typeof window !== "undefined" && "speechSynthesis" in window && (
              <button
                type="button"
                onClick={toggleSpeak}
                title={speaking ? "Stop reading" : "Read aloud"}
                className={`rounded-full p-1 transition hover:scale-110 ${
                  speaking ? "text-sky-400 animate-pulse" : "text-zinc-600 hover:text-sky-300"
                }`}
              >
                {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
            )}

            {onBookmark && (
              <button
                type="button"
                onClick={onBookmark}
                title={bookmarked ? "Remove bookmark" : "Bookmark this message"}
                className={`rounded-full p-1 transition hover:scale-110 ${
                  bookmarked
                    ? "text-amber-400 animate-star-pop"
                    : "text-zinc-600 hover:text-amber-300"
                }`}
              >
                <Star className="h-3.5 w-3.5" fill={bookmarked ? "currentColor" : "none"} />
              </button>
            )}

            {/* Retry — shown when cloud failed and local fallback was used */}
            {onRetry && replySource === "fallback" && (
              <button
                type="button"
                onClick={onRetry}
                title="Retry with cloud"
                className="ml-1 rounded-full border border-amber-400/30 bg-amber-500/8 px-2 py-0.5 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/15"
              >
                ↺ Retry
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
