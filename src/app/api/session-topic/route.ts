// src/app/api/session-topic/route.ts
// POST — which ONE of our 17 topics was this conversation about? ⇒ the
// "Welcome back. Last time we talked about: <topic>" card (#16 C, owner 10 Nov 2026).
//
// ⛔ SEPARATE FROM THE REPLY. /api/chat-reply is not touched, and nothing here
// is shown to the model that writes replies.
// ⛔ CLOSED LIST: the model may answer only a key from SESSION_TOPICS or "none";
// anything else is "none" ⇒ trap_a_model_invents_specifics_it_cannot_have.
// ⛔ NOTHING IS STORED: the words are used for this one question and dropped; the
// device keeps only the topic key.
// ⛔ A crisis signal ⇒ "none" without asking the model at all (the card is not
// shown after a crisis anyway — this is the second lock).

import { NextResponse } from "next/server";
import { callImotaraAI } from "@/lib/imotara/aiClient";
import { getClientIp, checkPersistentIpRateLimit } from "@/lib/imotara/ipRateLimit";
import { CRISIS_HINT_REGEX, isCrisisTier2 } from "@/lib/emotion/keywordMaps";
import { isSessionTopic } from "@/lib/imotara/welcomeBackTopic";
import { topicPrompt } from "@/lib/imotara/sessionTopicPrompt";

const MAX_MESSAGES = 6;
const MAX_CHARS = 1500;

export async function POST(req: Request) {
    const ip = getClientIp(req);
    if (!(await checkPersistentIpRateLimit("session-topic", ip, 6, 60))) {
        return NextResponse.json({ topic: null }, { status: 429 });
    }

    let body: { messages?: unknown } | null = null;
    try { body = await req.json(); } catch { /* fall through */ }
    const texts = Array.isArray(body?.messages)
        ? (body!.messages as unknown[]).filter((m): m is string => typeof m === "string" && m.trim().length > 0).slice(-MAX_MESSAGES)
        : [];
    if (texts.length < 2) return NextResponse.json({ topic: null });

    // ⛔ second lock: a crisis signal never gets a topic.
    if (texts.some((t) => CRISIS_HINT_REGEX.test(t) || isCrisisTier2(t))) return NextResponse.json({ topic: null });

    const joined = texts.map((t) => `- ${t.trim()}`).join("\n").slice(0, MAX_CHARS);
    try {
        const ai = await callImotaraAI(`What the person wrote:\n${joined}`, {
            system: topicPrompt(),
            maxTokens: 5,
            temperature: 0,
            noFallback: true,
        });
        const word = String(ai?.text ?? "").trim().toLowerCase().replace(/[^a-z_]/g, "");
        return NextResponse.json({ topic: isSessionTopic(word) ? word : null });
    } catch {
        return NextResponse.json({ topic: null });
    }
}
