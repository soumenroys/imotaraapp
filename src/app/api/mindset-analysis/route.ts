// src/app/api/mindset-analysis/route.ts
//
// Psychological analysis of user chat messages for the Mindset capsules.
// POST { messages: string[], period: string }
// Returns { analysis: string, advice: string }

import { NextResponse } from "next/server";
import { callImotaraAI } from "@/lib/imotara/aiClient";
import { supabaseUserServer } from "@/lib/supabase/userServer";

const PSYCH_SYSTEM = `You are a warm, expert psychological analyst — like a compassionate therapist who also writes insightfully. You will receive a set of messages a person wrote in a personal journal-like chat with an emotional support companion. Your job is to:

1. ANALYSIS: Identify the emotional and psychological themes present in their language. Look at: recurring emotions or worries, language patterns (catastrophising, self-criticism, projection, hope, resilience), what topics appear most frequently, and what the overall psychological state suggests. Explain your reasoning in 2–3 sentences, as if you're a trusted counsellor sharing an observation — not a clinical report. Be specific to what you actually see in the text.

2. ADVICE: Offer 2–3 sentences of warm, practical guidance for the person's wellbeing based on what you found. Make it feel personal, not generic. Acknowledge what they're going through before suggesting what might help.

Tone rules:
- Warm and human — never cold, clinical, or diagnostic
- Specific to the actual content provided — never vague platitudes
- Non-judgmental and validating
- Use "you" and first-person language naturally

Output format (IMPORTANT — return valid JSON only, no markdown, no extra text):
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
    const prompt = `Here are the messages this person shared with their emotional support companion during ${period}. Analyse them as described.\n\nMessages:\n${sample.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;

    const result = await callImotaraAI(prompt, {
      system: PSYCH_SYSTEM,
      maxTokens: 400,
      temperature: 0.65,
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
