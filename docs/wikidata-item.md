# Wikidata item for Imotara — ready to create

**Why this is worth doing.** Assistants lean on Wikidata for entity facts: what a thing *is*, who
made it, where to find it. Unlike Wikipedia there is **no notability bar** for a basic item — a
real product with app-store listings and an official site qualifies. It is the highest-leverage
LLM-visibility item still untouched, and it costs nothing.

**Verified 17 Oct 2026: no Imotara item exists.** `wbsearchentities` returns zero results.

⛔ **Every ID below was resolved from Wikidata's own API, not recalled.** The one trap worth
naming: searching "developer" returns **P61**, which is *discoverer or inventor* and wrong. The
software property is **P178**.

---

## What you need

A Wikidata account (free, no email required) — I can't create accounts. Then either:

- **Fast route:** [QuickStatements](https://quickstatements.toolforge.org/) → *Import statements*
  → paste the block below → Run.
- **Manual route:** [Create a new item](https://www.wikidata.org/wiki/Special:NewItem) and add
  each statement from the table.

---

## QuickStatements block

```
CREATE
LAST|Len|"Imotara"
LAST|Den|"mobile and web application for emotional wellbeing, available in 22 languages"
LAST|P31|Q620615
LAST|P31|Q189210
LAST|P856|"https://www.imotara.com"
LAST|P400|Q94
LAST|P400|Q48493
LAST|P400|Q189210
LAST|P495|Q668
LAST|P3418|"com.imotara.imotara"
LAST|P3861|"6756697569"
LAST|P2002|"imotaraofficial"
LAST|P2003|"imotaraofficial"
LAST|P2397|"UCJSh0QnG31SYa4vw5KE1Baw"
LAST|P2013|"imotaraofficial"
LAST|P4264|"imotara"
```

## What each line says

| Property | | Value |
|---|---|---|
| `P31` | instance of | **Q620615** mobile app · **Q189210** web application |
| `P856` | official website | `https://www.imotara.com` |
| `P400` | platform | **Q94** Android · **Q48493** iOS · **Q189210** web application |
| `P495` | country of origin | **Q668** India |
| `P3418` | Google Play Store app ID | `com.imotara.imotara` |
| `P3861` | App Store app ID | `6756697569` |
| `P2002` | X (Twitter) username | `imotaraofficial` |
| `P2003` | Instagram username | `imotaraofficial` |
| `P2397` | YouTube channel ID | `UCJSh0QnG31SYa4vw5KE1Baw` |
| `P2013` | Facebook username | `imotaraofficial` |
| `P4264` | LinkedIn company ID | `imotara` |

## ⛔ Deliberately left out

**`P178` (developer) — M/S IMOTARA.** The property is correct but it needs an *item* as its
value, and M/S IMOTARA has no Wikidata item. Creating a company item is a separate decision with
its own notability question, so it is not bundled in here. Add it later if you make one.

**`P571` (inception).** I do not have a verified first-release date. ⚠️ Wikidata is a factual
database and a guessed date is worse than a missing one — it gets copied. Add it once you can
check the real Play Store release date.

**Anything about what Imotara does therapeutically.** An item states what a thing *is*; it is not
a place for positioning. ⇒ [[trap_marketing_copy_claims_a_regulated_title]].

## After it exists

- Note the new **Q-id** and tell me — it goes into `llms.txt` and the site's `sameAs`, which is
  how the item gets tied back to the entity rather than floating alone.
- ⚠️ **Do not keep editing it.** A newly created item edited repeatedly by its own subject draws
  scrutiny. Set it once, correctly, and leave it.
