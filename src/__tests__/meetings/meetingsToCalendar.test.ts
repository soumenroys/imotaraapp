/**
 * 🔑 AGREED MEETINGS ⇒ THE IMOTARA CALENDAR — owner, 31 Oct 2026 (corrected), 1 Nov 2026.
 *
 * A person agrees to meet the team on a date and time ⇒ an event in the
 * imotara.imotara@gmail.com calendar at exactly that time IN THEIR TIME ZONE,
 * with Tapan, Suchismita and the person invited. Nothing more: no other slots,
 * no video link, no approval step.
 */
import { describe, it, expect, vi } from "vitest";
import { COLUMNS, type Column, type Contact } from "@/lib/voice/rules";
import { BOOKED_MARK, MEETING_TEAM, bookedMark, meetingEvent, meetingEventId, meetingWork } from "@/lib/meetings/plan";
import { calendarConsentUrl, exchangeCalendarCode, idTokenEmail, putEvent } from "@/lib/meetings/calendar";

const contact = (over: Partial<Record<Column, string>> = {}, row = 2): Contact => {
  const blank = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as Record<Column, string>;
  return {
    tab: "Eldercare", row,
    v: {
      ...blank, phone: "+44 20 7946 0000", name: "Margaret", organisation: "Rosewood Care", country: "GB", time_zone: "Europe/London",
      email: "margaret@rosewood.org", consent_note: "Asked for a call at the fair", ambassador_notes: "prefers mornings", call_summary: "keen",
      meeting_date: "2026-11-04", meeting_time: "15:00",
      ...over,
    },
  };
};
const NOW = new Date("2026-11-01T12:00:00Z");

describe("which rows become meetings", () => {
  it("books at the PERSON'S local time — 15:00 in London is 15:00 UTC in November", () => {
    const [w] = meetingWork([contact()], NOW);
    expect(w.kind).toBe("book");
    if (w.kind !== "book") return;
    expect(w.event.start).toEqual({ dateTime: "2026-11-04T15:00:00.000Z", timeZone: "Europe/London" });
    expect(w.mark).toBe(bookedMark("2026-11-04 15:00", "Europe/London", "margaret@rosewood.org"));
  });

  it("follows the row's own zone: 10:00 in New York is 15:00 UTC", () => {
    const [w] = meetingWork([contact({ time_zone: "America/New_York", meeting_time: "10:00" })], NOW);
    expect(w.kind === "book" && w.event.start.dateTime).toBe("2026-11-04T15:00:00.000Z");
  });

  it("Meeting time zone, when filled, wins over the row's zone", () => {
    const [w] = meetingWork([contact({ meeting_time_zone: "Asia/Kolkata", meeting_time: "20:30" })], NOW);
    expect(w.kind === "book" && w.event.start).toEqual({ dateTime: "2026-11-04T15:00:00.000Z", timeZone: "Asia/Kolkata" });
  });

  it("invites Tapan, the social@ mailbox AND the person (Suchismita resigned 3 Nov)", () => {
    const [w] = meetingWork([contact()], NOW);
    expect(w.kind === "book" && w.event.attendees.map((a) => a.email)).toEqual(["tapan@imotara.com", "social@imotara.com", "margaret@rosewood.org"]);
    expect(MEETING_TEAM).toEqual(["tapan@imotara.com", "social@imotara.com"]);
  });

  it("no email for the person: still booked for the team, and the sheet says to add it", () => {
    const [w] = meetingWork([contact({ email: "" })], NOW);
    expect(w.kind === "book" && w.event.attendees).toHaveLength(2);
    expect(w.kind === "book" && w.mark).toMatch(/no email/);
  });

  it("a row without a meeting date or time is left completely alone", () => {
    expect(meetingWork([contact({ meeting_date: "", meeting_time: "" })], NOW)).toEqual([]);
  });

  it("half-filled or unreadable ⇒ a plain reason in the sheet, nothing booked", () => {
    const [a] = meetingWork([contact({ meeting_time: "" })], NOW);
    expect(a).toMatchObject({ kind: "problem", mark: "⛔ Not booked — Add a meeting time" });
    const [b] = meetingWork([contact({ time_zone: "Mars/Olympus" })], NOW);
    expect(b.kind).toBe("problem");
  });

  it("a time already passed is not booked", () => {
    const [w] = meetingWork([contact({ meeting_date: "2026-10-30" })], NOW);
    expect(w).toMatchObject({ kind: "problem" });
    expect(w.mark).toMatch(/already passed/);
  });

  it("'Stop all contact?' yes ⇒ not booked", () => {
    expect(meetingWork([contact({ do_not_contact: "yes" })], NOW)[0]).toMatchObject({ kind: "problem" });
  });

  it("the same problem is written once, not every 10 minutes", () => {
    expect(meetingWork([contact({ meeting_time: "", meeting_booked: "⛔ Not booked — Add a meeting time" })], NOW)).toEqual([]);
  });
});

describe("one event per person — never a second one", () => {
  it("already booked as the sheet says ⇒ nothing to do", () => {
    const booked = bookedMark("2026-11-04 15:00", "Europe/London", "margaret@rosewood.org");
    expect(meetingWork([contact({ meeting_booked: booked })], NOW)).toEqual([]);
  });

  it("the team changes the time ⇒ the SAME event is updated", () => {
    const booked = bookedMark("2026-11-04 15:00", "Europe/London", "margaret@rosewood.org");
    const [w] = meetingWork([contact({ meeting_booked: booked, meeting_time: "16:00" })], NOW);
    expect(w.kind).toBe("update");
    expect(w.kind === "update" && w.event.id).toBe(meetingEventId(contact()));
  });

  it("an email added after booking updates the event, with the same id", () => {
    const booked = bookedMark("2026-11-04 15:00", "Europe/London", null);
    const [w] = meetingWork([contact({ meeting_booked: booked })], NOW);
    expect(w.kind).toBe("update");
    expect(meetingEventId(contact({ email: "" }))).toBe(meetingEventId(contact()));
  });

  it("a new person typed over the row gets a new event, not the old one", () => {
    expect(meetingEventId(contact({ phone: "+1 212 555 0100", name: "Ana" }))).not.toBe(meetingEventId(contact()));
  });

  it("the id is one Google accepts (a–v, 0–9, 5–1024 chars)", () => {
    expect(meetingEventId(contact())).toMatch(/^[a-v0-9]{5,1024}$/);
  });

  it("a booked meeting is never cancelled by a later stop or a blanked time", () => {
    const booked = `${BOOKED_MARK} 2026-11-04 15:00 Europe/London`;
    expect(meetingWork([contact({ meeting_booked: booked, do_not_contact: "yes" })], NOW)).toEqual([]);
    expect(meetingWork([contact({ meeting_booked: booked, meeting_time: "" })], NOW)).toEqual([]);
  });
});

describe("🔴 the person is a guest — the event shows only what they already know", () => {
  it("no team notes, consent note, call summary or phone number", () => {
    const e = meetingEvent(contact(), new Date("2026-11-04T15:00:00Z"), "Europe/London", "margaret@rosewood.org");
    const shown = `${e.summary}\n${e.description}`;
    for (const secret of ["prefers mornings", "Asked for a call", "keen", "7946"]) expect(shown).not.toContain(secret);
    expect(e.summary).toBe("Imotara × Rosewood Care");
  });

  it("no video link or extra slots were added (owner removed those)", () => {
    const e = meetingEvent(contact(), new Date("2026-11-04T15:00:00Z"), "Europe/London", null) as Record<string, unknown>;
    expect(e.conferenceData).toBeUndefined();
    expect(Object.keys(e).sort()).toEqual(["attendees", "description", "end", "id", "start", "summary"]);
  });
});

describe("the calendar permission", () => {
  const config = { clientId: "cid", clientSecret: "secret", redirectUri: "https://www.imotara.com/api/admin/meetings/calendar/callback" };
  const idToken = (email: string) => `x.${Buffer.from(JSON.stringify({ email, email_verified: true })).toString("base64url")}.y`;
  const tokenReply = (body: object) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  const SCOPE = "openid email https://www.googleapis.com/auth/calendar.events";

  it("asks for events only — plus which account — offline, with consent", () => {
    const u = new URL(calendarConsentUrl(config, "s"));
    expect(u.searchParams.get("scope")).toBe(SCOPE);
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("login_hint")).toBe("imotara.imotara@gmail.com");
  });

  it("refuses a consent given by any other Google account", async () => {
    const f = tokenReply({ refresh_token: "r", access_token: "a", id_token: idToken("soumenroys@gmail.com"), scope: SCOPE });
    await expect(exchangeCalendarCode(config, "code", f)).rejects.toThrow(/not imotara\.imotara@gmail\.com/);
  });

  it("refuses when the calendar box was left unticked", async () => {
    const f = tokenReply({ refresh_token: "r", access_token: "a", id_token: idToken("imotara.imotara@gmail.com"), scope: "openid email" });
    await expect(exchangeCalendarCode(config, "code", f)).rejects.toThrow(/did not grant calendar access/);
  });

  it("refuses an exchange with no refresh token", async () => {
    const f = tokenReply({ access_token: "a", id_token: idToken("imotara.imotara@gmail.com"), scope: SCOPE });
    await expect(exchangeCalendarCode(config, "code", f)).rejects.toThrow(/no refresh token/);
  });

  it("accepts the brand account", async () => {
    const f = tokenReply({ refresh_token: "r", access_token: "a", id_token: idToken("Imotara.Imotara@gmail.com"), scope: SCOPE });
    await expect(exchangeCalendarCode(config, "code", f)).resolves.toMatchObject({ account: "imotara.imotara@gmail.com", refreshToken: "r" });
  });

  it("an unreadable id_token names nobody", () => {
    expect(idTokenEmail("garbage")).toBe("");
    expect(idTokenEmail(undefined)).toBe("");
  });
});

describe("talking to the calendar", () => {
  const event = meetingEvent(contact(), new Date("2026-11-04T15:00:00Z"), "Europe/London", "margaret@rosewood.org");
  const replies = (...statuses: number[]) => {
    const calls: { url: string; method: string }[] = [];
    const f = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: String(init.method) });
      return new Response("{}", { status: statuses[calls.length - 1] ?? 200 });
    }) as unknown as typeof fetch;
    return { f, calls };
  };

  it("a new meeting is inserted, and Google emails the invitations (sendUpdates=all)", async () => {
    const { f, calls } = replies(200);
    await putEvent("t", event, false, f);
    expect(calls).toEqual([{ url: expect.stringMatching(/\/events\?sendUpdates=all$/), method: "POST" }]);
  });

  it("409 on insert = an earlier run booked it ⇒ updated, not duplicated", async () => {
    const { f, calls } = replies(409, 200);
    await putEvent("t", event, false, f);
    expect(calls.map((c) => c.method)).toEqual(["POST", "PATCH"]);
    expect(calls[1].url).toContain(`/events/${event.id}?sendUpdates=all`);
  });

  it("a change updates the same event; if it never landed, it is inserted", async () => {
    const { f, calls } = replies(404, 200);
    await putEvent("t", event, true, f);
    expect(calls.map((c) => c.method)).toEqual(["PATCH", "POST"]);
  });

  it("a refusal is an error, so the row is retried next run", async () => {
    const { f } = replies(403);
    await expect(putEvent("t", event, false, f)).rejects.toThrow(/refused the meeting \(403/);
  });
});

describe("🔴 Sheet setup makes room for the new columns", () => {
  it("a tab whose header ends at the old last column needs 4 more columns for the meeting ones", async () => {
    const { headerCells } = await import("@/lib/voice/sheets");
    const { LEGACY_COLUMNS, label } = await import("@/lib/voice/rules");
    const before = LEGACY_COLUMNS.filter((c) => !c.startsWith("meeting_")).map((c) => label(c as Column));
    const { cells, width } = headerCells(before);
    expect(before).toHaveLength(42);
    expect(width).toBe(46);
    expect(cells.find((c) => c.text === "Meeting in calendar")?.letter).toMatch(/^A[QRST]$/);
  });
});
