// src/lib/broadcast/templates/individuals.ts
// The only genuine NEWSLETTER audience — people who asked to hear from us.
// House style and the reasoning behind it: see ./types.ts

import { SITE, type Template } from "./types";

export const INDIVIDUALS: Template[] = [
    {
        id: "individuals-first-week",
        audience: "individuals",
        title: "After signing up — the first week",
        note: "Send a few days after someone first uses Imotara.",
        subject: "A small suggestion for your first week with Imotara",
        body: `Hello {{name|there}},

You tried Imotara recently, and I wanted to send one thought rather than a list of features.

The people who get the most from it do something quite ordinary: they open it when something is *already* on their mind, rather than waiting for a moment calm enough to reflect properly. The messy moment is the useful one.

You don't need an account, and you don't need to finish anything. A few lines is a complete use of it.

> It isn't therapy, and it doesn't pretend to be. It's somewhere to put the thought down and look at it.

If you'd like to pick it up again: ${SITE}

What made you try it in the first place? I read every reply.

— Suchismita`,
    },
    {
        id: "individuals-late-night",
        audience: "individuals",
        title: "The 2am thought",
        note: "For people who use Imotara late — or who stopped.",
        subject: "The thoughts that only show up at 2am",
        body: `Hello {{name|there}},

There's a particular kind of thought that waits until the house is quiet. It isn't usually new. It's the one you were too busy to look at during the day.

The difficulty at that hour isn't that help is unavailable — it's that waking someone feels unreasonable for something you can't quite name yet.

Imotara is awake at that hour, in your own language, and it doesn't need the thought to be tidy before you say it.

If a night comes when that would help: ${SITE}

And if it's ever heavier than that — please talk to someone. In India, Tele-MANAS is 14416, and it is free, around the clock.

Does the quiet hour tend to help you think, or make it harder?

— Suchismita`,
    },
    {
        id: "individuals-own-language",
        audience: "individuals",
        title: "In your own language",
        note: "Good for multilingual or non-English-first readers.",
        subject: "Saying it in the language you think in",
        body: `Hello {{name|there}},

Most of us can describe a difficult feeling in English. Far fewer of us can describe it *accurately* in English — the word that actually fits is usually in the language we grew up in.

Imotara understands 22 languages, including Bengali, Hindi, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia and Urdu. You can switch mid-sentence, or write the way people actually write — Roman script if that's what you use.

Nothing is translated and handed back to you flattened. It replies in the language you wrote in.

If you'd like to try it in yours: ${SITE}

Which language do you find yourself thinking in when something is difficult?

— Suchismita`,
    },
    {
        id: "individuals-patterns",
        audience: "individuals",
        title: "Patterns you can't see day to day",
        note: "About mood history and Trends.",
        subject: "The pattern you can't see from inside the week",
        body: `Hello {{name|there}},

A hard Tuesday feels like a hard Tuesday. Six hard Tuesdays in a row is information — but almost nobody notices it, because we experience our weeks one at a time.

Imotara keeps a quiet record of how you've been, and shows it back to you as a shape rather than a score. No streaks, no targets, nothing to keep up with.

Some people find the pattern is about sleep. Some find it's one recurring conversation. Often it isn't what they expected.

If you'd like to look: ${SITE}

If you already know your pattern — what is it? I'd genuinely like to know.

— Suchismita`,
    },
    {
        id: "individuals-not-advice",
        audience: "individuals",
        title: "When you don't want advice",
        note: "For readers who bounce off self-help tools.",
        subject: "When you don't want advice, just somewhere to put it",
        body: `Hello {{name|there}},

A lot of wellbeing tools answer a question nobody asked. You mention you're exhausted and get five steps for better sleep.

Sometimes that helps. Often what's needed first is simply to be heard accurately — to have the thing you said reflected back without being fixed.

Imotara leans that way by default. You can ask it for something practical and it will give you that, but it won't push.

If that sounds like the right shape: ${SITE}

Which do you usually want first — to be heard, or to be helped?

— Suchismita`,
    },
    {
        id: "individuals-no-account",
        audience: "individuals",
        title: "No account needed",
        note: "For people hesitant about signing up.",
        subject: "You don't have to sign up to try this",
        body: `Hello {{name|there}},

If you haven't opened Imotara yet, it may be because trying something new usually means an account, a password and an email you'll regret giving.

You don't need one. Open it and start typing. Chat, mood check-ins, your history and reflections all work without signing in, and what you write stays on your device.

An account only adds the things that genuinely need one — syncing across your phone and laptop, and backup.

If you'd like to look without committing anything: ${SITE}

Was there something specific that put you off? That's useful for me to know.

— Suchismita`,
    },
    {
        id: "individuals-privacy",
        audience: "individuals",
        title: "What we don't do with your words",
        note: "Privacy-led. Good for cautious readers.",
        subject: "What happens to the things you type",
        body: `Hello {{name|there}},

It's a fair question to ask before telling something personal to an app, so here is the plain answer.

- There are no ads in Imotara, so nothing about you is worth selling
- Without an account, your conversations stay on your device
- With an account, they sync so you can pick up on another device — that's what the account is for
- You can delete your history, and that means deleted

What we do keep is deliberately boring: enough to run your account and keep the service working.

The full detail, without the legal fog: ${SITE}/privacy

Is there something you'd want to know that isn't answered there? Ask me directly.

— Suchismita`,
    },
    {
        id: "individuals-companion",
        audience: "individuals",
        title: "Shaping the companion",
        note: "About naming the companion and setting its tone.",
        subject: "You can decide who you're talking to",
        body: `Hello {{name|there}},

One thing people often miss: the companion isn't fixed. You can name it, and you can set what it is to you — a friend, a mentor, something more formal.

It sounds cosmetic. It isn't. People talk very differently to "an assistant" than to something they've given a name and a relationship to, and the difference shows up in what they're willing to say.

You can change it whenever it stops fitting. Settings, then the companion section.

If you'd like to set yours up: ${SITE}

If you've named yours — what did you call it?

— Suchismita`,
    },
    {
        id: "individuals-returning",
        audience: "individuals",
        title: "Coming back after a gap",
        note: "Re-engagement. ⚠️ Send sparingly — once per person.",
        subject: "No need to catch up on anything",
        body: `Hello {{name|there}},

It's been a while since you opened Imotara, and I want to be clear that this isn't a nudge about a streak you've broken. There are no streaks. Nothing has been waiting for you disapprovingly.

If life has been fine, that's the best possible reason not to have needed it.

And if it hasn't been fine, you can pick it up mid-thought. Your history is still there if you were signed in, and if you weren't, starting fresh is completely normal.

Whenever it's useful: ${SITE}

How have the last few months actually been?

— Suchismita`,
    },
    {
        id: "individuals-not-therapy",
        audience: "individuals",
        title: "What Imotara is and isn't",
        note: "Honest positioning. Good as a second or third message.",
        subject: "What Imotara is, and what it isn't",
        body: `Hello {{name|there}},

I'd rather be straight with you about this than have you find out at the wrong moment.

**Imotara is not therapy.** It isn't a therapist, it isn't a crisis service, and it can't replace someone qualified who knows you. It's a private place to think out loud, notice how you've been, and say the thing you haven't said yet.

For many people that's genuinely useful on an ordinary difficult day. It is not enough when something is serious.

If you are in real distress, please contact someone who can help properly. In India: Tele-MANAS on **14416**, free and around the clock, or emergency services on **112**.

Imotara, for the ordinary days: ${SITE}

Is there anything you wish a tool like this would stop pretending to be?

— Suchismita`,
    },
];
