// src/lib/admin/todo.ts
// The admin's "To do": everything waiting for a person, from every part of the
// panel, in one list — most urgent first.
//
// 🔑 OWNER, 24 Oct 2026: "one main page where admin can login and see his/her
// immediate action points; once admin takes the action, that action point will
// be marked as done".
//
// ⚠️ TWO KINDS OF ITEM:
//   · DERIVED — read live from where the work is (a draft waiting, a failed
//     post). It disappears by itself the moment the thing is done, because the
//     thing itself changed. Nothing to tick.
//   · MANUAL — work that happens outside the system (call this person back,
//     send the details, hold the meeting). These carry `manual: true`; the page
//     offers "Mark done", recorded with who and when ⇒ todoDone.ts. The id
//     includes the event's own timestamp, so a NEW call needing a person comes
//     back even if an older one was marked done.
//
// ⛔ ONE SOURCE FAILING NEVER HIDES THE REST. Each source is read on its own;
// a failure becomes a visible "could not check …" line, never an empty list
// that reads as "nothing to do".

/**
 * 🔑 "setup" is the numbered checklist an admin works through IN ORDER before
 * anything can run by itself (owner, 24 Oct 2026: "the admin first need to fill
 * up google sheet properly … create the to-do list priority wise or sequence
 * wise"). Shown after "now", before "today".
 */
export type Urgency = "now" | "setup" | "today" | "soon";

export type TodoItem = {
  id: string;
  area: string;
  urgency: Urgency;
  title: string;
  detail?: string;
  href: string;
  action: string;
  /** Needs a person to say it is done (nothing in the system can see it). */
  manual?: boolean;
  /** Set-up steps: their place in the sequence, and whether they are already done. */
  step?: number;
  done?: boolean;
};

export type TodoSource = { area: string; roles: "all" | "admins" | "owner"; read: () => Promise<TodoItem[]> };

export type TodoResult = { items: TodoItem[]; problems: { area: string; error: string }[]; checked: string[] };

const RANK: Record<Urgency, number> = { now: 0, setup: 1, today: 2, soon: 3 };

/** Who may see a source: a connect reviewer only the "all" ones; an admin all but owner-only. */
export function visibleTo(role: string, roles: TodoSource["roles"]): boolean {
  if (roles === "all") return true;
  if (role === "connect_reviewer") return false;
  return roles === "admins" || role === "owner";
}

export async function collect(sources: TodoSource[], role: string, done: Record<string, unknown>): Promise<TodoResult> {
  const mine = sources.filter((s) => visibleTo(role, s.roles));
  const settled = await Promise.allSettled(mine.map((s) => s.read()));
  const items: TodoItem[] = [];
  const problems: TodoResult["problems"] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else problems.push({ area: mine[i].area, error: (r.reason as Error)?.message ?? String(r.reason) });
  });
  return {
    items: items
      .filter((x) => !(x.manual && done[x.id]))
      .sort((a, b) => RANK[a.urgency] - RANK[b.urgency] || (a.step ?? 0) - (b.step ?? 0) || a.area.localeCompare(b.area)),
    problems,
    checked: mine.map((s) => s.area),
  };
}
