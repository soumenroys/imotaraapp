// src/lib/imotara/reflectionTone.ts

import { getImotaraProfile } from "@/lib/imotara/profile";

export function adaptReflectionTone(text: string): string {
    if (!text) return text;

    const profile = getImotaraProfile();
    if (!profile?.companion?.enabled) return text;

    const rel = profile.companion.relationship;

    // Gentle / elder tone
    if (rel === "elder" || rel === "parent_like") {
        return (
            text
                .replace(/^You /i, "You might ")
                .replace(/^Try /i, "You could gently try ")
                .replace(/^It is /i, "It may be ")
        );
    }

    // Friend / peer tone
    if (rel === "friend") {
        return (
            text
                .replace(/^You /i, "It seems like you ")
                .replace(/^Try /i, "Maybe try ")
        );
    }

    // Coach / mentor tone
    if (rel === "coach" || rel === "mentor") {
        return (
            text
                .replace(/^You /i, "A clear next step is that you ")
                .replace(/^Try /i, "One practical thing to try is ")
        );
    }

    return text;
}
