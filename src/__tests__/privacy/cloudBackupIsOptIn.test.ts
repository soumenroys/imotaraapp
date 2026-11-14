// #94 (owner, 14 Nov 2026): cloud backup of chat history is OPT-IN on the web.
//
// 🔴 What this guards: every web message used to be POSTed to /api/history
// with no consent check, while every public text promised "history stays on
// your device; backup is off unless you turn it on". The owner chose to make
// the product match the promise.
//
// ⚠️ A text assertion cannot see reachability (trap_text_assertions_cannot_see_
// reachability) — so each gate is pinned as the FIRST statement of the
// function it guards, not merely "somewhere in the file".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLOUD_BACKUP_STORAGE_KEY, isCloudBackupOn, setCloudBackupOn } from "@/lib/imotara/cloudBackup";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** The body of `function name(...)` up to its first statement. */
function firstStatement(src: string, signature: RegExp): string {
    const m = signature.exec(src);
    expect(m, `signature ${signature} not found`).not.toBeNull();
    const after = src.slice(m!.index + m![0].length);
    const body = after.slice(after.indexOf("{") + 1);
    return body
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("//"))[0];
}

// A minimal browser storage — this suite runs in node (no jsdom installed).
beforeAll(() => {
    const store = new Map<string, string>();
    (globalThis as any).window = {
        localStorage: {
            getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
            setItem: (k: string, v: string) => void store.set(k, String(v)),
            removeItem: (k: string) => void store.delete(k),
            clear: () => store.clear(),
        },
    };
});

describe("cloud backup switch", () => {
    afterEach(() => (globalThis as any).window.localStorage.clear());

    it("is OFF when nothing was ever chosen — including for earlier visitors", () => {
        expect(isCloudBackupOn()).toBe(false);
    });

    it("turns on and off, and off removes the key entirely", () => {
        setCloudBackupOn(true);
        expect(isCloudBackupOn()).toBe(true);
        expect(window.localStorage.getItem(CLOUD_BACKUP_STORAGE_KEY)).toBe("on");
        setCloudBackupOn(false);
        expect(isCloudBackupOn()).toBe(false);
        expect(window.localStorage.getItem(CLOUD_BACKUP_STORAGE_KEY)).toBeNull();
    });

    it("any other stored value counts as off", () => {
        window.localStorage.setItem(CLOUD_BACKUP_STORAGE_KEY, "true");
        expect(isCloudBackupOn()).toBe(false);
    });
});

describe("every cloud write/pull on the web asks the switch first", () => {
    const chat = read("src/app/chat/page.tsx");
    const history = read("src/components/imotara/EmotionHistory.tsx");
    const settings = read("src/app/settings/page.tsx");

    it("chat: pushToRemoteHistory returns before any fetch when backup is off", () => {
        expect(firstStatement(chat, /async function pushToRemoteHistory\([\s\S]*?\): Promise<void>/)).toBe(
            "if (!isCloudBackupOn()) return;",
        );
    });

    it("chat: fetchRemoteHistory pulls nothing when backup is off", () => {
        expect(firstStatement(chat, /async function fetchRemoteHistory\(\): Promise<unknown\[\]>/)).toBe(
            "if (!isCloudBackupOn()) return [];",
        );
    });

    it("History page: the silent auto-seed from the cloud needs backup on", () => {
        expect(history).toMatch(/if \(!cancelled && isCloudBackupOn\(\) && list\.filter/);
    });

    it("History page: manual / timed sync stops first when backup is off", () => {
        expect(firstStatement(history, /async function manualSync\(\)/)).toBe("if (!isCloudBackupOn()) {");
    });

    it("Settings: 'Back up now' refuses while backup is off, and the button is disabled", () => {
        expect(settings).toMatch(/async function handleSyncNow\(\) \{\s*if \(syncBusy\) return;\s*if \(!isCloudBackupOn\(\)\)/);
        expect(settings).toMatch(/disabled=\{syncBusy \|\| !cloudBackup\}/);
    });

    it("Settings: signing out switches backup off", () => {
        expect(settings).toMatch(/await sb\.auth\.signOut\(\);\s*setCloudBackupOn\(false\)/);
    });

    it("no other web file writes to /api/history behind the switch's back", () => {
        // Deletes are allowed everywhere (taking data away from us is always fine).
        const writers = [chat, history].join("\n").match(/fetch\("\/api\/history",\s*\{\s*method: "POST"/g) ?? [];
        expect(writers.length).toBe(1); // the one in pushToRemoteHistory
    });
});
