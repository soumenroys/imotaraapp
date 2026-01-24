// src/lib/ai/compat/compatibilityGate.ts

import type { ImotaraResponse } from "../response/responseBlueprint";

export type CompatIssue = {
    code:
    | "missing_message"
    | "message_too_long"
    | "followup_too_long"
    | "has_markdown"
    | "missing_meta"
    | "wrong_style_contract"
    | "wrong_blueprint";
    detail: string;
};

export type CompatReport = {
    ok: boolean;
    issues: CompatIssue[];
};

const LIMITS = {
    messageMax: 240,   // keep in sync with runImotara caps
    followUpMax: 200,
};

function looksLikeMarkdown(s: string): boolean {
    // Simple, conservative detector: we only care about obvious markdown tokens.
    return /[`*_#>[\]]|\[[^\]]+\]\([^)]+\)/.test(s);
}

export function compatibilityGate(resp: ImotaraResponse): CompatReport {
    const issues: CompatIssue[] = [];

    const msg = String(resp?.message ?? "").trim();
    const follow = typeof resp?.followUp === "string" ? resp.followUp.trim() : "";

    if (!msg) {
        issues.push({ code: "missing_message", detail: "message is empty" });
    }

    if (msg.length > LIMITS.messageMax) {
        issues.push({
            code: "message_too_long",
            detail: `message length ${msg.length} > ${LIMITS.messageMax}`,
        });
    }

    if (follow && follow.length > LIMITS.followUpMax) {
        issues.push({
            code: "followup_too_long",
            detail: `followUp length ${follow.length} > ${LIMITS.followUpMax}`,
        });
    }

    if ((msg && looksLikeMarkdown(msg)) || (follow && looksLikeMarkdown(follow))) {
        issues.push({ code: "has_markdown", detail: "message/followUp contains markdown-like tokens" });
    }

    const meta: any = (resp as any)?.meta;
    if (!meta) {
        issues.push({ code: "missing_meta", detail: "meta is missing" });
    } else {
        if (meta.styleContract !== "1.0") {
            issues.push({ code: "wrong_style_contract", detail: `styleContract=${String(meta.styleContract)}` });
        }
        if (meta.blueprint !== "1.0") {
            issues.push({ code: "wrong_blueprint", detail: `blueprint=${String(meta.blueprint)}` });
        }

        // ✅ Baby Step 11.2 — make tone enforcement measurable
        // Expect the response layer to echo applied tone choices here.
        if (!meta.toneEcho) {
            issues.push({
                code: "missing_meta",
                detail: "meta.toneEcho is missing (cannot verify companion/age/gender tone application)",
            });
        }
    }

    return { ok: issues.length === 0, issues };
}
