/**
 * ⛔ YOUTUBE IS THE ONE CHANNEL WHERE THE STORED SECRET IS NOT THE SENT ONE.
 *
 * 🔑 EVERY TEST HERE GUARDS A FAILURE THAT IS SILENT RATHER THAN LOUD. That is
 * the whole character of this integration: each way of getting it wrong
 * produces a flow that COMPLETES, reports success, and leaves a channel that
 * stops publishing somewhere between an hour and a week later.
 *
 *   • no `access_type=offline` ⇒ no refresh token ⇒ works for one hour
 *   • no `prompt=consent`     ⇒ no refresh token on the SECOND connect ⇒
 *                               re-connecting silently achieves nothing
 *   • app left in "Testing"   ⇒ refresh token dies after 7 days
 *
 * ⚠️ None of the three announces itself, which is why they are pinned here
 * rather than trusted to review ⇒ youtube_oauth_setup_2026_10_19.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    youtubeOAuthConfig,
    youtubeConsentUrl,
    redirectUriFor,
    exchangeYouTubeCode,
    refreshYouTubeAccessToken,
    type YouTubeRefreshToken,
} from "@/lib/social/adapters/youtubeAuth";
import { youtubeTitleFrom, TITLE_MAX, YOUTUBE_UPLOAD_SCOPE } from "@/lib/social/adapters/youtube";

const CONFIG = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "https://www.imotara.com/api/admin/social/youtube/callback",
};

/** A fetch that answers once with the given status and body. */
const answers = (status: number, body: unknown) =>
    (async () =>
        new Response(typeof body === "string" ? body : JSON.stringify(body), {
            status,
        })) as unknown as typeof fetch;

describe("🔴 the consent screen asks for the thing that lasts", () => {
    it("sends access_type=offline AND prompt=consent", () => {
        const url = new URL(youtubeConsentUrl(CONFIG, "some-state"));

        // ⛔ Without this, Google returns an access token and no refresh token,
        // so the channel publishes for one hour and then stops.
        expect(url.searchParams.get("access_type")).toBe("offline");

        // ⛔ Without this, Google omits the refresh token on every
        // authorisation AFTER the first — so re-connecting a broken channel
        // completes, says it worked, and stores nothing usable.
        expect(url.searchParams.get("prompt")).toBe("consent");
    });

    it("asks for exactly one scope, and it is the narrow one", () => {
        const url = new URL(youtubeConsentUrl(CONFIG, "s"));
        // ⚠️ `youtube`, `youtube.force-ssl` and `youtubepartner` can all upload
        // too, and can do a great deal more besides. Asking for the least is
        // what keeps the consent screen honest about what this app does.
        expect(url.searchParams.get("scope")).toBe(YOUTUBE_UPLOAD_SCOPE);
        expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/youtube.upload");
    });

    it("carries the state, so a forged callback is not mistaken for ours", () => {
        expect(new URL(youtubeConsentUrl(CONFIG, "abc123")).searchParams.get("state")).toBe("abc123");
    });

    it("🔑 one function builds the redirect URI, because Google compares it exactly", () => {
        // ⚠️ `redirect_uri_mismatch` names neither copy of a path that drifted,
        // so there is only ever one copy.
        expect(redirectUriFor("https://www.imotara.com")).toBe(CONFIG.redirectUri);
        // A trailing slash on the origin must not produce a double slash.
        expect(redirectUriFor("https://www.imotara.com/")).toBe(CONFIG.redirectUri);
    });
});

describe("⛔ a grant with nothing durable in it is a failure, not a success", () => {
    it("refuses when Google returns an access token but no refresh token", async () => {
        const r = await exchangeYouTubeCode({
            config: CONFIG,
            code: "c",
            fetchImpl: answers(200, { access_token: "at", expires_in: 3599 }),
        });

        expect(r.ok).toBe(false);
        if (r.ok) return;
        // 🔑 And it says what to DO, because the remedy is not obvious: the
        // account has to forget the app before it will be asked again.
        expect(r.message).toMatch(/no refresh token/i);
        expect(r.message).toMatch(/access_type=offline|prompt=consent/);
    });

    it("accepts a grant that does carry one", async () => {
        const r = await exchangeYouTubeCode({
            config: CONFIG,
            code: "c",
            fetchImpl: answers(200, { access_token: "at", refresh_token: "rt" }),
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(String(r.refreshToken)).toBe("rt");
    });
});

describe("🔴 invalid_grant is the 7-day trap, and must not read as a bad password", () => {
    it("names the publishing status, not the client secret", async () => {
        const r = await refreshYouTubeAccessToken({
            config: CONFIG,
            refreshToken: "rt" as YouTubeRefreshToken,
            fetchImpl: answers(400, {
                error: "invalid_grant",
                error_description: "Token has been expired or revoked.",
            }),
        });

        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.kind).toBe("expired");
        // ⚠️ THE WHOLE POINT. Somebody reading this at 19:30 must be pointed at
        // the OAuth app's publishing status, not sent hunting for a typo in a
        // secret that is fine.
        expect(r.message).toMatch(/Testing/);
        expect(r.message).toMatch(/7 days/);
        expect(r.message).toMatch(/re-connect/i);
    });

    it("⛔ and a network blip is NOT reported as a revoked grant", async () => {
        const r = await refreshYouTubeAccessToken({
            config: CONFIG,
            refreshToken: "rt" as YouTubeRefreshToken,
            fetchImpl: (async () => {
                throw new Error("ECONNRESET");
            }) as unknown as typeof fetch,
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        // Sending somebody through a whole consent flow because of a dropped
        // connection is a bad half hour.
        expect(r.kind).toBe("transient");
    });

    it("tells apart a wrong client from a dead token", async () => {
        const r = await refreshYouTubeAccessToken({
            config: CONFIG,
            refreshToken: "rt" as YouTubeRefreshToken,
            fetchImpl: answers(401, { error: "invalid_client", error_description: "Unauthorized" }),
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.kind).toBe("config");
    });
});

describe("⛔ a misconfiguration names the variables, never the values", () => {
    it("says which env var is missing", () => {
        const r = youtubeOAuthConfig({ NEXT_PUBLIC_SITE_URL: "https://www.imotara.com" } as unknown as NodeJS.ProcessEnv);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.message).toMatch(/YOUTUBE_OAUTH_CLIENT_ID/);
        expect(r.message).toMatch(/YOUTUBE_OAUTH_CLIENT_SECRET/);
    });

    it("🔴 never prints a secret it was given", () => {
        // A config error that echoes the value turns a misconfiguration into a
        // credential leak — into logs, screenshots and support threads.
        const r = youtubeOAuthConfig({
            YOUTUBE_OAUTH_CLIENT_ID: "an-id",
            // deliberately empty so the error path runs with a secret present
            YOUTUBE_OAUTH_CLIENT_SECRET: "",
            NEXT_PUBLIC_SITE_URL: "https://www.imotara.com",
        } as unknown as NodeJS.ProcessEnv);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.message).not.toMatch(/an-id/);
    });
});

describe("⛔ the title comes from the post, and is never invented or cut", () => {
    it("prefers the approved subject", () => {
        expect(youtubeTitleFrom("When everything is too much at once", "A longer body. With more.")).toBe(
            "When everything is too much at once",
        );
    });

    it("falls back to the body's own opening sentence", () => {
        expect(youtubeTitleFrom(null, "Overthinking at night gets louder. Then it passes.")).toBe(
            "Overthinking at night gets louder",
        );
    });

    it("🔴 returns null rather than truncating", () => {
        // ⚠️ There is no "publish it as text instead" on YouTube, so the honest
        // outcome is to hold the post. A title cut mid-clause reads as a bug on
        // a live channel.
        const tooLong = `${"a".repeat(TITLE_MAX + 40)}.`;
        expect(youtubeTitleFrom(null, tooLong)).toBeNull();
        expect(youtubeTitleFrom(tooLong, tooLong)).toBeNull();
    });
});

/**
 * 🔴 THE TWO DEFECTS THAT MET ON 19 Oct, AND WHY BOTH ARE PINNED HERE.
 *
 * The consent succeeded, Google granted access, and the upsert was refused:
 * `scopes` is `text[]` and the callback passed a bare string, so Postgres said
 * "malformed array literal". The handling was right — it caught the error and
 * wrote the real reason into the redirect.
 *
 * ⛔ AND NOBODY SAW IT, because the redirect went to a page that read no query
 * params. A failed connect rendered an ordinary screen. The whole visible
 * symptom was a channel still reading "Not connected", which looks like not
 * having finished rather than like an error.
 *
 * 🔑 One bug cost nothing on its own. It was the SILENCE that cost the time
 * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 */
describe("⛔ the connect outcome reaches a human", () => {
    const CALLBACK = fs.readFileSync(
        path.join(process.cwd(), "src/app/api/admin/social/youtube/callback/route.ts"),
        "utf8",
    );
    const LANDING = fs.readFileSync(
        path.join(process.cwd(), "src/app/admin/social/channels/page.tsx"),
        "utf8",
    );

    it("🔴 stores scopes as an ARRAY, because the column is text[]", () => {
        // ⚠️ `scopes text[] not null default '{}'` ⇒ social_autopost_v1.sql.
        // A bare string is refused by Postgres AFTER the grant is spent, which
        // is the most expensive moment to discover a type.
        expect(CALLBACK).toMatch(/scopes:\s*\[/);
        expect(CALLBACK, "a bare string scope would be refused as a malformed array literal")
            .not.toMatch(/scopes:\s*YOUTUBE_UPLOAD_SCOPE\s*,/);
    });

    it("🔑 redirects to a page that actually reads what it is sent", () => {
        // ⛔ The pairing is the point: it is no use writing a careful message
        // into a parameter nobody consumes.
        expect(CALLBACK).toMatch(/\/admin\/social\/channels/);
        expect(LANDING, "the landing page never reads ?connected=").toMatch(/get\("connected"\)/);
        expect(LANDING, "the landing page never reads ?error=").toMatch(/get\("error"\)/);
    });

    it("⛔ and the files were really read", () => {
        // 🔑 The control. Two readFileSync calls prove nothing until one is
        // shown answering NO ⇒ trap_mutation_harness_can_report_false_caught.
        expect(CALLBACK.length).toBeGreaterThan(500);
        expect(LANDING.length).toBeGreaterThan(500);
        expect(CALLBACK).not.toMatch(/get\("nonsense-that-is-not-there"\)/);
    });
});
