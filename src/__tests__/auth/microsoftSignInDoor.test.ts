// #134 Microsoft (12 Nov 2026): the button appears only when the env list says so; the login page's
// "other ways" sentence is built from the same list; help + policy name Microsoft; no Google-only claim.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { enabledOAuth, otherWaysText } from "@/lib/auth/signInOptions";

describe("Microsoft sign-in door", () => {
  it("is offered only when switched on, with the account chooser and the email scope", () => {
    expect(enabledOAuth("google").map((o) => o.id)).toEqual(["google"]);
    const ms = enabledOAuth("google,azure").find((o) => o.id === "azure");
    expect(ms?.label).toBe("Continue with Microsoft");
    expect(ms?.scopes).toBe("email");
    expect(ms?.queryParams?.prompt).toBe("select_account");
  });
  it("the login sentence lists exactly what is switched on", () => {
    expect(otherWaysText(enabledOAuth("google"))).toBe("Google or a code by email");
    expect(otherWaysText(enabledOAuth("google,azure"))).toBe("Google, Microsoft or a code by email");
    expect(otherWaysText(enabledOAuth("google,azure,apple"))).toBe("Google, Microsoft, Apple or a code by email");
    expect(readFileSync("src/app/login/page.tsx", "utf8")).not.toMatch(/\(Google, or a code by email\)/);
  });
  it("help and policy are current", () => {
    expect(readFileSync("src/content/help/organizations.md", "utf8")).not.toMatch(/Google-only/);
    expect(readFileSync("src/content/help/getting-started.md", "utf8")).toMatch(/Continue with Microsoft/);
    expect(readFileSync("src/app/privacy/page.tsx", "utf8")).toMatch(/with Google, Microsoft or Apple/);
  });
});
