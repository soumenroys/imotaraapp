// src/app/api/app/latest-version/route.ts
// The version the phone app should offer as an update — per store, set by hand
// only after that store shows it live. See lib/imotara/latestAppVersion.ts.
// Public and harmless: it says nothing about any person.
import { NextResponse } from "next/server";
import { latestAppVersions } from "@/lib/imotara/latestAppVersion";

export async function GET() {
    const res = NextResponse.json({ ok: true, ...latestAppVersions() });
    // A few minutes at the edge is plenty — this changes once per release.
    res.headers.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    return res;
}
