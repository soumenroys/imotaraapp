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
