// src/app/api/mindset-analysis/route.ts
//
// Psychological analysis of user chat messages for the Mindset capsules.
// POST { messages: string[], period: string }
// Returns { analysis: string, advice: string }

import { NextResponse } from "next/server";
import { callImotaraAI } from "@/lib/imotara/aiClient";
import { supabaseUserServer } from "@/lib/supabase/userServer";

const PSYCH_SYSTEM = `You are a psychologically attuned observer — part therapist, part poet — writing deeply personal insight for someone about their own mind and heart. You receive messages they shared in a private emotional companion app.

Your task: two sections.

ANALYSIS (3–5 sentences): See their inner world with clinical depth but express it in warm, personal language. Specifically look for:
- Schema patterns: Are they caught in shame or self-defectiveness loops ("I'm not enough", "I always fail")? Abandonment fears ("everyone eventually leaves")? Feeling trapped or without choice? Chronic mistrust or betrayal wounds?
- Secondary emotions: What lies beneath the surface feeling? Shame beneath anger. Fear beneath withdrawal. Grief beneath irritability. Loneliness beneath busyness or numbness.
- SDT gaps: Which core psychological needs are chronically unmet — autonomy (feeling controlled, constrained, no say in their own life), competence (feeling ineffective, falling short), or relatedness (feeling unseen, disconnected, not truly known)?
- Repetition compulsion: Are they drawn back to the same situations, dynamics, or types of pain repeatedly?
- Post-Traumatic Growth: Is any growth visible — a realization, an acceptance, a new perspective emerging after difficulty?
Write as a wise, warm friend who sees people with unusual clarity. Be specific to what you actually read in their messages. Never use clinical labels — translate everything into felt, human language. If you see a self-critical loop, name it exactly: "There's a voice in you that keeps saying..." If you see loneliness, name it precisely: not the absence of people, but the ache of not being truly known.

ADVICE (2–3 sentences): Offer something genuinely useful — not platitudes, not generic wellness tips. First acknowledge exactly what they are carrying — name it, sit with it. If you see a schema loop, name it gently before offering any reframe. If there is growth visible, celebrate it as a beginning, not an end. If there is loneliness, do not minimize it with silver linings. Meet them where they are, then offer one honest, possible next thing.

Tone: Intimate. Honest. Non-clinical. Like a letter from someone who truly sees them — not a report written about them.

Output: Return ONLY valid JSON, no markdown, no extra text:
{"analysis":"...","advice":"..."}`;

export async function POST(req: Request) {
  try {
    const supabase = await supabaseUserServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const messages: string[] = Array.isArray(body.messages) ? body.messages : [];
    const period: string = typeof body.period === "string" ? body.period : "this period";

    if (messages.length === 0) {
      return NextResponse.json({ analysis: "", advice: "" });
    }

    // Cap at 60 messages to stay within context limits
    const sample = messages.slice(-60);
    const prompt = [
      `Here are the messages this person shared with their emotional companion during ${period}.`,
      `Read them with the eyes of someone who truly sees people — not just what is said, but what is felt underneath.`,
      `Look for the recurring patterns, the unspoken aches, and any signs of growth or insight.`,
      `The messages may be in any of 22 supported languages (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu, Arabic, Chinese, Japanese, Spanish, French, German, Portuguese, Russian, Indonesian, Hebrew, English). Read them in their original language. Write your analysis and advice in the same language the messages are written in.`,
      ``,
      `Messages:`,
      sample.map((m, i) => `${i + 1}. ${m}`).join("\n"),
    ].join("\n");

    const result = await callImotaraAI(prompt, {
      system: PSYCH_SYSTEM,
      maxTokens: 600,
      temperature: 0.7,
    });

    if (!result.text) {
      return NextResponse.json({ analysis: "", advice: "" });
    }

    // Parse JSON from AI response — handle both clean JSON and markdown-wrapped JSON
    let parsed: { analysis?: string; advice?: string } = {};
    try {
      const cleaned = result.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, try to extract fields with regex
      const aMatch = result.text.match(/"analysis"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const vMatch = result.text.match(/"advice"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      parsed = {
        analysis: aMatch?.[1]?.replace(/\\n/g, "\n") ?? "",
        advice: vMatch?.[1]?.replace(/\\n/g, "\n") ?? "",
      };
    }

    return NextResponse.json({
      analysis: parsed.analysis ?? "",
      advice: parsed.advice ?? "",
    });
  } catch (err) {
    console.error("[mindset-analysis]", err);
    return NextResponse.json({ analysis: "", advice: "" }, { status: 500 });
  }
}
