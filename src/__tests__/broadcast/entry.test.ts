// src/__tests__/broadcast/entry.test.ts
import { describe, it, expect } from "vitest";
import { cleanLocalPart, cleanDomain, cleanName, composeRows, rowDomain, SOURCE_DETAIL } from "@/lib/broadcast/entry";
import { EMAIL_RE } from "@/lib/broadcast/parseRecipients";

describe("cleanLocalPart", () => {
  it("keeps what a local part may contain", () => {
    expect(cleanLocalPart("priya.n_1+news-x%y")).toBe("priya.n_1+news-x%y");
  });

  it("removes spaces, @ and angle brackets", () => {
    // A pasted "Priya N <priya.n@childcare.org>" must not half-land looking fine.
    expect(cleanLocalPart("Priya N <priya.n@childcare.org>")).toBe("PriyaNpriya.nchildcare.org");
  });

  it("removes characters that would break the address", () => {
    expect(cleanLocalPart('a"b;c,d\\e')).toBe("abcde");
  });
});

describe("cleanDomain", () => {
  it("lowercases and keeps letters, digits, dots and hyphens", () => {
    expect(cleanDomain("Child-Care.ORG")).toBe("child-care.org");
  });

  it("strips an @ someone types out of habit", () => {
    expect(cleanDomain("@gmail.com")).toBe("gmail.com");
  });
});

describe("composeRows", () => {
  const row = (local: string, domain: string, custom = "") => ({ local, domain, custom });

  it("joins complete rows one per line", () => {
    expect(composeRows([row("a", "gmail.com"), row("b", "yahoo.com")]))
      .toBe("a@gmail.com\nb@yahoo.com");
  });

  it("ignores rows with no local part — an empty row is not an error", () => {
    expect(composeRows([row("", "gmail.com"), row("b", "gmail.com")])).toBe("b@gmail.com");
  });

  it("ignores a custom row whose domain has not been typed yet", () => {
    expect(composeRows([row("a", "__custom__", "")])).toBe("");
  });

  it("uses the custom domain when one is given", () => {
    expect(composeRows([row("a", "__custom__", "childcare.org")])).toBe("a@childcare.org");
    expect(rowDomain(row("a", "__custom__", "childcare.org"))).toBe("childcare.org");
  });

  it("produces addresses the validator accepts", () => {
    for (const line of composeRows([row("priya.n", "gmail.com"), row("x+y", "childcare.org")]).split("\n")) {
      expect(EMAIL_RE.test(line)).toBe(true);
    }
  });
});

describe("SOURCE_DETAIL", () => {
  it("has wording for every source the API accepts", () => {
    const apiSources = ["event", "meeting", "email", "whatsapp", "social", "website_form", "phone", "app_signup"];
    for (const s of apiSources) expect(SOURCE_DETAIL[s]).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Optional recipient name (owner request, 2026-09-12)
//
// The bulk textarea always accepted "Priya N <priya@x>" and parseRecipients
// always read the name back out with displayName(). What was missing was any
// way to TYPE a name in the row form, which is two fields — local-part and
// domain — with nowhere to put one.
// ---------------------------------------------------------------------------
describe("cleanName", () => {
    it("keeps an ordinary name", () => {
        expect(cleanName("Priya N")).toBe("Priya N");
    });

    it("strips the characters that would split one recipient into two", () => {
        // splitPasted() splits on newline, comma AND semicolon — a name
        // containing one does not look wrong, it silently creates a second,
        // broken recipient.
        for (const ch of [",", ";", "\n", "\r"]) {
            expect(cleanName(`Priya${ch} R`)).toBe("Priya R");
        }
    });

    it("strips angle brackets, which would move where the address ends", () => {
        // unwrap() takes the LAST <...>; a stray bracket in the name would
        // change which text is treated as the address.
        expect(cleanName("Priya <hacker@evil.com> N")).toBe("Priya hacker@evil.com N");
        expect(cleanName("Pri>ya")).toBe("Pri ya");
    });

    it("strips quotes, which displayName would trim off anyway", () => {
        expect(cleanName('"Priya"')).toBe("Priya");
    });

    it("collapses whitespace and trims", () => {
        expect(cleanName("  Priya    N  ")).toBe("Priya N");
    });

    it("caps at 80 characters, matching what displayName keeps", () => {
        expect(cleanName("x".repeat(200))).toHaveLength(80);
    });

    it("an empty or whitespace-only name is simply absent", () => {
        expect(cleanName("")).toBe("");
        expect(cleanName("   ")).toBe("");
    });
});

describe("composeRows with names", () => {
    const namedRow = (name: string, local: string, domain: string) =>
        ({ name, local, domain, custom: "" });

    it("emits the Name <addr> form the rest of the pipeline already parses", () => {
        expect(composeRows([namedRow("Priya N", "priya.n", "childcare.org")]))
            .toBe("Priya N <priya.n@childcare.org>");
    });

    it("is BYTE-IDENTICAL to the old output when no name is given", () => {
        // The regression that matters: every list typed before this field
        // existed must compose exactly as it did.
        expect(composeRows([{ local: "a", domain: "gmail.com", custom: "" }]))
            .toBe("a@gmail.com");
        expect(composeRows([namedRow("", "a", "gmail.com")])).toBe("a@gmail.com");
        expect(composeRows([namedRow("   ", "a", "gmail.com")])).toBe("a@gmail.com");
    });

    it("mixes named and unnamed rows in one list", () => {
        expect(composeRows([
            namedRow("Priya N", "priya.n", "childcare.org"),
            { local: "deepa", domain: "gmail.com", custom: "" },
        ])).toBe("Priya N <priya.n@childcare.org>\ndeepa@gmail.com");
    });

    it("a row with a name but no address is still dropped", () => {
        expect(composeRows([namedRow("Priya N", "", "gmail.com")])).toBe("");
    });

    it("sanitises the name on the way out, not just in the input handler", () => {
        // The UI cleans on change, but composeRows must not depend on that —
        // a Row can be built in code or restored from state.
        expect(composeRows([namedRow("Priya, R", "p", "gmail.com")]))
            .toBe("Priya R <p@gmail.com>");
    });
});

describe("round trip: composeRows -> parseRecipients", () => {
    it("every composed line survives splitting, and the name comes back", async () => {
        const { splitPasted, unwrap, displayName } = await import("@/lib/broadcast/parseRecipients");
        const text = composeRows([
            { name: "Priya, N;", local: "priya.n", domain: "childcare.org", custom: "" },
            { local: "deepa", domain: "gmail.com", custom: "" },
        ]);
        const parts = splitPasted(text);
        // The sanitised comma/semicolon must NOT have created extra entries.
        expect(parts).toHaveLength(2);
        expect(unwrap(parts[0])).toBe("priya.n@childcare.org");
        expect(displayName(parts[0])).toBe("Priya N");
        expect(unwrap(parts[1])).toBe("deepa@gmail.com");
        expect(displayName(parts[1])).toBe("");
    });
});
