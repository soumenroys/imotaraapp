# App Store listing — draft for review

**Status: DRAFT. Nothing submitted.** The Play half of this work went live after the 16 Oct
submission (`docs/play-listing-draft.md`); this is the App Store half.

What can change when, on the App Store:

| Field | Limit | Editable now? |
|---|---|---|
| Promotional text | 170 | ✅ any time, no review |
| Name, subtitle, keywords, description | 30 / 30 / 100 / 4000 | ⛔ only with a new version (1.5.9, held by the owner) |
| "Languages" line on the store page | — | ⛔ comes from the app binary, not the listing — see the last section |

Read from the live page (`apps.apple.com/in/app/imotara/id6756697569`) on 2026-10-21.

---

## 1. Name — 30 characters

**Now:** `Imotara` (7/30) · **Draft:** `Imotara: Mood & Mind Companion` (30/30)

Same title the owner chose for Play on 16 Oct. One name across both stores.

## 2. Subtitle — 30 characters

**Now:** `Emotional wellness companion` · **Draft:** `Talk it out, in 22 languages` (28/30)

The subtitle is indexed for search. "Companion" is already in the name, so repeating it here
spends characters for nothing; the languages are the differentiator.

## 3. Keywords — 100 characters, comma-separated, no spaces after commas

**Draft:** `journal,mental health,anxiety,stress,lonely,feelings,diary,calm,hindi,bengali,tamil,telugu,marathi` (98/100)

Apple already indexes every word of the name and subtitle, so none are repeated here.

## 4. Promotional text — 170 characters (editable now)

**Now:** empty.

**Draft:**

> Say how you actually feel, in the language you think in. 22 languages, 11 of them Indian. Private, free to start, and honest that it is not therapy.

(148/170)

## 5. Description — 4000 characters

🔴 **The live description has to change, not just improve.** Its Connect section says users can
"book a session with a supportive listener or **wellness professional**". Connect companions are
peers: they sign an agreement that they are not licensed professionals, and `ae955a4` removed
this exact kind of claim from the website and the app on 16 Oct. The App Store page is the last
place still making it.

Also gone: "Reflections informed by real approaches — grounding techniques, strengths-based
reflection" reads as a clinical-method claim; and the stacked bullets.

The draft is the live Play text (approved and published) plus the subscription terms Apple
requires.

```
Imotara — a private space to say how you actually feel

Most people don't want advice. They want to say the thing out loud to
someone who won't flinch, change the subject, or tell the family.

Imotara is that. You type or speak; it listens, asks one good question
rather than three, and remembers what mattered last time you talked. It
won't diagnose you, won't tell you to think positive, and won't panic if
you say something frightening.


Talk in the language you think in

Imotara speaks 22 languages, and eleven of them are Indian: Hindi,
Bengali, Marathi, Tamil, Telugu, Gujarati, Punjabi, Kannada, Malayalam,
Odia and Urdu — alongside English, Arabic, Hebrew, Russian, Chinese,
Japanese, Spanish, French, German, Portuguese and Indonesian.

Not translated English. Ordinary conversational register, the way people
actually speak. Most of us feel things in our first language and only
translate afterwards, and the translation is where the feeling gets lost.

You can speak instead of typing, hands-free, and Imotara can read its
replies back to you.


What you can do here

Say what happened, and be heard.
Keep a mood timeline, and see how a week actually went rather than how
you remember it.
Breathe, when the thinking won't stop.
Look back at a conversation that mattered.
Use it on a plane, on a train, with no signal — replies work offline.


Your conversations stay yours

Imotara is local-first. What you write stays on your device unless you
switch cloud sync on yourself. No ads. No engagement algorithm. No
social feed. Nothing sold to anyone, ever. You can export or delete
everything from one screen.


Free, and what costs money

Free, forever: twenty cloud replies a day, unlimited replies on your own
device, all 22 languages, breathing and mood tools. No card needed.

Imotara Plus: unlimited replies and history, companion personas, a
natural neural voice, emotion trends and companion letters.

Imotara Connect: if talking to software isn't enough, you can reach a
verified human wellness companion, paid by the minute.

Imotara Plus renews automatically unless cancelled at least 24 hours
before the end of the current period. Manage or cancel it any time in
your Apple ID account settings.


Everywhere you are

iPhone, iPad, Android, or your browser at imotara.com. Your history
follows you across devices when cloud sync is on.


Please read this part

Imotara is not therapy, not a doctor, and not a crisis service. It is a
companion for reflection, and it will say so itself rather than pretend
otherwise.

If you are in danger right now, please contact a qualified professional
or a crisis helpline. In India, Tele-MANAS is free and open 24 hours on
14416. Imotara will show you a helpline for your own country when it
matters.


Terms of Use: https://imotara.com/terms
Privacy Policy: https://imotara.com/privacy
```

---

## 6. ⚠️ "Languages: English" — a binary fix, not a listing fix

The store page lists **one** language. Apple builds that line from the localisations inside the
app bundle (`.lproj` folders), and the iOS app declares none — `app.json` has no `locales` key.
So a Bengali speaker searching the store is told Imotara is English-only.

The fix is Expo's top-level `locales` map, which generates one `<lang>.lproj/InfoPlist.strings`
per language. It ships only in a new build (1.5.9).

⛔ **Not done yet, deliberately.** Adding `.lproj` folders also changes what iOS treats as the
app's language (it adds a per-app Language setting, and localises system prompts). This app has
a long history of language-selection traps, so it needs a device check in Bengali and Hindi
before it ships, not just a passing build.
