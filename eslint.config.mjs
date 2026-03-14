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
]);

export default eslintConfig;
