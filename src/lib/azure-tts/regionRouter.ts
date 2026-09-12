// src/lib/azure-tts/regionRouter.ts
// Picks which of the four Azure Speech resources to synthesize with.
//
// WHICH DISTANCE ACTUALLY COSTS TIME
//
// This used to choose the region nearest the USER, from x-vercel-ip-country.
// That is the wrong end of the wire: the request to Azure is made by the
// FUNCTION, not the browser, and the function does not run next to the user.
// Measured against production 2026-09-12 — `x-vercel-id: bom1::iad1::…`, so a
// request from India entered at Mumbai and executed in Washington DC, then
// called Azure centralindia. The audio crossed the Pacific twice:
//
//   Azure centralindia -> iad1 (long) -> user in India (long)
//
// The leg to the user is fixed by where the function runs. The only leg this
// file controls is Azure -> function, so it now picks the Azure region nearest
// the FUNCTION:
//
//   Azure eastus -> iad1 (short) -> user in India (long)
//
// The same rule stays correct if compute ever moves: run the function in bom1
// and this picks centralindia by itself, which is the fully-local case.
//
// SAFE TO DO THIS — checked, not assumed (2026-09-12). Every one of the 44
// configured voices exists in East US, including all sixteen MAI-Voice-2
// voices that en/hi/zh/es/fr/pt/ru/de depend on, and all nine style-using
// languages have every style they request. Re-run that check before adding a
// voice: a voice missing in the serving region fails synthesis outright.
//
// This is a LATENCY decision, confirmed with the owner 2026-09-12 — the split
// was never about keeping a user's text inside their own jurisdiction. If that
// ever changes, this file is where the change belongs, and country routing is
// still right there below.

const REGION_COUNTRIES: Record<string, string[]> = {
    IN: [ // centralindia — India, South Asia, Middle East, SE Asia
        "IN","BD","PK","LK","NP","BT","MV","AF",
        "IR","IQ","SA","AE","KW","QA","BH","OM","YE","SY","JO","LB",
        "TR","TH","MY","SG","ID","PH","VN","MM","KH","LA","BN",
    ],
    EU: [ // westeurope — Europe, Africa
        "DE","FR","GB","IT","ES","NL","PL","RU","UA","BE","CH","AT",
        "SE","NO","DK","FI","PT","GR","CZ","HU","RO","BG","HR","SK",
        "SI","EE","LV","LT","IE","LU","MT","CY","RS","BA","ME","MK",
        "AL","MD","BY","LI","IS","AD","MC","SM","VA",
        "ZA","NG","EG","KE","GH","ET","TZ","MA","DZ","TN","LY","SD",
        "UG","RW","CI","CM","SN","GN","MZ","AO","ZM","ZW","BW","NA",
        "MW","SL","LR","BF","ML","NE","TD","CF","CD","CG","GA","BI",
        "DJ","ER","GM","GW","KM","LS","MR","MU","SC","SS","SZ","SO",
        "IL", // Israel — westeurope is closer than centralindia
    ],
    US: [ // eastus — Americas
        "US","CA","MX","BR","AR","CO","CL","PE","VE","EC","BO","PY",
        "UY","GT","HN","SV","NI","CR","PA","CU","DO","HT","JM","TT",
        "BB","BS","LC","VC","GD","AG","DM","KN","SR","GY","BZ","PF",
    ],
    AP: [ // japaneast — East Asia, Pacific
        "JP","CN","KR","TW","HK","MO","AU","NZ","MN",
        "KZ","UZ","TM","KG","TJ","AZ","GE","AM",
    ],
};

// Suffix → env var keys
const SUFFIX_MAP: Record<string, string> = {
    IN: "IN",
    EU: "EU",
    US: "US",
    AP: "AP",
};

export interface AzureConfig {
    key:    string;
    region: string;
}

/**
 * Vercel compute region -> nearest Azure Speech resource.
 * Only the regions this project could plausibly run in are listed; anything
 * unknown falls through to country routing rather than guessing.
 */
const VERCEL_REGION_TO_SUFFIX: Record<string, string> = {
    // Americas -> eastus
    iad1: "US", cle1: "US", pdx1: "US", sfo1: "US", gru1: "US",
    // Europe + Africa -> northeurope
    arn1: "EU", cdg1: "EU", dub1: "EU", fra1: "EU", lhr1: "EU", cpt1: "EU",
    // India -> centralindia
    bom1: "IN",
    // Asia-Pacific -> japaneast
    hnd1: "AP", icn1: "AP", kix1: "AP", sin1: "AP", syd1: "AP", hkg1: "AP",
};

export function getAzureConfig(countryCode: string | null): AzureConfig {
    // Where this code is running, which is where the Azure call originates.
    // Unset off-Vercel (local dev, tests) — country routing covers that.
    const suffixForRegion = VERCEL_REGION_TO_SUFFIX[process.env.VERCEL_REGION ?? ""];
    if (suffixForRegion) return buildConfig(suffixForRegion);

    const code = (countryCode ?? "").toUpperCase();
    for (const [suffix, countries] of Object.entries(REGION_COUNTRIES)) {
        if (countries.includes(code)) {
            return buildConfig(SUFFIX_MAP[suffix]);
        }
    }
    // Default to India region
    return buildConfig("IN");
}

function buildConfig(suffix: string): AzureConfig {
    const key    = process.env[`AZURE_SPEECH_KEY_${suffix}`];
    const region = process.env[`AZURE_SPEECH_REGION_${suffix}`];
    if (!key || !region) {
        throw new Error(`Azure Speech credentials not configured for region ${suffix}. Set AZURE_SPEECH_KEY_${suffix} and AZURE_SPEECH_REGION_${suffix} in .env.local`);
    }
    return { key, region };
}
