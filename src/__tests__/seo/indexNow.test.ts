// src/__tests__/seo/indexNow.test.ts
// 🔑 Owner, 30 Oct 2026: tell Bing (⇒ ChatGPT search, Copilot, DuckDuckGo) about
// the site, once per production deployment.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { INDEXNOW_KEY, MAX_URLS, buildPayload, shouldSubmit } from "@/lib/seo/indexNow";

describe("the key file proves ownership", () => {
  it("public/<key>.txt exists and holds exactly the key", () => {
    const f = join(process.cwd(), "public", `${INDEXNOW_KEY}.txt`);
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, "utf8").trim()).toBe(INDEXNOW_KEY);
  });
  it("the key is the 8–128 hex/dash characters IndexNow accepts", () => expect(INDEXNOW_KEY).toMatch(/^[a-f0-9-]{8,128}$/));
  it("robots.txt does not block the key file", () => {
    const robots = readFileSync(join(process.cwd(), "src/app/robots.ts"), "utf8");
    expect(robots).not.toMatch(/disallow[^\n]*\.txt/i);
  });
});

describe("the request", () => {
  it("one host, key location on that host, duplicates dropped", () => {
    const p = buildPayload(["https://www.imotara.com/", "https://www.imotara.com/faq", "https://www.imotara.com/faq"])!;
    expect(p).toEqual({
      host: "www.imotara.com",
      key: INDEXNOW_KEY,
      keyLocation: `https://www.imotara.com/${INDEXNOW_KEY}.txt`,
      urlList: ["https://www.imotara.com/", "https://www.imotara.com/faq"],
    });
  });
  it("⛔ another host or plain http is never mixed in (IndexNow rejects the whole request)", () => {
    const p = buildPayload(["https://www.imotara.com/a", "https://imotara.com/b", "http://www.imotara.com/c", "not a url"])!;
    expect(p.urlList).toEqual(["https://www.imotara.com/a"]);
  });
  it("nothing usable ⇒ nothing sent", () => expect(buildPayload(["http://localhost:3000/"])).toBeNull());
  it("capped at IndexNow's limit", () => {
    const urls = Array.from({ length: MAX_URLS + 5 }, (_, i) => `https://www.imotara.com/p${i}`);
    expect(buildPayload(urls)!.urlList).toHaveLength(MAX_URLS);
  });
});

describe("⛔ once per deployment — never a daily flood", () => {
  it("a new deployment ⇒ submit", () => expect(shouldSubmit("dpl_old", "dpl_new")).toBe(true));
  it("the same deployment ⇒ not again", () => expect(shouldSubmit("dpl_same", "dpl_same")).toBe(false));
  it("first ever run ⇒ submit", () => expect(shouldSubmit(null, "dpl_1")).toBe(true));
  it("no deployment id (local or unknown) ⇒ never", () => expect(shouldSubmit(null, undefined)).toBe(false));
});

describe("the job", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/cron/indexnow/route.ts"), "utf8");
  it("runs only in production — a preview must never announce its URLs as the site's", () =>
    expect(route).toMatch(/VERCEL_ENV !== "production"/));
  it("is authorised like every cron, and is a GET", () => {
    expect(route).toMatch(/cronAuthorised\(req\)/);
    expect(route).toMatch(/export async function GET/);
  });
  it("remembers the deployment only after IndexNow accepted it", () => {
    expect(route.indexOf("if (!r.ok)")).toBeLessThan(route.indexOf('from("app_settings").upsert'));
  });
  it("is scheduled", () => expect(readFileSync(join(process.cwd(), "vercel.json"), "utf8")).toMatch(/"\/api\/cron\/indexnow"/));
});
