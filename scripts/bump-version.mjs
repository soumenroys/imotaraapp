// scripts/bump-version.mjs
//
// Single-command version/build bump across imotaraapp (web) and
// imotara-mobile (iOS + Android). The two repos' own release-commit
// convention ("chore(release): bump version to X, build Y") kept them in
// sync by hand across 4 separate fields in 3 files; this makes that one
// command instead.
//
// Usage: node scripts/bump-version.mjs <version> <buildNumber>
// Example: node scripts/bump-version.mjs 1.2.6 106
//
// Does NOT commit, tag, or push — review the diff in both repos and commit
// yourself. All-or-nothing: if any expected field can't be found (e.g. a
// file's format changed), nothing is written to any file.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const MOBILE_ROOT = path.resolve(WEB_ROOT, "../imotara-mobile");

const [, , version, buildNumber] = process.argv;

if (!version || !buildNumber) {
  console.error("Usage: node scripts/bump-version.mjs <version> <buildNumber>");
  console.error("Example: node scripts/bump-version.mjs 1.2.6 106");
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version "${version}" — expected semver like 1.2.6`);
  process.exit(1);
}
if (!/^\d+$/.test(buildNumber)) {
  console.error(`Invalid build number "${buildNumber}" — expected a plain integer like 106`);
  process.exit(1);
}
if (!fs.existsSync(MOBILE_ROOT)) {
  console.error(
    `Mobile repo not found at ${MOBILE_ROOT} — expected as a sibling directory of imotaraapp. ` +
    `Edit MOBILE_ROOT in this script if your local layout differs.`
  );
  process.exit(1);
}

/**
 * Applies [pattern, replacement, label] edits to one file's content in
 * memory. Throws (without writing anything) if any pattern isn't found —
 * callers must only write after every file's edits have all succeeded.
 */
function applyEdits(filePath, edits) {
  let content = fs.readFileSync(filePath, "utf8");
  for (const [pattern, replacement, label] of edits) {
    if (!pattern.test(content)) {
      throw new Error(`Pattern not found for "${label}" in ${filePath} — file format may have changed.`);
    }
    content = content.replace(pattern, replacement);
  }
  return { filePath, content };
}

try {
  const writes = [
    applyEdits(path.join(WEB_ROOT, "package.json"), [
      [/"version":\s*"[\d.]+"/, `"version": "${version}"`, "web version"],
      [/"buildNumber":\s*"\d+"/, `"buildNumber": "${buildNumber}"`, "web buildNumber"],
    ]),
    applyEdits(path.join(MOBILE_ROOT, "package.json"), [
      [/"version":\s*"[\d.]+"/, `"version": "${version}"`, "mobile package.json version"],
    ]),
    applyEdits(path.join(MOBILE_ROOT, "app.json"), [
      [/"version":\s*"[\d.]+"/, `"version": "${version}"`, "mobile app.json expo.version"],
      [/"buildNumber":\s*"\d+"/, `"buildNumber": "${buildNumber}"`, "mobile app.json ios.buildNumber"],
      // versionCode is a bare integer in app.json, not a quoted string — preserve that type.
      [/"versionCode":\s*\d+/, `"versionCode": ${buildNumber}`, "mobile app.json android.versionCode"],
    ]),
  ];

  // Only write after every edit across every file has succeeded.
  for (const { filePath, content } of writes) {
    fs.writeFileSync(filePath, content);
  }

  console.log(`Bumped to version ${version}, build ${buildNumber}:`);
  console.log(`  imotaraapp/package.json        (version, buildNumber)`);
  console.log(`  imotara-mobile/package.json    (version)`);
  console.log(`  imotara-mobile/app.json        (expo.version, ios.buildNumber, android.versionCode)`);
  console.log(`\nReview the diff in both repos, then commit each yourself.`);
} catch (err) {
  console.error(`Aborted, nothing was written: ${err.message}`);
  process.exit(1);
}
