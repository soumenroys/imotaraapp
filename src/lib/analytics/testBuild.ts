// src/lib/analytics/testBuild.ts — #170 (25 Nov 2026)
// The app marks its own simulator / emulator / dev builds with `x-imotara-build: test`
// (imotara-mobile src/config/buildChannel.ts). Those counts are ours, not real people's.
// ⚠️ Only an explicit "test" is dropped: store apps from before this change send nothing.

/** True only when the app explicitly says it is a test build. */
export function isTestBuild(header: string | null): boolean {
    return (header ?? "").trim().toLowerCase() === "test";
}
