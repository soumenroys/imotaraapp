// Dec release check (26 Nov 2026): "I'm stressed and overwhelmed" was saved as the person's job.
// 🔴 MIRRORED in imotara-mobile src/__tests__/memoryFactsNoFeelingsAsJobs.test.ts
import { describe, it, expect } from "vitest";
import { occupationFrom, occupationFact, placeFact, repairLegacyFact } from "@/lib/memory/memoryFacts";

const NOT_JOBS = [
  "I'm stressed and overwhelmed",
  "I am so tired of everything",
  "I'm a mess right now",
  "I'm a bit lost",
  "I'm worried my teacher hates me",
  "I'm a terrible person",
  "I'm a burden to my family",
  "i am feeling low today",
  "my job is killing me",
  "I'm not a student anymore", // ⚠️ "not" is not a job word — must stay null
];

const JOBS: [string, string][] = [
  ["I'm a teacher at a school in Pune", "teacher"],
  ["I work as a nurse and I'm exhausted", "nurse"],
  ["I am an engineer.", "engineer"],
  ["I'm a software engineer", "software engineer"],
  ["I am teacher", "teacher"],
  ["I am working as a driver", "driver"],
  ["I'm a student nurse", "student nurse"],
  ["I'm a worried student", "student"],
  ["I’m a doctor", "doctor"],
];

describe("occupationFrom", () => {
  it.each(NOT_JOBS)("never makes a job out of: %s", (t) => {
    expect(occupationFrom(t)).toBeNull();
  });
  it.each(JOBS)("finds the job in: %s", (t, job) => {
    expect(occupationFrom(t)).toBe(job);
  });
  it("plain English with the right article", () => {
    expect(occupationFact("engineer")).toBe("User works as an engineer");
    expect(occupationFact("teacher")).toBe("User works as a teacher");
  });
});

describe("placeFact", () => {
  it("names the place with the right verb", () => {
    expect(placeFact("I live in Kolkata and work in IT")).toBe("User lives in Kolkata");
    expect(placeFact("I'm from Lagos.")).toBe("User is from Lagos");
    expect(placeFact("I'm based in New York City now")).toBe("User is based in New York City");
  });
  it("ignores things that are not places", () => {
    expect(placeFact("I live in fear every day")).toBeNull();
    expect(placeFact("I'm from a small town")).toBeNull();
  });
});

describe("repairLegacyFact (rows saved before the fix)", () => {
  it("drops a feeling saved as a job", () => {
    expect(repairLegacyFact("User is a/an stressed and overwhelmed")).toBeNull();
  });
  it("rewrites a real job in plain English", () => {
    expect(repairLegacyFact("User is a/an teacher")).toBe("User works as a teacher");
  });
  it("rewrites the slash wording for places, drops non-places", () => {
    expect(repairLegacyFact("User is from/lives in Kolkata")).toBe("User is from or lives in Kolkata");
    expect(repairLegacyFact("User is from/lives in fear")).toBeNull();
  });
  it("leaves every other fact alone", () => {
    expect(repairLegacyFact("User's name is Rina")).toBe("User's name is Rina");
  });
});

import * as fs from "fs";
import * as path from "path";
import { fetchUserMemories } from "@/lib/memory/fetchUserMemories";

describe("every reader gets repaired rows", () => {
  it("fetchUserMemories drops a feeling saved as a job and rewrites old wording", async () => {
    const rows = [
      { id: "1", value: "User is a/an stressed and overwhelmed" },
      { id: "2", value: "User is a/an nurse" },
      { id: "3", value: "User's name is Rina" },
    ];
    const q: any = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: rows, error: null }) };
    const supabase: any = { from: () => q };
    const out = await fetchUserMemories(supabase, "u1", 20);
    expect(out.map((r) => r.value)).toEqual(["User works as a nurse", "User's name is Rina"]);
  });

  it("the old 'a/an' and 'from/lives in' wording is gone from the code that writes facts", () => {
    for (const f of ["src/app/chat/page.tsx", "src/app/api/memory/route.ts"]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      expect(src).not.toMatch(/User is a\/an \$\{|User is from\/lives in \$\{/);
    }
  });

  it("the save route repairs before it writes", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/app/api/memory/route.ts"), "utf8");
    const post = src.slice(src.indexOf("export async function POST"));
    expect(post.indexOf("repairLegacyFact(")).toBeGreaterThan(-1);
    expect(post.indexOf("repairLegacyFact(")).toBeLessThan(post.indexOf(".upsert("));
  });
});
