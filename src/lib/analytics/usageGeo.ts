// src/lib/analytics/usageGeo.ts
//
// Where Imotara is being used, at country and region level, across all three
// platforms — with no location permission, no coordinate, and no per-person
// record.
//
// 🔑 HOW IT WORKS WITHOUT LOCATION SERVICES. Both apps call imotara.com for
// everything, so every request already arrives at Vercel carrying the phone's
// IP, and Vercel attaches geo headers at the edge. The device's location
// service can be off, denied or never requested and this still works — the
// apps ask for no new permission, and we never see a coordinate.
//
// ⛔ WHAT THIS FILE MUST NEVER READ. Vercel also sends
// x-vercel-ip-latitude, x-vercel-ip-longitude and x-vercel-ip-city on the same
// request. They are deliberately absent from the code below, and
// src/__tests__/analytics/usageGeoCollectsNoOneInParticular.test.ts asserts
// their absence — because the easiest way for this to become a privacy
// incident is for someone to add "just the city" later. A city plus a
// mental-health session plus a date is identifying in a small town.
//
// ⚠️ IT RECORDS WHERE THE REQUEST CAME FROM, NOT WHERE THE PERSON IS. VPNs,
// corporate egress and carrier NAT all lie. Imotara's "Singapore users" in GA
// turned out to be e-mail security scanners. Read these numbers as traffic
// origin, never as a population.

import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { resolvePlatform } from "@/lib/imotara/clientPlatform";

/** Vercel's edge geo headers — the only two we take. */
const COUNTRY_HEADER = "x-vercel-ip-country";
const REGION_HEADER = "x-vercel-ip-country-region";

/** Used when the edge could not place the request. Satisfies the ISO-2 check. */
export const UNKNOWN_COUNTRY = "ZZ";

export type UsageGeo = {
    /** ISO 3166-1 alpha-2, or "ZZ". */
    country: string;
    /** Region/state code, or "" — never a city, never a coordinate. */
    region: string;
    platform: "web" | "ios" | "android" | "unknown";
};

interface HeaderLike {
    get(name: string): string | null;
}

/**
 * Reads the coarse origin of a request. Pure, synchronous, and safe to call on
 * any request — it touches no network and no database.
 */
export function readUsageGeo(req: { headers: HeaderLike }): UsageGeo {
    const rawCountry = req.headers.get(COUNTRY_HEADER)?.trim().toUpperCase() ?? "";
    // ⚠️ Validated rather than trusted. The header is edge-injected in
    // production, but a request reaching the function directly can carry
    // anything, and the column has an ISO-2 check constraint that an unchecked
    // value would violate — turning a silent miscount into a failed insert.
    const country = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : UNKNOWN_COUNTRY;

    const rawRegion = req.headers.get(REGION_HEADER)?.trim().toUpperCase() ?? "";
    // Region codes are short (e.g. "WB", "CA", "ENG"). Anything longer is not
    // a region code, and the column caps at 8 characters.
    const region = /^[A-Z0-9-]{1,8}$/.test(rawRegion) ? rawRegion : "";

    return { country, region, platform: resolvePlatform(req) };
}

/**
 * Records one hit against today's (country, region, platform) bucket.
 *
 * ⛔ NEVER AWAIT THIS ON A REQUEST PATH. The standing constraint on this
 * codebase is that nothing may degrade reply quality or user experience, and
 * an analytics write has no business sitting between a person in distress and
 * their reply. Call it as `void recordUsageGeo(req)` and let it settle on its
 * own; every failure mode below is swallowed on purpose.
 *
 * 🔑 The write is a single atomic `hits = hits + 1`, so two requests in the
 * same millisecond both count. A read-then-write would lose one.
 */
export async function recordUsageGeo(req: { headers: HeaderLike }): Promise<void> {
    try {
        const { country, region, platform } = readUsageGeo(req);

        // 🔴 MOBILE IS OFF UNTIL THE STORE DECLARATIONS SAY IT IS ON.
        //
        // The trap this exists for: this recorder runs SERVER-SIDE on
        // /api/respond, which every already-installed iOS and Android build
        // calls, and those builds already send X-Imotara-Platform. So mobile
        // usage would begin being recorded the instant the WEB deploys — with
        // no new app release, and therefore potentially before the Play Data
        // Safety form declares it. Google's rule is explicit that IP-inferred
        // approximate location must be disclosed, so that window would be a
        // false declaration on a live listing.
        //
        // ⛔ Default is web-only. Set IMOTARA_USAGE_GEO_MOBILE=true in Vercel
        // ONLY once the Play Data Safety form and the Apple privacy label have
        // been updated ⇒ imotara-mobile/PLAY_DATA_SAFETY.md.
        // ⚠️ Not a feature flag to tidy away later: it is what keeps the
        // declaration and the behaviour in step, in that order.
        if (platform !== "web" && process.env.IMOTARA_USAGE_GEO_MOBILE !== "true") return;

        await getSupabaseAdmin().rpc("imotara_record_usage_geo", {
            p_country: country,
            p_region: region,
            p_platform: platform,
        });
    } catch {
        // ⛔ Deliberately silent. If the migration has not been run, or the
        // database is briefly unreachable, the person still gets their reply.
        // A missing analytics row is not worth a failed response, and not
        // worth a log line on every request either.
    }
}
