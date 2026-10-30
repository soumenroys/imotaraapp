// src/lib/voice/countries.ts
// The countries the sheet's dropdown offers: dial code, and the time zone to
// use when the admin leaves time_zone empty.
//
// 🔑 OWNER, 29 Oct 2026: "make the country column selectable, so that by
// default that country code can be appended as a prefix with the phone
// number" and "if admin selects the country, the corresponding timezone will
// be selected automatically".
//
// ⚠️ A ZONE ONLY WHERE THE COUNTRY HAS ONE. USA, Canada, Mexico, Brazil,
// Australia, Russia and Indonesia span several zones — guessing one would put
// a call or an email hours off ⇒ `zone: null`, and the admin picks.
// ⚠️ Italy keeps its trunk 0 after the country code (+39 06…) ⇒ keepZero.
// ⚠️ PURE ⇒ src/__tests__/voice/sheetV2.test.ts.

export type Country = { code: string; name: string; dial: string; zone: string | null; keepZero?: boolean };

export const COUNTRIES: Country[] = [
  { code: "IN", name: "India", dial: "91", zone: "Asia/Kolkata" },
  { code: "BD", name: "Bangladesh", dial: "880", zone: "Asia/Dhaka" },
  { code: "NP", name: "Nepal", dial: "977", zone: "Asia/Kathmandu" },
  { code: "LK", name: "Sri Lanka", dial: "94", zone: "Asia/Colombo" },
  { code: "PK", name: "Pakistan", dial: "92", zone: "Asia/Karachi" },
  { code: "BT", name: "Bhutan", dial: "975", zone: "Asia/Thimphu" },
  { code: "MV", name: "Maldives", dial: "960", zone: "Indian/Maldives" },
  { code: "AE", name: "United Arab Emirates", dial: "971", zone: "Asia/Dubai" },
  { code: "SA", name: "Saudi Arabia", dial: "966", zone: "Asia/Riyadh" },
  { code: "QA", name: "Qatar", dial: "974", zone: "Asia/Qatar" },
  { code: "KW", name: "Kuwait", dial: "965", zone: "Asia/Kuwait" },
  { code: "OM", name: "Oman", dial: "968", zone: "Asia/Muscat" },
  { code: "BH", name: "Bahrain", dial: "973", zone: "Asia/Bahrain" },
  { code: "SG", name: "Singapore", dial: "65", zone: "Asia/Singapore" },
  { code: "MY", name: "Malaysia", dial: "60", zone: "Asia/Kuala_Lumpur" },
  { code: "TH", name: "Thailand", dial: "66", zone: "Asia/Bangkok" },
  { code: "PH", name: "Philippines", dial: "63", zone: "Asia/Manila" },
  { code: "VN", name: "Vietnam", dial: "84", zone: "Asia/Ho_Chi_Minh" },
  { code: "ID", name: "Indonesia", dial: "62", zone: null },
  { code: "CN", name: "China", dial: "86", zone: "Asia/Shanghai" },
  { code: "HK", name: "Hong Kong", dial: "852", zone: "Asia/Hong_Kong" },
  { code: "JP", name: "Japan", dial: "81", zone: "Asia/Tokyo" },
  { code: "KR", name: "South Korea", dial: "82", zone: "Asia/Seoul" },
  { code: "GB", name: "United Kingdom", dial: "44", zone: "Europe/London" },
  { code: "IE", name: "Ireland", dial: "353", zone: "Europe/Dublin" },
  { code: "DE", name: "Germany", dial: "49", zone: "Europe/Berlin" },
  { code: "FR", name: "France", dial: "33", zone: "Europe/Paris" },
  { code: "ES", name: "Spain", dial: "34", zone: "Europe/Madrid" },
  { code: "IT", name: "Italy", dial: "39", zone: "Europe/Rome", keepZero: true },
  { code: "NL", name: "Netherlands", dial: "31", zone: "Europe/Amsterdam" },
  { code: "BE", name: "Belgium", dial: "32", zone: "Europe/Brussels" },
  { code: "CH", name: "Switzerland", dial: "41", zone: "Europe/Zurich" },
  { code: "SE", name: "Sweden", dial: "46", zone: "Europe/Stockholm" },
  { code: "NO", name: "Norway", dial: "47", zone: "Europe/Oslo" },
  { code: "DK", name: "Denmark", dial: "45", zone: "Europe/Copenhagen" },
  { code: "PT", name: "Portugal", dial: "351", zone: "Europe/Lisbon" },
  { code: "IL", name: "Israel", dial: "972", zone: "Asia/Jerusalem" },
  { code: "TR", name: "Turkey", dial: "90", zone: "Europe/Istanbul" },
  { code: "RU", name: "Russia", dial: "7", zone: null },
  { code: "EG", name: "Egypt", dial: "20", zone: "Africa/Cairo" },
  { code: "ZA", name: "South Africa", dial: "27", zone: "Africa/Johannesburg" },
  { code: "NG", name: "Nigeria", dial: "234", zone: "Africa/Lagos" },
  { code: "KE", name: "Kenya", dial: "254", zone: "Africa/Nairobi" },
  { code: "US", name: "United States", dial: "1", zone: null },
  { code: "CA", name: "Canada", dial: "1", zone: null },
  { code: "MX", name: "Mexico", dial: "52", zone: null },
  { code: "BR", name: "Brazil", dial: "55", zone: null },
  { code: "AR", name: "Argentina", dial: "54", zone: "America/Argentina/Buenos_Aires" },
  { code: "AU", name: "Australia", dial: "61", zone: null },
  { code: "NZ", name: "New Zealand", dial: "64", zone: "Pacific/Auckland" },
];

/** What the dropdown shows, e.g. "IN — India (+91)". */
export const countryLabel = (c: Country) => `${c.code} — ${c.name} (+${c.dial})`;

/** "IN", "in", "IN — India (+91)" → the entry; anything else → null. */
export function countryOf(raw: string | undefined): Country | null {
  const m = (raw ?? "").trim().match(/^([A-Za-z]{2})(\b|$)/);
  if (!m) return null;
  return COUNTRIES.find((c) => c.code === m[1].toUpperCase()) ?? null;
}

/** The 2-letter code the rest of the system uses ("IN"), or the raw text upper-cased when it is not in the list. */
export function countryCode(raw: string | undefined): string {
  return countryOf(raw)?.code ?? (raw ?? "").trim().slice(0, 2).toUpperCase();
}

/** The time zone to use when the admin left time_zone empty, or null where the country has several. */
export function countryZone(raw: string | undefined): string | null {
  return countryOf(raw)?.zone ?? null;
}

/**
 * The phone as an international number, adding the country's code when the
 * admin typed a national one.
 *   "+44 20 7946 0000"  → +442079460000   (already international)
 *   "020 7946 0000", GB → +442079460000   (trunk 0 dropped)
 *   "98300 12345",  IN  → +919830012345
 *   "919830012345", IN  → +919830012345   (code already there)
 * ⚠️ Without a known country the digits are kept as typed (the old behaviour),
 * and the existing checks still name a missing code.
 */
export function normalisePhoneFor(raw: string, countryRaw: string | undefined): string {
  const s = String(raw ?? "").trim();
  let digits = s.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (s.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  const c = countryOf(countryRaw);
  if (!c) return `+${digits}`;
  if (digits.startsWith("0") && !c.keepZero) {
    digits = digits.replace(/^0+/, "");
    return `+${c.dial}${digits}`;
  }
  // Already carries the code: it starts with it AND is longer than a national number.
  if (digits.startsWith(c.dial) && digits.length > 10) return `+${digits}`;
  return `+${c.dial}${digits}`;
}

/** "bn — Bengali" (the language dropdown) or "bn" → "bn"; anything else as typed, lower-cased. */
export function languageCode(raw: string | undefined): string {
  const s = (raw ?? "").trim();
  const m = s.match(/^([A-Za-z]{2,3})(?=\s*(?:—|-|–|$))/);
  return (m ? m[1] : s).toLowerCase();
}
