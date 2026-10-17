# Product Hunt — the launch kit

**⛔ You launch once.** There is no second attempt at a first launch, and a launch posted at the
wrong hour with an improvised comment is simply spent. This file exists so that the day it happens,
nothing is being written under pressure.

Copy comes from [`listing-copy.md`](./listing-copy.md) — the one place the words live. ⛔ If
something here is wrong, fix it *there* first.

---

## ⏰ Before anything else: the timing is half the result

Product Hunt's day starts at **00:01 Pacific Time** and the leaderboard resets then. A post that
goes up at noon PT has lost half its voting window before anyone sees it.

| | |
|---|---|
| **Post at** | **00:01–00:30 PT** — that is **12:31–13:00 IST the same day** |
| **Which day** | **Tuesday, Wednesday or Thursday.** Monday is crowded, Friday–Sunday are quiet |
| **Be awake for** | the first 4 hours. Comments arriving unanswered is the commonest way a launch dies |

⚠️ **Never ask for upvotes** — not in the post, not on social, not in DMs. Product Hunt removes
posts for it. You may say "we're live on Product Hunt today" and link it. That is the line.

---

## The post

**Name**
```
Imotara
```

**Tagline** — 60 characters maximum. This one is 49.
```
Someone to talk to, in the language you think in
```

**Description** — ~260 characters.
```
A private companion for the days you don't feel like explaining yourself. It listens, remembers
what mattered last time, and speaks 22 languages — eleven of them Indian. Free to start, works
offline, no ads. It is not therapy and does not pretend to be.
```

**Topics** (pick 3)
```
Mental Health   ·   Artificial Intelligence   ·   Android
```
⚠️ Not "Productivity". It is the broadest topic and the one where this gets lost.

**Links**
```
Website      https://www.imotara.com
App Store    https://apps.apple.com/in/app/imotara/id6756697569
Google Play  https://play.google.com/store/apps/details?id=com.imotara.imotara
```

---

## 🔑 The first comment — the part that decides the launch

Post it **within one minute** of going live. On Product Hunt the maker's comment is read more
than the description, and a comment that reads like marketing is the single fastest way to be
scrolled past.

⛔ **Two-thirds of this is written. The opening is not, and I will not invent it** — see below.

> **[YOUR OPENING — 2 to 4 sentences. Why you built it. The true version.]**
>
> What Imotara does is narrow on purpose. You type or speak, it listens, and it remembers what
> mattered last time you talked. There is no feed, no streak, no badge, nothing to keep up with.
>
> The part I'd most like feedback on is the languages. It works in 22, eleven of them Indian —
> Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Punjabi, Kannada, Malayalam, Odia and Urdu.
> Most wellbeing apps offer English and a translation layer. The difference is whether the reply
> sounds like a person or like a translation, and that is the thing I cannot judge alone. If you
> speak one of those languages, say something real to it and tell me honestly which it sounds
> like.
>
> What it is not: it is not therapy, it does not diagnose, and it is not a crisis service. It
> says so in the app, and when it detects crisis language it shows the helpline for your country
> rather than trying to handle it itself.
>
> Free to start — 20 cloud replies a day, unlimited on-device, all 22 languages. Paid is ₹149/mo
> if you want unlimited and voice. Android, iPhone and web.
>
> Happy to answer anything, including the sceptical questions.

### ⛔ Why I left the opening blank

It is the one part that has to be true and yours. Product Hunt's audience reads a lot of launches
and can tell an invented origin story instantly. **Two or three honest sentences about why this
exists beat any paragraph I could write.**

⚠️ If it helps: the strongest version is usually concrete and small — a specific moment, not a
mission statement. Avoid "I realised there was a gap in the market".

---

## 🛡️ Prepared answers for the questions that will come

Product Hunt's mental-health launches reliably draw these. Having the answer ready is the
difference between a good thread and a defensive one.

**"Isn't this just ChatGPT with a prompt?"**
> Fair question. The differences that matter: it runs offline on-device when you have no signal,
> it keeps a mood history you can actually read back, and it is built around 22 languages rather
> than English plus translation. If you only want a chat window, you do not need this.

**"Is it safe for someone in crisis?"**
> It is not a crisis service and says so. It detects crisis language and surfaces the helpline for
> the user's country — Tele-MANAS 14416 in India, findahelpline.com elsewhere. The honest answer
> is that no app should be the thing standing between someone and a crisis line.

**"What happens to my data?"**
> Local-first. Conversations stay on the device by default; cloud sync is opt-in and off until you
> turn it on. The privacy policy names every processor rather than saying "third parties".

**"Why so cheap?" / "How do you make money?"**
> ₹149/month, and most people never pay. It is a small operation in Kolkata, not a funded one.

**"Who are the human companions in Connect?"**
> Peers with lived experience — friend, parent, sibling, wellness companion roles. ⛔ Explicitly
> **not** therapists, counsellors or psychologists, and the agreement they sign says so.

---

## 🖼️ Gallery

Product Hunt shows **1270 × 760**. First image is the one most people see.

| # | Shows | Source |
|---|---|---|
| 1 | The line + the 22 languages | ▶️ generate — add a `producthunt` spec to `scripts/generate-youtube-banner.js` |
| 2 | A real conversation | ⚠️ recapture from the **current** build ⇒ the store screenshots are stale |
| 3 | Mood trends | same |
| 4 | The crisis card | 🔑 Worth including. It is the honest differentiator and nobody else shows it |

⛔ **Do not reuse the existing store screenshots.** They still advertise a two-tier Plus/Pro
structure that no longer exists ⇒ `imotara_pending_tasks`.

---

## ✅ The morning checklist

- [ ] It is a Tue/Wed/Thu, and the clock says **12:31 IST**
- [ ] Gallery images ready, none of them the stale store screenshots
- [ ] First comment pasted **within one minute** of posting
- [ ] Your opening paragraph written — in your words
- [ ] Four hours clear to answer comments
- [ ] ⛔ Nobody has been asked to upvote
