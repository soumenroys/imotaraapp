// #167 — imotaraapp.vercel.app pages move to www.imotara.com; the API never does.
import { describe, expect, it } from "vitest";
import fs from "fs";
import { canonicalRedirect } from "@/lib/seo/canonicalHost";

const V = "imotaraapp.vercel.app";

describe("canonicalRedirect", () => {
    it("pages on Vercel's address go to www.imotara.com, query kept", () => {
        expect(canonicalRedirect(V, "GET", "/answers/exam-stress", "")).toBe("https://www.imotara.com/answers/exam-stress");
        expect(canonicalRedirect(V, "GET", "/", "?utm_source=x")).toBe("https://www.imotara.com/?utm_source=x");
        expect(canonicalRedirect("IMOTARAAPP.vercel.app:443", "HEAD", "/chat", "")).toBe("https://www.imotara.com/chat");
    });

    it("⛔ never the API, sign-in callbacks, Next assets, app links or files", () => {
        for (const p of ["/api/tts", "/api/chat-reply", "/api", "/auth/callback", "/auth/callback-mobile", "/_next/static/x.js", "/.well-known/assetlinks.json", "/manifest.webmanifest", "/sw.js", "/robots.txt", "/og.png"]) {
            expect(canonicalRedirect(V, "GET", p, "")).toBeNull();
        }
    });

    it("⛔ never a POST (a cross-origin hop would drop the Authorization header)", () => {
        expect(canonicalRedirect(V, "POST", "/answers", "")).toBeNull();
    });

    it("other hosts are untouched (www, previews, localhost)", () => {
        for (const h of ["www.imotara.com", "imotaraapp-abc123-soumen-roys-projects.vercel.app", "localhost:3000", null]) {
            expect(canonicalRedirect(h as any, "GET", "/answers", "")).toBeNull();
        }
    });

    it("runs FIRST in the proxy, before any other work", () => {
        const src = fs.readFileSync("src/proxy.ts", "utf8");
        const body = src.slice(src.indexOf("export async function middleware"));
        expect(body.indexOf("canonicalRedirect(")).toBeGreaterThan(-1);
        expect(body.indexOf("canonicalRedirect(")).toBeLessThan(body.indexOf("blockedPrefixes"));
    });
});
