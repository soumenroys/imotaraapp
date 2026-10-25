import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

/**
 * /open/* is claimed by the app (assetlinks.json + apple-app-site-association).
 * With the app installed the phone opens it; without the app the same link
 * reached the website and 404'd (found 26 Oct 2026). It now falls through to
 * the matching web page.
 */
describe("an /open link without the app lands on a real page", () => {
    it("redirects /open to home and /open/<page> to /<page>, temporarily", async () => {
        const rules = await (nextConfig as { redirects: () => Promise<{ source: string; destination: string; permanent: boolean }[]> }).redirects();
        expect(rules).toContainEqual({ source: "/open", destination: "/", permanent: false });
        expect(rules).toContainEqual({ source: "/open/:path*", destination: "/:path*", permanent: false });
    });
});
