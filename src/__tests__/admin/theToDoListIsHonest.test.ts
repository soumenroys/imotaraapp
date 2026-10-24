/**
 * ✅ TO DO — one page of what is waiting (owner, 24 Oct 2026).
 * An item the system can see finished clears itself; one it cannot see is
 * marked done by a person; a source that fails is SAID, never silently empty.
 */
import { describe, it, expect } from "vitest";
import { collect, visibleTo, type TodoSource } from "@/lib/admin/todo";

const src = (area: string, roles: TodoSource["roles"], items: Partial<{ id: string; urgency: "now" | "today" | "soon"; manual: boolean }>[] | Error): TodoSource => ({
  area, roles,
  read: async () => {
    if (items instanceof Error) throw items;
    return items.map((x, i) => ({ id: x.id ?? `${area}${i}`, area, urgency: x.urgency ?? "soon", title: area, href: "/", action: "go", manual: x.manual }));
  },
});

describe("who sees what", () => {
  it("a connect reviewer sees only the shared sources", () => {
    expect(visibleTo("connect_reviewer", "all")).toBe(true);
    expect(visibleTo("connect_reviewer", "admins")).toBe(false);
    expect(visibleTo("admin", "owner")).toBe(false);
    expect(visibleTo("owner", "owner")).toBe(true);
  });
});

describe("the list", () => {
  it("most urgent first", async () => {
    const r = await collect([src("A", "all", [{ urgency: "soon" }]), src("B", "all", [{ urgency: "now" }])], "owner", {});
    expect(r.items.map((i) => i.urgency)).toEqual(["now", "soon"]);
  });
  it("✓ a manual item marked done leaves the list; a derived one cannot be hidden that way", async () => {
    const r = await collect([src("Calls", "all", [{ id: "m", manual: true }, { id: "d" }])], "owner", { m: {}, d: {} });
    expect(r.items.map((i) => i.id)).toEqual(["d"]);
  });
  it("⛔ a source that fails is reported, and the others still show", async () => {
    const r = await collect([src("Social", "all", new Error("timeout")), src("Comments", "all", [{}])], "owner", {});
    expect(r.items).toHaveLength(1);
    expect(r.problems).toEqual([{ area: "Social", error: "timeout" }]);
  });
  it("owner-only sources are not even read for an admin", async () => {
    const r = await collect([src("Broadcast mail", "owner", [{}])], "admin", {});
    expect(r.checked).toEqual([]);
  });
});

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
describe("🔗 every To do link goes somewhere real (owner: 'check and approve links … with right url')", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/admin/todoSources.ts"), "utf8");
  const hrefs = [...src.matchAll(/href: [`"]([^`"]+)[`"]/g)].map((m) => m[1]);
  it("finds the links", () => expect(hrefs.length).toBeGreaterThan(10));
  it("each path is a page that exists", () => {
    for (const h of hrefs) {
      const path = h.split("?")[0];
      expect(existsSync(join(process.cwd(), "src/app", path, "page.tsx")), `${h} has no page`).toBe(true);
    }
  });
  it("each /admin section in a link is one the admin page knows", () => {
    const page = readFileSync(join(process.cwd(), "src/app/admin/page.tsx"), "utf8");
    for (const h of hrefs) {
      const section = /section=([a-z]+)/.exec(h)?.[1];
      if (section) expect(page, `section=${section} is not a section`).toMatch(new RegExp(`\\n  ${section}:\\s+"`));
    }
  });
  it("the deep-link parameters are read by the pages they point at", () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(read("src/components/admin/BroadcastSection.tsx")).toMatch(/sp\.get\("review"\)/);
    expect(read("src/app/admin/outreach/page.tsx")).toMatch(/get\("audience"\)/);
    expect(read("src/app/admin/social/page.tsx")).toMatch(/get\("open"\)/);
    expect(read("src/app/admin/page.tsx")).toMatch(/get\("tab"\)/);
  });
});

describe("🧭 urgent first, then set-up in order (owner, 24 Oct)", () => {
  it("now → setup by step → today → soon", async () => {
    const S = (area: string, items: { id: string; urgency: "now" | "setup" | "today" | "soon"; step?: number; done?: boolean }[]): TodoSource =>
      ({ area, roles: "all", read: async () => items.map((x) => ({ ...x, area, title: x.id, href: "/", action: "go" })) });
    const r = await collect([
      S("a", [{ id: "soon", urgency: "soon" }, { id: "s3", urgency: "setup", step: 3 }]),
      S("b", [{ id: "today", urgency: "today" }, { id: "s1", urgency: "setup", step: 1, done: true }, { id: "now", urgency: "now" }]),
    ], "owner", {});
    expect(r.items.map((i) => i.id)).toEqual(["now", "s1", "s3", "today", "soon"]);
  });
  it("a finished set-up step stays on the list (ticked), so the sequence is always visible", async () => {
    const r = await collect([{ area: "Set up", roles: "all", read: async () => [{ id: "s1", area: "Set up", urgency: "setup", step: 1, done: true, title: "", href: "/", action: "" }] }], "owner", {});
    expect(r.items).toHaveLength(1);
  });
});
