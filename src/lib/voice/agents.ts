// src/lib/voice/agents.ts
// The 44 live Bolna voice agents: 22 languages × female/male voice.
//
// 🔑 IDS COPIED FROM THE VOICE CALLING SPEC (Appendix C, 21 Oct 2026). Each
// agent carries the same master prompt with per-language spoken lines; the
// prompt itself lives in Bolna for now.
//
// ⚠️ A language being listed here does NOT mean it may be called. That is
// the sheet's Languages tab ("Start" only after a native speaker approves)
// ⇒ rules.checkContact.

export type VoiceGender = "female" | "male";

export const BOLNA_AGENTS: Record<string, { female: string; male: string }> = {
  en: { female: "98462292-7dca-434a-9879-9353a114318f", male: "d3596c72-5805-4bc5-81e2-5652c4881cc1" },
  bn: { female: "59b1abb8-9600-47f1-bdff-078245ae9e34", male: "898d053e-00cc-4f66-9134-8406bdd708c9" },
  hi: { female: "c995d86d-857e-4303-8821-4bc624f1954d", male: "2522b33f-5309-41e3-822c-4d5593a72bdd" },
  mr: { female: "8b92fd16-04d1-4634-84d5-a1468677bf5d", male: "3c62f2b6-03e8-496a-a98f-e4e70b46becb" },
  ta: { female: "026a4528-52c0-4a9a-a535-2dd07bb8e2fa", male: "83b023bf-9da6-45d0-a8f4-65746263d5f6" },
  te: { female: "4a438465-0204-4184-bda3-68117018460c", male: "92ad22fb-371b-4709-ac61-cf6fd7571228" },
  gu: { female: "7862919f-e192-42f4-ab29-949d5a3ae482", male: "0f873fcd-a9c3-4626-8f1c-063a9e1038ca" },
  pa: { female: "d1466576-188e-49cb-be33-8b6bda11e372", male: "c4d5f647-d0cf-4880-8d57-ffffc964104a" },
  kn: { female: "22ca7455-54de-4322-8718-ff6ab01323f2", male: "447139c0-fa86-4938-aae1-5791f7a8a4e5" },
  ml: { female: "2e7887c0-8ffd-4e91-af3c-1f26c8f0aa17", male: "ef28e8d5-b14d-4782-a91f-2f938c5ba81c" },
  or: { female: "4c29f3fc-835a-4ea6-bc56-9d1c6fed8128", male: "2678490b-34fb-4c4b-ac81-07df222b18f7" },
  ur: { female: "9aa9fd7e-f90e-47aa-9d6f-9df0a1e96344", male: "2ffa90e0-0250-4c2d-8528-6810e466d8bd" },
  es: { female: "82799b6d-f7d7-44cc-9183-ddd127c9ccd2", male: "06b2b36f-3e44-4ba6-93ee-440e59ff6938" },
  fr: { female: "28a25ba3-b29f-4247-a991-01014f414d9a", male: "32f1238c-ad29-41b7-99e8-3ab7542f6e77" },
  de: { female: "fa2c005c-d4ab-498f-9f56-3b3139185712", male: "83d3b339-e23e-44a6-8ec6-e4bde60125ee" },
  pt: { female: "66dc34c7-917a-4d67-814c-50fe82debd1f", male: "6a02bdc3-9991-41d2-a825-b0be7ab3efa8" },
  ru: { female: "be83c928-bf60-49c4-bf54-34cbe8ea1345", male: "7ad1dee9-ab52-47e1-8bac-95ac4eb1299d" },
  ar: { female: "79f36245-c466-4470-8677-06c8c09d5508", male: "8968848c-acee-454e-8347-d7fd0094bc2f" },
  zh: { female: "faa6b2f7-12d9-4275-8a09-736738864238", male: "718e2219-5f52-466d-859e-60fd917a73e3" },
  ja: { female: "1eb0d947-67f2-4f63-b702-1530e17a30d3", male: "e22a84c9-b0ac-43bf-b243-a55bf6c886c1" },
  he: { female: "9c890c98-c07f-4678-898f-d3b4a6c4afbc", male: "4c19e709-1127-4210-9d5b-fadff76ecf3b" },
  id: { female: "9de93342-82cb-47f0-9af6-6ef6b499b113", male: "01bf1a6e-fb0a-48d1-9239-4ae2c2e65707" },
};

/** ⚠️ An empty voice is female ⇒ spec §6 "Agent pick". */
export function agentFor(language: string, voice: string | undefined): string | null {
  const row = BOLNA_AGENTS[(language ?? "").trim().toLowerCase()];
  if (!row) return null;
  return (voice ?? "").trim().toLowerCase() === "male" ? row.male : row.female;
}
