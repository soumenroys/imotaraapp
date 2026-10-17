# Scheduled social posting — plan and design

**What the owner asked for, 17 Oct 2026.** An admin feature that posts Imotara-specific content to
Facebook and LinkedIn on a schedule. The owner picks the content type (text, graphics, video,
combinations) and the time; the subject is generated, always unique; it publishes automatically
without re-entering credentials each time. More channels later.

**Short answer: yes, and most of it is straightforward here.** The scheduling, queueing and
generation all have working precedents in this codebase. ⛔ **The hard part is not the code — it
is API access, and the two platforms gate it very differently.** That decides the order of work,
so it comes first.

---

## 1. ⛔ The two constraints that shape everything

### Facebook — solvable without App Review
Publishing to a Page needs `pages_manage_posts`. The `wabhai` app (ID `2167301730838484`) does
**not** have it, and the ordinary route is Meta App Review.

✅ **But we do not need that route.** For a Page we own, inside our own Business Portfolio, a
**Business Manager System User** can be granted Page access and issue a long-lived token with no
App Review. That is the correct architecture for first-party posting, and it is also how we avoid
ever handling a password.

⚠️ Prerequisite: the Page must be owned by the portfolio. ✅ It is, as of 17 Oct.

### LinkedIn — genuinely gated, and the long pole
Posting to a Company Page needs `w_organization_social` via the **Community Management API**,
which is **approval-gated**. From LinkedIn's own documentation and current write-ups:

- Available to **registered legal organisations, commercial use cases only** ⇒ M/S IMOTARA
  qualifies, but it is an application with a wait.
- **Development tier**: ~500 app calls/day, 100 per member, for up to 12 months. Enough for this.
- Leaving Development needs a **second review**.
- The publishing user must be a **Page admin** ✅ we are.
- Tokens expire in **60 days**; refresh tokens last 365 ⇒ **refresh must be automated or it dies
  silently in two months.**

⇒ **Build Facebook first and ship it. Apply for LinkedIn in parallel and add it when approved.**
⛔ Do not design as though both arrive together.

### 🔴 The third constraint, which is ours not theirs
**Auto-posting unreviewed generated content from a mental-health brand is the riskiest part of
this feature, and nothing about it is technical.**

Today alone, **eight** regulated-title claims were found in copy written by humans who knew the
rules — *"expert counselors"*, *"Human Consultation"*, *"therapy alternative"*. A generator posting
daily without review will eventually produce one, on the channel where it does most harm. And the
Facebook estate was nearly lost this week to an enforcement action; automated posting is precisely
what draws scrutiny.

⇒ **Design decision: generated posts land in an approval queue, not on the timeline.**

**The owner settled this on 17 Oct:** *"Make it in setting, if selected off then 'Generated posts do
not publish. They wait for you.' otherwise post"* ⇒ it is a real switch with two real positions,
not a warning dressed up as one.

| `auto_publish` | What happens at the hour |
|---|---|
| **OFF** — the default for every new schedule | It writes, then **waits**. The draft sits in the review queue until the owner approves it. Nothing reaches a timeline on its own. |
| **ON** | It writes and **posts**, unattended. No review step, no email first. |

🔑 **Two things that must not be confused with each other:**
- ⛔ **The safety gate runs in BOTH positions**, and in both it *throws the draft away* rather than
  warning. The switch decides whether a **human** reads the post — never whether it is checked.
- The switch is **per schedule**, so one schedule can be trusted without trusting all of them, and
  there is **one master switch** on the social settings page that holds every schedule back at once
  (for the week the Facebook estate is under scrutiny, or any other reason to stop quickly).

---

## 2. What already exists and should be reused

| Need | Already in this codebase |
|---|---|
| Minute-accurate queue drain | `/api/cron/broadcast-queue`, running `* * * * *` |
| Scheduling + status + retry | the broadcast feature's queue model |
| Text generation | `src/lib/imotara/aiClient.ts` (OpenAI, Gemini fallback) |
| Image rendering | `scripts/generate-youtube-banner.js` — headless Chrome → PNG, four canvas sizes |
| Copy safety guards | `brandImagesClaimNoClinicalRole.test.ts`, `markupNeverOffersItselfAsTherapy.test.ts` |
| Admin shell | `/admin`, `/admin/analytics`, `/admin/crisis-events` |

🔑 **Nothing here needs inventing.** The feature is mostly wiring proven parts together.

---

## 2a. 🔒 Who can reach it — owner and Imotara admins only

**The owner, 17 Oct:** *"only owner or imotara admin can get this feature"*.

✅ **This needs no new mechanism.** The platform already has exactly the right gate:
`super_admins` (roles `owner` · `admin` · `connect_reviewer`) + a session cookie, checked by
`requireSuperAdmin()` in `src/app/api/admin/_auth.ts`.

### ✅ DECIDED 17 Oct — two tiers, and the owner named them himself

> *"yes the someone equivalent permission level of soumenroys or suchismita only can get that"*

🔑 **Both of those accounts are `role = 'owner'`** — `soumenroys@gmail.com` and
`suchismita.sen@imotara.com`, the highest tier that exists here
⇒ [[admin_credentials]], [[admin_access_suchismita_sen]]. ⇒ **"equivalent to Soumen or
Suchismita" resolves exactly to `role = 'owner'`**, so the rule needs no new concept at all.

| who | read the queue · approve · write a post · edit a schedule | 🔐 connect a channel · replace a token · switch auto-publish ON |
|---|---|---|
| `role = 'owner'` — Soumen, Suchismita | ✅ | ✅ |
| `role = 'admin'` | ✅ | ⛔ **no** |
| `role = 'connect_reviewer'` | ⛔ | ⛔ |
| **Org admins** (`/org/*`, a different table entirely) | ⛔ | ⛔ |
| an ordinary signed-in user | ⛔ | ⛔ |

⛔ **Org admins and Connect reviewers are excluded by construction, not by a check** — they have no
`super_admins` row at all, and `adminAuthorized()` already refuses `connect_reviewer`. Nothing can
be forgotten into existence here.

🔐 **Why those three actions and not others.** They are the only ones that can **publish in the
company's name without a human reading the words** (auto-publish), **expose a credential** (token
replacement), or **attach a new public identity to the system** (connecting a channel). Everything
else is reversible, visible, and already requires a person.

⚠️ **One thing to tidy, found while confirming the roles:** `test@imotara.com` holds `role = 'admin'`
and is **inactive**. Inactive means it cannot sign in — but if it is ever reactivated it inherits the
whole left-hand column. ▶️ **Recommendation: delete it rather than leave it dormant.**

⚠️ Roles above are read from the record of **2 Sep 2026**, which was verified live against production
then; the SQL to re-verify is in [[admin_access_suchismita_sen]]. ⛔ Worth re-running before the
`owner` gate is written, rather than trusting this file
⇒ [[feedback_check_the_record_before_asserting]].

⛔ **The legacy `ADMIN_SECRET` Bearer path must not be an entry point.** The key has been deleted
from Vercel and `ADMIN_SECRET_DISABLED` is honoured in `requireSuperAdmin()` as of the 16 Oct
security review — the new routes inherit that, and must not reintroduce a bypass.

⚠️ **Hiding the menu item is not authorization.** Every `/api/admin/social/*` route checks on its
own, on every request. ⇒ [[security_review_findings_2026_10_16]]

🛡️ **The three owner-only actions are checked server-side, per request, in their own routes** —
not by hiding a button. A disabled control in a page an `admin` can open is a hint, never a gate.

---

## 2b. ✍️ Two ways a post is made — generated, or written by you

**The owner, 17 Oct:** *"also consider to create the content manually and post, not only automated
content creation and post"*.

✅ **Right call, and it costs almost nothing** — the queue, the gate, the picture composer, the
previews, the adapters and the retries are all the same machinery. Writing by hand is a different
*way in*, not a different pipeline.

| | generated | written by you |
|---|---|---|
| Where it starts | a schedule, at its hour | `/admin/social/compose`, whenever you like |
| Subject | drawn from the pool, checked against the register | yours |
| The words | written for you, then editable | yours, with the gate checking as you type |
| The picture | composed from an unused recipe | composed from a recipe you can shuffle or pick |
| 🛡️ The safety gate | ✅ runs | ✅ **runs, identically** |
| The voice rules (§4c) | ✅ enforced | ⚠️ **checked and shown, never silently changed** |
| Publishing | its schedule's slot, or waits for approval | **post now**, or pick a time |

🔑 **Three things that make this worth having beyond convenience:**
1. **A generated draft can be taken over.** *Edit the words* on any queued draft turns it into a
   written post with the draft as a starting point. That is how most posts will really be made.
2. **The occasions that matter are never generated.** A launch, a thank-you, an apology, a response
   to something in the news — those need a person, and today there is nowhere to write them.
3. ⛔ **It must not become a bypass.** A hand-written post goes through the same gate and the same
   checks. The gate exists because people who knew the rules still wrote eight claims that broke
   them — ⚠️ **it protects us from ourselves, not from the model.**

---

## 3. Data model

```
social_accounts
  id · platform ('facebook'|'linkedin') · display_name · external_id
  access_token (encrypted) · refresh_token (encrypted)
  token_expires_at · status ('ok'|'expiring'|'dead') · last_verified_at

social_schedules
  id · name · platforms[] · content_type · post_at (time) · timezone
  days[] · active · auto_publish (default FALSE) · topic_pool · tone
  languages[] (rotated, one per post) · wordmark_follows_language (default TRUE)
  created_by (super_admins.id) · auto_publish_enabled_by · auto_publish_enabled_at

social_settings                        -- one row; the master switch
  posting_paused (default FALSE) · paused_by · paused_at · note

social_posts
  id · schedule_id (NULL when written by hand) · platform · scheduled_for
  origin ('generated'|'written')   ← a hand-written post is a first-class row, not a special case
  author_id (super_admins.id, when written)
  language (BCP-47) · status ('drafting'|'generating'|'needs_review'|'approved'
                             |'publishing'|'published'|'failed'|'skipped')
  subject · body · media_path · media_kind · visual_recipe
  external_post_id · error · generated_at · reviewed_by · published_at

social_topics_used
  id · subject_hash · subject · used_at · schedule_id

social_visuals_used                    -- what makes the PICTURES unique, not just the words
  id · recipe_hash · layout · palette · type_treatment · motif · script
  used_at · schedule_id · post_id
```

⚠️ `social_topics_used` is what makes "always unique" real. ⛔ Uniqueness cannot be a prompt
instruction — a model asked for "something new" repeats itself within a fortnight. **It must be
enforced against stored history**, by hashed subject, with the recent list passed to the generator
as an exclusion.

---

## 4. The pipeline

```
cron (every minute)
  └─ due schedules?
       └─ pick a subject   ── excluded against social_topics_used
            └─ generate body (aiClient)
                 └─ 🛡️ SAFETY GATE  ── the not-therapy blocklist, as a hard reject
                      │                     ⛔ runs whatever auto_publish says
                      └─ render media if the content type needs it
                           ├─ auto_publish = FALSE (default)
                           │    └─ status: needs_review
                           │         └─ owner approves in /admin/social ─┐
                           └─ auto_publish = TRUE                        │
                                └─ status: approved ────────────────────┬┘
                                                                        └─ publish via adapter
                                                                             └─ record external_post_id,
                                                                                or error + retry ×3
```

**Platform adapters** share one interface, so a new channel is one file:

```ts
interface SocialAdapter {
  platform: string;
  verify(): Promise<boolean>;             // token still good?
  publish(post: PreparedPost): Promise<{ externalId: string }>;
  refreshToken?(): Promise<void>;
}
```

### 🛡️ The safety gate is not optional — and it has three lists, not one
The same vocabulary already guarded in code, applied to **generated** output before it can be
queued: ⛔ therapist · counsellor · therapy · clinical · diagnose · treat · heal · cure · patient ·
consultation. A hit **rejects the draft and regenerates**, it does not warn.

**The other two lists**, added on the owner's brief of 17 Oct (§4c):
2. 🚫 **Abuse and profanity**, per language, in **both** the native script and Latin
   transliteration — an English list on a Bengali post checks nothing.
3. 🔴 **Casual ableist idiom** — *crazy · insane · psycho · mental · lunatic · triggered* used
   loosely. ⚠️ **This is the list an ordinary profanity filter does not have**, and the one most
   likely to be tripped on a mental-health page by a perfectly well-meant sentence.
⚠️ It cannot read an image ⇒ graphics are **composed** from a recipe system, never produced by a free
image model, and every word in a picture comes from caption text the gate has already read
⇒ §4a, [[trap_marketing_copy_claims_a_regulated_title]].

---

## 4a. 🎨 Making the picture unique too — and the trade I had to reverse

**The owner, 17 Oct:** *"take extra care that the image style, content, theme should be unique in all
respect and those posts should be for all audience"*.

⚠️ **This overturns something I had locked down, and the reason matters.** My first design froze the
graphic to one template with a fixed headline set, *specifically* so a picture could never make a
claim the text gate had not seen. That bought safety by making every post look the same — which, on
a feed, is its own kind of failure.

⛔ **The wrong fix is a free image model.** Hand a prompt to an image generator and you get invented
text in the picture, invented faces, and imagery no blocklist can read. ⇒ The gate cannot read an
image, so the image must not be free-form.

### ✅ The resolution: uniqueness by RECIPE, enforced from a register

The graphic is composed from independently-varying axes. The **combination** is hashed, stored, and
never repeated — the same discipline as the subject, for the same reason: ⛔ **uniqueness cannot be
asked for, it has to be enforced from a record.**

| axis | variants | notes |
|---|---|---|
| **Layout** | 8 | wordmark-corner · centred statement · split rule · stacked · offset quote · language grid · low horizon · full-bleed type |
| **Palette** | 6 | brand-derived grounds (ink, slate, deep teal, warm sand, plum, forest), each with its accent pre-checked at **4.5:1** |
| **Type treatment** | 4 | scale, weight, case, measure |
| **Motif** | 6 | line and shape fields — arcs, dotted grid, concentric, bands, rule stack, none. ⛔ **no gradient washes** |
| **Script of the wordmark** | 22 | the verified native-script table ⇒ [[brand_name_in_native_scripts]]. 🔑 This axis is not decoration — it *is* the product's point |

⇒ **25,344 distinct recipes** (8 × 6 × 4 × 6 × 22). The register makes repetition impossible, and a
second rule keeps the feed from *looking* repetitive even when the hash differs: **no palette and no
layout returns among the last five posts.**

🔴 **I first wrote that second rule as "within 14 days", and it is arithmetically impossible** — there
are six palettes, so fourteen days of daily posting needs fourteen distinct ones. The rule would
have been unsatisfiable from day seven, and the only open question was whether the code failed
loudly or relaxed it quietly where nobody reads the log. **Five posts** is always satisfiable and is
long enough that nobody scrolling the page meets the same ground twice running.
⚠️ The picker throws if an axis is ever shrunk below that window, rather than leaving a comment
asking the next person to remember.

🔑 **And the two rules are different in kind**, which is the part worth keeping: *never used before*
is a **guarantee** backed by a unique index, and the picker fails rather than break it; *not among
the last five* is a **preference**, and when it cannot be met it is dropped **and reported**. ⛔ A
preference that lapses silently is indistinguishable from a bug.

### ⛔ What the picture may still never contain
- **Text that was not written by the generator and read by the gate.** Every word in the image comes
  from the approved caption fields, so the gate has already seen it.
- **A human face, photographed or generated.** On a mental-health post a face reads as a
  testimonial from a real person who does not exist.
- **Any depiction of distress** — tears, isolation, a figure in the dark, a hand reaching.
  🔴 This is the imagery the category reaches for by habit, and it is the worst possible thing to
  put in front of someone scrolling on a bad day.
- **Country-specific or festival-specific furniture**, which quietly narrows the audience.

### 👥 "For all audience" — the editorial rule, written down so it can be enforced
Every post, text and picture:
- **Assumes nothing about who is reading** — not their country, language, faith, age, family shape,
  job, or whether they are having a hard time right now.
- **Says it in plain words.** No clinical vocabulary ⇒ the gate; and no product jargon either.
- ⛔ **Never addresses a segment.** No *"students —"*, no *"for HR leaders"*, no *"this Diwali"*.
  Audience-specific copy belongs on the `/for/*` landing pages, not on the main channels.
- **Is legible to someone who has never heard of Imotara**, with no prior post required to make
  sense of it.
- **Reads as well at thumbnail size as full size**, which is where most people will meet it.

⚠️ **Two of these cannot be machine-checked** — *is this addressed to everyone* and *would this land
badly on a bad day* are judgement, not pattern matching. ⇒ **A second reason the approval queue
stays the default**, and the honest answer to "why can't it just post from day one".

---

## 4b. 🗣️ Which language it is written in

**The owner, 17 Oct:** *"also introduce a language selection for the content"*.

A schedule carries a **list** of languages and **rotates** them; each post is in **exactly one**.
⛔ **Not two languages in one post** — a bilingual caption reads as a translation exercise and halves
the room for the thought. ⛔ **Not the same subject across five languages on one day** either; that
is the same post five times, and it reads as spam on a page with the follower counts we have.

✅ **The picture follows the post.** The wordmark axis (§4a) uses that language's script from the
verified table ⇒ [[brand_name_in_native_scripts]]. ⛔ **Never transliterate the brand ad hoc** — two
of those 22 were spelled two different ways until a guard caught it.

### 🔴 The honest constraint, and the rule it produces
**A public post is not an in-app reply.** A reply is read by one person and gone; a post is
permanent, quotable, and screenshot. And the reply quality in most of the 22 languages
**has never been read by a native speaker**
⇒ [[native_speakers_should_audit_real_replies]], [[feedback_bengali_test_strings_must_be_natural]].

⇒ **Languages sit in two tiers, and the tier decides one thing only:**

| tier | what it means | may auto-publish? |
|---|---|---|
| 🟢 **Read by someone here** — English, Bengali, Hindi | a person on this side can tell whether it sounds like a person or like a translation | ✅ yes, once the schedule has earned it |
| 🟠 **Not yet read by anyone here** — the other 19 | we cannot currently tell | ⛔ **no.** It is written, composed and queued — and waits for a human ⩾ always |

🔑 **This is not a smaller feature than the owner asked for.** Every one of the 22 can be selected,
written, pictured and posted. The tier gates only *unattended* posting, and a language moves to the
green tier the moment somebody who speaks it reads a few real drafts ⇒ that is already a standing
instruction whenever a native speaker appears for any reason.

⚠️ **Two traps if this is built carelessly:**
- `concreteLang('auto')` resolves to `'en'` ⇒ [[trap_concretelang_turns_auto_into_en]]. A schedule
  with no language must **refuse to run**, not quietly post in English.
- The abuse list (§4c) must cover the post's **own** language, in its **own script and in Latin
  transliteration**. An English-only profanity filter on a Bengali post checks nothing.

---

## 4c. 💛 The voice — and the words that are never used

**The owner, 17 Oct:** *"content should not include any abusive words, should be gentle, touchy,
thoughtful, insightful and promote thinking, generous"*.

That is a brief, so it is written down here as rules a reviewer can actually apply, rather than
adjectives in a prompt.

### ✅ What every post does
- **Speaks to one person.** *You*, never *users*, never *our community*.
- **Says one true thing**, and stops. ⛔ No three-benefit structure, no feature list.
- **Leaves room.** A post that answers everything invites nothing. Where it is honest to end open,
  it ends open — ⛔ **but never a manufactured prompt** (*"What do you think? 👇"*). An open ending
  is a thought left standing, not a question begged.
- **Is generous.** Credits the reader's intelligence. Says what the product does *not* do. Points
  to something useful even when it is not ours.
- **Earns the feeling instead of asking for it.** ⛔ No sentimental staging, no invented second
  person *"I know how you feel"*. Gentle is a register, not a subject.

### ⛔ What never appears
| | why it matters here specifically |
|---|---|
| Profanity, slurs, abuse, mockery, sarcasm at anyone's expense | the obvious floor |
| 🔴 **Casual ableist idiom** — *crazy, insane, psycho, mental, OCD about, triggered* used loosely | **the real risk, and no ordinary profanity filter catches it.** On a mental-health page, *"crazy good"* is the sentence that gets screenshot |
| Urgency, scarcity, streaks, *don't miss out* | the product is deliberately the opposite of this ⇒ the app has no feed, no streak, no badge |
| Guilt or shame — *you owe yourself, stop making excuses* | it blames the reader for the state they are in |
| Belittling anyone else — competitors, therapists, other coping | ⛔ and never positioning against real clinicians |
| A regulated title or clinical claim | §4's gate ⇒ [[trap_marketing_copy_claims_a_regulated_title]] |
| Anything that reads as a testimonial, or a story about a person who does not exist | the same reason a face is refused in §4a |

⚠️ **Emoji: none in the body**, and at most two hashtags — or none. This matches the house style
already enforced on broadcast mail ⇒ [[broadcast_templates_house_style]].

🔑 **Which of these a machine can check, honestly:**
✅ the word lists, the emoji and hashtag counts, length, the clinical gate — all mechanical.
⛔ *gentle* · *insightful* · *leaves room* · *generous* — none of them. They are read, not matched.
⇒ **The third reason the approval queue is the default**, and the reason a hand-written post is
worth building: the brief above describes writing, and writing is what a person does.

---

## 5. Content types — honest feasibility

| Type | Feasible? | Notes |
|---|---|---|
| **Text** | ✅ now | `aiClient`, straightforward |
| **Graphics** | ✅ now | The banner generator, extended into a **recipe system** — unique every time, and still unable to invent a claim ⇒ §4a |
| **Text + Graphics** | ✅ now | The two above |
| **Short video** | 🟠 phase 4 | Needs a render pipeline (ffmpeg is present). Slideshow-style is realistic; anything more is not |
| **Long video** | 🔴 **not recommended** | Auto-generated long video is poor, expensive, and nobody watches it. ⇒ Do not build it. If long video is wanted, it should be made by a person |

⚠️ **Cost**: daily generation on two channels is small (a few ₹/day of tokens). Video rendering is
the part that would change that.

---

## 6. Phases

| Phase | Contains | Blocked on |
|---|---|---|
| **1** | Schema, admin UI, schedule CRUD, generation + the **three-list gate**, **approval queue**, the **visual recipe system + register**, **language selection**, and the **hand-written composer**. **No posting yet** | nothing ✅ |
| **2** | Facebook adapter via Business Manager **System User** token | portfolio System User setup (owner, ~15 min) |
| **3** | LinkedIn adapter | ⏳ **Community Management API approval** |
| **4** | Short video; more channels (X, Instagram) | phase 1–3 done |

🔑 **Phase 1 is genuinely useful on its own** — it generates and queues daily content the owner can
post by hand in two clicks, which is already better than nothing and proves the generator before
anything is automated.

---

## 7. ⛔ What this will not do

- **It will not log in with a password.** Tokens only, issued by the platform, revocable by the
  owner ⇒ [[no_credential_impersonation_for_paid_apis]].
- **It will not post unreviewed by default.** `auto_publish` is a per-schedule setting that starts
  OFF; turning it ON genuinely posts unattended, and the safety gate runs either way.
- **It will not be reachable by an org admin, a Connect reviewer, or an ordinary user.**
- **It will not auto-generate long video.**
- **It will not post unattended in a language nobody here can read** ⇒ §4b. It will write,
  compose and queue in all 22.
- **It will not let a hand-written post skip the gate.**
- **It will not post to Instagram via the Facebook token** — Instagram publishing is a separate
  permission set, and the account only joined the portfolio on 17 Oct.
