import { describe, it, expect } from "vitest";
import { formatImotaraReply } from "@/lib/imotara/response/responseFormatter";

/**
 * Measured 26 Oct 2026 on /api/chat-reply (non-streaming): Chinese and Japanese
 * replies to a heavy message came back as
 *
 *   "ええ! 全部ひとりで抱えている感じ、相当しんどいよね。…最近特に強くなったのはどんなとき。
 *    急がなくていい。小さな一歩、それから次の一歩。"
 *
 * The formatter's "already a complete reply" check listed the Arabic "؟" twice
 * and never the full-width "？" that Chinese and Japanese use. So a reply
 * ending in a question looked unfinished: a canned opener ("真的吗？", "ええ!")
 * was put in front of a sad message, the model's own question was turned into
 * a full stop (one question per reply — the opener had taken it), and a stock
 * closing line was added.
 */
const JA = "全部ひとりで抱えている感じ、相当しんどいよね。その「ひとりで」という感覚、最近特に強くなったのはどんなとき？";
const ZH = "你说“只有我一个人在扛”，那种孤单真的很难受。你最近有没有哪怕一小会儿，是只属于自己的、能松一口气的时刻？";

describe("a Chinese or Japanese reply ending in ？ is left as the model wrote it", () => {
    it.each([
        ["ja", JA, "最近の仕事も家族も、全部いっぺんに。ひとりで抱えている気がします。"],
        ["zh", ZH, "工作和家庭，所有事情一起压过来。我觉得只有我一个人在扛。"],
    ])("%s", (lang, raw, userMessage) => {
        const out = formatImotaraReply({ raw, lang, userMessage, seed: "t" });
        expect(out).toBe(raw);
        expect(out.endsWith("？")).toBe(true);
        expect(out).not.toMatch(/^(ええ|真的吗|哦！)/);
        expect(out).not.toMatch(/一小步|小さな一歩/);
    });
});
