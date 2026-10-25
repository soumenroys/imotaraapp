// src/lib/social/trends.ts
// What people are talking about this week — chosen OUTSIDE the writer, checked,
// and handed to it, like the untranslatable word.
//
// 🔑 OWNER, 24 Oct 2026: social content should be driven by "social media
// specific users and latest trends … aligned with imotara interest".
//
// Two sources:
//   · AWARENESS DAYS — a fixed calendar of dates that genuinely fit a wellbeing
//     companion (Mother Language Day, World Mental Health Day …). Safe by
//     construction; active from three days before the day until it ends.
//   · TRENDING SEARCHES — Google's public daily trends feed (India, US). Most
//     of it is cricket, film stars and news; for a mental-health brand almost
//     all of that must be refused ⇒ two filters, both required:
//       1. a word filter in code (death, violence, crime, politics, disaster …);
//       2. a judgement step that keeps a topic only when Imotara has a genuine,
//          respectful angle on it, and writes that angle down.
//
// ⛔ THE WRITER NEVER PICKS A TREND AND NEVER ADDS FACTS ABOUT ONE. It is handed
// the topic, why it matters to people, and the angle — and told to add nothing
// about the event itself ⇒ writer.ts. A wrong "fact" about a trending story is
// the most public mistake this feature could make.
//
// ⚠️ Kept in app_settings (no migration). The admin can remove any note
// ⇒ /admin/social/trends.

import type { SupabaseClient } from "@supabase/supabase-js";
import { callImotaraAI } from "@/lib/imotara/aiClient";

const KEY = "social_trends";

export type TrendNote = {
  id: string;
  /** The moment, in plain words, e.g. "Sharad Purnima" or "International Mother Language Day". */
  topic: string;
  /** Why people care about it right now — no claims about the event beyond this. */
  why: string;
  /** How Imotara genuinely connects — one true thing, said with respect. */
  angle: string;
  source: "awareness-day" | "google-trends-IN" | "google-trends-US";
  activeFrom: string;
  expiresAt: string;
  addedAt: string;
  removed?: boolean;
};

export type TrendState = { notes: TrendNote[]; rejected: { topic: string; why: string }[]; refreshedAt: string | null };

/**
 * ⛔ Only dates that are fixed, well established, and fit a wellbeing companion.
 * Deliberately absent: days about suicide or self-harm (a public post cannot
 * follow up), children's days (the product is not for children), and any
 * festival whose date moves with the lunar calendar (a wrong date is a public
 * mistake) — those arrive, correctly dated, through the trends feed instead.
 */
export const AWARENESS_DAYS: { month: number; day: number; name: string; why: string; angle: string }[] = [
  { month: 1, day: 24, name: "International Day of Education", why: "A day about learning and the people who do it.", angle: "Students and teachers carry a lot quietly; a private place to think aloud, in their own language." },
  { month: 2, day: 21, name: "International Mother Language Day", why: "A day for the languages people grow up in.", angle: "Feelings arrive in the language you grew up with — Imotara listens in 22, eleven of them Indian." },
  { month: 3, day: 20, name: "International Day of Happiness", why: "A day that asks what actually makes people well.", angle: "Not forced cheer — room to say how you really are, without a streak or a score." },
  { month: 4, day: 7, name: "World Health Day", why: "A day about health, including the kind nobody sees.", angle: "Emotional health is part of health; a private companion you can talk to any hour." },
  { month: 5, day: 21, name: "World Day for Cultural Diversity", why: "A day for the many ways people live and speak.", angle: "There is no single way to say how you feel — 22 languages, Roman script too." },
  { month: 6, day: 1, name: "Global Day of Parents", why: "A day for parents, who rarely get asked how they are.", angle: "Parents put themselves last; a private, unhurried place to put words to the day." },
  { month: 7, day: 30, name: "International Day of Friendship", why: "A day about friendship and being heard.", angle: "Sometimes the thing you can't yet say to a friend needs saying somewhere first." },
  { month: 8, day: 12, name: "International Youth Day", why: "A day for young adults and what they carry.", angle: "Exams, first jobs, moving away — a private place to think it through, no feed, no audience." },
  { month: 9, day: 5, name: "Teachers' Day (India)", why: "India thanks its teachers.", angle: "Teachers hold everyone else's worries all day; something that asks how they are." },
  { month: 10, day: 1, name: "International Day of Older Persons", why: "A day for older people and the people who care for them.", angle: "Speak instead of type, in your own language, and it remembers what mattered last time." },
  { month: 10, day: 10, name: "World Mental Health Day", why: "The world's day for mental health.", angle: "What Imotara is and is not: a private companion, not therapy — and it shows a helpline when needed." },
  { month: 11, day: 13, name: "World Kindness Day", why: "A day about kindness, including towards yourself.", angle: "Being kind starts with being honest about how you are — somewhere nobody judges." },
  { month: 11, day: 21, name: "World Hello Day", why: "A day for saying hello and starting a conversation.", angle: "The first hello is the hardest; Imotara is there to talk to, any hour, even offline." },
  { month: 12, day: 3, name: "International Day of Persons with Disabilities", why: "A day for access and inclusion.", angle: "Type or speak — whichever works for you, in your own language." },
  { month: 12, day: 5, name: "International Volunteer Day", why: "A day for volunteers and the NGOs they keep going.", angle: "Volunteers give a lot and say little about it; a private place for them too." },
];

/** ⛔ Refused before any judgement step sees it — in English and the commonest Hindi words. */
const BLOCKED_EN = /\b(death|dead|dies|died|killed|kill|murder|accident|crash|attack|blast|bomb|war|terror|terrorist|arrest|arrested|rape|assault|suicide|self[- ]harm|shooting|stabbed|riot|protest|election|elections|vote|voting|minister|mla|mp|bjp|congress|aap|court|verdict|bail|scam|scandal|flood|earthquake|cyclone|disaster|tragedy|funeral|condolence|rip)\b/i;
// ⚠️ \b does not work around Devanagari letters, so Hindi words are matched plainly.
const BLOCKED_HI = /(हत्या|मौत|मृत्यु|हादसा|चुनाव|आतंक|दुर्घटना)/;
export const isBlocked = (text: string) => BLOCKED_EN.test(text) || BLOCKED_HI.test(text);

export type Candidate = { topic: string; context: string; source: TrendNote["source"] };

/** Google's daily trends RSS ⇒ titles plus the first news headline as context. */
export function parseTrendsRss(xml: string, source: Candidate["source"]): Candidate[] {
  const out: Candidate[] = [];
  for (const item of xml.split("<item>").slice(1)) {
    const title = /<title>([^<]+)<\/title>/.exec(item)?.[1]?.trim();
    const news = /<ht:news_item_title>([^<]+)</.exec(item)?.[1]?.trim() ?? "";
    if (title) out.push({ topic: decode(title), context: decode(news), source });
  }
  return out;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Awareness days whose window (3 days before → end of the day) touches the next `days` days. */
export function upcomingAwarenessDays(now: Date, days = 14): TrendNote[] {
  const out: TrendNote[] = [];
  for (const y of [now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
    for (const a of AWARENESS_DAYS) {
      const day = Date.UTC(y, a.month - 1, a.day);
      const from = day - 3 * 86_400_000;
      const until = day + 86_400_000;
      if (until < now.getTime() || from > now.getTime() + days * 86_400_000) continue;
      out.push({
        id: `day:${y}-${a.month}-${a.day}`, topic: a.name, why: a.why, angle: a.angle, source: "awareness-day",
        activeFrom: new Date(from).toISOString(), expiresAt: new Date(until).toISOString(), addedAt: now.toISOString(),
      });
    }
  }
  return out;
}

export function judgePrompt(candidates: Candidate[]): string {
  return `
You choose which of this week's trending topics a mental-wellbeing companion app (Imotara) may post about.
Imotara: a private companion for saying how you actually feel; 22 languages (11 Indian); works offline; no feed or streaks; NOT therapy.

KEEP a topic only if ALL are true:
- It is a shared, positive or neutral moment: a festival, a holiday, a season, exam or results season, a cultural event, a broad everyday experience.
- Imotara has a GENUINE, respectful connection to it (feelings, language, family, pressure, rest, togetherness) — not a forced one.
- Posting about it could not hurt or offend anyone, and needs no facts about the event itself.

REFUSE anything about: a named person (celebrity, athlete, politician), sports results or players, politics, religion in conflict,
crime, death, illness, accidents, disasters, war, business or markets, gossip, or anything you are unsure of. When in doubt, refuse.

For each KEPT topic write: "why" — one plain line on why people care right now, with NO claims of fact about the event;
"angle" — one line on how Imotara genuinely connects. Keep at most 4.

Topics (with one news headline for context, which may be in another language):
${candidates.map((c, i) => `${i + 1}. ${c.topic} — ${c.context}`).join("\n")}

Reply with JSON only: {"kept":[{"n":1,"topic":"...","why":"...","angle":"..."}],"refused":[{"n":2,"why":"..."}]}
`.trim();
}

export async function readTrends(supabase: SupabaseClient): Promise<TrendState> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const v = (data?.value ?? {}) as Partial<TrendState>;
  return { notes: v.notes ?? [], rejected: v.rejected ?? [], refreshedAt: v.refreshedAt ?? null };
}

async function writeTrends(supabase: SupabaseClient, s: TrendState): Promise<void> {
  const { error } = await supabase.from("app_settings").upsert({ key: KEY, value: s, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Could not save trends: ${error.message}`);
}

/**
 * The notes a post may use — not removed, not yet expired. ⚠️ Includes ones whose
 * window is still AHEAD: posts are written up to ten days early, and the pipeline
 * matches each note to the post's own day (review, 24 Oct: filtering by "active
 * now" meant no post written ahead could ever use one).
 */
export function activeNotes(s: TrendState, now = new Date()): TrendNote[] {
  const t = now.getTime();
  return s.notes.filter((n) => !n.removed && Date.parse(n.expiresAt) > t);
}

export async function activeTrends(supabase: SupabaseClient, now = new Date()): Promise<TrendNote[]> {
  return activeNotes(await readTrends(supabase), now);
}

/** Which note a post uses, rotated like the angles ⇒ pipeline.nextPool. */
export function pickTrend(notes: TrendNote[], postsSoFar: number): TrendNote | null {
  return notes.length ? notes[postsSoFar % notes.length] : null;
}

async function fetchFeed(geo: "IN" | "US"): Promise<Candidate[]> {
  const res = await fetch(`https://trends.google.com/trending/rss?geo=${geo}`, { headers: { "user-agent": "Mozilla/5.0 (Imotara trends)" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Google Trends ${geo} answered ${res.status}`);
  return parseTrendsRss(await res.text(), geo === "IN" ? "google-trends-IN" : "google-trends-US");
}

/**
 * Refresh the week's notes: awareness days + filtered trends. Keeps notes an
 * admin removed (so they stay removed) and those still active.
 */
export async function refreshTrends(supabase: SupabaseClient, now = new Date()): Promise<TrendState> {
  const prev = await readTrends(supabase);
  const removed = new Set(prev.notes.filter((n) => n.removed).map((n) => n.topic.toLowerCase()));
  const notes: TrendNote[] = upcomingAwarenessDays(now).map((n) => (removed.has(n.topic.toLowerCase()) ? { ...n, removed: true } : n));
  // ⚠️ Kept across refreshes: removed notes (so "Never use this" holds) and trends still inside their window.
  for (const n of prev.notes) {
    if (n.source === "awareness-day" || Date.parse(n.expiresAt) <= now.getTime()) continue;
    if (!notes.some((x) => x.topic.toLowerCase() === n.topic.toLowerCase())) notes.push(n);
  }
  const rejected: TrendState["rejected"] = [];

  const feeds = await Promise.allSettled([fetchFeed("IN"), fetchFeed("US")]);
  const candidates: Candidate[] = [];
  feeds.forEach((f, i) => {
    if (f.status === "fulfilled") candidates.push(...f.value.slice(0, 20));
    else rejected.push({ topic: `(trending searches, ${i === 0 ? "India" : "US"})`, why: `Could not be read: ${(f.reason as Error)?.message ?? f.reason}` });
  });
  // Filter 1 — words.
  const passed = candidates.filter((c) => {
    if (isBlocked(`${c.topic} ${c.context}`)) { rejected.push({ topic: c.topic, why: "blocked word (death, violence, politics …)" }); return false; }
    return true;
  });
  // Filter 2 — judgement.
  if (passed.length) {
    try {
      const res = await callImotaraAI(judgePrompt(passed), { system: "You are a careful editor for a mental-wellbeing brand. When in doubt, refuse. JSON only.", maxTokens: 900, temperature: 0.2, abortMs: 45_000, feature: "trends" });
      const text = res.text ?? "";
      const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { kept?: { n: number; topic: string; why: string; angle: string }[]; refused?: { n: number; why: string }[] };
      for (const k of (j.kept ?? []).slice(0, 4)) {
        const c = passed[k.n - 1];
        if (!c || isBlocked(`${k.topic} ${k.why} ${k.angle}`) || removed.has(k.topic.toLowerCase())) continue;
        if (notes.some((x) => x.topic.toLowerCase() === k.topic.toLowerCase())) continue;
        notes.push({
          id: `trend:${c.source}:${k.topic.toLowerCase().replace(/\s+/g, "-").slice(0, 60)}`, topic: k.topic, why: k.why, angle: k.angle, source: c.source,
          activeFrom: now.toISOString(), expiresAt: new Date(now.getTime() + 4 * 86_400_000).toISOString(), addedAt: now.toISOString(),
        });
      }
      for (const r of j.refused ?? []) { const c = passed[r.n - 1]; if (c) rejected.push({ topic: c.topic, why: r.why }); }
    } catch (e) {
      rejected.push({ topic: "(this week's trending searches)", why: `Could not be judged, so none were used: ${(e as Error).message}` });
    }
  }
  const state: TrendState = { notes, rejected: rejected.slice(0, 40), refreshedAt: now.toISOString() };
  await writeTrends(supabase, state);
  return state;
}

/** An admin removes a note — it is never used again, and stays removed on the next refresh. */
export async function removeTrend(supabase: SupabaseClient, id: string): Promise<void> {
  const s = await readTrends(supabase);
  s.notes = s.notes.map((n) => (n.id === id ? { ...n, removed: true } : n));
  await writeTrends(supabase, s);
}
