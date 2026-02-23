// scripts/devRoutes.mjs
import fs from "fs";
import path from "path";

const shouldPrune =
  process.env.IMOTARA_PRUNE_DEV_ROUTES === "1" ||
  (process.env.NODE_ENV === "production" && process.env.CI === "true");

const root = process.cwd();

// Routes we never want shipped in production builds
const targets = [
  {
    from: path.join(root, "src", "app", "dev"),
    to: path.join(root, "src", "app", "__dev_pruned"),
  },
  {
    from: path.join(root, "src", "app", "license-debug"),
    to: path.join(root, "src", "app", "__license_debug_pruned"),
  },
];

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function copyDirRecursiveSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const srcPath = path.join(src, e.name);
    const destPath = path.join(dest, e.name);
    if (e.isDirectory()) {
      copyDirRecursiveSync(srcPath, destPath);
    } else if (e.isSymbolicLink()) {
      // Best-effort: preserve symlink if possible
      const linkTarget = fs.readlinkSync(srcPath);
      fs.symlinkSync(linkTarget, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function removeDirRecursiveSync(p) {
  // Node 22 supports fs.rmSync with recursive.
  fs.rmSync(p, { recursive: true, force: true });
}

function renameSafe(from, to) {
  // If target exists, do nothing (avoid destructive behavior)
  if (!exists(from)) return;
  if (exists(to)) return;

  try {
    fs.renameSync(from, to);
    return;
  } catch (err) {
    const code = err?.code;

    // Windows often throws EPERM when directory is "busy" (watchers/AV).
    // Cross-device rename can throw EXDEV. In both cases, fall back.
    if (code !== "EPERM" && code !== "EXDEV") throw err;
  }

  // Fallback: copy -> delete original
  copyDirRecursiveSync(from, to);
  removeDirRecursiveSync(from);
}

const mode = process.argv[2]; // "prune" | "restore"

if (!shouldPrune) {
  // No-op unless explicitly enabled
  process.exit(0);
}

if (mode === "prune") {
  // Move debug/dev routes out of the app router tree for production build
  for (const t of targets) renameSafe(t.from, t.to);
  process.exit(0);
}

if (mode === "restore") {
  // Restore after build (so local dev isn't affected)
  for (const t of targets) renameSafe(t.to, t.from);
  process.exit(0);
}

// If called incorrectly, still no-op (keep builds resilient)
process.exit(0);
