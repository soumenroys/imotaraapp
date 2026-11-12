// src/lib/analytics/automatedVisitor.ts — #76 (12 Nov 2026): keep robots out of our counts.
//
// 🔑 WHY: GA, last 7 days to 11 Nov — 125 "active users", 76 of them from Ashburn (a data-centre
// town) arriving "direct". Our own tally agreed: 53 web visits on 11 Nov, only ~half ever reported
// their length (a real tab does when it is hidden; a headless robot usually never is). Every rate
// we read — "share of visits that send a message" (#130) — was divided by robots.
//
// Two checks, both standard and both cheap:
//   1. navigator.webdriver — set by Puppeteer, Playwright, Selenium and Chrome's own automation.
//   2. the User-Agent — crawlers, previewers, uptime checkers and headless Chrome say so.
// ⚠️ This cannot catch a robot that hides both. It removes the honest ones; the rest stay counted.
// ⛔ A false positive costs one uncounted visit — never a broken page: nothing here blocks anyone.
// ⛔ WEB ONLY. The apps' HTTP stacks (okhttp on Android, CFNetwork on iOS) are not browsers and
//    must never be read as robots — the endpoint checks the platform first ⇒ api/metrics/visit.

const AUTOMATED_UA =
  /bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|statuscake|checkly|datadog|newrelic|python-requests|python-urllib|aiohttp|httpx|curl\/|wget\/|go-http-client|node-fetch|axios\/|undici|java\/|libwww|phantomjs|puppeteer|playwright|selenium|cypress|facebookexternalhit|meta-externalagent|whatsapp|telegrambot|slackbot|discordbot|linkedinbot|twitterbot|embedly|preview|vercel-screenshot|google-inspectiontool|chrome-lighthouse|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-user|perplexity|bytespider|amazonbot|applebot|ccbot|ahrefs|semrush|mj12|dotbot|petalbot|yandex|baiduspider/i;

/** True when the User-Agent says it is a program, not a person's browser. Empty ⇒ automated. */
export function looksAutomatedUA(ua: string | null | undefined): boolean {
  const s = (ua ?? "").trim();
  if (!s) return true;
  return AUTOMATED_UA.test(s);
}

type NavLike = { webdriver?: boolean; userAgent?: string } | null | undefined;

/** Client side: an automated browser (webdriver flag) or a robot's User-Agent. */
export function isAutomatedBrowser(nav: NavLike): boolean {
  if (!nav) return true;
  if (nav.webdriver === true) return true;
  return looksAutomatedUA(nav.userAgent);
}

/** Server side (the tally endpoint): refuse a robot — but never an app. Pure, tested. */
export function refuseAsRobot(platform: string, ua: string | null | undefined): boolean {
  if (platform === "ios" || platform === "android") return false;
  return looksAutomatedUA(ua);
}
