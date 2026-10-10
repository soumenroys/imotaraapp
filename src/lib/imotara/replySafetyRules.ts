// src/lib/imotara/replySafetyRules.ts
/**
 * The safety rules that EVERY system prompt must carry, in one place.
 *
 * 🔴 WHY THIS FILE EXISTS. /api/chat-reply builds TWO system prompts:
 *
 *   `prompt`          the full therapeutic framework (thousands of lines)
 *   `romanizedPrompt` a short one, used when the person types their own
 *                     language in Latin letters ("ami valo achi")
 *
 * ⚠️ The second REPLACES the first — it is not merged. That is deliberate and
 * must stay: the route records that the full prompt makes the model abandon
 * romanized script and answer in native script or English instead. Merging
 * them would fix a maintenance problem by breaking the output, for the users
 * least able to read a native-script reply.
 *
 * 🔴 BUT THE SAFETY RULES WERE DUPLICATED STRING LITERALS, and that is how
 * they go missing. Found in the 2026-08-14 pre-release review: the whole
 * crisis-safety framework and the Connect referral rule were silently absent
 * from the romanized prompt, and a romanized-Hindi message carrying BOTH
 * crisis and loneliness signals got a warm reply with no crisis referral at
 * all. They were hand-ported afterwards — leaving two copies, and the next
 * rule one edit away from the same hole.
 *
 * 🔑 So the prompts stay separate and the SAFETY RULES become shared. Adding a
 * rule here puts it on both paths. Adding one to a prompt array puts it on
 * one, and `replySafetyRules.test.ts` fails.
 *
 * ⛔ Every string below is BYTE-IDENTICAL to what the route sent before this
 * extraction, pinned by that test against a captured fixture. A prompt string
 * is not a comment — rewording one changes what the model says to someone in
 * crisis. Do not "tidy" these.
 */

/**
 * How much room the prompt has.
 *
 * `full`  — the main prompt. No length pressure.
 * `brief` — the romanized prompt, which holds itself to "1-2 sentences", so
 *           the rules are shortened. ⚠️ Shortened in WORDING only: every rule
 *           present in `full` is present in `brief`, which the test enforces
 *           rule by rule.
 */
export type SafetyVariant = "full" | "brief";

/** The baseline. Unconditional — it goes in every prompt, every turn. */
export const SAFETY_BASELINE: Record<SafetyVariant, string> = {
    full: "No medical, diagnostic, or crisis instructions. If serious risk appears, encourage reaching out to trusted people and local professional crisis services — always lead with that.",
    brief: "No medical, diagnostic, or crisis instructions. If serious risk appears, encourage reaching out to trusted people and local professional crisis services — always lead with that, even in a short reply.",
};

/**
 * The Connect referral rule, stated in the body of the prompt.
 *
 * ⚠️ The `full` text carries the crisis EXCEPTION inline, because the full
 * prompt states the rule unconditionally and the model has to know when it
 * does not apply. The `brief` text is only ever included when
 * `isLonelyOrWantsCompany` is true — which is already false whenever crisis
 * language is present — so it needs no exception clause.
 */
export const CONNECT_REFERRAL_RULE: Record<SafetyVariant, string> = {
    full: "CONNECT REFERRAL RULE: If the user explicitly says (in ANY language) that they are lonely, have no one to talk to, or wish they had someone real/human to talk to — you MUST, in that same reply, name 'Imotara Connect' as a place to talk to a real person one-on-one, e.g. 'you can also talk to a real person through Imotara Connect if you want company.' Say this plainly, alongside your own presence, not as a replacement for it. This is peer support only — NEVER call a Connect companion a therapist, counsellor, doctor, or any kind of licensed/medical professional. EXCEPTION: if the user has also expressed thoughts of suicide, self-harm, or ending their life anywhere in this conversation, do NOT mention Connect — the trusted-person/professional-crisis-service referral above must be the ONLY referral in your reply.",
    brief: "If the user is lonely / has no one to talk to / wishes they had someone real to talk to, you MUST name 'Imotara Connect' as a place to talk to a real person one-on-one — peer support only, never call it therapy or a licensed professional.",
};

/**
 * The near-end reminders.
 *
 * 🔑 These exist because a buried instruction proved unreliable in live
 * testing: the model reliably ignored an in-prompt-only instruction to name
 * Connect, so the rule is repeated where recall is strongest. The same
 * technique as scriptMirrorInstruction and contextAnchor.
 *
 * ⛔ Which means these carry MORE weight than the body rules, and a
 * contradiction here would be worse than one anywhere else. See
 * safetyEndReminders.
 */
export const CONNECT_REMINDER: Record<SafetyVariant, string> = {
    full: "REMINDER — CONNECT REFERRAL RULE (repeated near end for recall): The user said they're lonely / have no one to talk to / wish they had someone real to talk to. You MUST name 'Imotara Connect' in this reply as a place to talk to a real person one-on-one — peer support only, never call it therapy or a licensed professional.",
    brief: "REMINDER: Name 'Imotara Connect' in this reply as a place to talk to a real person one-on-one — peer support only, never therapy or a licensed professional.",
};

export const CRISIS_REMINDER: Record<SafetyVariant, string> = {
    full: "REMINDER — CRISIS SAFETY (repeated near end for recall): The user has expressed thoughts of suicide, self-harm, or ending their life. Do NOT mention Imotara Connect anywhere in this reply, in any language. Your only referral must be to a trusted person and/or local professional crisis services.",
    brief: "REMINDER — CRISIS SAFETY: The user has expressed thoughts of suicide, self-harm, or ending their life. Do NOT mention Imotara Connect anywhere in this reply, in any language. Your only referral must be to a trusted person and/or local professional crisis services.",
};

/** What the route knows about this turn that changes the safety rules. */
export type SafetySignals = {
    /** Suicide / self-harm language anywhere in the recent window. */
    isCrisisAdjacent: boolean;
    /** Loneliness language — ⚠️ already false whenever isCrisisAdjacent. */
    isLonelyOrWantsCompany: boolean;
};

/**
 * The reminder to repeat near the end of the prompt, or "" for neither.
 *
 * 🔴 AT MOST ONE, AND CRISIS WINS. The two reminders directly contradict each
 * other — one says "you MUST name Imotara Connect", the other "do NOT mention
 * Imotara Connect anywhere in this reply, in any language" — and because they
 * sit where recall is strongest, emitting both would leave the most heavily
 * weighted instruction in the prompt undecided, for someone who has just
 * mentioned ending their life.
 *
 * ⚠️ Today that cannot happen: `isLonelyOrWantsCompany` is computed as
 * `!isCrisisAdjacent && …`, from live testing where the Connect reminder
 * "crowded out the professional/trusted-person crisis referral entirely — the
 * reply mentioned ONLY Connect".
 *
 * 🔑 This function does not TRUST that. The exclusion lives 3,300 lines away
 * from the prompt and nothing warned about it; deleting the `!isCrisisAdjacent`
 * term would read as a harmless simplification and would silently put a
 * suicidal person back in front of a peer-support referral. So the precedence
 * is restated here, where the contradiction actually lives.
 */
export function safetyEndReminders(
    signals: SafetySignals,
    variant: SafetyVariant,
): string {
    if (signals.isCrisisAdjacent) return CRISIS_REMINDER[variant];
    if (signals.isLonelyOrWantsCompany) return CONNECT_REMINDER[variant];
    return "";
}

/**
 * Every rule this module owns, for the drift test.
 *
 * ⛔ Adding a safety rule means adding it here too, or the test cannot tell
 * the difference between "deliberately absent" and "forgotten".
 */
export const SAFETY_RULE_IDS = [
    "baseline", "connect-referral", "connect-reminder", "crisis-reminder",
] as const;

export function safetyRuleText(
    id: (typeof SAFETY_RULE_IDS)[number],
    variant: SafetyVariant,
): string {
    switch (id) {
        case "baseline":         return SAFETY_BASELINE[variant];
        case "connect-referral": return CONNECT_REFERRAL_RULE[variant];
        case "connect-reminder": return CONNECT_REMINDER[variant];
        case "crisis-reminder":  return CRISIS_REMINDER[variant];
    }
}
