"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Reusable phone frame ─────────────────────────────────────────────────────

function Phone({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative mx-auto w-[200px] rounded-[28px] border-2 border-zinc-700 bg-zinc-900 shadow-2xl ${className}`} style={{ paddingTop: "28px", paddingBottom: "16px" }}>
      {/* Notch */}
      <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-16 h-3.5 rounded-full bg-zinc-800 border border-zinc-700" />
      {/* Screen */}
      <div className="overflow-hidden rounded-b-[20px] rounded-t-[4px] bg-zinc-950 mx-1 min-h-[300px]">
        {children}
      </div>
      {/* Home bar */}
      <div className="mt-2 mx-auto w-14 h-1 rounded-full bg-zinc-700" />
    </div>
  );
}

// ─── Category banner illustrations ────────────────────────────────────────────

function BannerStart() {
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-900/40 to-violet-900/30 border border-indigo-500/20 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Getting Started</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Download Imotara on iOS, Android, or open it in your browser. Your first conversation takes seconds — no account needed.</p>
        <div className="mt-4 flex gap-2 flex-wrap">
          {["📱 iOS", "🤖 Android", "🌐 Web"].map(p => (
            <span key={p} className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">{p}</span>
          ))}
        </div>
      </div>
      <Phone>
        <div className="p-3 space-y-2">
          <div className="text-center py-3">
            <div className="text-3xl mb-1">💙</div>
            <p className="text-xs font-bold text-zinc-200">Welcome to Imotara</p>
            <p className="text-[9px] text-zinc-500 mt-0.5">Your private AI companion</p>
          </div>
          <div className="space-y-1.5">
            {["What's your name?", "Choose a relationship", "Select language"].map((s, i) => (
              <div key={s} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${i === 0 ? "bg-indigo-500/20 border border-indigo-400/30" : "bg-zinc-800"}`}>
                <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${i === 0 ? "bg-indigo-500 text-white" : "bg-zinc-700 text-zinc-500"}`}>{i+1}</span>
                <span className="text-[9px] text-zinc-300">{s}</span>
              </div>
            ))}
          </div>
          <button className="w-full rounded-lg bg-indigo-600 py-1.5 text-[9px] font-bold text-white mt-2">Start →</button>
        </div>
      </Phone>
    </div>
  );
}

function BannerChat() {
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-sky-900/30 to-indigo-900/30 border border-sky-500/20 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-sky-400 uppercase tracking-widest mb-2">Chat</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Talk to your companion about anything. Replies stream back word by word. Each message is tagged with emotion and synced to the cloud.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {["💬 Stream replies", "😊 Emotion tags", "🔖 Bookmarks", "🔁 Retry any reply"].map(f => (
            <span key={f} className="text-[11px] text-zinc-400 flex items-center gap-1">✓ {f}</span>
          ))}
        </div>
      </div>
      <Phone>
        <div className="p-2 space-y-1.5">
          <div className="flex items-center gap-1.5 py-1.5 border-b border-zinc-800 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[9px] font-semibold text-zinc-200">Elina</span>
          </div>
          {[
            { from: "bot", text: "Hi! How are you feeling today? 💙" },
            { from: "user", text: "Stressed about work honestly" },
            { from: "bot", text: "That sounds heavy. What's been weighing on you most?" },
          ].map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`rounded-xl px-2 py-1 text-[9px] max-w-[75%] leading-relaxed ${m.from === "user" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-200"}`}>
                {m.text}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1 pt-1">
            <span className="text-[8px] text-zinc-600">😟 Stressed</span>
            <span className="ml-auto text-[8px] text-zinc-700">☁ Synced</span>
          </div>
          <div className="flex gap-1 border-t border-zinc-800 pt-1.5">
            <div className="flex-1 rounded-lg bg-zinc-800 px-2 py-1 text-[9px] text-zinc-600">Type something…</div>
            <button className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-[9px] flex items-center justify-center">➤</button>
          </div>
        </div>
      </Phone>
    </div>
  );
}

function BannerVoice() {
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-rose-900/30 to-orange-900/20 border border-rose-500/20 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-rose-400 uppercase tracking-widest mb-2">Voice & Audio</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Speak instead of typing — AI transcribes your voice in any of 22 languages. Hear replies read aloud in your companion's voice.</p>
        <div className="mt-4 flex items-end gap-0.5 h-10">
          {[2,4,7,5,9,6,3,8,5,4,7,3,6,8,4,7,5,3,6,8].map((h,i) => (
            <div key={i} className="w-1.5 rounded-full bg-rose-400/60 animate-pulse" style={{ height: `${h*4}px`, animationDelay: `${i*80}ms` }} />
          ))}
          <span className="text-[10px] text-zinc-500 ml-2">Listening…</span>
        </div>
      </div>
      <Phone>
        <div className="p-3 flex flex-col items-center gap-3 py-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="w-14 h-14 rounded-full bg-rose-600 flex items-center justify-center text-2xl shadow-lg">🎤</div>
          </div>
          <p className="text-[10px] font-semibold text-zinc-200">Recording…</p>
          <div className="flex items-end gap-0.5 h-6">
            {[3,5,7,4,8,6,4,7,5,3].map((h,i) => (
              <div key={i} className="w-1 rounded-full bg-rose-400/70 animate-pulse" style={{ height: `${h*2}px`, animationDelay: `${i*100}ms` }} />
            ))}
          </div>
          <div className="w-full space-y-1.5 mt-2">
            <div className="flex items-center justify-between rounded-lg bg-zinc-800 px-2 py-1.5">
              <span className="text-[9px] text-zinc-400">🔊 Auto-play replies</span>
              <div className="w-6 h-3.5 rounded-full bg-indigo-600 flex items-center justify-end px-0.5"><div className="w-2.5 h-2.5 rounded-full bg-white" /></div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-zinc-800 px-2 py-1.5">
              <span className="text-[9px] text-zinc-400">⚡ Cloud transcription</span>
              <div className="w-6 h-3.5 rounded-full bg-indigo-600 flex items-center justify-end px-0.5"><div className="w-2.5 h-2.5 rounded-full bg-white" /></div>
            </div>
          </div>
        </div>
      </Phone>
    </div>
  );
}

function BannerCompanion() {
  const tones = ["Friend", "Mentor", "Coach", "Elder", "Sibling"];
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-amber-900/30 to-yellow-900/20 border border-amber-500/20 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2">Your Companion</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Name your companion, set a relationship tone, and pick a response style. Every reply adapts to your choices — instantly.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tones.map((t, i) => (
            <span key={t} className={`rounded-full px-2.5 py-0.5 text-[11px] border ${i === 0 ? "bg-amber-500/20 border-amber-400/40 text-amber-300 font-semibold" : "border-white/10 text-zinc-500"}`}>{t}</span>
          ))}
        </div>
      </div>
      <Phone>
        <div className="p-2 space-y-2">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider pt-1">Your companion</p>
          <div>
            <p className="text-[8px] text-zinc-600 mb-0.5">Name</p>
            <div className="rounded-md bg-zinc-800 border border-amber-500/30 px-2 py-1 text-[9px] text-zinc-200">Elina</div>
          </div>
          <div>
            <p className="text-[8px] text-zinc-600 mb-1">Relationship tone</p>
            <div className="grid grid-cols-2 gap-1">
              {tones.slice(0,4).map((t,i) => (
                <div key={t} className={`rounded-md px-1.5 py-1 text-center text-[8px] border ${i===0 ? "bg-amber-500/20 border-amber-400/30 text-amber-300 font-bold" : "bg-zinc-800 border-zinc-700 text-zinc-500"}`}>{t}</div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[8px] text-zinc-600 mb-1">Response style</p>
            {["Comfort me","Help me reflect","Motivate me"].map((s,i) => (
              <div key={s} className={`rounded-md px-2 py-1 mb-0.5 text-[8px] border ${i===1 ? "bg-sky-500/15 border-sky-400/30 text-sky-300" : "bg-zinc-800 border-zinc-700 text-zinc-500"}`}>{s}</div>
            ))}
          </div>
        </div>
      </Phone>
    </div>
  );
}

function BannerHistory() {
  const items = [
    { emoji: "😟", date: "Today", preview: "Stressed about the presentation…" },
    { emoji: "😊", date: "Yesterday", preview: "Had a really good day overall…" },
    { emoji: "😔", date: "May 27", preview: "Couldn't sleep, kept overthinking…" },
    { emoji: "🙏", date: "May 26", preview: "Feeling grateful for my friends…" },
  ];
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-900/30 to-teal-900/20 border border-emerald-500/20 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-2">History</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Every conversation is saved and tagged with the emotion detected. Browse, search, and continue any past conversation.</p>
        <div className="mt-3 flex gap-3">
          {[{ label: "Free", val: "7 days" }, { label: "Plus", val: "90 days" }, { label: "Pro", val: "Unlimited" }].map(t => (
            <div key={t.label} className="text-center">
              <p className="text-xs font-bold text-zinc-200">{t.val}</p>
              <p className="text-[10px] text-zinc-500">{t.label}</p>
            </div>
          ))}
        </div>
      </div>
      <Phone>
        <div className="p-2">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider py-1">History</p>
          <div className="flex gap-1 mb-2">
            {["Conversations", "Emotion History"].map((t,i) => (
              <span key={t} className={`rounded-full px-2 py-0.5 text-[8px] font-medium ${i===0 ? "bg-indigo-500/20 text-indigo-300" : "text-zinc-600"}`}>{t}</span>
            ))}
          </div>
          <div className="space-y-1">
            {items.map(c => (
              <div key={c.date} className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-2 py-1.5">
                <span className="text-sm">{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] text-zinc-300 truncate">{c.preview}</p>
                  <p className="text-[7px] text-zinc-600">{c.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Phone>
    </div>
  );
}

function BannerTrends() {
  const emotions = [{ e: "Joy", v: 3, c: "bg-yellow-400" }, { e: "Hopeful", v: 5, c: "bg-emerald-400" }, { e: "Neutral", v: 9, c: "bg-zinc-400" }, { e: "Anxious", v: 6, c: "bg-blue-400" }, { e: "Stressed", v: 4, c: "bg-red-400" }];
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-500/20 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-2">Trends & Insights</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Radar charts, 7-day mood rows, streak tracking, and monthly growth summaries — visual insight into your emotional patterns.</p>
        <div className="mt-3 space-y-1.5">
          {emotions.map(e => (
            <div key={e.e} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 w-14">{e.e}</span>
              <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                <div className={`${e.c} h-1.5 rounded-full`} style={{ width: `${e.v * 10}%` }} />
              </div>
              <span className="text-[10px] text-zinc-600">{e.v}x</span>
            </div>
          ))}
        </div>
      </div>
      <Phone>
        <div className="p-2">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider py-1">Trends</p>
          {/* Mini radar using SVG */}
          <svg viewBox="0 0 100 100" className="w-full" style={{ height: "100px" }}>
            <polygon points="50,10 80,30 75,65 50,80 25,65 20,30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <polygon points="50,30 65,40 62,57 50,65 38,57 35,40" fill="rgba(99,102,241,0.3)" stroke="rgba(99,102,241,0.6)" strokeWidth="1" />
            {[{ x: 50, y: 10, l: "Joy" }, { x: 82, y: 28, l: "Hope" }, { x: 77, y: 67, l: "Neutral" }, { x: 50, y: 82, l: "Stress" }, { x: 23, y: 67, l: "Sad" }, { x: 18, y: 28, l: "Fear" }].map(p => (
              <text key={p.l} x={p.x} y={p.y} textAnchor="middle" fontSize="7" fill="rgba(161,161,170,0.8)">{p.l}</text>
            ))}
            <circle cx="50" cy="50" r="2" fill="rgba(99,102,241,0.8)" />
          </svg>
          <div className="flex items-center justify-between mt-1 border-t border-zinc-800 pt-1.5">
            <span className="text-[8px] text-zinc-500">🔥 4 day streak</span>
            <span className="text-[8px] text-indigo-400">★ Pro insight →</span>
          </div>
          <div className="mt-1.5 space-y-1">
            {emotions.slice(0,3).map(e => (
              <div key={e.e} className="flex items-center gap-1.5">
                <span className="text-[7px] text-zinc-400 w-10">{e.e}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-1">
                  <div className={`${e.c} h-1 rounded-full`} style={{ width: `${e.v * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Phone>
    </div>
  );
}

function BannerGrow() {
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/20 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-2">Grow & Wellbeing</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Future letters, guided breathing, 30-day challenges, mindset capsules, and the collective emotional pulse — tools for deeper growth.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {["📬 Future Letters", "🌬 Breathing", "📅 30-Day Challenge", "🧠 Mindset Capsule"].map(f => (
            <span key={f} className="text-[11px] text-zinc-400 flex items-center gap-1">✓ {f}</span>
          ))}
        </div>
      </div>
      <Phone>
        <div className="p-2 space-y-2">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider py-1">Grow</p>
          <div className="rounded-xl bg-zinc-800 border border-green-500/20 p-2">
            <p className="text-[8px] text-green-400 font-semibold">30-Day Challenge · Day 4/30</p>
            <div className="flex gap-0.5 mt-1.5 flex-wrap">
              {Array.from({ length: 30 }, (_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < 4 ? "bg-green-400" : "bg-zinc-700"}`} />
              ))}
            </div>
            <p className="text-[8px] text-zinc-400 mt-1.5 italic">"What made you feel alive this week?"</p>
            <button className="mt-1.5 w-full rounded-md bg-green-600/30 border border-green-500/30 py-1 text-[8px] text-green-300">Mark today done ✓</button>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-sky-900/30 border border-sky-400/20 p-2">
            <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-full border-2 border-sky-400/30 animate-ping" style={{ animationDuration: "2.5s" }} />
              <span className="text-lg">🌬</span>
            </div>
            <div>
              <p className="text-[8px] font-semibold text-sky-300">Breathing Exercise</p>
              <p className="text-[7px] text-zinc-500">4-7-8 · Rain sound</p>
            </div>
          </div>
          <div className="rounded-xl bg-zinc-800 border border-amber-500/20 p-2">
            <p className="text-[8px] text-amber-400">💌 Future Letter — opens Dec 31</p>
            <p className="text-[7px] text-zinc-500 mt-0.5">Written to yourself on May 29, 2026</p>
          </div>
        </div>
      </Phone>
    </div>
  );
}

function BannerExperience() {
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-900/30 to-sky-900/20 border border-cyan-500/20 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-2">Settings: Experience</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Customise everything — theme colour, font size, notification schedule, typing speed, haptic feedback, and more than a dozen more options.</p>
      </div>
      <Phone>
        <div className="p-2 space-y-1.5">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider py-1">Experience</p>
          {[
            { label: "Dark mode", on: true },
            { label: "Auto-play TTS", on: false },
            { label: "Typing indicator", on: true },
            { label: "Streak notifications", on: true },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between bg-zinc-800 rounded-lg px-2 py-1.5">
              <span className="text-[8px] text-zinc-300">{s.label}</span>
              <div className={`w-6 h-3.5 rounded-full flex items-center px-0.5 ${s.on ? "bg-indigo-600 justify-end" : "bg-zinc-700 justify-start"}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-white" />
              </div>
            </div>
          ))}
          <div className="bg-zinc-800 rounded-lg px-2 py-1.5">
            <p className="text-[7px] text-zinc-500 mb-1">Accent colour</p>
            <div className="flex gap-1">
              {["#6366f1","#0ea5e9","#14b8a6","#f43f5e","#f59e0b","#10b981"].map((c,i) => (
                <div key={c} className={`w-4 h-4 rounded-full border-2 ${i===0?"border-white":"border-transparent"}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="bg-zinc-800 rounded-lg px-2 py-1.5">
            <p className="text-[7px] text-zinc-500 mb-1">Font size</p>
            <div className="flex gap-1">
              {["S","M","L"].map((s,i) => (
                <div key={s} className={`flex-1 rounded text-center text-[8px] py-0.5 ${i===1?"bg-indigo-600 text-white":"bg-zinc-700 text-zinc-400"}`}>{s}</div>
              ))}
            </div>
          </div>
        </div>
      </Phone>
    </div>
  );
}

function BannerPrivacy() {
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900/60 to-zinc-900/40 border border-zinc-600/30 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Privacy & Safety</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Full control over your data — choose what's analysed, what's synced, what's exported, and what's deleted. No data is ever sold.</p>
        <div className="mt-3 space-y-1">
          {["🔒 Local-first by default", "☁ Cloud sync is opt-in", "📤 Export in 3 formats", "🗑 Delete anytime"].map(f => (
            <p key={f} className="text-[11px] text-zinc-400">{f}</p>
          ))}
        </div>
      </div>
      <Phone>
        <div className="p-2 space-y-1.5">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider py-1">Privacy & safety</p>
          {[
            { label: "Store locally only", on: true, icon: "📱" },
            { label: "Cloud sync", on: false, icon: "☁" },
            { label: "Emotion analysis", on: true, icon: "🧠" },
            { label: "Anonymous data", on: false, icon: "📊" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 bg-zinc-800 rounded-lg px-2 py-1.5">
              <span className="text-xs">{s.icon}</span>
              <span className="flex-1 text-[8px] text-zinc-300">{s.label}</span>
              <div className={`w-6 h-3.5 rounded-full flex items-center px-0.5 ${s.on ? "bg-indigo-600 justify-end" : "bg-zinc-700 justify-start"}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-white" />
              </div>
            </div>
          ))}
          <div className="rounded-lg bg-zinc-800 px-2 py-1.5">
            <p className="text-[8px] text-zinc-400">Crisis resources</p>
            <p className="text-[7px] text-zinc-600 mt-0.5">🇮🇳 India · iCall: 9152987821</p>
          </div>
          <div className="flex gap-1">
            <button className="flex-1 rounded-lg bg-indigo-600/20 border border-indigo-400/20 py-1 text-[8px] text-indigo-300">Export</button>
            <button className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 py-1 text-[8px] text-zinc-400">Sync now</button>
          </div>
        </div>
      </Phone>
    </div>
  );
}

function BannerAdvanced() {
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900/60 to-neutral-900/40 border border-zinc-700/30 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Advanced Settings</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Companion memory, history management, network tuning, journal auto-delete, and more — for users who want granular control.</p>
      </div>
      <Phone>
        <div className="p-2 space-y-1.5">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider py-1">Advanced</p>
          <div className="bg-zinc-800 rounded-lg px-2 py-1.5">
            <p className="text-[8px] text-zinc-300 mb-1">🧠 Companion memory (8/12)</p>
            <div className="space-y-0.5">
              {["Name: Soumen", "Works in tech", "Partner: Elina"].map(m => (
                <div key={m} className="flex items-center justify-between">
                  <span className="text-[7px] text-zinc-400">{m}</span>
                  <span className="text-[7px] text-rose-400">×</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-zinc-800 rounded-lg px-2 py-1.5">
            <p className="text-[8px] text-zinc-300">📆 Auto-delete history</p>
            <div className="flex gap-1 mt-1">
              {["30d","60d","90d","180d"].map((d,i) => (
                <div key={d} className={`flex-1 rounded text-center text-[7px] py-0.5 ${i===2?"bg-indigo-600 text-white":"bg-zinc-700 text-zinc-400"}`}>{d}</div>
              ))}
            </div>
          </div>
          <div className="bg-zinc-800 rounded-lg px-2 py-1.5">
            <p className="text-[8px] text-zinc-300">🌐 API timeout</p>
            <input type="range" className="w-full h-1 mt-1 accent-indigo-500" defaultValue={20} min={10} max={60} readOnly />
            <p className="text-[7px] text-zinc-600 text-right">20s</p>
          </div>
          <p className="text-[7px] text-zinc-600 text-center">v1.1.7 · build 95</p>
        </div>
      </Phone>
    </div>
  );
}

function BannerPlans() {
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-violet-900/40 to-indigo-900/30 border border-violet-500/20 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-2">Plans & Upgrade</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Free is genuinely free. Plus and Pro add cloud features. Token packs extend your daily limit. Enterprise is available for organisations.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {[["Free","₹0","20 replies/day"],["Plus","₹99/mo","Unlimited"],["Pro","₹149/mo","+ Insights"],["Enterprise","Custom","SSO + Admin"]].map(([t,p,f]) => (
            <div key={t} className="rounded-lg bg-white/5 border border-white/8 px-2 py-1.5">
              <p className="font-semibold text-zinc-200 text-[10px]">{t}</p>
              <p className="text-indigo-300 text-[10px] font-bold">{p}</p>
              <p className="text-zinc-500 text-[9px]">{f}</p>
            </div>
          ))}
        </div>
      </div>
      <Phone>
        <div className="p-2 space-y-1.5">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider py-1">Upgrade Imotara</p>
          <div className="flex gap-1">
            {[["Monthly","active"],["Annual",""]].map(([l,a]) => (
              <div key={l} className={`flex-1 rounded-lg text-center py-1 text-[8px] font-medium ${a?"bg-indigo-600 text-white":"bg-zinc-800 text-zinc-400"}`}>{l}</div>
            ))}
          </div>
          {[
            { name: "Plus", price: "₹99/mo", color: "border-sky-400/30 bg-sky-500/5", badge: "" },
            { name: "Pro", price: "₹149/mo", color: "border-indigo-400/40 bg-indigo-500/10", badge: "Best" },
          ].map(p => (
            <div key={p.name} className={`rounded-xl border p-2 ${p.color}`}>
              <div className="flex justify-between items-center">
                <p className="text-[9px] font-bold text-zinc-200">{p.name}</p>
                {p.badge && <span className="text-[7px] bg-indigo-500 text-white px-1 rounded">{p.badge}</span>}
              </div>
              <p className="text-[9px] font-bold text-indigo-300">{p.price}</p>
              <button className={`mt-1 w-full rounded-md py-0.5 text-[8px] font-semibold ${p.badge ? "bg-indigo-600 text-white" : "bg-zinc-700 text-zinc-300"}`}>Subscribe</button>
            </div>
          ))}
          <div className="rounded-xl border border-violet-400/25 bg-violet-500/8 p-2">
            <p className="text-[8px] text-violet-300 font-semibold">Enterprise — Custom</p>
            <p className="text-[7px] text-zinc-500">SSO · Admin · Data residency</p>
            <button className="mt-1 w-full rounded-md bg-violet-600/30 border border-violet-400/30 py-0.5 text-[8px] text-violet-300">Contact us</button>
          </div>
        </div>
      </Phone>
    </div>
  );
}

function BannerLanguages() {
  const langs = [
    { flag: "🇮🇳", code: "हिं", name: "Hindi" }, { flag: "🇮🇳", code: "বাং", name: "Bengali" },
    { flag: "🇮🇳", code: "தமி", name: "Tamil" }, { flag: "🇮🇳", code: "తెలు", name: "Telugu" },
    { flag: "🌍", code: "Esp", name: "Spanish" }, { flag: "🌍", code: "عرب", name: "Arabic" },
    { flag: "🌍", code: "中文", name: "Chinese" }, { flag: "🌍", code: "日本", name: "Japanese" },
  ];
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-teal-900/30 to-cyan-900/20 border border-teal-500/20 p-6 flex gap-6 items-center">
      <div className="flex-1 hidden sm:block">
        <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-2">22 Languages</p>
        <p className="text-zinc-200 text-sm leading-relaxed">Chat in Hindi, Tamil, Bengali, Spanish, Arabic, or any of 22 languages. Imotara detects your language automatically — even mid-sentence code-switching.</p>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {langs.map(l => (
            <div key={l.name} className="rounded-lg bg-white/5 border border-white/8 px-1.5 py-1 text-center">
              <p className="text-base">{l.flag}</p>
              <p className="text-[8px] text-zinc-300 font-bold">{l.code}</p>
            </div>
          ))}
        </div>
      </div>
      <Phone>
        <div className="p-2 space-y-1.5">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider py-1">Languages</p>
          <div className="bg-zinc-800 rounded-lg p-2">
            <p className="text-[8px] text-zinc-400 mb-1">Detected language</p>
            <div className="flex items-center gap-2">
              <span className="text-base">🇮🇳</span>
              <div>
                <p className="text-[9px] font-bold text-zinc-200">Hindi</p>
                <p className="text-[7px] text-zinc-500">Auto-detected from Devanagari</p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-2">
            <p className="text-[7px] text-zinc-500 mb-1">User message</p>
            <p className="text-[8px] text-zinc-200">"मुझे आज बहुत अच्छा लग रहा है"</p>
            <p className="text-[7px] text-zinc-500 mt-1">→ Reply in Hindi with female voice</p>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {langs.slice(0,6).map(l => (
              <div key={l.name} className="rounded-lg bg-zinc-800 text-center p-1">
                <p className="text-sm">{l.flag}</p>
                <p className="text-[7px] text-zinc-400">{l.name}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-[7px] text-zinc-600">+ 16 more languages supported</p>
        </div>
      </Phone>
    </div>
  );
}

// ─── Banner map ───────────────────────────────────────────────────────────────

const BANNERS: Record<string, React.ReactNode> = {
  start:      <BannerStart />,
  chat:       <BannerChat />,
  voice:      <BannerVoice />,
  companion:  <BannerCompanion />,
  history:    <BannerHistory />,
  trends:     <BannerTrends />,
  grow:       <BannerGrow />,
  experience: <BannerExperience />,
  privacy:    <BannerPrivacy />,
  advanced:   <BannerAdvanced />,
  plans:      <BannerPlans />,
  languages:  <BannerLanguages />,
};

// ─── Category tabs ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "start",      icon: "🚀", label: "Getting Started" },
  { id: "chat",       icon: "💬", label: "Chat" },
  { id: "voice",      icon: "🎤", label: "Voice & Audio" },
  { id: "companion",  icon: "🎨", label: "Your Companion" },
  { id: "history",    icon: "📚", label: "History" },
  { id: "trends",     icon: "📊", label: "Trends & Insights" },
  { id: "grow",       icon: "🌱", label: "Grow & Wellbeing" },
  { id: "experience", icon: "⚙️", label: "Settings: Experience" },
  { id: "privacy",    icon: "🔒", label: "Settings: Privacy" },
  { id: "advanced",   icon: "🔧", label: "Settings: Advanced" },
  { id: "plans",      icon: "⭐", label: "Plans & Upgrade" },
  { id: "languages",  icon: "🌐", label: "Languages" },
];

// ─── Feature card data ────────────────────────────────────────────────────────

// "limited" means the feature exists but with restrictions on that tier
type TierValue = boolean | "limited";

interface TierAvail {
  free:  TierValue | string;   // string for display like "7 days" or "20/day"
  plus:  TierValue | string;
  pro:   TierValue | string;
  ent:   TierValue | string;   // Enterprise covers Family/EDU institutional features
  note?: string;               // extra clarification shown below badges
}

interface Feature {
  icon: string;
  title: string;
  short: string;
  long: string;
  steps: string[];
  tip?: string;
  badge?: string;
  tiers?: TierAvail;            // omit = available on all plans
}

const FEATURES: Record<string, Feature[]> = {

  // ─ Getting Started ─────────────────────────────────────────────────────────
  start: [
    {
      icon: "📲",
      title: "Download & Install",
      short: "Imotara is available on iOS, Android, and as a web app at imotara.com.",
      long: "You can use Imotara on any device without installing anything — just open imotara.com in any browser. For a native experience, download from the App Store (iPhone/iPad) or Google Play Store (Android). All three platforms share the same account and sync your data.",
      steps: [
        "iOS: Open the App Store, search 'Imotara', tap Get.",
        "Android: Open Google Play, search 'Imotara', tap Install.",
        "Web: Visit imotara.com in Chrome, Safari, Firefox, or Edge.",
        "On web, tap 'Add to Home Screen' from your browser menu for a PWA experience.",
      ],
      tip: "The web app works offline too — your local conversations are always saved in the browser.",
    },
    {
      icon: "👋",
      title: "Onboarding (First Launch)",
      short: "A 3-step onboarding helps your companion understand you before the first reply.",
      long: "When you first open Imotara, a short onboarding modal asks three things: your name (optional), the relationship tone you want with your companion (friend, mentor, coach, etc.), and your preferred language. None of these are mandatory — you can skip and change them anytime in Settings.",
      steps: [
        "Open Imotara for the first time.",
        "Step 1: Enter your name (optional — the companion will use it if provided).",
        "Step 2: Choose a relationship tone — Friend, Mentor, Elder, Coach, Sibling, Junior buddy, Parent-like, Partner-like.",
        "Step 3: Choose your preferred language from 22 options.",
        "Tap 'Start' — you land on the Chat screen, ready to go.",
      ],
      tip: "To redo onboarding later: Settings → Advanced → Tips & tours → Restart onboarding.",
    },
    {
      icon: "💬",
      title: "Your First Conversation",
      short: "Just type how you're feeling — there's no right way to start.",
      long: "The Chat screen shows quick-start chips like 'I'm feeling low today', 'Something good happened', or 'I just need to vent'. Tap one or type anything in the message box. Your companion will respond within seconds with a warm, thoughtful reply shaped by your persona settings.",
      steps: [
        "Tap the Chat tab (speech bubble icon at the bottom).",
        "Tap one of the feeling chips, or type in the message box.",
        "Press the Send arrow or hit Enter.",
        "Read your companion's reply — it appears word by word in real time.",
        "Reply back naturally — there's no structure or rules.",
      ],
      tip: "Your companion improves over time. The more you talk, the better it understands your patterns.",
    },
    {
      icon: "🔑",
      title: "Creating an Account (Optional)",
      short: "An account is optional — Imotara works fully without one, but an account enables cloud sync.",
      long: "You don't need a Google account to use Imotara. All core features work locally without login. To enable cloud sync, access your history from multiple devices, or make a purchase, tap 'Sign in with Google' from Settings or the upgrade page. Apple Sign-in is available on iOS.",
      steps: [
        "Open Settings (gear icon, bottom right).",
        "Scroll to 'Remote history sync' or tap 'Sign in' when prompted during cloud sync.",
        "Tap 'Sign in with Google' (web + Android) or 'Sign in with Apple' (iOS).",
        "Complete the OAuth flow in the browser/system sheet.",
        "You're signed in — your history begins syncing to the cloud.",
      ],
      tip: "Signing out does not delete your local history — everything stays on your device.",
    },
  ],

  // ─ Chat ────────────────────────────────────────────────────────────────────
  chat: [
    {
      icon: "⌨️",
      title: "Sending a Message",
      short: "Type in the message box at the bottom and tap Send — or press Enter on web.",
      long: "The chat input box sits at the bottom of the screen. Type anything — your feelings, a question, a one-word mood, or a long story. Press the arrow button (or Enter on desktop) to send. On mobile, the keyboard appears automatically when you tap the input box.",
      steps: [
        "Tap the message input box at the bottom of the Chat screen.",
        "Type your message — no length limit.",
        "Tap the ➤ send button or press Enter (web).",
        "Your message appears on the right in a blue bubble.",
        "Your companion's reply streams back in real time.",
      ],
    },
    {
      icon: "⚡",
      title: "Quick-Start Feeling Chips",
      short: "Tap an emotion chip to start a conversation instantly without typing.",
      long: "Above the message box, coloured feeling chips let you start with one tap: 'Feeling heavy', 'Need to vent', 'Just thinking out loud', and more. These set an emotional context before the first message, helping your companion respond more accurately.",
      steps: [
        "Look above the message input box for the emotion chips.",
        "Tap a chip that matches how you're feeling right now.",
        "It populates the message box with a starter phrase.",
        "You can edit the text or just send it as-is.",
      ],
      tip: "Chips change based on context — after a few messages, new chips may appear based on the conversation tone.",
    },
    {
      icon: "😊",
      title: "Emotion Tags on Messages",
      short: "Each AI reply is tagged with a detected emotion — tap to confirm or correct it.",
      long: "Below every AI reply, Imotara shows an emotion chip (e.g., '😟 Anxious', '😊 Hopeful') representing the emotional tone it detected in your message. Tapping it logs that emotion to your history, which feeds into your Trends charts. You can also tap a different chip to correct the detection.",
      steps: [
        "Send a message and receive a reply.",
        "Look below the reply for the small emotion chip.",
        "Tap it to log that emotion to your history.",
        "Or tap 'Change' to select a more accurate emotion from the list.",
        "Logged emotions appear in your Trends tab.",
      ],
    },
    {
      icon: "🔖",
      title: "Bookmarking Messages",
      short: "Long-press any message to bookmark it — find it instantly in History.",
      long: "Any message — yours or your companion's — can be bookmarked for quick access later. Bookmarked messages are flagged in your History and can be filtered to show only bookmarks, making it easy to find important reflections, encouraging words, or key insights.",
      steps: [
        "Long-press (hold) any message bubble.",
        "A context menu appears — tap 'Bookmark'.",
        "A small bookmark icon appears on the message.",
        "To find bookmarks: go to History → tap the filter icon → select Bookmarks.",
      ],
    },
    {
      icon: "😄",
      title: "Reacting to Messages",
      short: "Long-press a message and pick an emoji reaction to express how it made you feel.",
      long: "You can react to any message with an emoji — heart, thumbs up, lightbulb, or others. Reactions are personal (only you see them) and help you mark messages that resonated, surprised, or comforted you.",
      steps: [
        "Long-press any message bubble.",
        "Tap 'React' in the context menu.",
        "Choose an emoji from the reaction picker.",
        "The emoji appears below the message.",
        "Long-press again and tap the reaction to remove it.",
      ],
    },
    {
      icon: "📋",
      title: "Copying a Message",
      short: "Long-press any message and tap Copy to copy the text to your clipboard.",
      long: "You can copy any message — your own or your companion's — to share with someone else, save to notes, or use elsewhere. The text is copied without any formatting markers.",
      steps: [
        "Long-press the message you want to copy.",
        "Tap 'Copy' in the context menu.",
        "Paste it anywhere using the standard paste gesture.",
      ],
    },
    {
      icon: "🔁",
      title: "Retry / Regenerate a Reply",
      short: "Long-press a companion reply and tap Retry to get a different response.",
      long: "If a reply doesn't feel right — too short, missed the point, or just not what you needed — you can regenerate it. The companion will craft a fresh response to the same message using a slightly different approach.",
      steps: [
        "Long-press your companion's reply.",
        "Tap 'Retry' or 'Regenerate'.",
        "A new reply is generated and replaces the old one.",
      ],
      tip: "Each retry may take a different angle — useful when you feel the first response didn't land.",
    },
    {
      icon: "🌐",
      title: "Tone Reflection Card",
      short: "After a session, a reflection card summarises the emotional tone of your conversation.",
      long: "At the end of a meaningful conversation, Imotara may show a Tone Reflection card — a compact summary showing your dominant emotion, the emotional arc of the session, and a seed prompt for further reflection. It appears as a special card in the chat thread.",
      steps: [
        "Have a multi-message conversation (usually 5+ messages).",
        "A Tone Reflection card appears at a natural pause point.",
        "Read the emotion summary and dominant label.",
        "Tap 'Reflect on this →' to open a deeper journaling prompt.",
        "Tap dismiss (×) to close it and continue chatting.",
      ],
    },
    {
      icon: "🏠",
      title: "Starting a New Conversation",
      short: "Tap 'New conversation' in the History tab to start a fresh thread.",
      long: "Each conversation is a separate thread in your history. Starting a new one is like opening a blank page — your companion starts fresh without the context of previous threads, though it still remembers personal facts from your companion memory.",
      steps: [
        "Go to the History tab.",
        "Tap '+ Start new conversation'.",
        "You're taken to the Chat screen with a blank thread.",
        "Your previous conversations remain accessible in History.",
      ],
    },
    {
      icon: "☁️",
      title: "Cloud vs Local Badge",
      short: "Each reply shows whether it came from cloud AI or the on-device local engine.",
      long: "A small badge on each message shows 'Synced to cloud' (cloud AI, full quality) or 'Local' (on-device engine, works offline). When your daily cloud quota is reached or you're offline, Imotara automatically switches to local mode — you keep chatting without interruption.",
      steps: [
        "Look at the small label below each companion reply.",
        "'Synced to cloud' = the reply was generated by the cloud AI.",
        "'Local' = the reply was generated on your device.",
        "No action needed — switching is automatic.",
      ],
      tip: "Local replies are fast, private, and work with no internet — but cloud replies are richer and more nuanced.",
      tiers: { free: "20 cloud/day", plus: "Unlimited", pro: "Unlimited", ent: "Unlimited", note: "Local (on-device) replies are always unlimited on all plans." },
    },
    {
      icon: "🔍",
      title: "In-Chat Search",
      short: "Search your current conversation using the search icon in the chat header.",
      long: "Tap the search (🔍) icon in the top-right of the Chat header to search within the current conversation. Type any keyword to jump to matching messages highlighted in the thread. This is for searching the current conversation; searching across all history is in the History tab.",
      steps: [
        "Tap the 🔍 icon in the top-right of the Chat screen.",
        "Type a keyword (emotion, topic, person's name, etc.).",
        "Matching messages are highlighted.",
        "Tap the up/down arrows to jump between results.",
        "Press × or Escape to close search.",
      ],
    },
    {
      icon: "🧠",
      title: "Grief Mode & Unsent Letter",
      short: "Dedicated conversation modes for grief and cathartic expression — accessible from the chat menu.",
      long: "Tap the ··· (more) icon in the chat header to access special conversation modes: Grief & Loss mode adapts your companion to speak more slowly and carefully around themes of loss. Unsent Letter mode lets you write a letter to someone you can't speak to — for closure, not sending.",
      steps: [
        "Tap the ··· icon in the Chat header (top right).",
        "Select 'Grief & Loss mode' or 'Unsent Letter'.",
        "For Grief mode: a banner confirms the mode is active — continue chatting normally.",
        "For Unsent Letter: a dedicated editor opens. Write your letter and tap Done.",
        "Tap the mode banner to exit back to normal chat.",
      ],
      tip: "These modes are session-only — they reset when you close the app or start a new conversation.",
    },
  ],

  // ─ Voice & Audio ───────────────────────────────────────────────────────────
  voice: [
    {
      icon: "🎤",
      title: "Voice Input (Speech to Text)",
      short: "Tap the microphone to speak your message — Imotara transcribes it using AI.",
      long: "Tap the 🎤 microphone icon beside the message input to start recording. Speak naturally in any language. When you stop, the audio is sent to OpenAI Whisper for transcription and the text appears in the input box, ready to send or edit.",
      steps: [
        "Tap the 🎤 icon to the right of the message input box.",
        "Speak your message — there's no time limit (default max: 60 seconds).",
        "Tap the mic again or wait for silence detection to stop recording.",
        "The transcribed text appears in the message box.",
        "Edit if needed, then tap Send.",
      ],
      tip: "Works in all 22 languages. If you code-switch (mix languages), Whisper usually handles it correctly.",
      tiers: { free: true, plus: true, pro: true, ent: true },
    },
    {
      icon: "⏱",
      title: "Voice Recording Duration Limit",
      short: "Set how long a single voice recording can be — from 30 seconds to 5 minutes.",
      long: "By default, voice recordings stop at 60 seconds. You can change this in Settings → Advanced → Voice settings. Shorter limits use less data; longer limits let you speak more freely without interruption.",
      steps: [
        "Go to Settings → Advanced (expand the Advanced section).",
        "Find 'Voice max duration'.",
        "Drag the slider or tap to set: 30s, 60s, 2 min, 3 min, or 5 min.",
        "Changes take effect immediately on the next recording.",
      ],
    },
    {
      icon: "🌐",
      title: "Cloud vs On-Device Transcription",
      short: "Choose whether voice recording uses cloud AI (more accurate) or stays on-device (more private).",
      long: "By default, voice recordings are sent to OpenAI Whisper via Imotara's API for high-quality transcription. If privacy is a priority, you can switch to on-device transcription (uses your device's built-in speech recognition, which is less accurate but never leaves your phone).",
      steps: [
        "Go to Settings → Advanced → Voice settings.",
        "Find 'Cloud transcription'.",
        "Toggle off to use on-device transcription only.",
        "Toggle on (default) to use cloud Whisper transcription.",
      ],
      badge: "Cloud transcription requires internet",
    },
    {
      icon: "✅",
      title: "Voice Confirmation Before Sending",
      short: "Enable a confirmation step so you can review and edit transcribed text before sending.",
      long: "By default, after transcription the text goes into the input box and you must manually press Send. You can also enable 'Auto-send on transcription' which sends immediately. Or enable 'Confirm before send' which shows a review modal. Toggle these in Settings.",
      steps: [
        "Go to Settings → Advanced → Voice settings.",
        "Find 'Confirm before send'.",
        "Toggle on: after transcription, a modal shows the text for review before sending.",
        "Toggle off (default): text goes into the input box; you send manually.",
      ],
    },
    {
      icon: "🔊",
      title: "Text-to-Speech (Listen to Replies)",
      short: "Tap the speaker icon below any reply to hear it read aloud in your companion's voice.",
      long: "Every companion reply can be played as audio using Azure Neural TTS — high-quality, natural-sounding voices matched to your companion's gender and language. Plus subscribers can choose specific voices, adjust speed, and set pitch.",
      steps: [
        "Receive a reply from your companion.",
        "Tap the 🔊 speaker icon below the message bubble.",
        "The reply plays in your companion's voice.",
        "Tap again to pause; tap again to resume.",
        "To customize: Settings → Experience → Voice & audio.",
      ],
      tiers: { free: "Basic (device)", plus: "Azure Neural", pro: "Azure Neural", ent: "Azure Neural", note: "Free uses device built-in voice. Plus+ unlocks Azure Neural with gender-matched voices." },
    },
    {
      icon: "▶️",
      title: "Auto-Play TTS",
      short: "Enable Auto-play so every companion reply starts reading aloud automatically.",
      long: "When Auto-play is enabled, Imotara reads each reply aloud as soon as it finishes generating — no tapping required. This creates a more conversational, voice-forward experience. Ideal for hands-free use, accessibility, or when you prefer listening over reading.",
      steps: [
        "Go to Settings → Experience → Voice & audio.",
        "Find 'Auto-play replies'.",
        "Toggle on.",
        "Return to Chat — your companion's next reply will play automatically.",
      ],
    },
    {
      icon: "🎚️",
      title: "TTS Speed & Pitch Control",
      short: "Adjust how fast and how high-pitched your companion's voice sounds.",
      long: "Available on Plus and above. In Settings you can set the TTS speaking rate (0.5× slow to 1.5× fast) and pitch adjustment. Lower pitch creates a calmer, deeper voice; higher pitch is lighter and more energetic. These apply to all TTS playback.",
      steps: [
        "Go to Settings → Experience → Voice & audio.",
        "Find 'Speaking rate' slider — drag left to slow down, right to speed up.",
        "Find 'Pitch' slider — drag left for deeper, right for higher.",
        "Tap 'Preview voice' to hear a sample with your settings.",
      ],
      tiers: { free: false, plus: true, pro: true, ent: true },
      badge: "Plus+ required for customization",
    },
    {
      icon: "🎭",
      title: "TTS Voice Selection",
      short: "Choose from multiple Azure Neural voices matched to your language and companion gender.",
      long: "Azure Neural TTS provides several voice options per language. Your companion's gender setting determines which voices are shown — female companion shows female voices, male shows male. You can preview each voice before selecting.",
      steps: [
        "Go to Settings → Experience → Voice & audio.",
        "Find 'Voice selection'.",
        "Tap a voice name to hear a preview.",
        "Tap 'Use this voice' to confirm.",
        "All future TTS playback uses the selected voice.",
      ],
      tiers: { free: false, plus: true, pro: true, ent: true },
      badge: "Plus+ required",
    },
    {
      icon: "🌬",
      title: "Breathing Exercise with Ambient Sound",
      short: "A guided breathing exercise with Rain, Ocean, or Singing Bowl sound — accessible from chat.",
      long: "The breathing exercise uses the 4-7-8 technique (inhale 4 sec, hold 7 sec, exhale 8 sec). It runs full-screen with a pulsing visual guide and optional ambient sound. Choose from Rain, Ocean waves, or a Singing Bowl. Great for anxiety or to reset mid-conversation.",
      steps: [
        "Tap the + or ··· icon in the Chat header.",
        "Select 'Breathing exercise'.",
        "Choose your ambient sound: Rain, Ocean, or Singing Bowl.",
        "Follow the expanding circle — in, hold, out.",
        "Tap 'Done' to return to your conversation.",
      ],
      tip: "You can also change the default breathing pattern in Settings → Experience → Grow & Wellbeing.",
    },
  ],

  // ─ Your Companion ──────────────────────────────────────────────────────────
  companion: [
    {
      icon: "📛",
      title: "Companion Name",
      short: "Give your AI companion a name — it uses it in conversation and in TTS audio.",
      long: "By default your companion is named 'Imotara'. You can rename it anything — a real name, a nickname, or whatever feels right for you. The companion will use the name to refer to itself and in its voice profile for TTS.",
      steps: [
        "Go to Settings → Your companion → Tone & Context.",
        "Find 'Companion name' field.",
        "Clear the field and type a new name.",
        "Scroll down and tap 'Save'.",
        "The companion uses the new name from the next reply onward.",
      ],
    },
    {
      icon: "👤",
      title: "Your Name & Profile",
      short: "Tell your companion your name so it can address you personally in replies.",
      long: "Set your name in the Tone & Context settings. The companion uses it naturally in replies (e.g., 'That sounds hard, [Your name]'). You can also set your gender, which subtly affects how the companion addresses you in certain languages.",
      steps: [
        "Go to Settings → Your companion → Tone & Context.",
        "Enter your name in 'Your name' field.",
        "Select your gender tone: Female, Male, Non-binary, Other, or Prefer not to say.",
        "Tap Save.",
      ],
    },
    {
      icon: "🤝",
      title: "Relationship Tone",
      short: "Choose the kind of relationship your companion models — friend, mentor, coach, elder, and more.",
      long: "The relationship tone shapes every reply. 'Friend' gives warm, casual, empathetic responses. 'Mentor' is wise and guiding. 'Elder' is patient and measured. 'Coach' is direct and action-focused. 'Sibling' is relatable. 'Junior buddy' is lighter. 'Parent-like' is nurturing. 'Partner-like' is intimate.",
      steps: [
        "Go to Settings → Your companion → Tone & Context.",
        "Find 'Relationship tone'.",
        "Tap the relationship that feels right for you right now.",
        "Tap Save — your next reply will already feel different.",
      ],
      tip: "You can change this anytime — different days call for different kinds of support.",
    },
    {
      icon: "💡",
      title: "Response Style",
      short: "Tell your companion what kind of response you need — comfort, reflection, motivation, or advice.",
      long: "Five response styles shape how the companion replies: 'Comfort me' focuses on emotional validation. 'Help me reflect' asks thought-provoking questions. 'Motivate me' is encouraging and forward-looking. 'Give advice' offers practical guidance. 'Let Imotara decide' — the AI chooses based on emotional context.",
      steps: [
        "Go to Settings → Your companion → Tone & Context.",
        "Find 'Response style'.",
        "Select the style that matches what you need.",
        "Tap Save.",
      ],
    },
    {
      icon: "🎂",
      title: "Age Tone",
      short: "Set your age range so your companion adjusts its language and communication style.",
      long: "The companion communicates differently based on age group. 'Teen (13–17)' gets careful, age-sensitive messaging. 'Young adult (18–25)' is energetic and relatable. 'Adult (26–54)' is balanced. 'Senior (55+)' is patient and unhurried. Setting your companion's age range also affects TTS voice selection.",
      steps: [
        "Go to Settings → Your companion → Tone & Context.",
        "Find 'Your age' — select your age bracket.",
        "Find 'Companion age' — select how old you'd like your companion to feel.",
        "Tap Save.",
      ],
    },
    {
      icon: "🚻",
      title: "Companion Gender",
      short: "Choose your companion's gender — affects TTS voice selection and language tone.",
      long: "Setting your companion's gender (Female, Male, Non-binary, Neutral) determines which TTS voice is used when replies are read aloud, and subtly affects how the companion expresses itself in languages with gendered conjugation (Hindi, Bengali, Marathi, etc.).",
      steps: [
        "Go to Settings → Your companion → Tone & Context.",
        "Find 'Companion gender'.",
        "Select: Female, Male, Non-binary, or Prefer not to say.",
        "Tap Save.",
        "Tap 'Preview voice' to hear how the new gender sounds.",
      ],
    },
    {
      icon: "📐",
      title: "Reply Length",
      short: "Control whether replies are brief or detailed — short, medium, or long.",
      long: "You can set a preferred reply length so your companion consistently matches your preference. 'Short' gives concise 2-3 sentence replies — ideal for quick check-ins. 'Medium' is balanced. 'Long' gives detailed, thorough responses — good for deep processing or journaling-style conversations.",
      steps: [
        "Go to Settings → Your companion → Tone & Context.",
        "Find 'Reply length preference'.",
        "Select Short, Medium, or Long.",
        "Tap Save.",
      ],
      tiers: { free: false, plus: true, pro: true, ent: true },
    },
    {
      icon: "👁",
      title: "Teen Insights Mode",
      short: "A special mode that makes emotion analysis more careful and supportive for younger users.",
      long: "Teen Insights Mode adapts how Imotara processes and responds to emotional content — more careful phrasing, lower thresholds for safety resources, and additional sensitivity around topics like self-worth, peer pressure, and academic stress. Enable it in Settings for any user under 18.",
      steps: [
        "Go to Settings → Your companion.",
        "Find 'Teen Insights Mode'.",
        "Toggle on.",
        "A purple indicator confirms the mode is active.",
      ],
    },
    {
      icon: "🔊",
      title: "Voice Preview",
      short: "Hear a sample of your companion's TTS voice before committing to any setting change.",
      long: "Every time you change the companion name, gender, or language, a 'Preview voice' button appears. Tap it to hear a short sample of how your companion will sound in TTS. This lets you fine-tune before saving.",
      steps: [
        "Go to Settings → Your companion → Tone & Context.",
        "Make any change (name, gender, language).",
        "Tap 'Preview voice' that appears below.",
        "Listen to the sample — adjust if needed.",
        "Tap Save when satisfied.",
      ],
    },
  ],

  // ─ History ─────────────────────────────────────────────────────────────────
  history: [
    {
      icon: "📜",
      title: "Viewing Conversation History",
      short: "The History tab shows all past conversations, organised by date with emotion tags.",
      long: "Open the History tab (clock icon) to see all your conversations. Each entry shows a preview, date, and the dominant emotion icon. Tap any entry to read the full conversation. Your retention period depends on your plan: Free (7 days), Plus (90 days), Pro (unlimited).",
      steps: [
        "Tap the History tab (🕐 icon) at the bottom of the screen.",
        "Browse conversations — newest at the top.",
        "Tap any entry to open and read it.",
        "Scroll to the bottom of an open conversation to continue it.",
      ],
      tiers: { free: "7 days", plus: "90 days", pro: "Unlimited", ent: "Unlimited" },
    },
    {
      icon: "🔍",
      title: "Searching History",
      short: "Search across all your conversations by keyword, emotion, or topic.",
      long: "Tap the search icon in the History tab to search across your entire history. Type any word or phrase — matching messages are highlighted. Plus users can toggle between keyword search and semantic search (meaning-based — finds messages about a topic even if you used different words).",
      steps: [
        "Tap the History tab.",
        "Tap the 🔍 search icon.",
        "Type your search term.",
        "Matching messages appear with highlights.",
        "Toggle 'Semantic' (Plus+) to find meaning-based matches.",
      ],
      tiers: { free: "Keyword only", plus: "Keyword + Semantic", pro: "Keyword + Semantic", ent: "Keyword + Semantic" },
      badge: "Semantic search on Plus+",
    },
    {
      icon: "😊",
      title: "Emotion History Tab",
      short: "Switch to the Emotion History view to see your mood log organised by emotion type.",
      long: "In the History tab, tap 'Emotion History' to see all logged emotions sorted by type. This view lets you quickly filter to all times you felt 'Anxious', 'Joyful', or any other emotion — useful for identifying patterns.",
      steps: [
        "Open the History tab.",
        "Tap the 'Emotion History' pill at the top.",
        "Browse emotions chronologically.",
        "Tap an emotion type to filter.",
      ],
    },
    {
      icon: "🗑️",
      title: "Deleting a Conversation",
      short: "Swipe left (mobile) or click the trash icon to permanently delete a conversation.",
      long: "You can delete any individual conversation from the History tab. Once deleted, it's removed from your local storage immediately. If cloud sync is enabled, the deletion is also propagated to the server on the next sync.",
      steps: [
        "Open the History tab.",
        "Swipe left on a conversation (mobile) to reveal the Delete button.",
        "On web: hover over the conversation and click the trash icon.",
        "Confirm deletion in the prompt.",
      ],
      tip: "Deleted conversations cannot be recovered — they're gone from both local and cloud storage.",
    },
    {
      icon: "🔀",
      title: "Sync Status",
      short: "A sync badge at the top of History shows when your history last synced with the cloud.",
      long: "When cloud sync is enabled, the History tab shows a 'Sync checked recently' or 'Synced at HH:MM' line at the top. A spinning icon means sync is in progress. This reassures you that your data is safely backed up across devices.",
      steps: [
        "Enable cloud sync from Settings → Privacy & safety → Remote history sync.",
        "Open the History tab.",
        "Check the sync status line at the top.",
        "Tap 'Sync now' if you want to trigger a manual sync.",
      ],
    },
    {
      icon: "🔗",
      title: "Emotion Trends Link",
      short: "Tap 'Emotion trends' at the bottom of the History tab to jump to your full charts.",
      long: "At the bottom of the History tab, a card labeled 'Emotion trends — Radar chart · 30-day line · mood heatmap' links directly to the Trends screen. Tap it to see a full visual breakdown of your emotional patterns.",
      steps: [
        "Open the History tab.",
        "Scroll to the bottom.",
        "Tap the 'Emotion trends' card.",
        "You're taken to the Trends tab.",
      ],
    },
  ],

  // ─ Trends & Insights ───────────────────────────────────────────────────────
  trends: [
    {
      icon: "🫀",
      title: "Mood Check-In Chips",
      short: "Tap an emotion chip at the top of Trends to log a quick mood without starting a full conversation.",
      long: "The Trends tab opens with a row of emotion chips: Joy, Hopeful, Grateful, Sad, Stressed, Angry, Confused, Neutral. Tap one to instantly log that mood to your history — it counts as a check-in and keeps your streak alive, even on days when you don't feel like chatting.",
      steps: [
        "Open the Trends tab (📊 bar chart icon).",
        "Tap the emotion chip that matches how you feel right now.",
        "The emotion is logged with the current timestamp.",
        "Your streak counter updates.",
      ],
    },
    {
      icon: "🕸",
      title: "Emotion Radar Chart",
      short: "A 6-axis radar chart showing how your emotions spread across joy, sadness, stress, and more this week.",
      long: "The Emotion Radar shows Joy, Hopeful, Confused, Angry, Stressed, Sad, and Neutral as axes of a hexagon. The larger a segment, the more times that emotion appeared in your conversations this week. An evenly distributed chart means a varied emotional week; a spike in one area signals a dominant mood.",
      steps: [
        "Open the Trends tab.",
        "Scroll to the 'Emotion Radar' section.",
        "Look at which emotions have the largest segments.",
        "Hover (web) or tap (mobile) an axis to see the count for that emotion.",
      ],
      tiers: { free: false, plus: false, pro: true, ent: true },
      badge: "Pro unlocks weekly comparison",
    },
    {
      icon: "📅",
      title: "7-Day Mood Row",
      short: "A row of emoji dots showing your dominant emotion for each of the last 7 days.",
      long: "Below the radar, a row shows one emoji dot per day for the last 7 days. Each dot represents the dominant emotion logged that day. Gaps mean no check-in that day. This gives a quick visual scan of your week's emotional pattern.",
      steps: [
        "Open the Trends tab.",
        "Find the '7-Day Mood' section.",
        "Read each dot left to right (oldest to today).",
        "Tap a dot to see the emotion label.",
      ],
    },
    {
      icon: "🔥",
      title: "Streak Tracking",
      short: "Your streak counts consecutive days you checked in — with Imotara or via a quick chip tap.",
      long: "A streak day is any day you either send a message in Chat or tap a mood chip in Trends. The streak counter shows your current consecutive days and best streak. A missed day resets the streak. You'll get a notification warning if you're at risk of losing your streak.",
      steps: [
        "Open the Trends tab.",
        "Your streak counter is shown near the top ('X days in a row').",
        "Maintain it by checking in daily — either chat or tap a mood chip.",
        "Streak notifications: Settings → Experience → Notifications → Streak reminder.",
      ],
    },
    {
      icon: "📋",
      title: "Weekly Report",
      short: "An auto-generated narrative summary of your emotional week appears every Monday.",
      long: "The Weekly Report is a short paragraph generated by the AI summarising the emotional themes of your week — what you felt, patterns it noticed, and a gentle observation. It appears in the Trends tab and (if enabled) as a push notification.",
      steps: [
        "Open the Trends tab on or after Monday.",
        "Find the 'Weekly Report' section.",
        "Read the narrative summary.",
        "Tap 'Reflect on this' to journal about the week.",
      ],
      tiers: { free: false, plus: false, pro: true, ent: true },
      badge: "Pro+ for full weekly digest",
    },
    {
      icon: "📈",
      title: "30-Day Mood Trend",
      short: "A line chart of your daily emotional intensity over the past 30 days — see your emotional arc at a glance.",
      long: "The 30-day trend graph plots your emotional intensity day-by-day over the past month. An upward trend means increasing positive emotions; downward means increasing difficult ones. Look for recurring patterns (e.g., mood dips every weekend) that might reveal triggers.",
      steps: [
        "Open the Trends tab.",
        "Scroll to the '30-Day Mood Trend' chart.",
        "Hover/tap any point to see the date and emotion.",
        "Look for patterns — recurring dips or peaks.",
      ],
      tiers: { free: false, plus: false, pro: true, ent: true },
      badge: "Pro feature",
    },
    {
      icon: "📆",
      title: "30-Day Reflection Challenge",
      short: "A month-long daily reflection challenge with a daily prompt — tap 'Mark today done' to track progress.",
      long: "In the Grow tab (or Trends on mobile), the 30-Day Challenge gives you a daily journaling prompt. Complete 30 consecutive days to finish the challenge. A progress grid shows your dots — filled for completed days, empty for missed ones. Tap 'Restart' to begin again at any time.",
      steps: [
        "Open the Grow tab (web) or scroll in Trends (mobile).",
        "Find the '30-Day Challenge' card.",
        "Read today's prompt (e.g., 'Write about one thing that made you feel alive this week').",
        "Reflect on the prompt — either in Chat or privately.",
        "Tap 'Mark today done' to record your completion.",
      ],
    },
    {
      icon: "💌",
      title: "Companion Letter (Pro)",
      short: "Once a month, your companion writes you a personal letter reflecting on your emotional journey.",
      long: "Available on Pro and above. At the end of each calendar month, Imotara generates a personal letter from your companion — written in first person, referencing specific things you talked about, and offering a gentle reflection on the month's emotional arc. Find it in Trends.",
      steps: [
        "Upgrade to Pro from Settings → Plan & support.",
        "Enable cloud sync (required for letter generation).",
        "Wait until the end of the calendar month.",
        "Open Trends → scroll to 'Companion Letter'.",
        "Read your monthly letter.",
      ],
      tiers: { free: false, plus: false, pro: true, ent: true },
      badge: "Pro feature",
    },
    {
      icon: "🌱",
      title: "Growth Arc Narrative (Pro)",
      short: "A long-term emotional narrative that tracks how you evolve across multiple months.",
      long: "The Growth Arc is Imotara's deepest insight feature — an ongoing narrative that reads your emotional history across months and tells the story of your emotional evolution. It notices when patterns shift (e.g., loneliness replaced by connection), when you've grown, and what emotional themes keep recurring.",
      steps: [
        "Upgrade to Pro.",
        "Enable cloud sync.",
        "After 1-2 months of conversations, open Trends.",
        "Scroll to 'Growth Arc'.",
        "Read the narrative — it updates monthly.",
      ],
      tiers: { free: false, plus: false, pro: true, ent: true },
      badge: "Pro feature",
    },
  ],

  // ─ Grow & Wellbeing ────────────────────────────────────────────────────────
  grow: [
    {
      icon: "🌿",
      title: "The Grow Page",
      short: "A dedicated space for reflection, journaling, emotional challenges, and growth modules.",
      long: "The Grow page (web) or Trends tab (mobile) contains all long-form reflection and growth features. Here you'll find the 30-day challenge, future letters, collective pulse, reflection prompts, and mindset capsule. It's designed for users who want to go deeper than daily chat.",
      steps: [
        "Click 'Grow' in the top navigation (web) or scroll within Trends (mobile).",
        "Browse the available modules.",
        "Tap any card to open that feature.",
      ],
    },
    {
      icon: "📬",
      title: "Future Letters",
      short: "Write a letter to your future self — it locks until the date you choose, then unlocks for reading.",
      long: "Future Letters are a journaling tool with a time-lock. Write a letter to yourself — hopes, fears, goals, a snapshot of where you are right now — then set a date (1 month, 6 months, a year from now). On that date, the letter unlocks and you can read what past-you wrote.",
      steps: [
        "Open Grow (web) or Trends → Future Letters (mobile).",
        "Tap '+ Write a letter'.",
        "Write your letter — address it to your future self.",
        "Set a lock date (when you want to read it).",
        "Tap 'Seal & lock'.",
        "On the unlock date, open Future Letters and read.",
      ],
    },
    {
      icon: "📡",
      title: "Collective Pulse",
      short: "An anonymised real-time pulse of how thousands of Imotara users are feeling right now.",
      long: "The Collective Pulse is an anonymised, aggregated signal showing the emotional state of Imotara users globally. No personal data is shared — it's purely numerical percentages (e.g., '34% feeling hopeful right now'). Use it as a reminder that you're not alone in whatever you're feeling.",
      steps: [
        "Open the Grow page (web) or Chat header → Collective Pulse (mobile).",
        "Read the live percentages.",
        "The data updates periodically throughout the day.",
      ],
    },
    {
      icon: "🧠",
      title: "Mindset Capsule",
      short: "An AI-generated weekly emotional capsule — your top themes, patterns, and a personalised insight.",
      long: "The Mindset Capsule analyses your recent conversations and generates a weekly insight: what emotional topics you discussed most, any patterns or contradictions it noticed, and one personalised reflection to sit with. Find it in Grow → Mindset Analysis.",
      steps: [
        "Open Grow → Mindset Analysis (web) or Settings → Advanced → Mindset Analysis (web).",
        "View your current capsule — it updates weekly.",
        "Toggle which time periods to include: Today, Last 7 days, Last 30 days, All time.",
        "Tap 'Generate' to refresh the capsule.",
      ],
    },
    {
      icon: "✉️",
      title: "Unsent Letter (Shadow Voice)",
      short: "Write a letter to someone you can't or won't speak to — for cathartic release, not sending.",
      long: "The Unsent Letter mode lets you pour out everything you'd say to someone — a parent, ex, estranged friend, or even yourself — without sending it. The act of writing it down is cathartic. The letter is stored privately and can be deleted anytime.",
      steps: [
        "In Chat, tap ··· (more) → 'Unsent Letter'.",
        "Type the recipient's name (optional).",
        "Write everything you want to say.",
        "Tap 'Done' — the letter is saved privately.",
        "To find it again: History → filter by Unsent Letters.",
      ],
    },
    {
      icon: "🌍",
      title: "Family Emotional Snapshot",
      short: "Generate a shareable emotional snapshot of your week to share with family members.",
      long: "The Family Snapshot creates a privacy-safe visual summary of your emotional week — showing trends and general mood without exposing conversation content. Share the link with a trusted family member so they understand how you've been feeling without needing to ask.",
      steps: [
        "Go to Settings → Advanced → Family Snapshot.",
        "Tap 'Generate snapshot'.",
        "A unique link is created.",
        "Share the link with the family member of your choice.",
        "They see an anonymised mood summary — no conversation text.",
      ],
    },
    {
      icon: "🧘",
      title: "Breathing Patterns",
      short: "Choose from several breathing techniques — 4-7-8, box breathing, and more.",
      long: "The breathing exercise supports multiple techniques. 4-7-8 (inhale 4, hold 7, exhale 8) is good for anxiety. Box breathing (4-4-4-4) is for focus and calm. You can set a default pattern in Settings so it opens to your preferred technique every time.",
      steps: [
        "Go to Settings → Experience → Grow & Wellbeing.",
        "Find 'Default breathing pattern'.",
        "Choose: 4-7-8, Box breathing, or Equal breathing.",
        "This becomes the default when you open the breathing exercise.",
      ],
    },
  ],

  // ─ Settings: Experience ────────────────────────────────────────────────────
  experience: [
    {
      icon: "🔔",
      title: "Browser Notifications",
      short: "Enable push notifications to receive daily check-in reminders and weekly digests.",
      long: "On web, Imotara can send you browser push notifications for daily reminders, streak warnings, and weekly emotional summaries. You must grant permission when prompted. If you accidentally blocked them, re-enable in your browser's site settings.",
      steps: [
        "Go to Settings → Experience.",
        "Find 'Browser notifications'.",
        "Tap 'Enable notifications'.",
        "Allow in the browser permission prompt.",
        "Set your preferred notification time for daily reminders.",
      ],
    },
    {
      icon: "💭",
      title: "Typing Indicator Speed",
      short: "Control how fast your companion appears to 'type' — affects the streaming animation speed.",
      long: "The typing indicator shows your companion appearing to type before the reply arrives. You can set the speed: Fast (minimal delay), Normal (natural feel), Slow (more deliberate, calmer). This changes the pacing of the conversation feel, not the actual reply generation speed.",
      steps: [
        "Go to Settings → Experience → Chat behaviour.",
        "Find 'Typing indicator speed'.",
        "Select Fast, Normal, or Slow.",
      ],
    },
    {
      icon: "😄",
      title: "Reaction Display",
      short: "Toggle whether emoji reactions appear on messages in your chat thread.",
      long: "If you've added emoji reactions to messages, this setting controls whether they're shown inline on the bubble or hidden. Turn off to keep the chat thread clean; turn on to see your emotional annotations at a glance.",
      steps: [
        "Go to Settings → Experience → Chat behaviour.",
        "Find 'Show message reactions'.",
        "Toggle on or off.",
      ],
    },
    {
      icon: "🫧",
      title: "Bubble Style",
      short: "Choose between rounded or compact message bubble styles.",
      long: "Switch between two chat bubble styles: Rounded (the default, soft and friendly) or Compact (tighter layout with less padding, shows more text per screen). Compact is useful on smaller screens or for users who prefer a denser view.",
      steps: [
        "Go to Settings → Experience → Chat behaviour.",
        "Find 'Bubble style'.",
        "Select Rounded or Compact.",
      ],
    },
    {
      icon: "🎨",
      title: "Accent Color",
      short: "Change the app's accent colour — Twilight (default), Indigo, Teal, Rose, Amber, or Emerald.",
      long: "Imotara's UI accent colour appears on buttons, active links, chips, and highlights. Choose the colour that feels most calming or personal to you. Twilight is a multi-colour gradient; the others are solid single-colour accents.",
      steps: [
        "Go to Settings → Experience → Appearance.",
        "Find 'Accent colour'.",
        "Tap a colour swatch to preview it.",
        "The UI updates instantly.",
      ],
    },
    {
      icon: "🌗",
      title: "Light / Dark / System Theme",
      short: "Switch between dark mode, light mode, or follow your device's system setting.",
      long: "Imotara defaults to dark mode. Switch to light mode for daytime use, or set it to 'System' to automatically match your device's dark/light setting. The theme applies immediately with no restart required.",
      steps: [
        "Go to Settings → Experience → Appearance.",
        "Find 'Theme'.",
        "Select Dark, Light, or System.",
      ],
    },
    {
      icon: "🔤",
      title: "Font Size",
      short: "Make text larger or smaller across the entire app — Small, Medium (default), or Large.",
      long: "Font size affects all text in the app — chat messages, settings labels, history entries. Large font is useful for accessibility or small-screen readability. Small font shows more content per screen.",
      steps: [
        "Go to Settings → Experience → Appearance.",
        "Find 'Font size'.",
        "Select Small, Medium, or Large.",
        "Changes apply instantly.",
      ],
    },
    {
      icon: "📊",
      title: "Mindset Analysis Preferences",
      short: "Choose which time windows feed into your Mindset Capsule analysis.",
      long: "The Mindset Analysis can look at different time windows: Today, Last 7 days, Last 30 days, and All time. Toggle each on or off to control what data the AI summarises when generating your capsule. If you want a fresh weekly snapshot only, turn off 'All time'.",
      steps: [
        "Go to Settings → Experience → Mindset Analysis.",
        "Toggle each time window: Today, 7 days, 30 days, All time.",
        "The next time you generate a capsule, only toggled windows are used.",
      ],
    },
    {
      icon: "📖",
      title: "Grow Cadence Controls",
      short: "Set how often your companion sends letters and how the arc updates.",
      long: "Available on Plus and above. Control the frequency of companion letters (Monthly, Every 2 months) and the arc narrative update cycle. More frequent updates mean shorter, more focused reflections; less frequent means broader, deeper summaries.",
      steps: [
        "Go to Settings → Experience → Chat behaviour.",
        "Find 'Companion letter cadence'.",
        "Select Monthly or Every 2 months.",
        "Find 'Growth arc cadence' — Monthly or Quarterly.",
      ],
      tiers: { free: false, plus: true, pro: true, ent: true },
      badge: "Plus+ required",
    },
    {
      icon: "🔎",
      title: "Search Mode",
      short: "Toggle between keyword search and semantic (meaning-based) search in History.",
      long: "Keyword search finds exact word matches. Semantic search (Plus+) finds conceptually similar results — searching 'feeling alone' might surface entries about loneliness even if that word wasn't used. Toggle the mode in Settings or directly in the History search bar.",
      steps: [
        "Go to Settings → Experience → Chat behaviour.",
        "Find 'Search mode'.",
        "Select Keyword or Semantic.",
      ],
      tiers: { free: "Keyword only", plus: "Keyword + Semantic", pro: "Keyword + Semantic", ent: "Keyword + Semantic" },
      badge: "Semantic search on Plus+",
    },
    {
      icon: "📳",
      title: "Haptic Feedback (Web)",
      short: "Control haptic vibration intensity on supported devices — Off, Light, or Strong.",
      long: "On devices that support haptic feedback through the browser (primarily mobile browsers), Imotara vibrates subtly on message send and certain interactions. Choose Light for a gentle tap, Strong for more noticeable feedback, or Off to disable entirely.",
      steps: [
        "Go to Settings → Experience → Chat behaviour.",
        "Find 'Haptic feedback'.",
        "Select Off, Light, or Strong.",
      ],
    },
  ],

  // ─ Settings: Privacy ───────────────────────────────────────────────────────
  privacy: [
    {
      icon: "🔬",
      title: "Analysis Consent",
      short: "Grant or revoke permission for Imotara to analyse your messages for emotional content.",
      long: "Emotion analysis — detecting whether you feel sad, anxious, joyful, etc. — runs only if you've given consent. Without consent, the companion still responds but doesn't log emotion tags or build your Trends history. You can grant or revoke this anytime.",
      steps: [
        "Go to Settings → Privacy & safety.",
        "Find 'Emotion analysis'.",
        "Toggle 'Allow analysis' on or off.",
        "If turned off, you can still manually log emotions from the Trends chip row.",
      ],
    },
    {
      icon: "☁️",
      title: "Cloud Analysis Mode",
      short: "Choose whether analysis runs locally (on device) or via the cloud API.",
      long: "Local analysis uses keyword matching on your device — fast, private, no data leaves your phone, but less nuanced. Cloud analysis sends your message to Imotara's API for more accurate emotion detection. Choose based on your privacy preference.",
      steps: [
        "Go to Settings → Privacy & safety.",
        "Find 'Analysis mode'.",
        "Select Auto (cloud when online, local when offline), Cloud only, or Local only.",
      ],
    },
    {
      icon: "🚨",
      title: "Safety & Crisis Resources",
      short: "View and configure the crisis resources your companion uses when distress is detected.",
      long: "When Imotara detects signs of serious distress (suicidal ideation, self-harm), it shows a crisis card with local emergency numbers. In Settings, you can configure your country to ensure the correct helplines are shown. You can also manually view and test the crisis resources.",
      steps: [
        "Go to Settings → Privacy & safety → Safety & crisis resources.",
        "Set your country from the dropdown.",
        "Review the emergency numbers shown for your region.",
        "Tap any number to test the tel: link.",
      ],
    },
    {
      icon: "📤",
      title: "Export Data",
      short: "Download all your conversations and emotion history as JSON, CSV, or PDF.",
      long: "Export your full data anytime from Settings. JSON is machine-readable and complete. CSV works in spreadsheets. PDF is human-readable. The export includes all messages, timestamps, emotion tags, and intensity levels — but not payment information.",
      steps: [
        "Go to Settings → Privacy & safety → Export data.",
        "Choose format: JSON, CSV, or PDF.",
        "Tap 'Export'.",
        "The file downloads to your device.",
      ],
      tiers: { free: false, plus: true, pro: true, ent: true, note: "Also unavailable on Family tier (shared-device privacy boundary)." },
      badge: "Plus+ required",
    },
    {
      icon: "🔄",
      title: "Remote History Sync",
      short: "Manually trigger a sync of your history between device and cloud.",
      long: "Sync happens automatically in the background, but you can also trigger it manually from Settings. The sync result shows how many new records were pulled from the server or pushed from your device.",
      steps: [
        "Sign in with Google first.",
        "Go to Settings → Privacy & safety → Remote history sync.",
        "Tap 'Sync now'.",
        "A message confirms the sync result: 'Synced, X new records from cloud'.",
      ],
    },
    {
      icon: "🔗",
      title: "Link Devices (Cross-Device Access)",
      short: "Connect multiple devices to the same history using a Chat Link Key.",
      long: "In addition to account-based sync, Imotara supports a Chat Link Key — a secret code that lets two devices share the same history bucket without requiring a Google account on both. Useful for accessing history from a shared computer.",
      steps: [
        "Go to Settings → Privacy & safety.",
        "Find 'Chat Link Key'.",
        "Copy the key from your primary device.",
        "On the second device, paste the key into the same field.",
        "Both devices now share the same history bucket.",
      ],
    },
    {
      icon: "🧹",
      title: "Clear Local History",
      short: "Delete all conversation history stored on this device — cloud history is unaffected.",
      long: "If you want a fresh start on a specific device without affecting your cloud backup, use 'Clear local history'. This removes all messages from local storage on this device only. The next sync will pull cloud history back if sync is enabled.",
      steps: [
        "Go to Settings → Privacy & safety.",
        "Find 'Clear local history'.",
        "Tap the button and confirm.",
        "All local messages are deleted.",
        "Cloud history is unaffected.",
      ],
    },
    {
      icon: "💥",
      title: "Delete All Cloud Data",
      short: "Permanently remove all your data from Imotara's servers — cannot be undone.",
      long: "This deletes everything associated with your account from Imotara's cloud: conversations, emotion history, memories, profile. Your local device data is not affected. This is permanent and cannot be undone — use with care.",
      steps: [
        "Go to Settings → Advanced → Data & privacy.",
        "Find 'Delete all cloud data'.",
        "Read the warning carefully.",
        "Tap 'Delete' and confirm.",
        "All server-side data for your account is permanently removed.",
      ],
    },
    {
      icon: "🗑️",
      title: "Delete Account",
      short: "Permanently delete your Imotara account and all associated data.",
      long: "Account deletion removes everything: your Google-linked account, all cloud data, purchases, and profile. Local data on each device must be cleared separately. This action is irreversible — subscriptions are not automatically cancelled, so cancel from your App Store / Play Store settings first.",
      steps: [
        "Cancel any active subscriptions first (App Store / Play Store settings).",
        "Go to Settings → Advanced → Delete account.",
        "Read the warning.",
        "Tap 'Delete account' and confirm.",
        "You're signed out and your account is queued for deletion.",
      ],
    },
  ],

  // ─ Settings: Advanced ──────────────────────────────────────────────────────
  advanced: [
    {
      icon: "🧩",
      title: "Companion Insights (Fingerprint)",
      short: "A visual 'emotional fingerprint' showing how your conversation patterns differ from day to day.",
      long: "The Companion Insights panel shows an abstract visualisation of your emotional fingerprint — how your pattern of expressed emotions looks at a glance. Toggle 'Show fingerprint' to include or hide this visualisation in your Trends view.",
      steps: [
        "Go to Settings → Advanced → Companion insights.",
        "Toggle 'Show fingerprint' on.",
        "Open Trends — look for the fingerprint visualisation.",
      ],
    },
    {
      icon: "🧠",
      title: "Companion Memory",
      short: "Imotara silently remembers personal facts you mention — name, job, relationships, events.",
      long: "As you chat, Imotara's companion memory engine detects personal facts: your name (if different from your profile name), your job, key relationships (partner, friends, family), and significant life events. These are stored privately and injected into future AI prompts to make replies feel more personal.",
      steps: [
        "Companion memory is automatic — just chat naturally.",
        "To see what's stored: Settings → Advanced → Companion memory.",
        "Review the list of remembered facts.",
        "Tap the trash icon next to any fact to delete it.",
        "Toggle 'Companion memory capture' off to stop new facts being remembered.",
      ],
    },
    {
      icon: "📏",
      title: "Memory Item Limit",
      short: "Set how many personal facts your companion can remember — from 5 to 20 items.",
      long: "By default, Imotara stores up to 12 memory items. You can increase this to 20 for richer personalization, or reduce to 5 for a lighter footprint. When the limit is reached, the oldest items are replaced by newer ones.",
      steps: [
        "Go to Settings → Advanced → Companion memory.",
        "Find 'Max memory items'.",
        "Drag the slider or enter a number: 5 to 20.",
      ],
    },
    {
      icon: "📆",
      title: "History Management (Auto-Delete)",
      short: "Set automatic deletion of old conversations after a set number of days.",
      long: "You can configure Imotara to automatically delete conversations older than a certain number of days — 30, 60, 90, or 180 days. This helps manage storage without manually cleaning up. Note: auto-delete applies to both local and cloud history.",
      steps: [
        "Go to Settings → Advanced → History management.",
        "Find 'Auto-delete old conversations'.",
        "Set the threshold: 30, 60, 90, or 180 days.",
        "Toggle the setting on.",
        "Conversations older than the threshold are deleted on the next cleanup.",
      ],
    },
    {
      icon: "📓",
      title: "Journal Auto-Delete",
      short: "Set automatic deletion of reflection journal entries after a set period.",
      long: "If you use the Reflect/Journal feature, you can auto-delete entries after a set time. This is useful if you journal for cathartic release but don't want entries accumulating indefinitely.",
      steps: [
        "Go to Settings → Advanced → History management.",
        "Find 'Journal auto-delete'.",
        "Set the period: 7, 14, 30, or 90 days.",
      ],
    },
    {
      icon: "📡",
      title: "Network Settings",
      short: "Configure API timeout, retry behaviour, and offline detection thresholds.",
      long: "Advanced users can tweak network settings: API timeout (how long Imotara waits before falling back to local AI — default 20 seconds), retry count, and the offline detection interval. Only change these if you're on a slow or unreliable connection.",
      steps: [
        "Go to Settings → Advanced → Network.",
        "Find 'API timeout' — drag slider to set (10s–60s).",
        "Find 'Offline detection interval'.",
        "Tap 'Reset to defaults' to restore original values.",
      ],
    },
    {
      icon: "🎯",
      title: "Tips & Tours Reset",
      short: "Reset the discovery tips that appear the first time you visit each screen.",
      long: "First-visit tips are small informational banners that appear when you first use a feature. If you dismissed them too quickly, you can reset them here to see them again. You can also reset the welcome tip that appears on your first Chat session.",
      steps: [
        "Go to Settings → Advanced → Tips & tours.",
        "Tap 'Reset discovery cards' to see feature tips again.",
        "Tap 'Reset welcome tip' to see the first-chat greeting again.",
      ],
    },
    {
      icon: "🔄",
      title: "Restart Onboarding",
      short: "Redo the 3-step onboarding flow — your data and settings are not affected.",
      long: "If you want to reconfigure your companion from scratch (new name, different relationship tone, different language), restarting onboarding is the quickest way. It doesn't delete any history or settings — it just re-walks you through the setup steps.",
      steps: [
        "Go to Settings → Advanced → Tips & tours.",
        "Tap 'Restart onboarding'.",
        "Confirm in the prompt.",
        "The onboarding modal opens on your next Chat visit.",
      ],
    },
    {
      icon: "📱",
      title: "App Version & Build Info",
      short: "See which version and build number of Imotara you're running.",
      long: "The current version and build number appear at the bottom of the Settings page (Advanced section). This is useful when reporting bugs or checking if you're on the latest release.",
      steps: [
        "Go to Settings → Advanced.",
        "Scroll to the bottom.",
        "The version (e.g., v1.1.7) and build (e.g., build 95) are displayed.",
      ],
    },
  ],

  // ─ Plans & Upgrade ─────────────────────────────────────────────────────────
  plans: [
    {
      icon: "🆓",
      title: "Free Plan",
      short: "Fully functional — 20 cloud AI replies per day, 7-day history, unlimited on-device replies.",
      long: "The Free plan gives you the core Imotara experience: 20 cloud AI replies per day (reset at midnight), unlimited on-device (local) replies, 7-day cloud history, streak tracking, mood check-ins, daily reminders, basic TTS, and full privacy controls. You never need to pay to use Imotara.",
      steps: [
        "No action needed — you start on the Free plan automatically.",
        "When you hit the daily limit, on-device local AI takes over.",
        "Local replies are unlimited and work offline.",
        "Your history is accessible for 7 days on Free.",
      ],
      tip: "The daily limit resets at midnight in your local timezone — not 24 hours from first use.",
      tiers: { free: true, plus: false, pro: false, ent: false, note: "This section describes what the Free plan includes." },
    },
    {
      icon: "☁️",
      title: "Plus Plan (₹99/mo or ₹699/yr)",
      short: "Unlimited cloud replies, 90-day history, advanced TTS, semantic search, data export, and more.",
      long: "Plus removes the daily reply limit, extends history to 90 days, adds data export (JSON/CSV/PDF), advanced TTS (voice selection, speed/pitch), semantic history search, reply cadence controls, custom notification schedule, and session duration stats.",
      steps: [
        "Go to Settings → Plan & support → View plans & upgrade.",
        "Select the Plus plan.",
        "Toggle Monthly / Annual (Annual saves ~25%).",
        "Complete payment via Razorpay (web/Android) or Apple IAP (iOS).",
        "Features unlock immediately.",
      ],
      tiers: { free: false, plus: true, pro: false, ent: false, note: "This section describes the Plus plan features." },
    },
    {
      icon: "⭐",
      title: "Pro Plan (₹149/mo or ₹1,299/yr)",
      short: "Everything in Plus, plus unlimited history, emotion insights, companion letter, and growth arc.",
      long: "Pro adds everything in Plus plus: unlimited conversation history, emotion trends charts (radar, 30-day trend), conversation insights, weekly emotional summaries, weekly insight digest notifications, monthly companion letter, and the long-term growth arc narrative.",
      steps: [
        "Go to Settings → Plan & support → View plans & upgrade.",
        "Select the Pro plan.",
        "Complete payment.",
        "Pro features (charts, companion letter, growth arc) unlock immediately.",
      ],
      tiers: { free: false, plus: false, pro: true, ent: false, note: "This section describes the Pro plan features." },
    },
    {
      icon: "🪙",
      title: "Token Packs (One-Time Purchase)",
      short: "Buy extra AI reply credits that never expire — use them on top of your daily limit.",
      long: "Token packs are one-time purchases that give you extra cloud AI replies beyond your daily limit. They never expire and carry over indefinitely. Useful for days when you need to talk more than your plan allows. Available to all tiers including Free.",
      steps: [
        "Go to Settings → Plan & support → View plans.",
        "Scroll to 'Top up with message credits'.",
        "Choose a pack: 100 (₹49), 250 (₹99), 600 (₹199), or 1800 (₹499) credits.",
        "Complete payment.",
        "Credits are added to your account immediately.",
      ],
    },
    {
      icon: "🏢",
      title: "Enterprise Plan (Custom Pricing)",
      short: "For organisations, schools, and healthcare platforms — admin dashboard, SSO, data residency, and more.",
      long: "Enterprise includes everything in Pro plus: admin dashboard with org-wide analytics, multi-profile management, child-safe mode, SSO/SAML (Okta, Google Workspace, Azure AD), data residency control, audit logs, API access, custom integrations, institution branding, bulk provisioning, dedicated support, and SLA.",
      steps: [
        "Go to Settings → Plan & support → View plans.",
        "Scroll to 'Enterprise & Institutional'.",
        "Tap 'Contact us for Enterprise'.",
        "Or email info@imotara.com with subject 'Enterprise inquiry'.",
        "The team typically responds within 24 hours.",
      ],
      tiers: { free: false, plus: false, pro: false, ent: true, note: "Enterprise is for organisations — contact sales for custom pricing." },
    },
    {
      icon: "🔄",
      title: "Restoring Purchases (iOS)",
      short: "If your subscription disappeared after reinstalling, use Restore Purchases to relink it.",
      long: "On iOS, subscriptions are tied to your Apple ID. If you reinstall the app or sign in on a new device, tap 'Restore previous purchases' in the upgrade sheet to relink your subscription. This syncs your Apple IAP history with your Imotara account.",
      steps: [
        "Open the upgrade sheet (Settings → Plan & support → View plans).",
        "Scroll to the bottom.",
        "Tap 'Restore previous purchases'.",
        "Wait for the restore to complete.",
        "Your subscription status updates.",
      ],
    },
    {
      icon: "💸",
      title: "Supporting Imotara (Donations)",
      short: "Optional one-time donations to support development — ₹49, ₹99, ₹199, ₹499, or ₹999.",
      long: "If you love Imotara and want to support its development without a subscription, donations are available in Settings. They're entirely optional, never change your plan or features, and are processed securely via Razorpay. Donations appear in your 'Your Donations' history.",
      steps: [
        "Go to Settings → Plan & support → Support Imotara.",
        "Choose a preset amount.",
        "Complete payment via Razorpay (UPI, cards, netbanking).",
        "A thank-you note appears in your Donations history.",
      ],
    },
  ],

  // ─ Languages ───────────────────────────────────────────────────────────────
  languages: [
    {
      icon: "🌐",
      title: "Supported Languages (22 Total)",
      short: "Imotara supports 12 Indian and 10 international languages — detected automatically.",
      long: "Indian languages: English, Hindi, Marathi, Bengali, Tamil, Telugu, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu. International: Spanish, French, German, Portuguese, Russian, Arabic, Chinese (Mandarin), Japanese, Hebrew, Indonesian. All are supported in chat, TTS, and local AI replies.",
      steps: [
        "Just start chatting in your language — detection is automatic.",
        "Indian scripts (Devanagari, Bengali, Tamil, etc.) are detected instantly.",
        "Latin-script languages (es, fr, de, etc.) are detected from keyword patterns.",
        "To pin a language: Settings → Your companion → Tone & Context → Language.",
      ],
    },
    {
      icon: "🔤",
      title: "Automatic Language Detection",
      short: "Imotara detects your language from the script and keywords in each message — no manual switching.",
      long: "Detection works in layers: first checks Unicode script range (Devanagari → Hindi/Marathi, Bengali script → Bengali, Tamil → Tamil, Arabic → Arabic/Urdu, CJK → Chinese, Hebrew → Hebrew, Cyrillic → Russian), then keyword patterns for romanised text, then falls back to your preferred language setting.",
      steps: [
        "Just type in your language.",
        "If detection is wrong, type 'reply in Tamil' or your preferred language to override.",
        "Or set a preferred language in Settings to always use it.",
      ],
      tip: "Type 'मराठीत बोल' (speak in Marathi) or 'reply in Bengali' mid-conversation to switch instantly.",
    },
    {
      icon: "🔀",
      title: "Code-Switching (Mixing Languages)",
      short: "Mix Hindi and English, Tamil and English, or any languages in the same message — Imotara handles it.",
      long: "Code-switching — where you mix two languages in the same sentence — is very common in multilingual communities. Imotara's AI understands code-switched text and responds in kind, typically matching the primary language of the message.",
      steps: [
        "Just write naturally — mixing languages is fine.",
        "Example: 'aaj ka din bahut tiring tha, I couldn't focus at all'.",
        "Imotara detects the primary language (Hindi here) and responds in Hindi-English mix.",
      ],
    },
    {
      icon: "🎤",
      title: "Language-Matched TTS Voices",
      short: "When you chat in Tamil, you hear a Tamil voice. Arabic chat → Arabic voice. Automatic.",
      long: "TTS voices are matched to the language detected in your conversation. Each of the 22 languages has dedicated Azure Neural TTS voices available in male and female variants. The voice selection matches your companion's gender setting.",
      steps: [
        "Set your companion gender in Settings (female → female voice, male → male voice).",
        "Chat in any language.",
        "Tap the speaker icon on a reply.",
        "You'll hear the reply in a voice matched to that language.",
      ],
      tiers: { free: "Basic (device voice)", plus: "Azure Neural voices", pro: "Azure Neural voices", ent: "Azure Neural voices", note: "Free uses device built-in voice. Plus+ unlocks language-matched Azure Neural voices." },
    },
    {
      icon: "📖",
      title: "Romanised Language Support",
      short: "Type Hindi, Bengali, or other Indic languages in Latin script — Imotara still understands.",
      long: "Many users type Indic languages using Latin characters (romanisation) — e.g., 'main bahut thaka hua hoon' instead of Devanagari. Imotara uses keyword frequency and two-hit threshold detection to identify romanised Indic languages and respond correctly.",
      steps: [
        "Type in romanised form: 'mujhe bahut anxious lag raha hai' (Hindi).",
        "Imotara detects Hindi from keywords like 'mujhe', 'lag raha'.",
        "Response comes in Hindi (Devanagari or romanised, matching your input).",
      ],
      tip: "Set your preferred language in Settings to help Imotara handle short or ambiguous romanised messages.",
    },
    {
      icon: "💬",
      title: "UI Language vs Chat Language",
      short: "The app UI is in English — but your chat responses can be in any of 22 languages.",
      long: "Currently, Imotara's UI (buttons, labels, settings text) is in English only. However, your companion's replies, TTS voices, and emotion detection all work in all 22 languages. A full UI localisation is planned for future versions.",
      steps: [
        "The app UI will always show in English.",
        "Your companion's replies will be in your detected or preferred language.",
        "To change the companion's reply language: Settings → Tone & Context → Preferred language.",
      ],
    },
  ],
};

// ─── Tier availability badge strip ───────────────────────────────────────────

const TIER_DEFS = [
  { key: "free",  label: "Free",  color: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
  { key: "plus",  label: "Plus",  color: "bg-sky-500/20  text-sky-300  border-sky-400/30" },
  { key: "pro",   label: "Pro",   color: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30" },
  { key: "ent",   label: "Ent",   color: "bg-violet-500/20 text-violet-300 border-violet-400/30" },
] as const;

function TierBadges({ tiers }: { tiers?: TierAvail }) {
  if (!tiers) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
        ✓ All plans
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {TIER_DEFS.map(({ key, label, color }) => {
        const val = tiers[key as "free" | "plus" | "pro" | "ent"];
        const included  = val === true;
        const limited   = val === "limited";
        const excluded  = val === false;
        const custom    = typeof val === "string" && val !== "limited";
        return (
          <span
            key={key}
            title={custom ? String(val) : undefined}
            className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-opacity ${
              excluded ? "opacity-30 bg-zinc-800 border-zinc-700 text-zinc-500" :
              limited  ? `${color} opacity-70` :
              custom   ? `${color}` :
                         `${color}`
            }`}
          >
            {excluded ? "✗" : limited ? "~" : included ? "✓" : "★"} {label}
            {custom && !excluded && (
              <span className="opacity-70 ml-0.5 truncate max-w-[60px]" style={{ fontSize: "9px" }}>
                {String(val).length > 8 ? String(val).slice(0,7)+"…" : String(val)}
              </span>
            )}
          </span>
        );
      })}
      {tiers.note && (
        <span className="text-[10px] text-zinc-500 italic">{tiers.note}</span>
      )}
    </span>
  );
}

// ─── Expandable feature card ──────────────────────────────────────────────────

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const [open, setOpen] = useState(false);
  const hasRestriction = feature.tiers &&
    (feature.tiers.free === false || typeof feature.tiers.free === "string" ||
     feature.tiers.plus === false || feature.tiers.pro === false);

  return (
    <div className={`rounded-2xl border overflow-hidden ${hasRestriction ? "border-white/10" : "border-white/8"} bg-white/[0.025]`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-xl mt-0.5 shrink-0">{feature.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="text-sm font-semibold text-zinc-100">{feature.title}</h3>
          </div>
          {/* Tier badges — always visible on the collapsed card */}
          <div className="mb-1.5">
            <TierBadges tiers={feature.tiers} />
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">{feature.short}</p>
        </div>
        <span className="text-zinc-600 text-sm mt-0.5 shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-white/5 space-y-4 pt-4">
          {/* Overview */}
          <p className="text-sm text-zinc-300 leading-7">{feature.long}</p>

          {/* Steps */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Step by step</p>
            <div className="space-y-2">
              {feature.steps.map((step, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-400/25 text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-zinc-400 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tip */}
          {feature.tip && (
            <div className="flex gap-2.5 rounded-xl bg-amber-500/8 border border-amber-400/20 px-4 py-3">
              <span className="text-base shrink-0">💡</span>
              <p className="text-xs text-amber-200/80 leading-relaxed">{feature.tip}</p>
            </div>
          )}

          {/* Tier detail table when there's a restriction */}
          {feature.tiers && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="px-4 py-2 border-b border-white/5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Plan availability</p>
              </div>
              <div className="grid grid-cols-4 divide-x divide-white/5">
                {TIER_DEFS.map(({ key, label, color }) => {
                  const val = feature.tiers![key as "free" | "plus" | "pro" | "ent"];
                  const excluded = val === false;
                  const custom   = typeof val === "string" && val !== "limited";
                  return (
                    <div key={key} className={`px-3 py-3 text-center ${excluded ? "opacity-40" : ""}`}>
                      <span className={`text-[10px] font-semibold rounded-full border px-1.5 py-0.5 ${excluded ? "bg-zinc-800 border-zinc-700 text-zinc-500" : color}`}>
                        {label}
                      </span>
                      <p className="text-[10px] mt-1.5 text-zinc-400 leading-tight">
                        {excluded ? "Not included" :
                         val === "limited" ? "Limited" :
                         custom ? String(val) :
                         "✓ Included"}
                      </p>
                    </div>
                  );
                })}
              </div>
              {feature.tiers.note && (
                <div className="px-4 py-2 border-t border-white/5">
                  <p className="text-[10px] text-zinc-500 italic">{feature.tiers.note}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TutorialPage() {
  const [activeTab, setActiveTab] = useState("start");
  const currentCat = CATEGORIES.find((c) => c.id === activeTab)!;
  const features = FEATURES[activeTab] ?? [];
  const totalFeatures = Object.values(FEATURES).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14 sm:px-6">

      {/* Hero */}
      <div className="mb-10 text-center">
        <Link href="/chat" className="mb-5 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition">
          ← Back to chat
        </Link>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-4">
          📘 Complete Tutorial
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
          Every Imotara feature,<br className="hidden sm:block" /> explained from scratch
        </h1>
        <p className="mt-3 max-w-2xl mx-auto text-sm text-zinc-400 leading-7">
          {totalFeatures} features across {CATEGORIES.length} categories — each with a quick summary, a full explanation, and step-by-step instructions. Tap any feature to expand it.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-6 text-center">
          {[
            { label: "Features covered", value: String(totalFeatures) },
            { label: "Settings explained", value: "30+" },
            { label: "Languages supported", value: "22" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xl font-bold text-zinc-100">{s.value}</p>
              <p className="text-xs text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Category tabs — scrollable horizontally on mobile */}
      <div className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0 border ${
                activeTab === cat.id
                  ? "bg-indigo-500/20 border-indigo-400/30 text-indigo-200"
                  : "bg-white/5 border-white/8 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="ml-1 text-[10px] opacity-60">
                {FEATURES[cat.id]?.length ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Category banner illustration */}
      {BANNERS[activeTab] && (
        <div className="mb-6">
          {BANNERS[activeTab]}
        </div>
      )}

      {/* Category header */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-2xl">{currentCat.icon}</span>
        <div>
          <h2 className="text-lg font-bold text-zinc-100">{currentCat.label}</h2>
          <p className="text-xs text-zinc-500">{features.length} features — tap any card to expand full details</p>
        </div>
      </div>

      {/* Feature cards */}
      <div className="space-y-3">
        {features.map((f, i) => (
          <FeatureCard key={f.title} feature={f} index={i} />
        ))}
      </div>

      {/* Bottom nav between sections */}
      <div className="mt-8 flex justify-between gap-3">
        {(() => {
          const idx = CATEGORIES.findIndex((c) => c.id === activeTab);
          const prev = CATEGORIES[idx - 1];
          const next = CATEGORIES[idx + 1];
          return (
            <>
              {prev ? (
                <button
                  onClick={() => setActiveTab(prev.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition"
                >
                  ← {prev.icon} {prev.label}
                </button>
              ) : <span />}
              {next ? (
                <button
                  onClick={() => setActiveTab(next.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition"
                >
                  {next.icon} {next.label} →
                </button>
              ) : (
                <Link
                  href="/chat"
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-400/30 bg-indigo-500/15 px-4 py-2 text-xs text-indigo-300 hover:bg-indigo-500/25 transition"
                >
                  Open chat →
                </Link>
              )}
            </>
          );
        })()}
      </div>

      {/* Footer CTA */}
      <div className="mt-10 rounded-3xl border border-indigo-400/20 bg-indigo-500/8 p-8 text-center">
        <p className="text-2xl mb-3">💙</p>
        <h3 className="text-lg font-bold text-zinc-100 mb-2">Ready to begin?</h3>
        <p className="text-zinc-400 text-sm mb-5 max-w-sm mx-auto">
          Imotara is always here — no appointments, no waiting. Just open Chat and say whatever's on your mind.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/chat" className="rounded-xl bg-indigo-600 hover:bg-indigo-500 transition px-5 py-2.5 text-sm font-semibold text-white">
            Open chat →
          </Link>
          <Link href="/upgrade" className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition px-5 py-2.5 text-sm font-semibold text-zinc-300">
            View plans
          </Link>
          <Link href="/guide" className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition px-5 py-2.5 text-sm font-semibold text-zinc-300">
            Quick start guide
          </Link>
        </div>
      </div>
    </div>
  );
}
