#!/usr/bin/env node
// Compiles the public help docs (src/content/help/*.md) into a single JSON
// bundle (src/content/help/helpKb.json) that the /api/help-chat route imports
// statically. Run after editing any help doc:
//   node scripts/build-help-kb.mjs
// The JSON is committed so no build-time hook is needed.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const helpDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "content", "help");
const files = readdirSync(helpDir).filter((f) => f.endsWith(".md")).sort();

if (files.length === 0) {
  console.error("No .md files found in src/content/help — nothing to build.");
  process.exit(1);
}

const docs = files.map((file) => {
  const content = readFileSync(join(helpDir, file), "utf8").trim();
  const firstLine = content.split("\n")[0] ?? "";
  const title = firstLine.replace(/^#\s*/, "").trim() || file.replace(/\.md$/, "");
  return { id: file.replace(/\.md$/, ""), title, content };
});

const out = join(helpDir, "helpKb.json");
writeFileSync(out, JSON.stringify({ generatedAt: null, docs }, null, 1) + "\n");
const totalKb = (docs.reduce((n, d) => n + d.content.length, 0) / 1024).toFixed(1);
console.log(`helpKb.json written: ${docs.length} docs, ${totalKb} KB of content.`);
