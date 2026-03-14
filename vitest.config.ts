import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
    plugins: [tsconfigPaths()],
    resolve: {
        alias: {
            // Next.js server-only packages are no-ops in test environment
            "server-only": path.resolve(__dirname, "src/__mocks__/server-only.ts"),
            "next/headers": path.resolve(__dirname, "src/__mocks__/next-headers.ts"),
        },
    },
    test: {
        environment: "node",
        setupFiles: ["src/__mocks__/vitest.setup.ts"],
    },
});
