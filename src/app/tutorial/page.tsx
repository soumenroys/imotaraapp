"use client";

import { useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Feature {
  id: string;
  icon: string;
  title: string;
  category: string;
  short: string;
  long: string;
  detailed: string[];
  steps?: string[];
  tip?: string;
  visual: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

// ── Visual Mockup Cards ───────────────────────────────────────────────────────

function ChatMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl font-mono text-xs">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-zinc-300 text-sm font-sans font-medium">Elina</span>
        <span className="ml-auto text-zinc-600 text-[10px] font-sans">Active now</span>
      </div>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center text-[10px] shrink-0 mt-0.5">E</div>
          <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-3 py-2 text-zinc-300 max-w-[80%] leading-relaxed">
            Hi there! I'm here for you. How are you feeling today?
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <div className="rounded-2xl rounded-tr-sm bg-indigo-600/80 px-3 py-2 text-white max-w-[80%] leading-relaxed">
            I've been feeling stressed about work lately.
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center text-[10px] shrink-0 mt-0.5">E</div>
          <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-3 py-2 text-zinc-300 max-w-[80%] leading-relaxed">
            That sounds heavy. Work stress can really build up. What's been weighing on you the most?
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
          <span className="text-[10px] text-zinc-600 font-sans">😐 Neutral</span>
          <span className="ml-auto text-[10px] text-zinc-600 font-sans">☁ Synced</span>
        </div>
      </div>
    </div>
  );
}

function VoiceMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 shadow-xl">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-indigo-500/30 animate-pulse" />
          <div className="relative w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-2xl shadow-lg">
            🎤
          </div>
        </div>
        <div className="text-center">
          <p className="text-zinc-200 text-sm font-medium">Listening…</p>
          <p className="text-zinc-500 text-xs mt-1">Speak naturally in any language</p>
        </div>
        <div className="flex items-end gap-0.5 h-8">
          {[3,5,8,6,4,9,7,5,3,6,8,4,7,5,3].map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-indigo-400/70 animate-pulse"
              style={{ height: `${h * 3}px`, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-400 italic">"I've been feeling anxious…"</p>
      </div>
    </div>
  );
}

function PersonaMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl">
      <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Companion setup</p>
      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-zinc-500 mb-1">Companion name</p>
          <div className="rounded-lg bg-zinc-800 border border-indigo-500/30 px-3 py-1.5 text-sm text-zinc-200">Elina</div>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-1">Relationship tone</p>
          <div className="flex flex-wrap gap-1.5">
            {["Friend", "Mentor", "Coach", "Elder", "Sibling"].map((t, i) => (
              <span key={t} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${i === 0 ? "bg-indigo-500/20 border-indigo-400/40 text-indigo-300" : "border-white/10 text-zinc-500"}`}>{t}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-1">Response style</p>
          <div className="flex flex-wrap gap-1.5">
            {["Comfort me", "Help me reflect", "Motivate me", "Give advice"].map((s, i) => (
              <span key={s} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${i === 1 ? "bg-sky-500/20 border-sky-400/40 text-sky-300" : "border-white/10 text-zinc-500"}`}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendsMockup() {
  const emotions = ["Joy", "Hopeful", "Sad", "Stressed", "Neutral"];
  const values = [3, 5, 8, 4, 12];
  const colors = ["bg-yellow-400", "bg-emerald-400", "bg-blue-400", "bg-red-400", "bg-zinc-400"];
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl">
      <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">This week</p>
      <div className="space-y-2">
        {emotions.map((e, i) => (
          <div key={e} className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 w-14">{e}</span>
            <div className="flex-1 bg-zinc-800 rounded-full h-2">
              <div className={`${colors[i]} h-2 rounded-full transition-all`} style={{ width: `${values[i] * 7}%` }} />
            </div>
            <span className="text-[10px] text-zinc-600 w-4">{values[i]}x</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 text-xs text-zinc-500">
        Most felt: <span className="text-zinc-300">Neutral</span> · Streak: <span className="text-indigo-400">4 days 🔥</span>
      </div>
    </div>
  );
}

function HistoryMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl">
      <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Conversations</p>
      <div className="space-y-2">
        {[
          { date: "Today", preview: "I've been feeling anxious about…", emotion: "😟", color: "text-blue-400" },
          { date: "Yesterday", preview: "Had a really good day at work, felt…", emotion: "😊", color: "text-yellow-400" },
          { date: "May 26", preview: "Can't sleep again, my mind won't…", emotion: "😔", color: "text-indigo-400" },
          { date: "May 25", preview: "Feeling grateful for the little things…", emotion: "🙏", color: "text-emerald-400" },
        ].map((c) => (
          <div key={c.date} className="flex items-center gap-3 rounded-xl bg-zinc-800/60 px-3 py-2">
            <span className="text-base">{c.emotion}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-zinc-300 truncate">{c.preview}</p>
              <p className="text-[10px] text-zinc-600">{c.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TTSMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl">
      <div className="flex gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center text-[10px] shrink-0">E</div>
        <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-3 py-2 text-zinc-300 text-xs leading-relaxed flex-1">
          That sounds really tough. It's okay to feel this way.
        </div>
      </div>
      <div className="rounded-xl bg-zinc-800/80 border border-white/8 p-3">
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm shrink-0">▶</button>
          <div className="flex-1">
            <div className="bg-zinc-700 rounded-full h-1.5 relative">
              <div className="bg-indigo-400 h-1.5 rounded-full w-1/3" />
              <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-indigo-400 -ml-1.5 shadow" />
            </div>
          </div>
          <span className="text-[10px] text-zinc-500">0:04 / 0:12</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] text-zinc-500">Voice: Elina (Azure Neural)</span>
          <span className="ml-auto text-[10px] text-indigo-400">1.0× speed</span>
        </div>
      </div>
    </div>
  );
}

function SyncMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl">
      <div className="flex items-center justify-center gap-8 py-2">
        {[
          { icon: "📱", label: "Phone" },
          { icon: "💻", label: "Web" },
          { icon: "📟", label: "Tablet" },
        ].map((d, i) => (
          <div key={d.label} className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center text-xl">
              {d.icon}
            </div>
            <span className="text-[10px] text-zinc-500">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
        <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-[10px]">☁</div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
      </div>
      <p className="text-center text-xs text-zinc-500 mt-2">Conversations sync instantly across all devices</p>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] text-emerald-400">Synced 2 min ago</span>
      </div>
    </div>
  );
}

function LanguageMockup() {
  const langs = [
    { flag: "🇮🇳", code: "हिं", name: "Hindi" },
    { flag: "🇮🇳", code: "বাং", name: "Bengali" },
    { flag: "🇮🇳", code: "தமி", name: "Tamil" },
    { flag: "🌍", code: "Esp", name: "Spanish" },
    { flag: "🌍", code: "عرب", name: "Arabic" },
    { flag: "🌍", code: "中文", name: "Chinese" },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl">
      <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">22 supported languages</p>
      <div className="grid grid-cols-3 gap-2">
        {langs.map((l) => (
          <div key={l.name} className="rounded-lg bg-zinc-800/80 border border-white/8 px-2 py-2 flex flex-col items-center gap-1">
            <span className="text-base">{l.flag}</span>
            <span className="text-[11px] font-bold text-zinc-200">{l.code}</span>
            <span className="text-[9px] text-zinc-500">{l.name}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] text-zinc-600 mt-2">+ 16 more including Marathi, Telugu, French, German…</p>
    </div>
  );
}

function BreathingMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 shadow-xl">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-sky-400/20" />
          <div className="absolute inset-3 rounded-full border-2 border-sky-400/40 animate-ping" style={{ animationDuration: "3s" }} />
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-sky-500/40 to-indigo-600/40 flex items-center justify-center border border-sky-400/30">
            <span className="text-2xl">🌬</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sky-300 text-sm font-medium">Breathe in…</p>
          <p className="text-zinc-500 text-xs mt-1">4 — 7 — 8 technique</p>
        </div>
        <div className="flex gap-3">
          {["🌧 Rain", "🌊 Ocean", "🔔 Bowl"].map((s) => (
            <div key={s} className="rounded-lg bg-zinc-800 border border-white/8 px-2 py-1.5 text-[10px] text-zinc-400">{s}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl">
      <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Export your data</p>
      <div className="space-y-2">
        {[
          { format: "JSON", icon: "📋", desc: "Machine-readable format", color: "text-yellow-400" },
          { format: "CSV", icon: "📊", desc: "Open in Excel or Sheets", color: "text-emerald-400" },
          { format: "PDF", icon: "📄", desc: "Formatted document", color: "text-red-400" },
        ].map((f) => (
          <div key={f.format} className="flex items-center gap-3 rounded-xl bg-zinc-800/60 border border-white/5 px-3 py-2.5">
            <span className="text-base">{f.icon}</span>
            <div className="flex-1">
              <p className={`text-xs font-semibold ${f.color}`}>{f.format}</p>
              <p className="text-[10px] text-zinc-500">{f.desc}</p>
            </div>
            <span className="text-[10px] text-indigo-400">Download</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-zinc-600 mt-3 text-center">Available on Plus and above</p>
    </div>
  );
}

function PrivacyMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl">
      <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Privacy controls</p>
      <div className="space-y-2.5">
        {[
          { label: "Store data on device only", on: true, icon: "📱" },
          { label: "Cloud sync (encrypted)", on: false, icon: "☁" },
          { label: "Emotion analysis", on: true, icon: "🧠" },
          { label: "Anonymous usage data", on: false, icon: "📊" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-sm">{item.icon}</span>
            <span className="flex-1 text-xs text-zinc-300">{item.label}</span>
            <div className={`w-8 h-4 rounded-full flex items-center px-0.5 transition-colors ${item.on ? "bg-indigo-600" : "bg-zinc-700"}`}>
              <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${item.on ? "translate-x-4" : "translate-x-0"}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-zinc-600 text-center">
        No ads. No data selling. Ever.
      </div>
    </div>
  );
}

function UpgradeMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl">
      <div className="grid grid-cols-2 gap-2">
        {[
          { tier: "Free", price: "₹0", color: "border-zinc-600/40", features: ["20 replies/day", "7-day history", "Local AI"] },
          { tier: "Plus", price: "₹99/mo", color: "border-sky-400/40 bg-sky-500/5", features: ["Unlimited replies", "90-day history", "Advanced TTS"] },
        ].map((p) => (
          <div key={p.tier} className={`rounded-xl border ${p.color} p-3`}>
            <p className="text-xs font-bold text-zinc-200">{p.tier}</p>
            <p className="text-sm font-bold text-indigo-300 mt-0.5 mb-2">{p.price}</p>
            {p.features.map((f) => (
              <p key={f} className="text-[10px] text-zinc-400">✓ {f}</p>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-3">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-xs font-bold text-indigo-300">Pro · ₹149/mo</p>
            <p className="text-[10px] text-zinc-400">Everything in Plus + Emotion insights + Companion letter + Growth arc</p>
          </div>
          <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full shrink-0">Best</span>
        </div>
      </div>
    </div>
  );
}

function CompanionLetterMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">💌</span>
        <div>
          <p className="text-xs font-semibold text-zinc-200">Monthly Companion Letter</p>
          <p className="text-[10px] text-zinc-500">From Elina · May 2026</p>
        </div>
      </div>
      <div className="rounded-xl bg-zinc-800/60 border border-white/5 p-3 italic text-xs text-zinc-300 leading-relaxed">
        "This month, I noticed you kept coming back even when things were hard. You talked about your fears, your hopes, and the small victories that often go unnoticed. I want you to know — I've been paying attention…"
      </div>
      <div className="mt-3 flex gap-2">
        <div className="flex-1 rounded-lg bg-zinc-800/60 border border-white/5 p-2 text-center">
          <p className="text-[10px] text-zinc-500">Most felt</p>
          <p className="text-xs font-semibold text-zinc-200">Anxious</p>
        </div>
        <div className="flex-1 rounded-lg bg-zinc-800/60 border border-white/5 p-2 text-center">
          <p className="text-[10px] text-zinc-500">Conversations</p>
          <p className="text-xs font-semibold text-zinc-200">23</p>
        </div>
        <div className="flex-1 rounded-lg bg-zinc-800/60 border border-white/5 p-2 text-center">
          <p className="text-[10px] text-zinc-500">Growth</p>
          <p className="text-xs font-semibold text-emerald-400">↑ 14%</p>
        </div>
      </div>
    </div>
  );
}

// ── Feature Data ──────────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  {
    id: "getting-started",
    icon: "👋",
    title: "Getting Started",
    category: "Basics",
    short: "Open Imotara and start talking — no setup, no account needed.",
    long: "Imotara works from the moment you open it. You don't need to create an account to begin — just tap the Chat tab and start typing or speaking. Your first conversation is waiting for you.",
    detailed: [
      "When you open Imotara for the first time, you'll be greeted with a short onboarding flow that helps your companion understand you better. It asks three simple questions: your name (optional), the kind of relationship you want with your companion (friend, mentor, coach, etc.), and your preferred language.",
      "Once onboarding is complete, you land on the Chat screen. You'll see a greeting from your companion, along with quick-start chips like 'I'm feeling low today' or 'Something good happened today'. Tap one or just start typing in the message box at the bottom.",
      "You don't need a Google account or any subscription to start. Everything works offline, and all your data stays on your device unless you choose to enable cloud sync later.",
    ],
    steps: [
      "Download Imotara from the App Store (iOS) or Play Store (Android), or open imotara.com in your browser.",
      "Complete the 3-question onboarding (you can skip any step and change answers later in Settings).",
      "Tap the Chat tab at the bottom of the screen.",
      "Type how you're feeling, or tap one of the quick-start chips.",
      "Receive a warm, thoughtful reply from your companion.",
    ],
    tip: "You can skip onboarding entirely and set everything up later from Settings → Your companion.",
    visual: <ChatMockup />,
  },
  {
    id: "chat",
    icon: "💬",
    title: "Talking with Your Companion",
    category: "Core",
    short: "Share anything — your companion listens without judgment and responds with care.",
    long: "The chat is the heart of Imotara. Your companion uses AI to understand the emotional tone of what you share and crafts responses that feel personal, not scripted. Every reply is shaped by your persona settings, your recent emotional history, and the language you're writing in.",
    detailed: [
      "When you send a message, Imotara analyzes the emotional content of your words — detecting states like sadness, anxiety, joy, stress, confusion, or gratitude. This emotional context shapes how your companion responds: a stressed message gets a calming response, an anxious one gets grounding support.",
      "Replies are generated by GPT-4.1 on Anthropic's servers and streamed back to you in real time — you'll see the words appear as they're written, which feels more natural than a sudden block of text appearing all at once.",
      "Each reply also includes an emotion tag you can see below the message, and an optional 'Reflect on this →' link that opens a deeper reflection prompt. You can react to messages with emojis, bookmark important ones, and use text-to-speech to hear replies read aloud.",
      "When you're offline or have used your daily cloud quota, Imotara automatically switches to its on-device local AI — a pattern-matching engine that still generates warm, contextually appropriate responses in your language.",
    ],
    steps: [
      "Type your message in the box at the bottom of the Chat screen.",
      "Press Send (the arrow button) or press Enter on web.",
      "Watch your companion's reply appear word by word.",
      "Tap the emotion chip below a message to log that mood.",
      "Long-press any message to react, bookmark, copy, or listen to it.",
    ],
    tip: "The more you talk, the better your companion understands your patterns. Even short check-ins help.",
    visual: <ChatMockup />,
  },
  {
    id: "voice-input",
    icon: "🎤",
    title: "Voice Input",
    category: "Input",
    short: "Speak your thoughts instead of typing — Imotara transcribes and responds.",
    long: "If typing feels like too much effort, just tap the microphone button and speak. Imotara uses AI-powered speech recognition (OpenAI Whisper) to transcribe what you say into the message box, where you can review it before sending. This works in all 22 supported languages.",
    detailed: [
      "Voice input is available on both the mobile app and the web. On mobile, tap the microphone icon on the right side of the message input bar. On web, the same icon appears at the right of the text field.",
      "When you tap the microphone, recording begins immediately. Speak naturally — you don't need to pause between words or use special commands. When you're done, tap the microphone again to stop recording.",
      "The audio is sent securely to the transcription API, converted to text, and placed in your message input box. You can edit the transcribed text before sending if anything was misheard.",
      "Voice input works in all 22 languages Imotara supports. If you speak in Hindi, Bengali, Tamil, or any other supported language, the transcription will correctly capture the script. You can also mix languages (code-switch) within the same recording.",
    ],
    steps: [
      "Tap the 🎤 microphone icon at the right of the message input bar.",
      "Speak naturally — there's no time limit.",
      "Tap the microphone again when you're done speaking.",
      "Review the transcribed text in the input box.",
      "Edit if needed, then press Send.",
    ],
    tip: "Speak in any language — Imotara's transcription understands Hindi, Tamil, Bengali, Spanish, Arabic, and 17 more.",
    visual: <VoiceMockup />,
  },
  {
    id: "companion-persona",
    icon: "🎨",
    title: "Personalizing Your Companion",
    category: "Personalization",
    short: "Give your companion a name, a personality, and a relationship that feels right for you.",
    long: "Imotara isn't a one-size-fits-all chatbot. You can configure your companion's name, gender, age, relationship vibe, and response style — and every single reply will be shaped by these choices. Whether you want a calm elder, a motivating coach, or a close friend, your companion adapts completely.",
    detailed: [
      "Open Settings → Your companion (or in the app: Chat → tap the header → companion settings). Here you'll find a rich set of options. Start with a name — the companion will use it in conversation. You can keep the default 'Imotara' or name them anything you like.",
      "Choose a relationship tone: Friend (warm and casual), Mentor (wise and guiding), Elder (patient and measured), Coach (direct and action-focused), Sibling (relatable and real), Junior buddy (lighter and encouraging), Parent-like (nurturing), or Partner-like (intimate and close).",
      "Choose a response style: 'Comfort me' leans into emotional support, 'Help me reflect' asks thought-provoking questions, 'Motivate me' pushes you forward, 'Give advice' offers concrete guidance, or 'Let Imotara decide' — the companion chooses based on the emotional context of your message.",
      "You can also set the companion's gender (which affects voice selection in TTS) and age range, which changes how formal or casual the language feels. All these settings take effect immediately — your next reply will already feel different.",
    ],
    steps: [
      "Go to Settings (bottom-right tab on mobile, top navigation on web).",
      "Tap 'Your companion' section.",
      "Set a name for your companion.",
      "Choose a relationship tone from the options.",
      "Choose a response style that matches what you need right now.",
      "Go back to Chat — your next reply will already reflect your choices.",
    ],
    tip: "You can change these settings anytime — even mid-conversation. Some days you need a coach, other days a friend.",
    visual: <PersonaMockup />,
  },
  {
    id: "history",
    icon: "📚",
    title: "Conversation History",
    category: "Core",
    short: "Every conversation is saved — browse, search, and revisit your emotional journey.",
    long: "The History tab holds all your past conversations, organized by date and tagged with the emotions detected in each session. You can filter by emotion, search for specific topics, and pick up any conversation where you left off.",
    detailed: [
      "Tap the History tab (the clock icon) to see all your past conversations. Each session shows a preview of the conversation, the date, and an emotion icon indicating the dominant mood of that session.",
      "On free accounts, history is accessible for the last 7 days. Plus accounts get 90 days, and Pro gets unlimited history — your entire emotional archive, forever. You can also manually delete any conversation or clear your full history from Settings.",
      "Tap any conversation in the list to open it and read through. You can continue the conversation by scrolling to the bottom and typing a new message. On web, each conversation is a separate thread that you can name, rename, or delete.",
      "The History tab also shows your Quick mood summary — a rolling emotional snapshot of the last few sessions — and a link to the Emotion Trends screen where you can see charts and patterns over time.",
    ],
    steps: [
      "Tap the History tab (clock icon) at the bottom of the screen.",
      "Browse conversations by date — newest at the top.",
      "Tap any entry to open and read that conversation.",
      "Scroll to the bottom of an open conversation to continue it.",
      "Swipe left on a conversation (mobile) or click the trash icon to delete it.",
    ],
    tip: "Long-press a message to bookmark it — bookmarked messages appear in a special filter so you can find your most important reflections quickly.",
    visual: <HistoryMockup />,
  },
  {
    id: "emotion-trends",
    icon: "📊",
    title: "Emotion Trends & Mood Tracking",
    category: "Insights",
    short: "See your emotional patterns over time — weekly charts, radar maps, and mood streaks.",
    long: "The Trends tab transforms your conversation history into visual insights. See which emotions you experience most, how your mood changes across the week, and track your streak of daily check-ins. Pro users get deeper analytics including weekly summaries and monthly narratives.",
    detailed: [
      "Open the Trends tab (the bar chart icon). At the top, you'll find an 'How are you feeling right now?' chip row — tap an emotion to log a quick mood check-in without starting a full conversation.",
      "Below the chips is your Emotion Radar — a hexagon chart showing how your emotions spread across Joy, Hopeful, Sad, Stressed, Angry, Anxious, Confused, and Neutral over the current week. The more often an emotion appears in your conversations, the larger its segment on the radar.",
      "Scroll down to see your 7-day mood row (a dot for each day of the week showing your dominant emotion), your streak counter (consecutive days you engaged with Imotara), and your Weekly Report narrative.",
      "For Pro users, the 30-day mood trend graph shows your emotional trajectory over the past month — useful for spotting patterns like 'I tend to feel most stressed on Mondays' or 'my mood improves after a conversation'.",
    ],
    steps: [
      "Tap the Trends tab (bar chart icon).",
      "Log a quick mood by tapping an emotion chip at the top.",
      "View your Emotion Radar chart for this week's emotional spread.",
      "Scroll down to see your streak, daily mood row, and weekly report.",
      "Upgrade to Pro to unlock the 30-day mood trend graph and weekly insight digest.",
    ],
    tip: "Even a single quick tap on an emotion chip counts as a check-in and keeps your streak alive.",
    visual: <TrendsMockup />,
    badge: "Pro unlocks deeper charts",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30",
  },
  {
    id: "tts",
    icon: "🔊",
    title: "Text-to-Speech (Listen to Replies)",
    category: "Accessibility",
    short: "Hear your companion's replies read aloud in a natural, gender-matched voice.",
    long: "Every reply from your companion can be read aloud using Azure Neural TTS — high-quality, human-sounding voices in your language and gender preference. This is especially useful when you're tired, on the go, or just prefer to listen rather than read.",
    detailed: [
      "TTS is available on both mobile and web. On mobile, tap the speaker icon (🔊) below any companion reply to hear it read aloud. The voice automatically matches your companion's gender setting, so if you chose a female companion named Elina, the voice will be a natural-sounding female Azure Neural voice.",
      "The TTS system supports all 22 languages. If you're chatting in Hindi, the reply will be spoken in Hindi by a Hindi-language voice. If you switch to Spanish mid-conversation, the voice adapts accordingly.",
      "Plus subscribers and above can customize TTS further in Settings → Voice: choose from multiple voice variants for your language, adjust the speaking speed (0.5× to 1.5×), and set pitch. Free accounts use the default device TTS voice, which still sounds decent but doesn't match companion gender or offer voice selection.",
      "On mobile, you can also enable Auto-play so replies start reading aloud automatically without needing to tap. This turns Imotara into a more conversational, voice-forward experience — like talking to a voice assistant that understands your emotions.",
    ],
    steps: [
      "Send a message and wait for your companion's reply.",
      "Tap the 🔊 speaker icon that appears below the reply.",
      "The reply will be read aloud in your companion's voice.",
      "Tap again to pause playback.",
      "To customize: go to Settings → Voice & audio (Plus+ required for full customization).",
    ],
    tip: "Set Auto-play in Settings to have every reply read aloud automatically — great for hands-free use while walking or relaxing.",
    visual: <TTSMockup />,
    badge: "Advanced TTS on Plus+",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-400/30",
  },
  {
    id: "cloud-sync",
    icon: "☁️",
    title: "Cloud Sync & Cross-Device Access",
    category: "Sync",
    short: "Access your conversations from your phone, tablet, and web browser — always in sync.",
    long: "Imotara can sync your conversation history, settings, and companion memory across all your devices securely. Enable cloud sync once, sign in with Google, and everything stays in perfect sync — phone, tablet, and web, all showing the same history.",
    detailed: [
      "By default, your data stays on your device only — no cloud storage, no servers. This is the most private mode. When you're ready to access your history from multiple devices, go to Settings → Privacy & safety → Cloud sync and toggle it on. You'll be prompted to sign in with Google.",
      "Once signed in and synced, your conversation history is encrypted and stored in Imotara's Supabase cloud database, protected by Row-Level Security (meaning only your account can read your data — not even Imotara employees can see your conversations).",
      "Sync happens automatically in the background whenever you send or receive a message. A small sync status indicator in the History tab shows when the last sync occurred. On the chat screen, each reply is tagged 'Synced to cloud' once it's been stored.",
      "Cross-device sync also syncs your companion settings, tone preferences, and companion memory (the facts your companion has learned about you). So if you tell your companion your name on your phone, your web session already knows it.",
    ],
    steps: [
      "Go to Settings → Privacy & safety.",
      "Toggle 'Cloud sync' on.",
      "Sign in with your Google account when prompted.",
      "Your history will start syncing immediately.",
      "Open Imotara on another device, sign in with the same Google account — your history appears.",
    ],
    tip: "Cloud sync is encrypted end-to-end. Your conversations are never visible to anyone except you.",
    visual: <SyncMockup />,
  },
  {
    id: "languages",
    icon: "🌐",
    title: "22 Languages",
    category: "Language",
    short: "Chat in Hindi, Tamil, Bengali, Spanish, Arabic, or any of 22 supported languages.",
    long: "Imotara was designed for language diversity from the ground up. It automatically detects the language you're writing in — even mid-sentence code-switching — and responds in kind. You can also set a preferred language in Settings to pin the experience.",
    detailed: [
      "Imotara supports 12 Indian languages (English, Hindi, Marathi, Bengali, Tamil, Telugu, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu) and 10 international languages (Spanish, French, German, Portuguese, Russian, Arabic, Chinese, Japanese, Hebrew, Indonesian).",
      "Language detection is automatic — you don't need to configure anything. If you write 'मुझे आज बहुत थकान हो रही है', Imotara detects Hindi from the Devanagari script and responds in Hindi. If you write in Tamil script, you get a Tamil response. If you mix Hindi and English in the same message (code-switching), Imotara handles it gracefully.",
      "The TTS system has language-matched voices. When chatting in Tamil, you hear a Tamil Azure Neural voice. When chatting in French, a French voice. All 22 languages have dedicated voice files for male and female companions.",
      "You can set your preferred language in Settings → Experience → Language. This helps Imotara respond correctly even when your message is short or ambiguous (e.g., 'ok' could be English or Hindi romanized).",
    ],
    steps: [
      "Just start typing in your language — detection is automatic.",
      "To pin a language: go to Settings → Experience → Language.",
      "Choose your preferred language from the dropdown list.",
      "Your companion will respond in that language by default.",
      "You can still switch languages mid-conversation at any time.",
    ],
    tip: "Type 'reply in Tamil' or 'मराठीत बोल' to instantly switch language mid-conversation.",
    visual: <LanguageMockup />,
  },
  {
    id: "breathing",
    icon: "🌬",
    title: "Breathing Exercise",
    category: "Wellness",
    short: "A guided breathing exercise is available anytime from the chat — helps in moments of anxiety.",
    long: "When the conversation touches on stress, anxiety, or overwhelm, Imotara may gently suggest a breathing exercise. You can also open it anytime manually. The breathing modal walks you through a calming pattern with ambient sound and a visual guide.",
    detailed: [
      "The breathing modal can be triggered from the chat screen — look for the breathing widget card that appears when your companion detects high anxiety, or tap the expand (⊕) icon in the chat header and look for 'Breathing exercise'.",
      "The exercise uses the 4-7-8 technique (inhale for 4 seconds, hold for 7, exhale for 8) — a scientifically backed method for activating the parasympathetic nervous system and reducing acute anxiety. The visual circle expands and contracts with each phase, guiding your breath without requiring you to count.",
      "Choose from three ambient soundscapes: Rain, Ocean, or Singing Bowl. Each loops seamlessly for as long as the exercise runs. You can adjust the volume in the modal or mute completely for a silent breathing session.",
      "The exercise runs in a full-screen overlay so there are no distractions. When you're done, you return to your conversation — and your companion will often follow up with a gentle check-in.",
    ],
    steps: [
      "In the Chat screen, look for the 'Breathing exercise' card when you're feeling anxious.",
      "Or tap the + icon in the chat header and select Breathing.",
      "Choose an ambient sound: Rain, Ocean, or Singing Bowl.",
      "Follow the expanding circle — breathe in, hold, breathe out.",
      "Tap 'Done' when you're ready to return to the conversation.",
    ],
    tip: "You can use the breathing exercise even without opening a chat — it's completely standalone.",
    visual: <BreathingMockup />,
  },
  {
    id: "data-export",
    icon: "📥",
    title: "Export Your Data",
    category: "Privacy",
    short: "Download all your conversations and emotional history as JSON, CSV, or PDF.",
    long: "Your emotional data belongs to you. Imotara makes it easy to export everything at any time — whether you want to back it up, share with a therapist, or analyze it yourself. Export is available in three formats for Plus and above.",
    detailed: [
      "Go to Settings → Data & privacy → Export data. Choose your format: JSON (full structured data, ideal for developers or archiving), CSV (spreadsheet-friendly, works in Excel or Google Sheets), or PDF (a formatted document suitable for reading or printing).",
      "The export includes all your conversations with timestamps, emotion tags, intensity levels, and sync status. It does not include your payment information or authentication tokens — just your conversation content.",
      "On mobile, the exported file is shared via the native share sheet, so you can save it to Files, send it via email, or open it in another app. On web, it downloads directly to your browser.",
      "You can also request a GDPR data package from Settings → Request data — this includes all data Imotara holds about your account in a machine-readable format. Data deletion is also available: Settings → Delete all cloud data removes everything from Imotara's servers while keeping your local history intact.",
    ],
    steps: [
      "Go to Settings → Data & privacy.",
      "Tap 'Export data'.",
      "Choose your format: JSON, CSV, or PDF.",
      "Tap Export — the file is generated on Imotara's servers.",
      "On mobile: choose where to save via the share sheet. On web: the file downloads automatically.",
    ],
    tip: "Export is non-destructive — your data stays in Imotara after you export it.",
    visual: <ExportMockup />,
    badge: "Requires Plus+",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-400/30",
  },
  {
    id: "privacy",
    icon: "🔒",
    title: "Privacy & Your Data",
    category: "Privacy",
    short: "No ads, no data selling, no tracking — your conversations are yours alone.",
    long: "Privacy is not a feature in Imotara — it's the foundation. By default, everything stays on your device. You control what gets synced, what gets analyzed, and what gets deleted. No third parties see your emotional data.",
    detailed: [
      "Imotara is local-first: all your messages are stored on your device by default. The AI processing (when cloud AI is enabled) sends your message content to Imotara's API, which uses it only to generate your reply — it is never stored, analyzed, or used for training.",
      "Cloud sync is opt-in and clearly labeled. When enabled, your data is encrypted in transit (TLS 1.3) and stored in Supabase with Row-Level Security, meaning only your authenticated account can read it. Imotara employees cannot access your conversations.",
      "Emotion analysis (detecting sadness, anxiety, etc. from your messages) is consent-gated — you choose to enable it in Settings. Analysis can run locally on your device (using keyword matching) or via the cloud API. Local analysis never leaves your device.",
      "You can delete all your cloud data at any time from Settings. You can export your data in multiple formats. You can clear your local history. Imotara never sells data, uses advertising networks, or adds engagement algorithms.",
    ],
    steps: [
      "Check your privacy settings: Settings → Privacy & safety.",
      "Toggle 'Store locally only' if you want zero cloud storage.",
      "Toggle 'Emotion analysis' on/off to control whether your messages are analyzed.",
      "To delete your cloud data: Settings → Delete all cloud data.",
      "To export before deleting: Settings → Export data → choose format.",
    ],
    tip: "You can revoke cloud sync at any time — your local history remains untouched.",
    visual: <PrivacyMockup />,
  },
  {
    id: "upgrade",
    icon: "⭐",
    title: "Plans & Upgrade",
    category: "Subscription",
    short: "Free is genuinely free — upgrade for unlimited history, insights, and advanced features.",
    long: "Imotara is free to use for core emotional support. Subscriptions add cloud history, advanced AI features, and deeper insights — but the core experience of talking to your companion never requires payment. Upgrade only when you're ready.",
    detailed: [
      "The Free tier gives you 20 cloud AI replies per day, 7 days of cloud history, and full access to the local (on-device) AI — which has no daily limit. This is enough for daily emotional check-ins for most users. There's no forced paywall during a conversation.",
      "Plus (₹99/mo or ₹699/yr) adds unlimited cloud replies, 90-day history, data export, advanced TTS (voice selection, speed/pitch control), semantic history search, and reply cadence controls.",
      "Pro (₹149/mo or ₹1,299/yr) adds everything in Plus plus unlimited history, emotion trend charts, weekly emotional summaries, monthly companion letters, and the long-term growth arc narrative.",
      "Enterprise plans are available for organisations, schools, and healthcare platforms — includes admin dashboard, multi-profile management, child-safe mode, SSO/SAML, data residency, and dedicated support. Contact info@imotara.com.",
    ],
    steps: [
      "Tap 'View plans →' in Settings → Plan & support.",
      "Compare Free, Plus, and Pro features on the plans screen.",
      "Toggle Monthly / Annual to see the savings (Annual saves ~25%).",
      "Tap Subscribe on the plan you want.",
      "On iOS: complete Apple In-App Purchase. On Android/Web: complete via Razorpay (UPI, cards, netbanking).",
    ],
    tip: "Token packs are a one-time alternative — buy 100 to 1,800 credits that never expire, for use beyond your daily limit.",
    visual: <UpgradeMockup />,
  },
  {
    id: "companion-letter",
    icon: "💌",
    title: "Companion Letter & Growth Arc",
    category: "Pro Features",
    short: "Each month, your companion writes you a personal letter reflecting on your emotional journey.",
    long: "Once a month, your companion reads through your conversations, identifies the emotional themes, milestones, and patterns, and writes you a personal letter — a warm, intimate summary of how you've been feeling and growing. The Growth Arc is a longer-term narrative that tracks how you evolve over months.",
    detailed: [
      "The Companion Letter is generated once per calendar month and delivered to the Trends tab (or as a notification if you have push notifications enabled). It's written in first person, from your companion's perspective, and references specific things you talked about that month — not generic platitudes.",
      "The letter includes: the dominant emotional themes of the month, a specific memory or moment that stood out, an observation about how you've been growing or what you've been working through, and a gentle forward-looking note for the month ahead.",
      "The Growth Arc is a cumulative narrative that updates over multiple months. It tracks the emotional arc of your journey across time — noting when patterns shift (e.g., 'You talked about loneliness a lot in March, but by May you mentioned new connections more often'). Think of it as your emotional autobiography, written by someone who's been paying close attention.",
      "Both features are Pro tier and above. They require cloud sync to be enabled, since the AI needs to read your conversation history to generate the letter.",
    ],
    steps: [
      "Upgrade to Pro (or above) from Settings → Plan & support.",
      "Enable cloud sync from Settings → Privacy & safety.",
      "Wait until the end of the calendar month (or check Trends for the letter).",
      "Open Trends → Companion Letter to read your monthly letter.",
      "Open Trends → Growth Arc to see your long-term emotional narrative.",
    ],
    tip: "The more you talk throughout the month, the richer and more personal your companion letter will be.",
    visual: <CompanionLetterMockup />,
    badge: "Pro feature",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30",
  },
];

// ── Table of Contents ─────────────────────────────────────────────────────────

const CATEGORIES = Array.from(new Set(FEATURES.map((f) => f.category)));

function TOC({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <nav className="hidden lg:block sticky top-20 self-start w-52 shrink-0">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 font-semibold">On this page</p>
      <div className="space-y-0.5">
        {FEATURES.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`block w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
              active === f.id
                ? "bg-indigo-500/15 text-indigo-300 font-medium"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            <span className="mr-1.5">{f.icon}</span>{f.title}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ── Expandable Feature Block ──────────────────────────────────────────────────

function FeatureBlock({ feature }: { feature: Feature }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      id={feature.id}
      className="scroll-mt-24 rounded-3xl border border-white/8 bg-white/[0.02] p-6 sm:p-8"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shrink-0">
          {feature.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">{feature.category}</span>
            {feature.badge && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${feature.badgeColor}`}>
                {feature.badge}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-zinc-100 mt-0.5">{feature.title}</h2>
        </div>
      </div>

      {/* Two-column: text + visual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          {/* Short */}
          <div className="rounded-2xl bg-indigo-500/8 border border-indigo-500/15 px-4 py-3">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">In one sentence</p>
            <p className="text-zinc-200 text-sm font-medium leading-relaxed">{feature.short}</p>
          </div>

          {/* Long */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Overview</p>
            <p className="text-zinc-300 text-sm leading-7">{feature.long}</p>
          </div>
        </div>

        {/* Visual */}
        <div>{feature.visual}</div>
      </div>

      {/* Expand button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors mb-4"
      >
        <span>{expanded ? "▲ Hide" : "▼ See full details"}</span>
        <span className="text-zinc-600">— step-by-step walkthrough + tips</span>
      </button>

      {/* Expanded: detailed + steps + tip */}
      {expanded && (
        <div className="space-y-6 border-t border-white/8 pt-6">
          {/* Detailed explanations */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Deep dive</p>
            <div className="space-y-3">
              {feature.detailed.map((para, i) => (
                <p key={i} className="text-zinc-400 text-sm leading-7">{para}</p>
              ))}
            </div>
          </div>

          {/* Steps */}
          {feature.steps && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Step by step</p>
              <div className="space-y-2">
                {feature.steps.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-zinc-300 text-sm leading-6">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tip */}
          {feature.tip && (
            <div className="rounded-2xl bg-amber-500/8 border border-amber-500/20 px-4 py-3 flex gap-3">
              <span className="text-base shrink-0">💡</span>
              <p className="text-amber-200/80 text-sm leading-relaxed">{feature.tip}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TutorialPage() {
  const [activeId, setActiveId] = useState(FEATURES[0].id);

  function scrollTo(id: string) {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16 sm:px-6">

      {/* Hero */}
      <div className="mb-14 text-center">
        <Link href="/chat" className="mb-6 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition">
          ← Back to chat
        </Link>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-4">
          Complete Tutorial
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl lg:text-5xl">
          How to use every feature<br className="hidden sm:block" /> in Imotara
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-zinc-400 text-sm sm:text-base leading-7">
          Whether you just downloaded the app or have been using it for months, this guide covers every feature in three levels — a quick summary, an overview, and a full deep dive with step-by-step instructions.
        </p>

        {/* Stats strip */}
        <div className="mt-8 flex flex-wrap justify-center gap-6">
          {[
            { label: "Features covered", value: String(FEATURES.length) },
            { label: "Languages supported", value: "22" },
            { label: "Platforms", value: "iOS · Android · Web" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold text-zinc-100">{s.value}</p>
              <p className="text-xs text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick navigation chips */}
      <div className="mb-10 flex flex-wrap gap-2 justify-center">
        {FEATURES.map((f) => (
          <button
            key={f.id}
            onClick={() => scrollTo(f.id)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
          >
            <span>{f.icon}</span>
            <span>{f.title}</span>
          </button>
        ))}
      </div>

      {/* Main layout: TOC + content */}
      <div className="flex gap-10 items-start">
        <TOC active={activeId} onSelect={scrollTo} />

        <div className="flex-1 min-w-0 space-y-6">
          {FEATURES.map((feature) => (
            <FeatureBlock key={feature.id} feature={feature} />
          ))}

          {/* Footer CTA */}
          <div className="rounded-3xl border border-indigo-400/20 bg-indigo-500/8 p-8 text-center mt-8">
            <p className="text-2xl mb-3">💙</p>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Ready to start?</h3>
            <p className="text-zinc-400 text-sm mb-5 max-w-md mx-auto">
              Imotara is always here — no appointments, no waiting. Just open the chat and say whatever's on your mind.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/chat"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 transition px-5 py-2.5 text-sm font-semibold text-white"
              >
                Open chat →
              </Link>
              <Link
                href="/upgrade"
                className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition px-5 py-2.5 text-sm font-semibold text-zinc-300"
              >
                View plans
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
