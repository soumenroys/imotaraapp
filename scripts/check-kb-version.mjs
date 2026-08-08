// scripts/check-kb-version.mjs
//
// Verifies the "Current release: vX.Y.Z" headers in ImotaraKnowledgebase/*.md
// match package.json's version. This drifted twice in the same session
// (2026-08-08) — fixed once, then silently went stale again on the very next
// version bump because nothing checked it automatically. Read-only: reports
// mismatches, never edits files.
//
// Usage: node scripts/check-kb-version.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const currentVersion = pkg.version;

// Each doc's own "current version" sentence, matched loosely enough to survive
// minor rewording but still anchored to an explicit vX.Y.Z token so a stale
// number is caught. Historical "fixed in vX.Y.Z" citations elsewhere in these
// same docs are NOT matched here on purpose — only the header/intro line.
const KB_DIR = path.join(ROOT, "ImotaraKnowledgebase");
const FILES = [
  "00-START-HERE-Index.md",
  "Database-and-Backend-Reference.md",
  "Imotara-Connect-Marketplace.md",
  "Licensing-Tiers-and-Payments.md",
  "Mobile-App-Technical-Guide.md",
  "Release-Runbook-Web-and-Mobile.md",
  "Web-App-Technical-Guide.md",
];

const problems = [];
for (const file of FILES) {
  const filePath = path.join(KB_DIR, file);
  if (!fs.existsSync(filePath)) {
    problems.push(`${file}: file not found (was it renamed or moved?)`);
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/v(\d+\.\d+\.\d+)/);
  if (!match) {
    problems.push(`${file}: no "vX.Y.Z" version string found at all — check it manually.`);
    continue;
  }
  if (match[1] !== currentVersion) {
    problems.push(`${file}: says v${match[1]}, package.json says v${currentVersion}`);
  }
}

if (problems.length > 0) {
  console.error(`KB version headers out of sync with package.json (v${currentVersion}):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`\nUpdate the "Current release"/"Current as of" line in each doc above to v${currentVersion}.`);
  process.exit(1);
}

console.log(`KB version headers all match package.json (v${currentVersion}).`);
