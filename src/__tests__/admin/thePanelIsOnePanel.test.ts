/**
 * The admin panel's shared furniture.
 *
 * 🔴 WHAT THE OWNER SAW: "Activity, Crisis Event and Social three buttons look
 * separate than comment, license etc." They were — seven sections in a pill
 * group and three routes hanging off the end as separately coloured chips,
 * because the first seven switch state and the last three are URLs. The reader
 * was being shown an implementation detail.
 *
 * ⚠️ AND "some of the menus and pages look isolated from the main Imotara
 * theme": the social screens painted their own full-screen background and used
 * the zinc palette for surfaces while /admin used white alphas — two design
 * languages in one product.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ADMIN_NAV, navFor } from "@/app/admin/_components/ui";
import { ADMIN_TUTORIALS } from "@/app/admin/_components/adminTutorials";
import { resetBeforePaintScript, CONSUMER_APPEARANCE, ADMIN_APPEARANCE_KEY } from "@/app/admin/_components/appearance";
// ⚠️ The social section keeps its own five, one per screen — its nav entry
// lands on Today. A walkthrough is a walkthrough wherever it is declared.
import { TUTORIALS as SOCIAL_TUTORIALS } from "@/app/admin/social/_components/PageTutorial";

const walkthroughFor = (key: string) =>
  key === "social" ? SOCIAL_TUTORIALS.today : ADMIN_TUTORIALS[key];

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("one nav, with everything in it", () => {
  it("⛔ the three pages that used to hang off the end are in the list", () => {
    for (const key of ["analytics", "crisis", "social"])
      expect(ADMIN_NAV.find((i) => i.key === key), `${key} is not in the nav`).toBeTruthy();
  });

  it("every destination has somewhere to go", () => {
    for (const item of ADMIN_NAV) {
      expect(item.href.startsWith("/admin"), `${item.key} points outside the panel`).toBe(true);
      expect(item.label.length).toBeGreaterThan(2);
    }
  });

  it("⚠️ a section of /admin deep-links to itself, so a sub-page can return to it", () => {
    // 🔑 Without ?section= the nav on Activity could only ever send you to the
    // panel's default tab, which is why those three were links to nowhere useful.
    for (const item of ADMIN_NAV.filter((i) => !i.route))
      expect(item.href).toBe(`/admin?section=${item.key}`);
  });

  it("the main page understands that parameter", () => {
    const page = read("src/app/admin/page.tsx");
    expect(page).toMatch(/searchParams\.get\("section"\)/);
    expect(page, "the section is not written back to the URL").toMatch(/replaceState/);
    // ⛔ replaceState, not push: seven tab changes must not fill the Back button.
    expect(page).not.toMatch(/history\.pushState/);
  });
});

describe("who sees what", () => {
  it("a connect reviewer sees only their two screens", () => {
    const keys = navFor("connect_reviewer").map((i) => i.key);
    expect(keys.sort()).toEqual(["comments", "connect"]);
  });

  it("⛔ broadcast is owner-only, because it speaks to everybody at once", () => {
    expect(navFor("admin").find((i) => i.key === "broadcast")).toBeUndefined();
    expect(navFor("owner").find((i) => i.key === "broadcast")).toBeTruthy();
  });

  it("an owner sees every destination", () => {
    expect(navFor("owner")).toHaveLength(ADMIN_NAV.length);
  });
});

describe("every screen explains itself", () => {
  it("🔴 each nav destination has a walkthrough", () => {
    // The owner asked for a step-by-step on all pages. Social had one; the
    // screens where a wrong click costs somebody access had none.
    for (const item of ADMIN_NAV) {
      const t = walkthroughFor(item.key);
      expect(t, `${item.key} has no tutorial`).toBeTruthy();
      expect(t.steps.length, `${item.key} has too few steps`).toBeGreaterThanOrEqual(3);
    }
  });

  it("⚠️ steps are instructions, not descriptions", () => {
    for (const [key, t] of Object.entries(ADMIN_TUTORIALS))
      for (const s of t.steps) {
        expect(s.do.length, `${key} has an empty step`).toBeGreaterThan(12);
        // ⛔ "This page lets you…" tells the reader what they can already see.
        expect(/^this (page|screen|section)/i.test(s.do), `${key}: "${s.do}" describes instead of instructs`).toBe(false);
      }
  });

  it("stays short — the channels screen once ran to 1,800 words and nobody read it", () => {
    for (const [key, t] of [...Object.entries(ADMIN_TUTORIALS), ...Object.entries(SOCIAL_TUTORIALS)]) {
      const words = [t.title, t.footnote ?? "", ...t.steps.flatMap((s) => [s.do, s.then ?? ""])]
        .join(" ").split(/\s+/).length;
      expect(words, `${key} is ${words} words`).toBeLessThan(230);
    }
  });
});

describe("the panel reads as one product", () => {
  const socialFiles = readdirSync(join(process.cwd(), "src/app/admin/social"), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => join("src/app/admin/social", f));

  it("🔴 no social screen paints its own full-screen background any more", () => {
    // That `bg-zinc-950` on <main> is what "looks black in all pages" was.
    for (const f of socialFiles)
      expect(read(f), `${f} still paints its own page background`).not.toMatch(/min-h-screen[^"]*bg-zinc-950/);
  });

  it("⛔ and none uses zinc for a surface", () => {
    /**
     * 🔑 Two reasons. It is a different design language from the rest of the
     * panel, and globals.css INVERTS the zinc palette under
     * [data-theme="light"] — so bg-zinc-900 renders light on a light page. The
     * admin layout strips that attribute now, which makes zinc survivable, but
     * white alphas are correct either way.
     */
    for (const f of socialFiles) {
      const bad = read(f).match(/\b(?:hover:)?(?:bg|border)-zinc-(?:7|8|9)\d\d\b/g);
      expect(bad, `${f} uses ${bad?.join(", ")}`).toBeNull();
    }
  });

  it("the social shell sits inside the shared one", () => {
    expect(read("src/app/admin/social/_components/ui.tsx")).toMatch(/<AdminShell/);
  });
});

describe("the consumer app's appearance is neutralised once, for everything", () => {
  it("🔴 the layout strips the theme AND the font size", () => {
    /**
     * data-theme inverts the zinc palette. data-fontsize sets the html
     * font-size to 14, 16 or 18px, so every rem in the panel scaled with a
     * preference somebody set months ago in the consumer app — which is what
     * "the font and styles are not exactly matching" was.
     */
    const chrome = read("src/app/admin/_components/AdminChrome.tsx");
    for (const attr of ["data-theme", "data-fontsize", "data-accent"])
      expect(chrome, `${attr} is not neutralised`).toContain(attr);
    expect(chrome).toMatch(/removeAttribute/);
    // ⚠️ And handed back, so visiting the panel does not reset somebody's app.
    expect(chrome).toMatch(/setAttribute/);
  });

  it("⛔ no admin page keeps its own copy of that effect", () => {
    // Three had one and five social screens had none, which is exactly how
    // the social screens ended up broken for anyone in light mode.
    for (const f of ["src/app/admin/page.tsx", "src/app/admin/analytics/page.tsx", "src/app/admin/crisis-events/page.tsx"])
      expect(read(f).includes('html.removeAttribute("data-theme")'), `${f} still has its own copy`).toBe(false);
  });

  it("and it covers every admin route by being the layout", () => {
    expect(read("src/app/admin/layout.tsx")).toMatch(/AdminChrome/);
  });

  it("\u2460 strips them BEFORE the first paint, not in an effect", () => {
    /**
     * \ud83d\udd34 THE THEME SHIFT THE OWNER SAW. The root layout sets data-theme from a
     * blocking script in <head>, so the admin's HTML painted with the CONSUMER
     * theme on it. An effect runs after hydration \u2014 measured on production:
     * first paint 316ms, attribute still present then, gone by 401ms. For that
     * window `[data-theme="light"]` was active and it INVERTS the zinc palette
     * the admin is built on, so the panel flashed light-and-wrong before
     * snapping to dark. Not two designs disagreeing \u2014 one page painting twice.
     */
    const layout = read("src/app/admin/layout.tsx");
    expect(layout, "no pre-paint script").toMatch(/dangerouslySetInnerHTML/);
    // \u26a0\ufe0f The script BODY lives in appearance.ts now \u2014 it cannot live in a
    // client module, and building it inline in the layout is what hid the
    // `undefined` bug. Assert on what the function returns.
    expect(resetBeforePaintScript()).toMatch(/removeAttribute/);
    // \u26d4 And it must run before the children, or it is not before their paint.
    expect(layout.indexOf("dangerouslySetInnerHTML")).toBeLessThan(layout.indexOf("<AdminChrome>"));
  });

  it("\ud83d\udd34 the script that ships is a REAL script, not one full of `undefined`", () => {
    /**
     * \ud83d\udd34 THE FIX SHIPPED AND DID NOTHING. The constants lived in
     * AdminChrome.tsx, a "use client" module. Next.js replaces a client
     * module's exports with client REFERENCES when a server component imports
     * them, so on the server both were `undefined` and production received:
     *
     *     var d=document.documentElement,k=undefined,s={};
     *     for(var i=0;i<k.length;i++){ ... }
     *     window[undefined]=s;
     *
     * `k.length` threw, the try/catch swallowed it, and the flash was
     * untouched. Found by reading the HTML the server actually sent.
     *
     * \u26a0\ufe0f The previous test asserted the layout "contains
     * dangerouslySetInnerHTML and removeAttribute" \u2014 both true of that broken
     * script. Checking the SHAPE of code cannot tell you its VALUES.
     */
    const script = resetBeforePaintScript();
    expect(script, "a value evaluated to undefined").not.toContain("undefined");
    for (const attr of CONSUMER_APPEARANCE) expect(script).toContain(attr);
    expect(script).toContain(ADMIN_APPEARANCE_KEY);
    // \u26d4 And it must actually be runnable.
    expect(() => new Function(script)).not.toThrow();
  });

  it("\u26d4 the constants do not live in a \"use client\" module", () => {
    // That is the mistake, stated as a rule: a value shared between a server
    // component and a client one belongs in a module that is neither.
    const plain = read("src/app/admin/_components/appearance.ts");
    expect(plain.slice(0, 400)).not.toMatch(/^\s*["']use client["']/m);
    expect(read("src/app/admin/layout.tsx")).toMatch(/from "@\/app\/admin\/_components\/appearance"/);
  });

  it("\u26a0\ufe0f the script hands the originals to the component, which cannot re-read them", () => {
    /**
     * \u26d4 THE WAY THIS FIX COULD BREAK THE CONSUMER APP. By the time
     * AdminChrome's effect runs the attributes are already gone. Reading them
     * there would capture nulls and restore nothing \u2014 so anybody who merely
     * visited the panel would find /chat dark for the rest of the session.
     */
    const chrome = read("src/app/admin/_components/AdminChrome.tsx");
    expect(resetBeforePaintScript()).toContain(ADMIN_APPEARANCE_KEY);
    expect(chrome).toMatch(/w\[ADMIN_APPEARANCE_KEY\] \?\?/);
    // \ud83d\udd11 The fallback is load-bearing: on a client-side nav back into /admin
    // the layout HTML is not re-sent, so the script does not run again.
    expect(chrome).toMatch(/CONSUMER_APPEARANCE\.map\(\(name\) => \[name, html\.getAttribute\(name\)\]\)/);
  });
});
