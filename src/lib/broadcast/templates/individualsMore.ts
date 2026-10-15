// src/lib/broadcast/templates/individualsMore.ts
// Forty further angles for the newsletter audience, added 2026-10-15 at the
// owner's request to take each category to fifty.
//
// House style and the reasoning: ./types.ts. Enforced by
// src/__tests__/broadcast/templateHouseStyle.test.ts — no images, no buttons,
// one link, no promotional vocabulary, every message ends on a question.
//
// ⚠️ Written as distinct ANGLES, not variations on a theme. A template that is
// only a reworded version of its neighbour adds a row to the picker and
// nothing to the reader, and the usage counter would eventually show it.

import { SITE, type Template } from "./types";

const t = (
    id: string, title: string, note: string, subject: string, body: string,
): Template => ({ id: `individuals-${id}`, audience: "individuals", title, note, subject, body });

export const INDIVIDUALS_MORE: Template[] = [
    t("before-hard-conversation", "Before a difficult conversation",
      "For someone rehearsing something they have to say.",
      "Rehearsing it before you say it",
      `Hello {{name|there}},

There is a particular kind of tiredness that comes from rehearsing a conversation you have not had yet. You run it eight times, and in every version they say something different.

Saying it out loud once, to something that will not interrupt or take sides, tends to do more than the eighth rehearsal. Usually because you find out what you actually want from the conversation, which is often not what you thought.

If that would help: ${SITE}

What is the conversation you keep rehearsing?

— Suchismita`),

    t("after-argument", "After an argument",
      "Send sparingly. Good as a standalone.",
      "The hour after an argument",
      `Hello {{name|there}},

The hour after an argument is a strange one. You are still holding the version of events where you were entirely right, and you already know it is not quite true.

Talking it through with someone who knows both of you means managing their opinion as well as your own feelings. Sometimes you want to think before you do that.

Imotara has no stake in who was right. You can be unfair out loud and nobody is hurt by it.

If that is useful: ${SITE}

Do you usually need to cool down first, or talk it out straight away?

— Suchismita`),

    t("sunday-evening", "Sunday evening",
      "Time this for a Sunday afternoon.",
      "That feeling that arrives on Sunday evening",
      `Hello {{name|there}},

Somewhere around five on a Sunday, a mood arrives that has nothing to do with Sunday. The week ahead stops being abstract.

Most people treat it as something to distract themselves out of. It is usually worth about ten minutes of attention instead — it is often pointing at one specific thing in the week rather than the week in general.

If you want somewhere to put it: ${SITE}

Does Sunday evening land heavily for you, or is it a different day?

— Suchismita`),

    t("cannot-name-it", "When you can't name the feeling",
      "For people who bounce off mood scales.",
      "When you can't name what you're feeling",
      `Hello {{name|there}},

Mood trackers ask you to pick: sad, anxious, angry. Often none of them fit, and choosing the nearest one makes the record slightly false.

You can describe it badly instead. "Like something is about to go wrong but nothing is." "Fine but flat." Imotara works from what you wrote, not from a list you had to choose from.

Naming it accurately is frequently most of the relief.

If you want to try: ${SITE}

What would you call the feeling you have most often, in your own words?

— Suchismita`),

    t("comparison", "Comparing yourself to others",
      "Good for a younger audience.",
      "Measuring your life against other people's",
      `Hello {{name|there}},

Comparison is not a character flaw, it is how people work out where they stand. It only becomes corrosive when the comparison is against an edited version of someone's life.

The useful question is usually not "why am I behind" but "whose approval am I actually trying to get". That one has an answer, and it is rarely the person you thought.

If you want to think it through: ${SITE}

Who are you measuring yourself against at the moment?

— Suchismita`),

    t("thing-you-dont-say", "The thing you keep not saying",
      "Direct. Works well as a second or third message.",
      "The thing you keep almost saying",
      `Hello {{name|there}},

Most people have one. A sentence that gets close to being said and then gets swallowed, for years sometimes.

It is rarely dramatic. More often it is "I have not been okay for a while" or "I do not think I want this any more" — small sentences with large consequences, which is exactly why they stay in.

Saying it once, somewhere private, changes very little and also changes something.

If you want to: ${SITE}

What is yours? You do not have to tell me — but you could tell someone.

— Suchismita`),

    t("old-grief", "Grief that is old",
      "Handle with care. Do not send near a known anniversary.",
      "Grief that stopped being recent",
      `Hello {{name|there}},

There is a point after a loss when people stop asking. Not unkindly — they assume you have reached the other side, and often you have mostly.

But it arrives sideways. A song, a street, something they would have found funny. And by then it feels unreasonable to bring up, because it has been years.

It is not unreasonable. It is just quieter now.

If you would like somewhere to say their name: ${SITE}

Who do you still think about?

— Suchismita`),

    t("anger-you-regret", "Anger you are ashamed of",
      "For people who feel bad about how they reacted.",
      "The reaction you wish you hadn't had",
      `Hello {{name|there}},

Snapping at someone who did not deserve it leaves two problems: the thing you said, and the quiet worry about what it says about you.

The second one usually gets handled by not thinking about it, which keeps it exactly where it is.

Looking at it plainly is less frightening than it sounds. It is almost always tiredness, or something else entirely that landed on the nearest person.

If you want to look at it: ${SITE}

What usually comes out sideways when you are worn down?

— Suchismita`),

    t("numb-not-sad", "Numb rather than sad",
      "For people who do not feel bad enough to ask for help.",
      "Not sad exactly, just flat",
      `Hello {{name|there}},

Flat is harder to talk about than sad. Sad has a shape and people know what to say to it. Flat just means you are getting through the days and not much is landing.

It also means you rarely qualify, in your own head, for anybody's help. You are functioning. Nothing is wrong enough to mention.

It is worth paying attention to anyway, especially if it has been going on a while.

If you want somewhere to notice it: ${SITE}

How long has it been flat, roughly?

— Suchismita`),

    t("postponed-decision", "The decision you keep postponing",
      "Practical. Good for a coach-tone reader.",
      "The decision you keep not making",
      `Hello {{name|there}},

Some decisions do not get made because the information is missing. Most do not get made because both options cost something and you would rather not pick which thing to lose.

Writing down what each one actually costs — not the pros and cons, the losses — tends to end the stalemate quite quickly. Usually you already knew.

If that would help: ${SITE}

What have you been deciding for too long?

— Suchismita`),

    t("you-are-so-strong", "When people say you are strong",
      "Resonates with carers and eldest siblings.",
      "When everyone tells you how strong you are",
      `Hello {{name|there}},

Being told you are strong is meant kindly and often functions as a request. It means: please keep holding this, because we are relying on it.

Nobody checks on the strong one. There is no obvious moment to say that you are managing it rather than fine with it.

That gap is worth having somewhere to put.

If you would like that: ${SITE}

When did someone last ask how you were and wait for the real answer?

— Suchismita`),

    t("everyone-leans-on-you", "Being the one people lean on",
      "Close to the previous one — send one or the other, not both.",
      "You listen to everyone. Who listens to you?",
      `Hello {{name|there}},

If you are the person friends call when something goes wrong, you will know the particular loneliness of it. You know a great deal about their lives. They know the headline version of yours.

It is not that they do not care. It is that the shape of the friendship got set early and nobody renegotiated it.

Imotara is not a substitute for being properly known. It is somewhere to put the things you have got used to not saying.

If that helps: ${SITE}

Who would you call, if you were the one who needed to?

— Suchismita`),

    t("lonely-in-a-full-house", "Loneliness with people around",
      "For readers in joint families or shared homes.",
      "Lonely in a house full of people",
      `Hello {{name|there}},

Loneliness is usually pictured as being by yourself. The harder version is being surrounded — family, flatmates, a busy house — and still having nowhere to say the actual thing.

Privacy is not only physical. Sometimes there is no room in the day where you are not someone's daughter or someone's colleague.

Imotara is private in that sense. Nobody in the house knows what you said.

If you want that: ${SITE}

Where do you go when you need ten minutes to yourself?

— Suchismita`),

    t("starting-something-new", "Starting something new",
      "Good for a new job, course or city.",
      "The first weeks of anything new",
      `Hello {{name|there}},

The first weeks of something new are exhausting in a way that is hard to explain, because on paper nothing hard has happened yet. You are just running every small decision through a system that does not have shortcuts yet.

It passes. Knowing it passes does not make it less tiring while it is happening.

If you want somewhere to offload at the end of those days: ${SITE}

What is new for you at the moment?

— Suchismita`),

    t("imposter", "The feeling you don't belong there",
      "Workplace-flavoured but not corporate.",
      "The suspicion that you got in by accident",
      `Hello {{name|there}},

A lot of capable people carry a quiet theory that they are there by luck and someone will eventually notice.

The usual advice is to recite your achievements at it, which rarely works, because the feeling is not actually an argument about evidence.

What does help is saying it out loud and finding it is less convincing in the open than it is in your head at 2am.

If you want to test that: ${SITE}

What is the thing you are sure you are about to be found out about?

— Suchismita`),

    t("money-worry", "Money worry",
      "Careful tone. Never implies Imotara solves it.",
      "The worry that wakes you at four",
      `Hello {{name|there}},

Money worry has a particular quality: it is specific, it is real, and nothing you feel about it changes the number.

So people stop talking about it, because what is the point. And then they carry both the problem and the silence.

Imotara cannot help with the number. It can be somewhere to stop pretending the number is not there, which is not nothing on a bad night.

If that is useful: ${SITE}

What is the worry that tends to wake you?

— Suchismita`),

    t("health-anxiety", "Worry about your health",
      "⚠️ Must never give medical advice. It does not.",
      "Waiting for a result",
      `Hello {{name|there}},

The waiting is its own thing, separate from whatever the result turns out to be. You are asked to carry on normally while a part of your attention is permanently elsewhere.

People close to you want to reassure you, which means you end up managing their worry on top of your own.

Imotara will not tell you it will be fine, because it does not know and neither does anyone else. It will let you say the frightening version out loud.

⚠️ For anything medical, please talk to a doctor — Imotara is not one and never pretends to be.

If you want somewhere for the rest: ${SITE}

What are you waiting on?

— Suchismita`),

    t("caring-for-a-parent", "Caring for a parent",
      "Strong with a 35–60 audience.",
      "When your parent starts needing you",
      `Hello {{name|there}},

The reversal is quiet and nobody prepares you for it. One day you are being looked after and some time later you are the one making the appointments.

Alongside the practical load there is something harder to admit: grief for someone who is still here, and sometimes impatience you feel awful about.

Both are extremely common. Neither gets said at family gatherings.

If you want somewhere to say them: ${SITE}

How is it going, honestly?

— Suchismita`),

    t("new-parent", "New parent exhaustion",
      "Avoid implying anything clinical about postnatal health.",
      "Tired in a way sleep doesn't fix",
      `Hello {{name|there}},

Everyone warns you about the tiredness. Fewer people mention that you are also supposed to be delighted, continuously, and that any gap between the two feels like a failing.

There is usually no gap in the day to notice how you are, and no obvious person to tell.

⚠️ If you are struggling in a way that frightens you, please speak to a doctor or midwife — that is not weakness and they will have heard it before.

For the ordinary heavy days: ${SITE}

How are you doing, separately from how the baby is doing?

— Suchismita`),

    t("exam-results", "After results",
      "Time to a results season.",
      "The day after the results",
      `Hello {{name|there}},

Results days are loud. The day after is quieter, and that is usually when it lands — whichever way it went.

If it went badly, the hardest part is often other people's disappointment rather than your own. If it went well, you may be surprised how little it changed.

Either way there is more to think about than the number.

If you want somewhere to do that: ${SITE}

How did it actually land for you?

— Suchismita`),

    t("job-loss", "Losing a job",
      "Dignified. Never cheerful about it.",
      "The week after the job ended",
      `Hello {{name|there}},

Losing work takes more than income. It takes the shape of the day, the people you saw without arranging to, and a sentence you used to be able to answer easily when strangers asked what you do.

You are expected to be resilient about it quickly, usually before you have finished being angry.

If you want somewhere that is not a networking conversation: ${SITE}

What has been the hardest part — the money, or the rest of it?

— Suchismita`),

    t("moving-city", "Moving somewhere new",
      "Good for students and relocating workers.",
      "Lonely in a city full of people",
      `Hello {{name|there}},

Moving somewhere new is sold as an adventure, and for the first fortnight it is. Then the admin finishes and you notice nobody here knows anything about you.

Making friends as an adult is slow and slightly humiliating and everyone pretends it is not.

Imotara is in your language, which matters more when nothing around you is.

If that helps: ${SITE}

How long have you been where you are now?

— Suchismita`),

    t("faded-friendship", "A friendship that faded",
      "Quiet, specific.",
      "The friend you stopped speaking to for no reason",
      `Hello {{name|there}},

Not a falling out. Just a gradual drift, and now too much time has passed to send a message without it being A Message.

People rarely mourn these properly because nothing identifiable happened. But something was lost, and it is allowed to be sad.

If you want to think about whether to send it: ${SITE}

Who came to mind just now?

— Suchismita`),

    t("forgiving", "Forgiving someone",
      "Philosophical. Not religious.",
      "Deciding whether to forgive someone",
      `Hello {{name|there}},

Forgiveness gets recommended as though it were a single decision. In practice it is closer to a thing you keep choosing, often while still fairly angry.

It is also not the same as deciding they were not in the wrong, or letting them back in. Separating those three tends to make the question answerable.

If you want to untangle it: ${SITE}

Is there someone you are deciding about?

— Suchismita`),

    t("apologising", "Owing someone an apology",
      "Pairs with the forgiving one — send either, not both.",
      "The apology you haven't made yet",
      `Hello {{name|there}},

An apology you have not made gets heavier the longer it waits, and at some point the delay becomes its own thing to apologise for.

Most unmade apologies are stuck on a detail: you were partly in the wrong and partly not, and you cannot work out how to say the first part without conceding the second.

That is a solvable problem, and usually easier out loud.

If you want to work out the wording: ${SITE}

Who are you putting off?

— Suchismita`),

    t("unsent-message", "The message you didn't send",
      "Light. Good between heavier ones.",
      "The messages you typed and deleted",
      `Hello {{name|there}},

Most people have a small archive of messages typed and then deleted. Sometimes deleting was right. Sometimes it was just easier.

It is worth knowing which, because the ones you deleted out of habit tend to be the ones that mattered.

Imotara is somewhere to write the version you would not send, and see what is actually in it.

If you want to: ${SITE}

What did you nearly send this week?

— Suchismita`),

    t("journaling-without-journaling", "Journaling, without the journal",
      "For people who have failed at journaling.",
      "If you've tried journaling and given up",
      `Hello {{name|there}},

Most journals fail the same way: you buy one, write earnestly for nine days, miss a day, and the gap becomes a reason to stop.

The useful part of journaling was never the discipline. It was putting the thought outside your head where you could look at it.

Imotara does that bit without the streak, the blank page or the guilt of a gap.

If that sounds better: ${SITE}

How long did your longest journaling run last?

— Suchismita`),

    t("voice-input", "Speaking instead of typing",
      "Feature-led: voice input.",
      "Say it out loud instead of typing it",
      `Hello {{name|there}},

Some things are easier spoken than written. Typing makes you compose; speaking lets you ramble, and the rambling version is often more honest.

You can hold the microphone and simply talk — in your own language, including switching mid-sentence the way people actually speak.

If you have only ever typed to it, it is worth trying once: ${SITE}

Are you someone who thinks better out loud, or on paper?

— Suchismita`),

    t("read-aloud", "Hearing it read back",
      "Feature-led: read-aloud.",
      "Hearing a reply instead of reading it",
      `Hello {{name|there}},

Imotara can read its replies aloud. It sounds like a small convenience and lands differently from that — being spoken to is not the same as reading, particularly late at night when your eyes are tired.

It is also useful if reading on a screen is hard for you, for any reason.

Turn it on in Settings, or just try it: ${SITE}

Would you rather read or be read to, at the end of a long day?

— Suchismita`),

    t("history-as-record", "Your history as a record",
      "Feature-led: history.",
      "What you were worried about in March",
      `Hello {{name|there}},

One quietly useful thing about keeping a record: you can go back and see what was occupying you six months ago.

Often it is something you cannot now remember being that worried about. That is not a lesson about how your worries are silly — it is evidence that this one will also move.

Your history is there whenever you want it: ${SITE}

Do you remember what was weighing on you this time last year?

— Suchismita`),

    t("trends", "What a month actually looks like",
      "Feature-led: trends.",
      "A month of your moods, in one picture",
      `Hello {{name|there}},

You experience your weeks one at a time, which makes patterns nearly invisible from the inside.

Trends shows the shape instead of the score: where the dips cluster, whether they follow sleep, work or one particular recurring thing. No targets, nothing to keep up.

Most people find it is not what they expected.

Have a look: ${SITE}

What do you think your pattern would show?

— Suchismita`),

    t("small-steps", "Small steps, not transformation",
      "Feature-led: Grow.",
      "Small enough that you'll actually do it",
      `Hello {{name|there}},

Most self-improvement fails at the size of the step. "Fix your sleep" is not a step, it is an ambition with no first move.

Grow suggests things small enough to be slightly disappointing, which is exactly why they get done.

If you want one: ${SITE}

What is one thing that would make this week marginally easier?

— Suchismita`),

    t("works-offline", "It works without a signal",
      "Feature-led: offline.",
      "It still works when your signal doesn't",
      `Hello {{name|there}},

Trains, basements, patchy areas, a tight data month. Imotara keeps working: the conversation continues on your device rather than stopping with an error.

Some cloud features need a connection, but the basic thing — somewhere to put a thought — does not wait for a signal.

Worth knowing before you need it: ${SITE}

Where do you usually end up using it?

— Suchismita`),

    t("switching-devices", "Phone and laptop",
      "Feature-led: sync.",
      "Start on your phone, finish on your laptop",
      `Hello {{name|there}},

If you are signed in, your history follows you. Start something on the bus and pick it up at your desk without re-explaining.

That is genuinely the main thing an account adds. Everything else works without one.

If you want to set it up: ${SITE}

Do you use it more on your phone or on a computer?

— Suchismita`),

    t("deleting-history", "Deleting what you wrote",
      "Trust-building. Important one.",
      "You can delete it, and delete means delete",
      `Hello {{name|there}},

Worth saying plainly, because people wonder and do not ask.

You can delete your history. It is not archived somewhere for us, it is not retained for analysis, and deleted means gone. Data deletion is available on every plan, including the free one — it is not a feature you have to pay to get.

You can also export everything first if you would rather keep a copy.

The detail: ${SITE}/privacy

Is there anything else about this you would want to know?

— Suchismita`),

    t("festival-loneliness", "Festival season, alone",
      "Time to a festival period. Do not name one festival.",
      "Festivals, when you're not with your people",
      `Hello {{name|there}},

Festival season is hard in a way that is difficult to complain about, because everyone around you is celebrating and the expectation is that you are too.

Being far from home, or estranged, or simply not in the mood, turns a season of warmth into a long stretch of noticing.

If you want somewhere that is not a party: ${SITE}

How are you spending it this year?

— Suchismita`),

    t("weather-and-mood", "Weather and mood",
      "Gentle. Good filler between heavier sends.",
      "Some months are just heavier",
      `Hello {{name|there}},

Long grey stretches, a monsoon that does not let up, weeks of heat that make sleep thin — weather moves mood more than people credit, and then they look for a personal explanation for feeling low.

Sometimes there is one. Sometimes it is the fourth week of rain.

Noticing which is useful in itself.

If you want to track it: ${SITE}

Does the weather move your mood much?

— Suchismita`),

    t("new-year-no-resolutions", "A new year, without resolutions",
      "Time to early January.",
      "A new year without a list of resolutions",
      `Hello {{name|there}},

January arrives with an expectation of reinvention, which mostly produces a list that is abandoned by February and a small layer of guilt that was not there before.

A quieter alternative: look at what last year was actually like before deciding what this one should be. Most people skip straight to the plan.

If you want to look first: ${SITE}

What was last year actually like for you?

— Suchismita`),

    t("birthday", "Birthdays",
      "Do not personalise unless you have the date.",
      "Birthdays, and the stocktake that comes with them",
      `Hello {{name|there}},

Birthdays come with an involuntary stocktake. You compare where you are against where you assumed you would be, and the assumption was usually made by someone much younger with poor information.

The comparison is rarely fair, and it happens anyway.

If you want to think about it somewhere: ${SITE}

Do birthdays land well for you, or not especially?

— Suchismita`),

    t("when-its-fine", "When things are actually fine",
      "⚠️ Important: not every message should assume distress.",
      "This one isn't about a difficult time",
      `Hello {{name|there}},

Most messages like this assume you are struggling. Sometimes you are not, and being written to as though you are is its own small irritation.

So: if things are steady at the moment, good. That is worth noticing rather than only noticing the hard stretches — and noticing it while it is true is how you recognise it later.

Imotara is not only for bad days. Some people use it most when things are going well, because that is when there is room to think.

Whenever it suits: ${SITE}

What has been going quietly well for you lately?

— Suchismita`),
];
