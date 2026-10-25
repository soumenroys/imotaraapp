/**
 * 🆘 THE CRISIS CARD'S COUNTRY FOLLOWS WHERE THE PERSON IS, NOT THEIR LOCALE
 * (checked 25 Oct 2026): /api/chat-reply — the route both clients really use —
 * never sent the edge's country, so only the rarely-used /api/respond fallback
 * carried it, and the web never asked at all. A Bengali-locale phone in London
 * was shown Tele-MANAS, which does not dial from the UK.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the server says where the request came from", () => {
  it("GET /api/geo/country returns the edge header, upper-cased, and nothing else", async () => {
    const { GET } = await import("@/app/api/geo/country/route");
    const at = (h?: string) => GET(new NextRequest("https://x.test/api/geo/country", { headers: h ? { "x-vercel-ip-country": h } : {} }));
    expect(await (await at("gb")).json()).toEqual({ country: "GB" });
    expect(await (await at()).json()).toEqual({ country: null });
    expect(await (await at("not-a-country")).json()).toEqual({ country: null });
    expect((await at("IN")).headers.get("cache-control")).toMatch(/no-store/);
  });
  it("chat-reply sends it FIRST on a stream, and in meta on JSON replies", () => {
    const r = src("src/app/api/chat-reply/route.ts");
    const stream = r.slice(r.indexOf('searchParams.get("stream") === "1"'));
    expect(stream.indexOf("{ meta: { resolvedCountry } }")).toBeGreaterThan(-1);
    expect(stream.indexOf("{ meta: { resolvedCountry } }")).toBeLessThan(stream.indexOf("streamImotaraAI("));
    expect(r).toMatch(/framework: "three-part-v1",\n\s+resolvedCountry: edgeCountry\(req\)/);
  });
});

describe("⛔ an older client is not broken by the new event", () => {
  it("both stream readers only take events that carry t", () => {
    // Web reader: `const { t } = JSON.parse(data)` then `if (t)`.
    expect(src("src/lib/imotara/respondRemote.ts")).toMatch(/const \{ t \} = JSON\.parse\(data\)[\s\S]{0,60}if \(t\)/);
  });
});

describe("the web chat prefers it, but never waits for it", () => {
  it("Settings choice > edge country > locale guess", () => {
    const page = src("src/app/chat/page.tsx");
    expect(page).toMatch(/\(override && override !== "auto"\) \? override : \(edgeCountry \?\? detectCountryCode\(\)\)/);
    expect(page).toMatch(/fetch\("\/api\/geo\/country"/);
  });
});
