// src/lib/seo/llmsFull.ts
// The body of /llms-full.txt ⇒ src/app/llms-full.txt/route.ts (why it exists, and why it says nothing new).

import { ANSWER_PAGES } from "@/data/answerPages";
import { COMPARE_PAGES } from "@/data/comparePages";

const SITE = "https://www.imotara.com";

export function llmsFullText(llmsTxt: string): string {
  const out: string[] = [llmsTxt.replace(/<!--[\s\S]*?-->\s*/g, "").trim(), "", "---", "", "## Answers to common questions", ""];
  for (const p of Object.values(ANSWER_PAGES)) {
    out.push(`### ${p.question}`, `Source: ${SITE}/answers/${p.slug}`, "", p.shortAnswer, "");
    for (const s of p.sections) out.push(`#### ${s.heading}`, ...s.body, "");
    if (p.tryNow.length) out.push("#### Things to try now", ...p.tryNow.map((t) => `- ${t}`), "");
    if (p.whenToGetHelp.length) out.push("#### When to get more help", ...p.whenToGetHelp.map((t) => `- ${t}`), "");
  }
  out.push("## Comparisons", "");
  for (const p of Object.values(COMPARE_PAGES)) {
    out.push(`### ${p.question}`, `Source: ${SITE}/compare/${p.slug}`, "", p.shortAnswer, "");
    if (p.rows.length) {
      out.push(`| | ${p.columns.imotara} | ${p.columns.other} |`, "|---|---|---|");
      for (const r of p.rows) out.push(`| ${r.criterion} | ${r.imotara} | ${r.other} |`);
      out.push("");
    }
    for (const s of p.sections) out.push(`#### ${s.heading}`, ...s.body, "");
    if (p.notFor.length) out.push("#### Who it is not for", ...p.notFor.map((t) => `- ${t}`), "");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

