/**
 * The template usage counter must not report numbers it cannot justify.
 *
 * Owner request, 2026-10-15: a counter showing which template was sent how
 * many times, with details.
 *
 * 🔑 THE FAILURE MODE THIS GUARDS AGAINST is not a crash — it is a panel that
 * LOOKS authoritative and is quietly wrong. A template is a starting point the
 * admin then rewrites. If a message started from "The 2am thought" and was
 * then rewritten entirely, counting it as a use of that template is defensible;
 * counting it as an UNEDITED use is a lie, and decisions about which templates
 * to keep would be made on it.
 *
 * So the two numbers are kept apart, the "edited" verdict is recomputed from
 * the body on every save rather than reported by the client, and the id is
 * validated against the catalogue so a request cannot invent one.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TEMPLATES, templateEditedState, templateById } from "@/lib/broadcast/templates";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("🔑 edited vs unedited is decided from the body, every time", () => {
    const t = TEMPLATES[0];

    it("an untouched body is not edited", () => {
        expect(templateEditedState(t.id, t.body)).toBe(false);
    });

    it("⚠️ whitespace the editor added is not an edit", () => {
        // A trailing newline is not a rewrite, and counting it as one would
        // make "unedited" always zero — the number would stop meaning anything.
        expect(templateEditedState(t.id, `${t.body}\n`)).toBe(false);
        expect(templateEditedState(t.id, `\n  ${t.body}  \n`)).toBe(false);
    });

    it("a changed body IS edited", () => {
        expect(templateEditedState(t.id, `${t.body}\n\nOne more line.`)).toBe(true);
        expect(templateEditedState(t.id, "Completely different text.")).toBe(true);
    });

    it("🔑 and it flips BACK when the wording is restored", () => {
        // The state is derived, not latched. An admin who edits and then undoes
        // should not leave the row permanently marked dirty.
        expect(templateEditedState(t.id, "something else")).toBe(true);
        expect(templateEditedState(t.id, t.body)).toBe(false);
    });

    it("⛔ no template means null, NOT false", () => {
        // "Written from scratch" is a different fact from "unedited", and
        // collapsing them would inflate the unedited count with messages that
        // never came from a template at all.
        expect(templateEditedState(null, "anything")).toBeNull();
        expect(templateEditedState(undefined, "anything")).toBeNull();
        expect(templateEditedState("", "anything")).toBeNull();
    });

    it("⛔ an unknown id means null, not a guess", () => {
        expect(templateEditedState("individuals-does-not-exist", "anything")).toBeNull();
        expect(templateById("individuals-does-not-exist")).toBeUndefined();
    });
});

describe("⛔ the server decides, not the client", () => {
    const createRoute = read("src/app/api/admin/broadcast/broadcasts/route.ts");
    const patchRoute = read("src/app/api/admin/broadcast/broadcasts/[id]/route.ts");

    it("the create route VALIDATES template_id against the catalogue", () => {
        // A request could otherwise invent an id and poison the counts with a
        // template that does not exist.
        expect(createRoute).toMatch(/templateById\(body\.template_id\)/);
    });

    it("⛔ template_edited is never read from the request body", () => {
        for (const [name, src] of [["create", createRoute], ["patch", patchRoute]] as const) {
            expect(src, name).not.toMatch(/body\.template_edited/);
        }
    });

    it("both routes use the SHARED helper, not their own copy", () => {
        // 🔑 They each had an inline comparison first. That is how two
        // implementations drift: a later fix to one leaves the other
        // disagreeing, and it surfaces only as numbers nobody can explain.
        for (const [name, src] of [["create", createRoute], ["patch", patchRoute]] as const) {
            expect(src, name).toMatch(/templateEditedState\(/);
        }
        // ⛔ The inline form must not come back.
        expect(createRoute).not.toMatch(/source\.trim\(\) !== \w+\.body\.trim\(\)/);
        expect(patchRoute).not.toMatch(/body_source\.trim\(\) !== \w+\.body\.trim\(\)/);
    });

    it("🔑 the PATCH recomputes it whenever the body changes", () => {
        // Without this, a message started from a template and then rewritten
        // would still count as an unedited use of it.
        const i = patchRoute.indexOf("patch.body_source = body.body_source");
        expect(i).toBeGreaterThan(-1);
        expect(patchRoute.slice(i, i + 1100)).toMatch(/templateEditedState\(/);
    });

    it("the PATCH reads the EXISTING template_id rather than taking a new one", () => {
        // Re-attributing a sent message to a different template would let one
        // send inflate two counters.
        const pat = patchRoute.indexOf("export async function PATCH");
        expect(patchRoute.slice(pat, pat + 1200)).toMatch(/select\("id, status, template_id"\)/);
    });
});

describe("⚠️ the panel is honest about what it does not know", () => {
    const statsRoute = read("src/app/api/admin/broadcast/templates/route.ts");
    const panel = read("src/components/admin/BroadcastTemplateUsage.tsx");

    it("a missing column says so instead of 500-ing", () => {
        // The SQL is applied by hand AFTER this deploys, so there is a real
        // window where the column does not exist.
        expect(statsRoute).toMatch(/42703/);
        expect(statsRoute).toMatch(/migrationNeeded: true/);
    });

    it("…and the panel renders that as a message, not an empty table", () => {
        // An empty table would be read as "no template has ever been used",
        // which is a different and wrong claim.
        expect(panel).toMatch(/migrationNeeded/);
        expect(panel).toMatch(/broadcast_template_usage\.sql/);
    });

    it("⛔ a bounce rate is null, not 0, when nothing was sent", () => {
        // 0% against zero recipients looks like a measurement.
        expect(statsRoute).toMatch(/recipients > 0 \?/);
        expect(statsRoute).toMatch(/bounceRate: recipients > 0/);
    });

    it("used and unedited are reported as SEPARATE numbers", () => {
        expect(statsRoute).toMatch(/used: mine\.length/);
        expect(statsRoute).toMatch(/unedited: mine\.filter/);
        expect(panel).toMatch(/Unedited/);
    });
});

describe("🗄️ the migration matches what the code writes", () => {
    const sql = read("docs/sql/broadcast_template_usage.sql");

    it("adds both columns, idempotently", () => {
        expect(sql).toMatch(/add column if not exists template_id\s+text/);
        expect(sql).toMatch(/add column if not exists template_edited\s+boolean/);
    });

    it("⛔ template_id is nullable — existing rows predate templates", () => {
        expect(sql).not.toMatch(/template_id\s+text\s+not null/i);
    });

    it("indexes what the panel groups by", () => {
        expect(sql).toMatch(/create index if not exists broadcasts_template_idx/);
    });
});
