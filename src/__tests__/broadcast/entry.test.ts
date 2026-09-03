// src/__tests__/broadcast/entry.test.ts
import { describe, it, expect } from "vitest";
import { cleanLocalPart, cleanDomain, composeRows, rowDomain, SOURCE_DETAIL } from "@/lib/broadcast/entry";
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
