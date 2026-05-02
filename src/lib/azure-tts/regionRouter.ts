// src/lib/azure-tts/regionRouter.ts
// Maps Vercel's x-vercel-ip-country header to the nearest Azure Speech region.
// Vercel injects this header automatically on every request — no extra setup needed.

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

export function getAzureConfig(countryCode: string | null): AzureConfig {
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
