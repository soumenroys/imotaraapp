// src/app/llms-full.txt/route.ts
// GET /llms-full.txt — the long form of /llms.txt, for language models.
//
// 🔑 6 Nov 2026 (#14): /llms-full.txt answered 404. Assistants that look for
// the long form found nothing, while ChatGPT alone already sends us more
// visitors than Google search.
//
// ⛔ NOTHING NEW IS SAID HERE. It is /llms.txt followed by the answer and
// comparison pages, rendered from the SAME data those pages are built from —
// so it cannot claim anything the site does not already publish, and it
// cannot go stale on its own ⇒ src/__tests__/seo/llmsFullTxt.test.ts.
// ⚠️ The HTML comment in llms.txt is a note to US; it is stripped here.

import fs from "node:fs";
import path from "node:path";
import { llmsFullText } from "@/lib/seo/llmsFull";

export const dynamic = "force-static";

export async function GET() {
  const llms = fs.readFileSync(path.join(process.cwd(), "public", "llms.txt"), "utf8");
  return new Response(llmsFullText(llms), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
