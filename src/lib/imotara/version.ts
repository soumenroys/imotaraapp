export function getImotaraWebVersionLabel() {
    // Primary source: explicit version from env
    const raw = (process.env.NEXT_PUBLIC_APP_VERSION || "").trim();

    // Optional fallback: Vercel commit SHA (short)
    const sha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "").trim();

    if (raw) {
        const clean = raw.replace(/^v/i, "").trim();
        return clean ? `v${clean}` : "v—";
    }

    if (sha) {
        return `v${sha.slice(0, 7)}`;
    }

    return "v—";
}
