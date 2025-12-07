// src/app/chat/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Download,
  Eraser,
  RefreshCw,
} from "lucide-react";
import MoodSummaryCard from "@/components/imotara/MoodSummaryCard";
import type { AppMessage } from "@/lib/imotara/useAnalysis";
import { syncHistory } from "@/lib/imotara/syncHistoryAdapter";
import ConflictReviewButton from "@/components/imotara/ConflictReviewButton";
import AnalysisConsentToggle from "@/components/imotara/AnalysisConsentToggle";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";
import type { AnalysisResult } from "@/types/analysis";
import { runLocalAnalysis } from "@/lib/imotara/runLocalAnalysis";
import { runAnalysisWithConsent } from "@/lib/imotara/runAnalysisWithConsent";
import { saveSample } from "@/lib/imotara/history";
import type { Emotion } from "@/types/history";
import TopBar from "@/components/imotara/TopBar";
import { buildTeenInsight } from "@/lib/imotara/buildTeenInsight";
import ReplyOriginBadge from "@/components/imotara/ReplyOriginBadge";

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
};

type Thread = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
};

const STORAGE_KEY = "imotara.chat.v1";

// Build-time analysis implementation mode
const ANALYSIS_IMPL: "local" | "api" =
  (process.env.NEXT_PUBLIC_IMOTARA_ANALYSIS as "local" | "api") === "api"
    ? "api"
    : "local";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
        timeZone: "UTC",
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

/**
 * Fetch remote history for sync.
 * Supports:
 *   • raw array              -> [ ...records ]
 *   • { items: [...] }       -> { items }
 *   • { records: [...] }     -> { records, syncToken, ... }  (new envelope)
 */
async function fetchRemoteHistory(): Promise<unknown[]> {
  try {
    const res = await fetch("/api/history", { method: "GET" });
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
    const mod: Record<string, unknown> = await import(
      "@/lib/imotara/history"
    );
    const setHistory = mod.setHistory as
      | ((items: unknown) => Promise<void> | void)
      | undefined;
    const saveLocalHistory = mod.saveLocalHistory as
      | ((items: unknown) => Promise<void> | void)
      | undefined;
    const saveHistory = mod.saveHistory as
      | ((items: unknown) => Promise<void> | void)
      | undefined;

    if (typeof setHistory === "function") return void (await setHistory(merged));
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([entry]),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[imotara] pushToRemoteHistory failed:", err);
  }
}

async function logUserMessageToHistory(
  msg: Message,
  opts?: HistoryEmotionOptions
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
          summary?.primaryEmotion ??
          summary?.emotion ??
          summary?.tag ??
          null;
        const inferredIntensity =
          typeof summary?.intensity === "number"
            ? summary.intensity
            : null;

        if (inferredEmotion) {
          emotion = inferredEmotion as Emotion;
        }
        if (inferredIntensity !== null) {
          intensity = inferredIntensity;
        }
      } catch (e) {
        console.warn(
          "[imotara] local analysis for history logging failed, using neutral:",
          e
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
    console.error(
      "[imotara] failed to log chat message to history:",
      err
    );
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
    console.error(
      "[imotara] failed to log assistant message to history:",
      err
    );
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
  const [highlightedMessageId, setHighlightedMessageId] =
    useState<string | null>(null);
  const usedMessageIdRef = useRef<string | null>(null);

  // 🔒 Idempotency guard: remember last user message we replied to
  const lastReplyKeyRef = useRef<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const { mode } = useAnalysisConsent();
  const consentLabel =
    mode === "allow-remote" ? "Remote analysis allowed" : "On-device only";

  // Load threads (client only)
  useEffect(() => {
    if (!mounted) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          threads: Thread[];
          activeId?: string | null;
        };
        const t = Array.isArray(parsed.threads) ? parsed.threads : [];
        const a = parsed.activeId ?? (t[0]?.id ?? null);
        setThreads(t);
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
            "Hi, I'm Imotara — a quiet companion. This is a preview of the chat experience. Try sending me a message.",
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
    [threads, activeId]
  );

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
        STORAGE_KEY,
        JSON.stringify({ threads, activeId })
      );
    } catch {
      // ignore
    }
  }, [mounted, threads, activeId]);

  const appMessages: AppMessage[] = useMemo(() => {
    const msgs = activeThread?.messages ?? [];
    return msgs.filter(isAppMessage);
  }, [activeThread?.messages]);

  // analysis side-effect
  useEffect(() => {
    if (!mounted) return;
    const msgs = activeThread?.messages ?? [];
    if (msgs.length === 0) {
      setAnalysis(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await runAnalysisWithConsent(msgs, 10);
        if (!cancelled) {
          setAnalysis(res as AnalysisResult);
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

  async function triggerAnalyze() {
    if (!activeThread?.messages?.length) return;
    setAnalyzing(true);
    try {
      const res = await runAnalysisWithConsent(activeThread.messages, 10);
      setAnalysis(res as AnalysisResult);
      console.log("[imotara] manual analysis:", res?.summary?.headline, res);
    } catch (err) {
      console.error("[imotara] manual analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  }

  function deriveEmotionFromSummaryAndText(
    summary: any,
    msgsForAnalysis: Message[]
  ): { emotion: string; source: DebugEmotionSource } {
    const rawFromSummary =
      summary?.primaryEmotion ?? summary?.emotion ?? summary?.tag ?? "";

    let emotion = String(rawFromSummary || "").toLowerCase().trim();
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

    if (
      /lonely|alone|isolated|nobody cares|no one cares/.test(text)
    ) {
      return { emotion: "lonely", source: "fallback" };
    }
    if (
      /sad|depressed|miserable|crying|heartbroken|upset|empty/.test(text)
    ) {
      return { emotion: "sad", source: "fallback" };
    }
    if (
      /anxious|anxiety|worried|worry|panic|scared|afraid|fear|terrified|nervous/.test(
        text
      )
    ) {
      return { emotion: "anxious", source: "fallback" };
    }
    if (
      /angry|furious|rage|irritated|annoyed|frustrated|pissed/.test(text)
    ) {
      return { emotion: "angry", source: "fallback" };
    }
    if (
      /stressed|stress|overwhelmed|burnt out|burned out|too much|can't handle|cant handle/.test(
        text
      )
    ) {
      return { emotion: "stressed", source: "fallback" };
    }
    if (
      /happy|excited|joy|joyful|glad|grateful|thankful|optimistic|hopeful|thrilled/.test(
        text
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
    userMessageId: string
  ) {
    const replyKey = `${threadId}:${userMessageId}`;
    if (lastReplyKeyRef.current === replyKey) {
      return;
    }
    lastReplyKeyRef.current = replyKey;

    setAnalyzing(true);
    try {
      let debugEmotion: string | undefined;
      let debugEmotionSource: DebugEmotionSource = "unknown";
      let summary: any = {};

      try {
        const res = (await runAnalysisWithConsent(
          msgsForAnalysis,
          10
        )) as AnalysisResult | null;
        summary = res?.summary ?? {};

        const derived = deriveEmotionFromSummaryAndText(
          summary,
          msgsForAnalysis
        );
        debugEmotion = derived.emotion;
        debugEmotionSource = derived.source;
      } catch (err) {
        console.error("[imotara] reply analysis failed:", err);
      }

      let aiReply: string | null = null;

      if (mode === "allow-remote" && ANALYSIS_IMPL === "api") {
        try {
          const recentForApi = msgsForAnalysis.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          }));

          const emotionHint =
            typeof debugEmotion === "string" &&
              debugEmotion.trim().length > 0
              ? debugEmotion
              : "";

          const aiRes = await fetch("/api/chat-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: recentForApi,
              emotion: emotionHint,
            }),
          });

          if (aiRes.ok) {
            const data = await aiRes.json();

            // Be tolerant about response shape: accept text/reply/message
            const text = (
              data?.text ??
              data?.reply ??
              data?.message ??
              ""
            )
              .toString()
              .trim();

            if (text) {
              aiReply = text;
              console.log(
                "[imotara] using remote AI reply:",
                text.slice(0, 120)
              );
            }
          }
        } catch (err) {
          console.warn("[imotara] AI chat reply failed, falling back:", err);
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
          replySource: "openai",
        };

        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? { ...t, messages: [...t.messages, assistantMsg] }
              : t
          )
        );

        void logAssistantMessageToHistory(assistantMsg);

        // Auto-focus composer when assistant reply arrives
        setTimeout(() => composerRef.current?.focus(), 0);

        return;
      }

      let fallbackReply: string | null = null;

      try {
        const intensity =
          typeof summary.intensity === "number" ? summary.intensity : 0.4;
        const tone =
          typeof summary.tone === "string"
            ? summary.tone.toLowerCase()
            : "";

        const advice =
          summary.adviceShort ??
          summary.coachingTip ??
          summary.nextStep ??
          "";

        const strengthLabel =
          intensity < 0.25
            ? "a gentle"
            : intensity < 0.6
              ? "a pretty strong"
              : "an intense";

        const adviceTail =
          advice && String(advice).trim().length > 0
            ? ` ${String(advice).trim()}`
            : " If you’d like, you can tell me a little more about what’s going on.";

        const toneHint =
          tone && tone !== "neutral"
            ? ` I’ll try to stay ${tone} and on your side while we talk.`
            : "";

        const emotion = debugEmotion ?? "neutral";

        switch (emotion) {
          case "sad":
            fallbackReply =
              `I’m really glad you chose to share this with me. ` +
              `It sounds like you’re carrying ${strengthLabel} kind of sadness right now.` +
              ` You don’t have to push yourself to “be okay” for me.` +
              adviceTail +
              toneHint;
            break;
          case "anxious":
            fallbackReply =
              `This does sound like a lot to hold inside. ` +
              `I can hear there’s ${strengthLabel} sense of anxiety or worry in what you wrote.` +
              ` It’s completely valid to feel this way.` +
              adviceTail +
              toneHint;
            break;
          case "angry":
            fallbackReply =
              `Your frustration makes sense in the way you’ve described things.` +
              ` It sounds like ${strengthLabel} wave of anger or irritation is present for you.` +
              ` I’m not here to judge that — I’m here to help you unpack it, if you want.` +
              adviceTail +
              toneHint;
            break;
          case "stressed":
            fallbackReply =
              `This feels like a heavy load to be carrying on your own.` +
              ` I’m sensing ${strengthLabel} feeling of stress or overwhelm in your words.` +
              ` It’s okay to admit that it’s a lot — that’s not a weakness.` +
              adviceTail +
              toneHint;
            break;
          case "happy":
            fallbackReply =
              `There’s a real spark of something warm in what you shared.` +
              ` It sounds like you’re feeling ${strengthLabel} sense of happiness.` +
              ` I’m genuinely happy to hear this with you.` +
              (advice
                ? ` ${String(advice).trim()}`
                : " If you want, we can explore how to keep nurturing this feeling.") +
              toneHint;
            break;
          case "lonely":
            fallbackReply =
              `Feeling disconnected or alone like this can be really tough.` +
              ` I’m sensing ${strengthLabel} feeling of loneliness in what you wrote.` +
              ` I’m here with you in this space, even if it’s just through text right now.` +
              adviceTail +
              toneHint;
            break;
          default:
            fallbackReply =
              `Thanks for opening up to me. ` +
              `What you shared feels like a more even, mixed emotional space — not purely positive or negative.` +
              ` I’m here to sit with whatever is there, even if it feels vague or hard to label.` +
              adviceTail +
              toneHint;
            break;
        }
      } catch (err) {
        console.error("[imotara] fallback reply failed:", err);
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
            : t
        )
      );

      void logAssistantMessageToHistory(assistantMsg);

      // Focus when fallback reply is shown
      setTimeout(() => composerRef.current?.focus(), 0);
    } finally {
      setAnalyzing(false);
    }
  }

  function newThread() {
    const t: Thread = {
      id: uid(),
      title: "New conversation",
      createdAt: Date.now(),
      messages: [],
    };
    setThreads((prev) => [t, ...prev]);
    setActiveId(t.id);
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
      prev.map((t) =>
        t.id === activeThread.id ? { ...t, title } : t
      )
    );
  }

  function sendMessage() {
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
                ? text.slice(0, 40) +
                (text.length > 40 ? "…" : "")
                : t.title,
            messages: [...t.messages, userMsg],
          }
          : t
      )
    );

    void logUserMessageToHistory(userMsg);
    void generateAssistantReply(targetId, msgsForAnalysis, userMsg.id);

    setDraft("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    if (!activeThread) return;
    if (!confirm("Clear all messages in this conversation?")) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id ? { ...t, messages: [] } : t
      )
    );
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ threads }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `imotara_chat_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <TopBar title="Chat" showSyncChip showConflictsButton />

      <div className="mx-auto flex h-[calc(100vh-0px)] w-full max-w-7xl px-3 py-4 text-zinc-100 sm:px-4">
        {/* Sidebar */}
        <aside className="hidden w-72 flex-col gap-3 p-4 sm:flex imotara-glass-card">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Conversations
            </h2>
            <button
              onClick={newThread}
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-100 shadow-sm transition hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-md duration-150"
              aria-label="New conversation"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>

          <div className="mb-2 hidden text-[11px] text-zinc-400 sm:block">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-zinc-300 backdrop-blur-sm">
              <span
                className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote" ? "bg-emerald-400" : "bg-zinc-500"
                  }`}
              />
              {consentLabel}
            </span>
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
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 shrink-0 text-zinc-400" />
                        <input
                          className={`w-full truncate bg-transparent text-sm outline-none placeholder:text-zinc-500 ${isActive
                            ? "font-semibold text-zinc-100"
                            : "text-zinc-200"
                            }`}
                          value={
                            t.id === activeId
                              ? activeThread?.title ?? ""
                              : t.title
                          }
                          onChange={(e) =>
                            t.id === activeId &&
                            renameActive(e.target.value)
                          }
                          placeholder="Untitled"
                        />
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                        <DateText ts={t.createdAt} />
                      </p>
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-white shadow-[0_10px_30px_rgba(15,23,42,0.8)] sm:h-9 sm:w-9">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-50 sm:text-base">
                        <span suppressHydrationWarning>
                          {mounted
                            ? activeThread?.title ?? "Conversation"
                            : ""}
                        </span>
                      </p>
                      <p className="text-[11px] text-zinc-400 sm:hidden">
                        Private preview · Local-first by default.
                      </p>
                      <div className="hidden space-y-0.5 sm:block">
                        <p className="text-sm text-zinc-400">
                          Private preview. Analysis and replies respect your
                          consent settings.
                        </p>
                        <p className="text-xs text-zinc-500">
                          You can{" "}
                          <Link
                            href="/privacy"
                            className="underline decoration-indigo-400/60 underline-offset-2 hover:text-indigo-300"
                          >
                            download or delete what’s stored on this device
                          </Link>{" "}
                          anytime.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-start gap-2 text-[11px] sm:justify-end">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-zinc-200 backdrop-blur-sm">
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
                      {syncing
                        ? "Syncing…"
                        : lastSyncAt
                          ? `Synced ${syncedCount ?? 0}`
                          : "Not synced yet"}
                    </span>
                    {syncError ? (
                      <span className="text-[11px] text-red-400">
                        {syncError}
                      </span>
                    ) : null}
                    <button
                      onClick={runSync}
                      disabled={syncing}
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-sm transition hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-md duration-150 disabled:opacity-60"
                      title="Sync local ↔ remote history"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${syncing ? "animate-spin" : ""
                          }`}
                      />
                      Sync now
                    </button>
                    <Link
                      href="/history"
                      className="inline-flex"
                      title="Open Emotion History to review conflicts"
                    >
                      <ConflictReviewButton />
                    </Link>
                    <span
                      className={[
                        "hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] backdrop-blur-sm",
                        mode === "allow-remote"
                          ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-200"
                          : "border-zinc-500/70 bg-black/40 text-zinc-300",
                      ].join(" ")}
                      title="Current emotion analysis mode"
                    >
                      <span
                        className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${mode === "allow-remote"
                          ? "bg-emerald-400"
                          : "bg-zinc-500"
                          }`}
                      />
                      {consentLabel}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-zinc-400">
                      Emotion analysis mode
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      {analysis?.summary?.headline ? (
                        <span
                          className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-100 backdrop-blur-sm"
                          title="Emotion snapshot for this conversation"
                        >
                          {analysis.summary.headline}
                        </span>
                      ) : (
                        <span className="rounded-full border border-dashed border-white/20 bg-black/30 px-2 py-1 text-xs text-zinc-400">
                          No analysis yet
                        </span>
                      )}
                    </div>

                    {teenInsight && (
                      <div className="mt-1 hidden rounded-2xl border border-violet-500/35 bg-violet-500/10 px-3 py-3 text-xs text-violet-50 shadow-sm sm:block">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-200/90">
                          Teen Insight
                        </div>
                        <div className="whitespace-pre-line text-[12px] leading-relaxed text-violet-50/95">
                          {teenInsight}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <AnalysisConsentToggle />
                      <span className="text-xs text-zinc-400">
                        {consentLabel}
                      </span>
                    </div>

                    <p className="mt-1 hidden max-w-xs text-xs text-zinc-500 sm:block">
                      Use the toggle to switch between local-only and remote
                      analysis. Your words stay on-device unless you explicitly
                      allow remote.
                    </p>

                    <p className="mt-0.5 hidden max-w-xs text-[11px] text-zinc-500 sm:block">
                      {ANALYSIS_IMPL === "api"
                        ? "Engine: Cloud AI via /api/analyze (used only when remote analysis is allowed)."
                        : "Engine: On-device analysis only. Remote AI is disabled in this build."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                    <Link
                      href={
                        activeThread
                          ? `/history?sessionId=${encodeURIComponent(
                            activeThread.id
                          )}${urlMessageId
                            ? `&messageId=${encodeURIComponent(
                              urlMessageId
                            )}`
                            : ""
                          }`
                          : "/history"
                      }
                      className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 shadow-sm transition hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-md duration-150 sm:text-sm"
                      title="Open Emotion History filtered to this chat session"
                    >
                      History
                    </Link>

                    <button
                      onClick={triggerAnalyze}
                      disabled={
                        analyzing || !(activeThread?.messages?.length)
                      }
                      aria-busy={analyzing ? true : undefined}
                      className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 shadow-sm transition hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-md duration-150 disabled:opacity-60 sm:text-sm"
                      title="Run emotion analysis now (respects your consent setting)"
                    >
                      {analyzing ? (
                        <RefreshCw className="h-3 w-3 animate-spin sm:h-4 sm:w-4" />
                      ) : null}
                      Re-analyze
                    </button>

                    <Link
                      href="/privacy"
                      className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-zinc-100 shadow-sm transition hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-md duration-150 sm:text-sm"
                      title="See how Imotara handles your data and privacy"
                    >
                      Privacy
                    </Link>

                    <button
                      onClick={clearChat}
                      className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 shadow-sm transition hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-md duration-150 disabled:opacity-60 sm:text-sm"
                      title="Clear current conversation"
                    >
                      <Eraser className="h-3 w-3 sm:h-4 sm:w-4" /> Clear
                    </button>
                    <button
                      onClick={exportJSON}
                      className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 shadow-sm transition hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-md duration-150 disabled:opacity-60 sm:text-sm"
                      title="Download all conversations as JSON"
                    >
                      <Download className="h-3 w-3 sm:h-4 sm:w-4" /> Export
                    </button>
                    <button
                      onClick={newThread}
                      className="inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-gradient-to-r from-indigo-500/70 via-sky-500/70 to-emerald-400/80 px-3 py-1.5 text-xs font-medium text-white shadow-md transition hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg duration-150 sm:text-sm"
                    >
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4" /> New
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* BODY */}
          <div
            ref={listRef}
            className="flex-1 overflow-auto px-4 py-4 sm:px-6"
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
              <EmptyState />
            ) : (
              <div className="mx-auto max-w-3xl space-y-4">
                <div className="imotara-glass-card p-4">
                  <MoodSummaryCard
                    messages={appMessages}
                    windowSize={10}
                    mode="local"
                  />
                </div>
                {activeThread.messages.map((m) => (
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
                  />
                ))}
              </div>
            )}
          </div>

          {/* COMPOSER */}
          <div className="border-t border-white/10 px-3 pb-3 pt-2 sm:px-4">
            <div className="mx-auto mb-1 flex max-w-3xl justify-end">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[11px] text-zinc-200 backdrop-blur-sm">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote" ? "bg-emerald-400" : "bg-zinc-500"
                    }`}
                />
                {consentLabel}
              </span>
            </div>

            <div className="mx-auto mb-1 max-w-3xl space-y-0.5">
              <p className="pr-1 text-right text-xs text-zinc-500">
                Your chat is saved locally and synced when online.
              </p>
              <p className="pr-1 text-right text-[11px] text-zinc-600">
                Imotara is not an emergency or crisis service. If you are in
                danger or feel like you might hurt yourself, please reach out to
                a trusted adult or local helpline immediately.
              </p>
            </div>

            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type your message… (Enter to send, Shift+Enter for newline)"
                rows={1}
                className="max-h-[200px] flex-1 resize-none rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-indigo-400/70 focus:ring-1 focus:ring-indigo-500/60"
              />
              <button
                onClick={sendMessage}
                disabled={!draft.trim()}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/15 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-4 text-sm font-medium text-white shadow-lg transition hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(129,140,248,0.7)] duration-150 disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Send
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mt-8 rounded-2xl border border-dashed border-white/20 bg-black/30 p-8 text-center text-zinc-200">
        <p className="text-base font-medium">Start a conversation</p>
        <p className="mt-1 text-sm text-zinc-400">
          This is a preview of Imotara’s chat. Messages are saved in your
          browser, and analysis/replies respect your consent settings.
        </p>
      </div>
    </div>
  );
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
}) {
  const isUser = role === "user";

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
      "shadow-[0_18px_40px_rgba(16,185,129,0.8)]"
    );
  }

  const assistantHover: string[] = [];
  if (!isUser) {
    assistantHover.push(
      "hover:scale-[1.01]",
      "hover:shadow-[0_0_28px_rgba(129,140,248,0.7)]",
      "hover:brightness-110",
      "hover:saturate-125"
    );
    if (replySource === "openai") {
      assistantHover.push(
        "hover:shadow-[0_0_36px_rgba(52,211,153,0.85)]",
        "hover:translate-y-[-1px]"
      );
    }
  }

  const bubbleClass = [
    "max-w-[85%] rounded-2xl px-4 py-3 text-sm sm:max-w-[75%] transition-all",
    isUser
      ? "bg-gradient-to-br from-indigo-500/80 via-sky-500/80 to-emerald-400/80 text-white shadow-[0_18px_40px_rgba(15,23,42,0.85)]"
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
    replySource === "openai" ? "openai" : replySource ? "local-fallback" : "unknown";

  return (
    <div
      ref={attachRef}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={bubbleClass}>
        <div className="whitespace-pre-wrap">{content}</div>

        <div
          className={`mt-1 text-[11px] ${isUser ? "text-zinc-100/80" : "text-zinc-300"
            }`}
        >
          <DateText ts={time} /> · {isUser ? "You" : "Imotara"}
          {isUser && sessionId ? (
            <>
              {" · "}
              <Link
                href={`/history?sessionId=${encodeURIComponent(
                  sessionId
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
              <span className="font-medium">
                {debugEmotion ?? "unknown"}
              </span>
              , derived:{" "}
              <span className="font-medium">
                {debugEmotionSource ?? "unknown"}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
