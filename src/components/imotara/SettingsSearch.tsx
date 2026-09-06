"use client";

// src/components/imotara/SettingsSearch.tsx
// Find-a-setting for /settings. The page is 5,000+ lines across 27 sections,
// 24 collapsed by default, so Ctrl-F cannot help — the text is not in the DOM
// until the section is open. Mobile has had this since settingsCatalog.ts.
//
// Sends you to the section, not the individual control: see settingsSections.ts
// for why that boundary is deliberate rather than lazy.

import { useCallback, useEffect, useRef, useState } from "react";
import {
    searchSettingsSections,
    OPEN_SECTION_EVENT,
    type SectionResult,
} from "@/data/settingsSections";

export default function SettingsSearch() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SectionResult[]>([]);
    const [active, setActive] = useState(0);
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setResults(searchSettingsSections(query));
        setActive(0);
    }, [query]);

    const go = useCallback((r: SectionResult) => {
        window.dispatchEvent(new CustomEvent(OPEN_SECTION_EVENT, { detail: r.id }));
        setQuery("");
        setResults([]);
        // The section has to render before there is anything to scroll to, and
        // opening it is a state update — two frames is the cheap, reliable wait.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
            const target = Array.from(document.querySelectorAll("h2"))
                .find((h) => norm(h.textContent ?? "").startsWith(norm(r.title)));
            if (!target) return;
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            // Announce where they landed; the heading is not focusable by default.
            target.setAttribute("tabindex", "-1");
            (target as HTMLElement).focus({ preventScroll: true });
        }));
    }, []);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!results.length) return;
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length); }
        else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
        else if (e.key === "Escape") { setQuery(""); setResults([]); }
    };

    // Clicking away closes the result list without clearing what was typed.
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setResults([]);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    return (
        <div ref={boxRef} className="relative mb-5">
            <label htmlFor="settings-search" className="sr-only">Search settings</label>
            <input
                id="settings-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search settings — try “dark mode” or “timeout”"
                autoComplete="off"
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls="settings-search-results"
                aria-autocomplete="list"
                aria-activedescendant={results.length ? `settings-search-opt-${active}` : undefined}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-zinc-800 outline-none placeholder:text-zinc-500 focus:border-violet-500 dark:text-zinc-200"
            />
            {results.length > 0 && (
                <ul
                    id="settings-search-results"
                    role="listbox"
                    aria-label="Matching settings sections"
                    className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-900"
                >
                    {results.map((r, i) => (
                        <li key={r.id} id={`settings-search-opt-${i}`} role="option" aria-selected={i === active}>
                            <button
                                type="button"
                                onMouseEnter={() => setActive(i)}
                                onClick={() => go(r)}
                                className={`block w-full px-3.5 py-2.5 text-start text-sm transition-colors ${
                                    // NB: bg-zinc-* is unusable here. globals.css inverts the
                                    // zinc palette variables under [data-theme="light"]
                                    // (--color-zinc-100 becomes #1e293b) because this is a
                                    // dark-first app and those utilities are used for TEXT.
                                    // A bg-zinc-100 row therefore renders dark on a light page.
                                    // Backgrounds use black/white alphas, which are not inverted.
                                    i === active
                                        ? "bg-black/5 text-zinc-900 dark:bg-white/10 dark:text-zinc-100"
                                        : "text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5"
                                }`}
                            >
                                {r.title}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {query.trim() && results.length === 0 && (
                <p className="absolute z-30 mt-1 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-zinc-500 shadow-xl dark:border-white/10 dark:bg-zinc-900">
                    Nothing matches “{query.trim()}”.
                </p>
            )}
        </div>
    );
}
