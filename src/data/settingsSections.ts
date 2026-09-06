// src/data/settingsSections.ts
// What each collapsible section on /settings is, so search can send someone to
// the right one.
//
// The settings page is 5,000+ lines across 27 sections, 24 of which are
// collapsed by default. Mobile has had a search for this since settingsCatalog
// .ts; the web had none, so a setting whose name you cannot quite remember was
// effectively unreachable — Ctrl-F does not find text inside a collapsed
// section either.
//
// **This indexes SECTIONS, not individual settings, and that is deliberate.**
// Mobile's catalogue maps each setting to a section, but eight of these 27
// sections render through sub-components, so which section a given setting
// lives in cannot be derived from the page and would have to be asserted by
// hand. An entry that names the wrong section is worse than no search: it opens
// a section, scrolls you to it, and the thing you asked for is not there. That
// exact drift was found and fixed on mobile the same day this was written
// (companion_reactions claimed Experience while it renders in Advanced).
//
// So every mapping here is one the page itself can confirm, and
// settingsSections.test.ts fails the build if an id or title stops matching.
// Per-setting entries can be added later, one at a time, each verified.
//
// `synonyms` are what someone might type instead of the title. Keep them to
// things that are certainly in the section — a wrong synonym has the same
// failure mode as a wrong section.

export type SettingsSection = {
    /** Must match the useSectionOpen(id, …) call on the settings page. */
    id: string;
    /** Must match the SectionToggleHeader title, so results read as the page does. */
    title: string;
    synonyms: string[];
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
    { id: "tone-context", title: "Tone & Context Preferences",
      synonyms: ["tone", "context", "about me", "personal details", "how imotara talks to me"] },
    { id: "data-on-device", title: "Data on this device",
      synonyms: ["local data", "stored on this device", "offline", "auto clear old history"] },
    { id: "sign-in", title: "Sign in",
      synonyms: ["log in", "login", "sign out", "account", "google", "apple"] },
    { id: "your-plan", title: "Your plan",
      synonyms: ["subscription", "upgrade", "premium", "billing", "tokens", "credits", "free plan"] },
    { id: "family-profiles", title: "Family Profiles",
      synonyms: ["family", "profiles", "multiple people"] },
    { id: "donate", title: "Support Imotara (Donate)",
      synonyms: ["donate", "donation", "support", "tip", "contribute"] },
    { id: "your-donations", title: "Your Donations",
      synonyms: ["donation history", "past donations", "receipts"] },
    { id: "browser-notifications", title: "Browser notifications",
      synonyms: ["notifications", "reminders", "daily check-in reminder", "reminder time", "push"] },
    { id: "chat-behaviour", title: "Chat behaviour",
      synonyms: ["chat", "conversation", "replies", "mood glimpse", "reactions", "hands-free", "read aloud"] },
    { id: "grow-wellbeing", title: "Grow & Wellbeing",
      synonyms: ["grow", "wellbeing", "journal", "breathing", "challenge", "exercises"] },
    { id: "mindset-analysis", title: "Mindset Analysis",
      synonyms: ["mindset", "psychological analysis", "patterns"] },
    { id: "appearance", title: "Appearance",
      synonyms: ["theme", "dark mode", "light mode", "text size", "font size", "colour", "color", "accent"] },
    { id: "emotion-analysis-mode", title: "Emotion analysis mode",
      synonyms: ["emotion analysis", "on device", "remote analysis", "accuracy"] },
    { id: "safety-crisis", title: "Safety & crisis resources",
      synonyms: ["crisis", "safety", "helpline", "emergency", "suicide", "self harm"] },
    { id: "local-data-controls", title: "Local data controls",
      synonyms: ["clear history", "delete local data", "wipe", "storage"] },
    { id: "export-data", title: "Export data",
      synonyms: ["export", "download my data", "backup", "json", "csv"] },
    { id: "remote-history-sync", title: "Remote history sync",
      synonyms: ["cloud sync", "sync", "backup to cloud", "across devices"] },
    { id: "device-sync", title: "Sync with another device (optional)",
      synonyms: ["another device", "pair device", "transfer", "second device"] },
    { id: "companion-insights", title: "Companion insights",
      synonyms: ["insights", "letters", "emotional arc", "companion letter"] },
    { id: "history-management", title: "History management",
      synonyms: ["history", "auto delete old conversations", "retention", "cleanup"] },
    { id: "tips-tours", title: "Tips & tours",
      synonyms: ["tips", "tour", "onboarding", "walkthrough", "feature discovery"] },
    { id: "companion-memory", title: "Companion memory",
      synonyms: ["memory", "remember", "memories", "what imotara remembers"] },
    { id: "family-snapshot", title: "Family Snapshot",
      synonyms: ["snapshot", "share with family", "weekly summary"] },
    { id: "how-to-use-imotara", title: "How to use Imotara",
      synonyms: ["help", "guide", "how to", "tutorial", "getting started"] },
    { id: "network", title: "Network",
      synonyms: ["timeout", "api request timeout", "poll interval", "online status", "slow connection", "connection"] },
    { id: "data-privacy", title: "Data & privacy",
      synonyms: ["privacy", "data", "gdpr", "what you store"] },
    { id: "delete-account", title: "Delete account",
      synonyms: ["delete account", "close account", "remove my account", "erase everything"] },
];

export type SectionResult = SettingsSection & { score: number };

/**
 * Rank sections against a typed query. Mirrors the scoring mobile already uses
 * in settingsCatalog.ts so both platforms behave the same way for the same
 * words. Local only — no network call, so it stays instant and costs nothing.
 */
export function searchSettingsSections(query: string, topN = 6): SectionResult[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const words = q.split(/\s+/).filter(Boolean);

    return SETTINGS_SECTIONS
        .map((s) => {
            const title = s.title.toLowerCase();
            let score = 0;
            if (title === q) score += 50;
            if (title.includes(q)) score += 20;
            for (const w of words) if (title.includes(w)) score += 10;
            for (const syn of s.synonyms) {
                const k = syn.toLowerCase();
                if (k === q) score += 15;
                if (k.includes(q) || q.includes(k)) score += 8;
                for (const w of words) if (k.includes(w)) score += 4;
            }
            return { ...s, score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
        .slice(0, topN);
}

/** Dispatched by search; the settings page's useSectionOpen listens for it. */
export const OPEN_SECTION_EVENT = "imotara:settings-open-section";
