// Live, network-touching checks. A SEPARATE config so they can never run in
// CI or alongside the unit suite: they cost money, need a real key, and are
// slow. See src/__tests__/*.live.ts.
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
    plugins: [tsconfigPaths()],
    resolve: {
        alias: {
            "server-only": path.resolve(__dirname, "src/__mocks__/server-only.ts"),
            "next/headers": path.resolve(__dirname, "src/__mocks__/next-headers.ts"),
        },
    },
    test: {
        environment: "node",
        setupFiles: ["src/__mocks__/vitest.setup.ts"],
        include: ["src/__tests__/**/*.live.ts"],
        testTimeout: 300_000,
    },
});
