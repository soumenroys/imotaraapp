/**
 * A rationed voice must say so, and say what fixes it.
 *
 * 🔴 Owner, 2026-10-10, after a long investigation into "the speech got
 * worse": "imotara should request to login for better voice assistance" and
 * "imotara should show the emil address in which the user is logged in
 * somewhere. otherwise user will get confused."
 *
 * An ANONYMOUS identity has a daily allowance for the neural voice. Past it
 * /api/tts answers 429 and playback silently becomes the browser/device
 * voice — faint, flatter, no emotion styles, and on mobile not even the
 * companion's gender. Nothing said why, and nothing said that signing in
 * removes the limit entirely.
 *
 * ⚠️ The server already sent the right words — "Daily voice limit reached.
 * Sign in for unlimited voice." — and the client threw them away.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const CHAT = "src/app/chat/page.tsx";
const HEADER = "src/components/SiteHeader.tsx";

describe("🔴 the quota is explained, not silently absorbed", () => {
    const s = read(CHAT);

    it("a 429 from /api/tts raises the nudge", () => {
        expect(s).toMatch(/\/\\bTTS 429\\b\/\.test\(err\.message\)/);
        expect(s).toMatch(/onVoiceQuotaReached\?\.\(\)/);
    });

    it("⛔ only a 429 — everything else still degrades quietly", () => {
        // A network blip has nothing useful to tell anyone; a ration does.
        const block = s.slice(s.indexOf("A 429 IS A RATION"), s.indexOf("A 429 IS A RATION") + 1400);
        expect(block).toMatch(/TTS 429/);
        expect(block).not.toMatch(/TTS 5\d\d/);
    });

    it("the message names BOTH what happened and what fixes it", () => {
        const m = /const VOICE_QUOTA_NUDGE =\s*\n?\s*"([^"]+)"/.exec(s);
        expect(m, "nudge text not found").toBeTruthy();
        const text = m![1];
        expect(text).toMatch(/limit/i);          // what happened
        expect(text).toMatch(/device voice/i);   // what you are hearing now
        expect(text).toMatch(/[Ss]ign in/);      // what to do
    });

    it("it reaches the person, not just a callback", () => {
        expect(s).toMatch(/onVoiceQuotaReached: \(\) => onNotice\?\.\(VOICE_QUOTA_NUDGE\)/);
        expect(s).toMatch(/onNotice=\{\(message\) => setChatToast\(\{ message, type: "info" \}\)\}/);
    });

    it("⛔ a broken notifier cannot stop the fallback playing", () => {
        // The reply still has to be spoken, however the nudge goes.
        expect(s).toMatch(/try \{ onVoiceQuotaReached\?\.\(\); \} catch/);
    });
});

describe("🔴 which account am I on?", () => {
    const h = read(HEADER);

    it("the header shows the signed-in email", () => {
        expect(h).toMatch(/\{mounted && user\?\.email && \(/);
        expect(h).toMatch(/\{user\.email\}/);
    });

    it("…and the narrow-screen drawer does too", () => {
        // The desktop slot hides below md, so without this a phone user
        // could never see it — which is the case that caused the confusion.
        const drawer = h.slice(h.indexOf("mobile drawer"));
        expect(drawer).toMatch(/\{user\.email\}/);
    });

    it("a long address cannot push the controls off the header", () => {
        expect(h).toMatch(/max-w-\[180px\] truncate/);
    });

    it("⚠️ it stays behind `mounted`, like the sign-in buttons", () => {
        // `user` resolves client-side; rendering it during SSR would hydrate
        // into a flicker, which is why the buttons are already guarded.
        const at = h.indexOf("user?.email");
        const guard = h.lastIndexOf("mounted &&", at);
        expect(at - guard).toBeLessThan(40);
    });
});
