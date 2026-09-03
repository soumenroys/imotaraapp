// src/__tests__/broadcast/listName.test.ts
import { describe, it, expect } from "vitest";
import { defaultListName } from "@/lib/broadcast/listName";

describe("defaultListName", () => {
  it("formats as dd mmm yy hh nn", () => {
    expect(defaultListName(new Date(2026, 8, 4, 23, 45))).toBe("04 Sep 26 23 45");
  });

  it("pads day, hour and minute", () => {
    expect(defaultListName(new Date(2026, 0, 7, 9, 5))).toBe("07 Jan 26 09 05");
  });

  it("uses midnight as 00, not 24 or 12", () => {
    expect(defaultListName(new Date(2026, 11, 31, 0, 0))).toBe("31 Dec 26 00 00");
  });

  it("keeps the year to two digits across a century boundary", () => {
    expect(defaultListName(new Date(2100, 5, 1, 13, 30))).toBe("01 Jun 00 13 30");
  });

  it("does not depend on the machine's locale for the month", () => {
    // A locale-formatted month would give "sept." here on a French machine,
    // and the stored names would stop matching each other.
    expect(defaultListName(new Date(2026, 8, 4, 1, 2))).toContain("Sep");
  });
});
