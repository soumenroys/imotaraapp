# Social Posting Scheduler (Admin)

**What it is.** An admin tool that writes Imotara's social posts on a schedule, checks them, makes the picture, and queues them for a person to approve. Built 17–18 October 2026.

**Where.** `imotara.com/admin/social` — five screens: **Today**, **Schedules**, **Write a post**, **Channels**, **Languages**. Reached from the **📅 Social** tab on `/admin`, beside Activity and Crisis Events.

> ⛔ **It does not publish yet.** Everything up to "a finished post is ready at the right moment" works. The code that hands a post to Facebook or LinkedIn — the adapter — is the next piece of work. An approved post waits; you can post it by hand from the screen in the meantime.

---

## 1. Who can reach it

| Role | Read the queue · approve · write a post · edit schedules | 🔐 Connect a channel · replace a token · switch auto-publish on |
|---|---|---|
| `super_admins.role = 'owner'` — Soumen, Suchismita | ✅ | ✅ |
| `super_admins.role = 'admin'` | ✅ | ⛔ |
| `connect_reviewer` | ⛔ | ⛔ |
| Org admins (`org_members`) | ⛔ | ⛔ |
| Ordinary signed-in users | ⛔ | ⛔ |

⚠️ **The admin panel has its own sign-in.** Being signed in to Imotara does not sign you in here — `super_admins` is email + password, no Google. The top bar can show your address while the page has no session.

⛔ Org admins are excluded **by construction**, not by a check: they have no `super_admins` row at all.

🔐 Those three actions are owner-only because they are the only ones that can publish in the company's name without a human reading the words, expose a credential, or attach a new public identity. Checked server-side on every request — a disabled button is a hint, never a gate.

---

## 2. How a post is made

1. **A cron wakes every minute** (`/api/cron/social-queue`) and asks which schedules are due in two hours.
2. **A subject is chosen** from the schedule's pool and checked against every subject ever used — by hash *and* by meaning overlap, so a rearranged subject is caught too.
3. **The words are written** through `aiClient` (OpenAI, Gemini behind it), with the channel's own register and length.
4. 🛡️ **The word check runs** — three lists. A hit throws the draft away and writes another; it does not warn. Up to three attempts.
5. **The picture is composed** from an unused recipe, with the logo and the three QR codes.
6. **It lands in the queue** as *Waiting for you* — or as *Ready to go* if that schedule's auto-publish is on **and** the language qualifies.

### The word check — three lists

| List | What it catches |
|---|---|
| **Clinical claims** | therapist, counsellor, psychologist, clinical, diagnose, heal, healing, "therapy alternative", "mental health care", psychotherapist, therapeutic, "our patients" |
| **Abuse and profanity** | Per language, in its own script **and** in Latin letters. English only today. |
| 🔴 **Careless language** | *crazy, insane, psycho, lunatic* as intensifiers · a diagnosis as a personality trait · "commit suicide" · urgency and streak language · guilt and shame · manufactured engagement prompts |

⚠️ **The third list is the one that matters here** and the one an ordinary profanity filter does not have. On a page about how people feel, *"crazy good"* is the sentence that gets screenshot.

🔑 **The check is context-aware.** "Peer companions, not clinicians" and "It is not therapy" pass — a denial in the same clause excuses the term. But a denial in one sentence does **not** excuse a claim in the next, and *every* occurrence is checked, not just the first.

⛔ **What no check can read:** whether it is gentle, whether it leaves the reader something to think, whether it has drifted towards one group, and how it would land on somebody having a bad day. Those are why a draft waits for a person.

---

## 3. Languages

All 22 can be **written, pictured and queued**. Two separate conditions decide whether a schedule may post in one **unattended**:

1. **Somebody here can read it** — `social_language_tiers.reviewed`. English, Bengali, Hindi.
2. **A word list exists for it** — `abuse_list_ready`. English only.

⛔ **Both, never either.** Bengali and Hindi pass the first and fail the second, which is exactly why they are two columns. Enforced by a database trigger, not just in a route, so it holds for any writer.

⛔ **We do not invent abuse lists** for languages nobody here reads. A wrong list is invisibly wrong *and reports success* — strictly worse than none. It is the same shape as the Urdu and Kannada brand-spelling defects of 17 Oct.

▶️ **To widen a language:** get a dozen words from a speaker (native script *and* Latin spelling) and add them on `/admin/social/languages`. Owner-only, because it is the same power as switching auto-publish on, reached by a different door.

⚠️ **Demoting a language turns off the schedules already using it**, automatically — the guard on schedules cannot see a language withdrawn afterwards.

---

## 4. The picture

Composed from a **recipe**: 8 layouts × 6 palettes × 4 type treatments × 6 motifs × the wordmark in 22 scripts = **25,344 combinations**. Every one is hashed and recorded, and none ever repeats. No palette or layout returns among the last five posts.

Every card carries the **logo** and **three QR codes** — Website, Android, iPhone — matching `scripts/generate-qr-codes.js`, each in its own colour with a label.

⛔ **Never in a picture:** a word the check has not read · a human face (it reads as a testimonial from somebody who does not exist) · any depiction of distress · festival or country furniture · a gradient wash.

🔴 **The brand name is set in Latin on every non-Latin post.** The renderer does not shape complex scripts properly, and nobody here can tell a correct brand name from a mangled one. Publishing it would mean not knowing. ▶️ One speaker, one rendered picture, one minute closes this per script.

### Shapes

| Shape | Notes |
|---|---|
| Text | Words only |
| Picture · Text + picture | The composed card |
| **Short video** | ✅ Animates on LinkedIn, Facebook, Instagram, X |
| **Animated GIF** | ⛔ Animates on **X only** — LinkedIn strips it, Facebook converts it |

The animation is the card assembling itself: rule, then headline, then the supporting line, then the logo and codes. ~6 seconds, silent, no movement — reveal only. Every frame is the finished card with parts hidden, so **no frame can introduce a word the check has not read**.

---

## 5. Channels and tokens

Five: Facebook, LinkedIn, Instagram, X, YouTube. None can publish yet; each row says why in its own terms.

**Tokens are encrypted** (AES-256-GCM, bound to the row). No key ⇒ the route refuses with 503 rather than storing plaintext. Only the last four characters are ever shown back. A fingerprint tells a replacement from a re-paste.

⛔ **A password is never accepted, and never will be.**
- A **hash** cannot do it — one-way, checkable, never usable to log in.
- **Encryption** can, and that is the problem: logging in needs the plaintext back, so the key sits beside the ciphertext and anyone with both has the password.
- None of these platforms allows programmatic password login anyway; a driven browser meets checkpoints, 2FA and terms that cost accounts.

🔑 **And a token is better at the thing that was wanted:** scoped to posting on one page, revocable on its own, and **it survives a password change** — a stored password would break posting every time one changed.

**Re-validation.** `/api/cron/social-health` runs daily at 09:00 IST and emails `social@imotara.com` the hour a channel stops working — **only on a change**. ⚠️ It checks what is knowable from here (the key, the stored expiry); it cannot yet ask a platform whether a token still works, because there is no adapter to ask with.

---

## 6. The two switches

| Switch | Default | What it does |
|---|---|---|
| **Post it without asking me** (per schedule) | **Off** | Off: the draft waits in the queue. On: it posts unattended. 🔐 Owner only to turn on; anyone may turn off. |
| **Stop everything** (`social_settings.posting_paused`) | Off | Holds every schedule at once. 🔐 Owner only, both ways. |

⛔ **The word check runs in both positions.** The switch decides whether a *person* reads the post, never whether it is checked.

---

## 7. Tables and routes

**Tables** (`docs/sql/social_autopost_v1.sql`, RLS on with **no policies** — admin routes only): `social_language_tiers` · `social_abuse_terms` · `social_accounts` · `social_settings` · `social_schedules` · `social_posts` · `social_topics_used` · `social_visuals_used`

**Triggers:** the schedule language guard · the abuse-terms recompute · the language demotion cascade

**Routes:** `/api/admin/social/{schedules,posts,compose,generate,channels,settings,languages}` · `/api/admin/social/picture/[id]` · `/api/admin/social/animation/[id]` · crons `/api/cron/social-queue` and `/api/cron/social-health`

**Env:** `SOCIAL_TOKEN_KEY` (32 bytes, base64 — set in Vercel, production + preview, `sensitive`) · `CRON_SECRET` (shared with the other crons)

---

## 8. Things that have already gone wrong here

Kept because each one cost time and none was visible from a test:

- 🔴 **`array_length('{}', 1)` returns NULL, not 0** — so `check (array_length(languages,1) >= 1)` passed and a schedule with **no language** was accepted. Use `cardinality()`.
- 🔴 **Renaming the layouts broke every stored picture.** The recipe is persisted as JSON; a post approved an hour earlier rendered as `unknown layout "split-rule"`. Any value that is stored and matched by name is a public identifier — renaming one is a migration.
- 🔴 **The gate checked only the first occurrence** of a term, so *"Not a therapist. Our therapist will see you now."* passed.
- 🔴 **`psychotherapist` sailed past a list containing `therapist`** — word boundaries.
- 🔴 **A zero-width space or curly apostrophe defeated the check entirely** — pasted text carries them invisibly.
- 🔴 **`inset: 0` is silently ignored by Satori** — two of six motifs rendered as nothing.
- 🔴 **The screens stated production's condition before being told it** — "Everything is held" came from a `useState(true)` default while the page had no session.
- ⚠️ **Three QR codes already existed** in `scripts/generate-qr-codes.js`; one generic code was shipped without looking.

---

**Tests:** `src/__tests__/social/` — 12 files. **Design doc:** `docs/social-autopost-design.md`.
