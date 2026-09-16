/**
 * Linking a page from a broadcast, instead of attaching a file.
 *
 * A PDF attachment was requested on 2026-09-15 and deliberately dropped in
 * favour of this. The codebase had already made the same call for images —
 * api/admin/broadcast/upload/route.ts routes them to object storage because
 * base64 inlining pushes the HTML past Gmail's ~102KB clipping threshold,
 * taking the unsubscribe link with it, and "CID attachments are what filters
 * expect from malware".
 *
 * A link also does three things an attachment cannot: it can be corrected
 * after the mail has gone out, it can be measured, and Google can index it.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { AUDIENCE_PAGES, type AudiencePage } from "@/data/audiencePages";
import { renderHtml } from "@/lib/broadcast/markup";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const COMPOSER = read("src/components/admin/BroadcastComposer.tsx");

describe("the picker cannot drift from what is live", () => {
    it("reads the pages from the data that builds them", () => {
        // A hand-typed list would rot the moment a page is added or renamed,
        // and a broadcast would link a 404 to everyone on the list.
        expect(COMPOSER).toMatch(/import \{ AUDIENCE_PAGES, type AudiencePage \} from "@\/data\/audiencePages"/);
        expect(COMPOSER).toMatch(/Object\.values\(AUDIENCE_PAGES\) as AudiencePage\[\]/);
    });

    it("offers every page, and only real ones", () => {
        const pages = Object.values(AUDIENCE_PAGES) as AudiencePage[];
        expect(pages).toHaveLength(10);
        for (const p of pages) expect(p.slug).toMatch(/^[a-z][a-z0-9-]*$/);
    });
});

describe("what it writes into the message", () => {
    // The composer's own rule: "every button is a text edit — there is no
    // hidden document model", so the inserted text IS what gets stored.
    const insert = (page: AudiencePage) =>
        `[[Read more — ${page.label}]](https://www.imotara.com/for/${page.slug})`;

    it("reuses the existing Button block, inventing no new markup", () => {
        // BLOCK_TOOLS already has { label: "▭", block: "[[Read more]](...)" }.
        // Anything new would need the renderer AND the cron to learn it.
        expect(COMPOSER).toMatch(/const block = `\[\[Read more — \$\{page\.label\}\]\]\(https:\/\/www\.imotara\.com\/for\/\$\{page\.slug\}\)`/);
        expect(insert(AUDIENCE_PAGES.seniors)).toBe(
            "[[Read more — Seniors]](https://www.imotara.com/for/seniors)");
    });

    it("every generated URL is absolute and on the real domain", () => {
        // A relative URL is meaningless inside an email client.
        for (const p of Object.values(AUDIENCE_PAGES) as AudiencePage[]) {
            const url = insert(p).match(/\((https?:[^)]+)\)/)?.[1];
            expect(url).toMatch(/^https:\/\/www\.imotara\.com\/for\/[a-z0-9-]+$/);
        }
    });

    it("the label names the page, so the button is not ten identical buttons", () => {
        const labels = (Object.values(AUDIENCE_PAGES) as AudiencePage[]).map((p) => insert(p));
        expect(new Set(labels).size).toBe(labels.length);
    });
});

describe("it stays a link, not an attachment", () => {
    it("adds no file input and no upload call of its own", () => {
        // The picker must not quietly grow into the thing it replaced.
        const block = COMPOSER.slice(COMPOSER.indexOf("function insertPageLink"),
                                     COMPOSER.indexOf("async function upload"));
        expect(block).not.toMatch(/FormData|type="file"|\/upload/);
    });

    it("says why linking is preferred, where the person is choosing", () => {
        // The reasoning has to be at the point of decision, not in a commit
        // message nobody sending a broadcast will ever read.
        expect(COMPOSER).toMatch(/can be corrected after the message has/);
        expect(COMPOSER).toMatch(/does not carry the\s*\n?\s*spam risk an attachment does/);
    });
});

describe("what the recipient actually receives", () => {
    // renderHtml is the SAME function the cron uses to build the outgoing
    // mail, so this is the real email, not an approximation of it.
    const insert = (page: AudiencePage) =>
        `[[Read more — ${page.label}]](https://www.imotara.com/for/${page.slug})`;

    it("becomes a real anchor, not literal text", () => {
        const out = renderHtml(insert(AUDIENCE_PAGES.seniors));
        expect(out).toMatch(/<a\s[^>]*href="https:\/\/www\.imotara\.com\/for\/seniors"/);
        expect(out).toContain("Read more — Seniors");
        // The failure that would ship silently: markup arriving as plain text.
        expect(out).not.toContain("[[");
    });

    it("every page renders to a working link", () => {
        for (const p of Object.values(AUDIENCE_PAGES) as AudiencePage[]) {
            const out = renderHtml(insert(p));
            expect(out).toContain(`href="https://www.imotara.com/for/${p.slug}"`);
            expect(out).not.toContain("[[");
        }
    });
});
