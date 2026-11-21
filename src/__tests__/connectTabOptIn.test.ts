/**
 * #108 (owner, 22 Nov 2026): "add a setting with selected as off. if user check it on, only then
 * connect will be shown" — web, Android and iOS, OFF by default.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readShowConnect, writeShowConnect, SHOW_CONNECT_KEY, SHOW_CONNECT_EVENT } from "@/lib/imotara/connectVisibility";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// No DOM test environment here — a minimal window: real EventTarget + a Map-backed localStorage.
const store = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  clear: () => store.clear(),
};
const win = Object.assign(new EventTarget(), { localStorage });
(globalThis as any).window = win;
const window = win;

describe("Show Connect — off by default", () => {
  beforeEach(() => localStorage.clear());

  it("nothing stored ⇒ OFF", () => {
    expect(readShowConnect()).toBe(false);
  });

  it("only an explicit '1' turns it on; anything else is OFF", () => {
    for (const v of ["0", "true", "yes", ""]) {
      localStorage.setItem(SHOW_CONNECT_KEY, v);
      expect(readShowConnect()).toBe(false);
    }
    localStorage.setItem(SHOW_CONNECT_KEY, "1");
    expect(readShowConnect()).toBe(true);
  });

  it("switching tells the open page at once (header + footer listen)", () => {
    let heard: unknown = null;
    window.addEventListener(SHOW_CONNECT_EVENT, (e) => { heard = (e as CustomEvent).detail; });
    writeShowConnect(true);
    expect(readShowConnect()).toBe(true);
    expect(heard).toBe(true);
    writeShowConnect(false);
    expect(readShowConnect()).toBe(false);
  });
});

describe("every place that INVITES people to Connect follows the switch", () => {
  it("header: the Connect tab is filtered out unless switched on (desktop + mobile drawer)", () => {
    const h = src("src/components/SiteHeader.tsx");
    expect(h).toContain('PRIMARY_LINKS.filter((l) => l.href !== "/connect" || showConnect)');
    expect(h).not.toMatch(/PRIMARY_LINKS\.map\(/);
    expect((h.match(/primaryLinks\.map\(/g) ?? []).length).toBe(2);
    expect(h).toMatch(/const \[showConnect, setShowConnect\] = useState\(false\)/);
  });

  it("footer: the Connect link is wrapped in ShowWhenConnectOn", () => {
    expect(src("src/components/SiteFooter.tsx")).toMatch(/href === "\/connect" \? <ShowWhenConnectOn/);
    expect(src("src/components/imotara/ShowWhenConnectOn.tsx")).toMatch(/useState\(false\)/);
  });

  it("chat: the 'Explore Connect' tip is skipped while Connect is off", () => {
    expect(src("src/app/chat/page.tsx")).toContain('(id !== "connect_translation" || readShowConnect())');
  });

  it("settings has the switch, starting OFF", () => {
    const s = src("src/app/settings/page.tsx");
    expect(s).toMatch(/const \[showConnectTab, setShowConnectTab\] = useState\(false\)/);
    expect(s).toContain("handleShowConnectToggle(!showConnectTab)");
  });
});
