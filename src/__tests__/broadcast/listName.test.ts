// src/__tests__/broadcast/listName.test.ts
import { describe, it, expect } from "vitest";
import { defaultListName } from "@/lib/broadcast/listName";

describe("defaultListName", () => {
  it("formats as yyyymmddhhnn (dd mmm yy hh nn)", () => {
    expect(defaultListName(new Date(2026, 8, 4, 23, 45)))
      .toBe("202609042345 (04 Sep 26 23 45)");
  });

  it("pads month, day, hour and minute in both halves", () => {
    expect(defaultListName(new Date(2026, 0, 7, 9, 5)))
      .toBe("202601070905 (07 Jan 26 09 05)");
  });

  it("uses midnight as 00, not 24 or 12", () => {
    expect(defaultListName(new Date(2026, 11, 31, 0, 0)))
      .toBe("202612310000 (31 Dec 26 00 00)");
  });

  it("keeps four digits of year in the sortable half and two in brackets", () => {
    expect(defaultListName(new Date(2100, 5, 1, 13, 30)))
      .toBe("210006011330 (01 Jun 00 13 30)");
  });

  it("sorts chronologically as plain text — the reason the digits lead", () => {
    const names = [
      defaultListName(new Date(2026, 11, 31, 23, 59)),
      defaultListName(new Date(2026, 0, 1, 0, 0)),
      defaultListName(new Date(2026, 8, 4, 9, 30)),
    ];
    expect([...names].sort()).toEqual([names[1], names[2], names[0]]);
  });

  it("does not depend on the machine's locale for the month", () => {
    // A locale-formatted month would give "sept." here on a French machine,
    // and the stored names would stop matching each other.
    expect(defaultListName(new Date(2026, 8, 4, 1, 2))).toContain("Sep");
  });
});
