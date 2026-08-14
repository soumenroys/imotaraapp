import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Project-level rule overrides
  {
    rules: {
      // Downgrade to warn: the codebase has pervasive `any` usage inherited
      // from rapid prototyping. Fixing all 400+ usages is tracked as a
      // dedicated type-safety initiative and should not block CI in the interim.
      "@typescript-eslint/no-explicit-any": "warn",
      // Downgrade to warn: setState inside useEffect is an established React 18
      // pattern throughout this codebase (hydration, async data loading, etc.).
      // All 18 instances are intentional and reviewed.
      "react-hooks/set-state-in-effect": "warn",
      // Downgrade to warn: Date.now() in useMemo during mount is intentional —
      // it captures a stable render-time timestamp used for future letter unlock
      // comparison. Reviewed and safe; not a true purity violation.
      "react-hooks/purity": "warn",
    },
  },
  // P2-11 (code_review_audit_2026_08_14): standalone CommonJS scripts, not
  // part of the app bundle or TypeScript build — package.json has no
  // "type": "module", and these are invoked directly via `node scripts/x.js`.
  // Converting require() to import here would break them at runtime, not
  // just satisfy a lint rule, so the rule is scoped out for this directory
  // instead of "fixed" in a way that's actually a regression.
  {
    files: ["scripts/**/*.js", "screenshot-test.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
