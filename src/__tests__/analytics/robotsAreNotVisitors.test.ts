// src/__tests__/analytics/robotsAreNotVisitors.test.ts
// 🔑 #76 (12 Nov 2026): GA showed 76 of 125 weekly "users" from Ashburn (data-centre robots), and our
// own tally counted 53 web visits on 11 Nov, ~half of which never reported a length. Robots were the
// denominator of every rate. ⇒ lib/analytics/automatedVisitor.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { looksAutomatedUA, isAutomatedBrowser, refuseAsRobot } from "@/lib/analytics/automatedVisitor";

const PEOPLE = {
  "Chrome on Windows": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Safari on iPhone": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  "Chrome on Android": "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  "Firefox on Mac": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:132.0) Gecko/20100101 Firefox/132.0",
  "Edge": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  "Samsung Internet": "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
};
const ROBOTS = {
  "headless Chrome": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
  Googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1)",
  GPTBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2)",
  "ChatGPT-User": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0",
  Lighthouse: "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
  curl: "curl/8.7.1",
  "python-requests": "python-requests/2.32.3",
  "Facebook preview": "facebookexternalhit/1.1",
  "Vercel screenshot": "Mozilla/5.0 (Linux) vercel-screenshot/1.0",
  empty: "",
};

describe("a person's browser is counted", () => {
  it.each(Object.entries(PEOPLE))("%s", (_n, ua) => {
    expect(looksAutomatedUA(ua)).toBe(false);
    expect(isAutomatedBrowser({ webdriver: false, userAgent: ua })).toBe(false);
  });
});

describe("a robot is not", () => {
  it.each(Object.entries(ROBOTS))("%s", (_n, ua) => {
    expect(looksAutomatedUA(ua)).toBe(true);
  });
  it("an automated browser with a perfectly normal User-Agent (webdriver flag)", () => {
    expect(isAutomatedBrowser({ webdriver: true, userAgent: PEOPLE["Chrome on Windows"] })).toBe(true);
  });
});

describe("⛔ the apps are never robots", () => {
  it("Android app (okhttp) and iOS app (CFNetwork) are counted", () => {
    expect(refuseAsRobot("android", "okhttp/4.12.0")).toBe(false);
    expect(refuseAsRobot("ios", "Imotara/169 CFNetwork/1568.100.1 Darwin/24.0.0")).toBe(false);
    expect(refuseAsRobot("ios", "")).toBe(false);
  });
  it("web robots are refused, web people are not", () => {
    expect(refuseAsRobot("web", ROBOTS["headless Chrome"])).toBe(true);
    expect(refuseAsRobot("web", PEOPLE["Safari on iPhone"])).toBe(false);
  });
});

describe("all three doors check", () => {
  it("the tally endpoint refuses before it parses or writes", () => {
    const route = readFileSync("src/app/api/metrics/visit/route.ts", "utf8");
    const body = route.slice(route.indexOf("export async function POST"));
    expect(body.indexOf("refuseAsRobot(")).toBeGreaterThan(-1);
    expect(body.indexOf("refuseAsRobot(")).toBeLessThan(body.indexOf("parseTallyEvents("));
  });
  it("the browser never sends a tally from a robot", () => {
    const client = readFileSync("src/lib/analytics/visitTallyClient.ts", "utf8");
    const send = client.slice(client.indexOf("function send("), client.indexOf("function send(") + 400);
    expect(send).toContain("isAutomatedBrowser(");
  });
  it("GA does not load for a robot", () => {
    const ga = readFileSync("src/components/analytics/GoogleAnalytics.tsx", "utf8");
    expect(ga).toContain("isAutomatedBrowser(navigator)");
    expect(ga).toMatch(/if \(!person\) return null;/);
  });
});
