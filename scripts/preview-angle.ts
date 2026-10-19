/**
 * scripts/preview-angle.ts — see what one topic pool actually writes, locally.
 *
 * 🔴 WHY. A new angle is a piece of WRITING, and the only way to judge writing
 * is to read it. Until now the only route was: push the pool, deploy, sign
 * into the admin, press a button. So angles were reasoned about rather than
 * read — which is how a pool one step from listicle advice would have shipped
 * before anybody saw a single line of it.
 *
 *   npx tsx scripts/preview-angle.ts ways-of-saying
 *   npx tsx scripts/preview-angle.ts the-unsaid instagram
 *
 * ⛔ Writes nothing and claims nothing: no subject is reserved, no recipe is
 * spent. It is a read of the writer, not a dry run of the pipeline.
 */
import { readFileSync } from "node:fs";

/**
 * ⚠️ `.env.local` is read HERE, before anything that needs a key is imported.
 * `set -a; source .env.local` in the shell does not survive into the node
 * process reliably, and the failure is a confusing one: the writer reports a
 * TOTAL OUTAGE alert rather than "you forgot the key".
 */
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

import type { WriteRequest } from "@/lib/social/pipeline";

const [, , poolId = "ways-of-saying", platform = "instagram", language = "en"] = process.argv;

async function main() {
  /**
   * ⛔ SAID PLAINLY AND FIRST. Without a key the writer falls through to its
   * Gemini fallback and then reports "TOTAL OUTAGE — users are getting
   * template replies", which is alarming, about production, and not what is
   * happening. ⚠️ `.env.local` carries an EMPTY OPENAI_API_KEY on this
   * machine; the real one lives in Vercel ⇒ feedback_vercel_env_pull_clobbers_local.
   */
  const key = process.env.OPENAI_API_KEY ?? "";
  if (key.length < 20) {
    console.error(
      "⛔ No usable OPENAI_API_KEY in .env.local (found " + key.length + " characters).\n" +
        "   This script reads the real writer, so it needs a real key.\n" +
        "   ▶️ Either export one for this shell, or preview the angle in the admin:\n" +
        "     /admin/social/schedules → pick the pool → “See what it would write”.",
    );
    process.exit(1);
  }

  // ⚠️ Imported after the env is loaded, for the reason above.
  const { writeWithModel } = await import("@/lib/social/writer");
  const { TOPIC_POOLS } = await import("@/lib/social/topicPools");
  const { checkVoice, checkHouseStyle } = await import("@/lib/social/voiceGate");

  const pool = TOPIC_POOLS.find((p) => p.id === poolId);
  if (!pool) {
    console.error(`No pool "${poolId}". Have: ${TOPIC_POOLS.map((p) => p.id).join(", ")}`);
    process.exit(1);
  }

  const req: WriteRequest = {
    brief:
      "Take one capability of Imotara and say what it is for, in plain words, as a person would. " +
      "No slogans, and no claim to be therapy.",
    // ⚠️ The pool is selected by ID, exactly as the pipeline selects it.
    topicPool: [pool.id],
    platform,
    language,
    tone: "gentle_plain",
    lengthHint: "medium",
    avoid: [],
  };
  const written = await writeWithModel(req);

  console.log(`\n── ${pool.label} · ${platform} ──\n`);
  console.log(`SUBJECT  ${written.subject}`);
  console.log(`\n${written.body}\n`);
  if (written.support) console.log(`SUPPORT  ${written.support}\n`);

  // ⚠️ The same two checks a real post goes through, so a preview cannot look
  // better than the thing it is previewing.
  const gate = checkVoice(`${written.subject}\n${written.body}`, language);
  const house = checkHouseStyle(written.body, platform);
  console.log(`GATE     ${gate.ok ? "passed" : "⛔ " + gate.findings.map((f) => f.matched).join(", ")}`);
  if (house.problems.length) console.log("HOUSE    " + house.problems.join("\n         "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
