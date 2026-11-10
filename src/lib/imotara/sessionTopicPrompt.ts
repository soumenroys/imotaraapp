// src/lib/imotara/sessionTopicPrompt.ts
// The one question /api/session-topic asks ⇒ welcomeBackTopic.ts (#16 C).
// Its own module because a Next.js route file may export only its handlers.

import { SESSION_TOPICS } from "@/lib/imotara/welcomeBackTopic";

/** The question. The list in the prompt IS the closed list. */
export function topicPrompt(): string {
    return [
        "You label a conversation with exactly ONE topic key from this list, or none.",
        `Allowed keys: ${SESSION_TOPICS.join(", ")}, none.`,
        "Meanings: work = job or workplace; studies = school, college, exams; family = parents, siblings, relatives, home;",
        "close_person = partner, spouse, a friend or someone dear; alone = loneliness, isolation; sleep; health = body, illness;",
        "money = finances, debt, expenses; loss = grief, death, a breakup or losing something dear; self_worth = confidence, self-doubt, how they see themselves;",
        "worry = general stress, anxiety, fear; good_news = something good that happened; overthinking = thoughts going round and round;",
        "stuck = feeling stuck, unmotivated, no direction; argument = a fight, conflict, anger at someone; caring = looking after someone ill, old or young;",
        "big_change = moving, a new job, marriage, a big life change.",
        "If the conversation is about self-harm, abuse, addiction or sexuality, or nothing fits clearly, answer none.",
        "Reply with the key only — one word, lowercase, nothing else.",
    ].join("\n");
}

