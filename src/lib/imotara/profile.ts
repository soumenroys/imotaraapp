// src/lib/imotara/profile.ts

export type Gender = "female" | "male" | "nonbinary" | "prefer_not" | "other";
export type AgeRange =
    | "under_13"
    | "13_17"
    | "18_24"
    | "25_34"
    | "35_44"
    | "45_54"
    | "55_64"
    | "65_plus"
    | "prefer_not";

export type ImotaraProfileV1 = {
    user?: {
        name?: string;
        ageRange?: AgeRange;
        gender?: Gender;
    };
    companion?: {
        enabled?: boolean;
        name?: string;
        ageRange?: AgeRange;
        gender?: Gender;
        relationship?:
        | "mentor"
        | "friend"
        | "elder"
        | "coach"
        | "parent_like"
        | "partner_like";
    };
};

const STORAGE_KEY = "imotara.profile.v1";

/**
 * Read Imotara tone & context profile from localStorage.
 * - Client-side only
 * - Safe: never throws
 * - Returns null if not present or malformed
 */
export function getImotaraProfile(): ImotaraProfileV1 | null {
    if (typeof window === "undefined") return null;

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as ImotaraProfileV1;
    } catch {
        return null;
    }
}

/**
 * Convenience helper: returns true only if
 * advanced companion context is explicitly enabled.
 */
export function isCompanionContextEnabled(
    profile: ImotaraProfileV1 | null
): boolean {
    return !!profile?.companion?.enabled;
}
