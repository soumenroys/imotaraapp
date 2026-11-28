# Languages & Voice

Everything about Imotara's 22 languages, switching languages mid-chat, read-aloud voices, voice input, and fixing common voice issues.

## The 22 supported languages

Imotara speaks 22 languages, across chat replies, read-aloud voices, and emotion understanding:

**Indian languages (12):** English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu.

**Global languages (10):** Spanish, French, German, Portuguese, Russian, Arabic, Chinese (Mandarin), Japanese, Hebrew, Indonesian.

Every one of these works for replies (both online and offline), read-aloud voices, and mood detection.

## How Imotara decides which language to use

Language is chosen in this priority order:

1. **An explicit request in chat** ("reply in Hindi") — wins for that conversation.
2. **Your Preferred language setting** — wins over automatic detection.
3. **Automatic detection** from the script you type in (or common romanized typing like "Hinglish").
4. **English** as the default.

### Switch language mid-conversation
1. Just ask in the chat — for example: "**reply in Hindi**", "**let's talk in Tamil**", "**switch to Spanish**", "**answer in Bengali**". Any natural phrasing works (speak / talk / reply / write / respond / use / switch / change / chat / answer + a language name).
2. All 22 languages can be requested this way.

### Set a permanent preferred language
1. Open your companion settings (**Settings → Tone & Context Preferences** on web, **Settings → Your companion** on mobile).
2. Set **Preferred language**. On web the options include **Auto-detect**, English, the Indian-language group, and the global languages group.
3. Your preferred language wins over script detection — so if you set English but type in Hindi script, you'll still get English replies. To change that in the moment, just ask explicitly in chat.

### What auto-detect does
If you leave language on **Auto-detect** and type in a native script (or common romanized typing), Imotara detects the language and replies in kind. A couple of friendly tips:

- If you type a **mostly-English** message, Imotara will reply in English — that's by design, so one stray English word doesn't derail your conversation.
- If Imotara ever guesses wrong (this can occasionally happen with romanized typing — for example romanized Gujarati or Marathi), the fastest fixes are: ask explicitly ("reply in Gujarati"), set your **Preferred language**, or type a few words in the native script.

## Read-aloud (listen to replies)

1. Hover over or tap a companion message to reveal its action row.
2. Tap the **speaker** icon. On web the tooltip says **Read aloud** (it becomes **Stop reading** while playing). On mobile the button reads **Listen** / **Preparing…** / **Stop**.
3. To stop playback, tap the same button again.
4. To have every new reply read automatically, turn on **Auto-read assistant replies** (**Settings → Chat behaviour** on web), or use **Hands-free conversation** which listens, replies, and reads aloud with no tapping.

### Voice gender and accent
- The read-aloud voice follows your **companion Gender** setting. Male and Female choose gendered voices; Non-binary, Other, and Prefer-not-to-say use a neutral voice. The regional accent follows your language.
- Preview it any time: **On web**, tap **🔊 Preview voice** in the companion Gender area. **On mobile**, tap **🔊 Preview companion voice** (it becomes **⏹ Stop preview** while playing).

### Speed & pitch
1. **On web:** **Settings → Appearance → Voice playback speed & pitch** (a **Plus** feature). Drag **Speed** (0.50–1.50×) and **Pitch** (0.50–1.50).
2. **On mobile:** **Settings** has **Voice speed** and **Voice pitch** controls, grouped as **Voice speed & pitch**.

## Talk or type — choosing how you send (web)

When you open a chat on the website, the message box starts in **Voice** mode wherever your browser supports speech: a big **Tap to talk** microphone, with **Type instead** and a speaker switch beneath it. The words are in your chosen language.

- **Tap to talk**, say what's on your mind, and it sends by itself. The reply is read aloud. While the mic is open, the label reads **Listening… tap to stop**.
- Nothing is recorded until you tap. Your browser asks for microphone permission only at that first tap.
- **Replies read aloud / Replies not read aloud** switches reading off or on for Voice mode.
- If a reply is still being read when you tap the mic, the reading stops and Imotara listens to you.
- **Type instead** brings back the text box. **Talk instead**, under the text box, switches back to Voice. Your choice is remembered on that browser.
- If there's already text in the box (for example, from a landing page), the text box shows so you can send it.
- Typing is the starting mode for **Punjabi** and **Odia** (speech recognition is less reliable for them) and in browsers without speech recognition (e.g. Firefox). You can still switch to Voice in Punjabi or Odia; a browser without speech recognition shows no voice option.
- The phone apps will get the same choice in a later update.

## Voice input (speak instead of type)

1. Tap the **microphone** button in the composer. On web the tooltip reads **Speak your message** (or **Speak — will send automatically** in hands-free mode); while active it shows **Stop listening**.
2. The first time, allow microphone access when your browser or phone asks. If you blocked it earlier on web, you'll see **"Microphone access denied — allow it in your browser settings."**
3. Speak clearly. Recording stops automatically at your **Max recording duration** setting — tap the mic again to stop early.
4. If **Confirm before sending** is on, you can review and edit the transcript before it sends. (Available on both web and mobile.)

### Voice input settings
Both platforms have these — on mobile they live together under **Settings → Experience → Voice input**.

- **Max recording duration** — how long the mic records before auto-stopping. On mobile: **30s, 1 min, 2 min or 5 min** (default 1 min).
- **Recording quality** — High / Low. Low uses less data, which helps on a slow or metered connection.
- **Confirm before sending** — review and edit the transcript before it's sent.
- **Hands-free conversation** (mobile) — you speak, Imotara replies and reads it aloud, and the microphone reopens by itself for your next turn. No tapping at all.
- **Cloud / Online transcription** — ⚠️ this one works differently on each platform. On **web**, switching "Cloud transcription" off falls back to your browser's own speech recognition: less accurate, but the audio stays on your computer. On **mobile** there is no on-device alternative — switching "Online transcription" off simply **turns the microphone off**. If you're turning it off on a phone for privacy, what you're really doing is disabling voice input.

**What happens to your recording:** it's turned into text and then discarded. Nothing is stored on our side but a count for your daily limit, and on mobile the temporary copy on your phone is cleaned up within the hour.

### Hands-free and background noise

In hands-free mode — and only there — Imotara checks that it actually heard speech before sending anything, so a noisy room doesn't become words you never said.

- Silence for about **10 seconds** → the turn is dropped and nothing is uploaded.
- Steady noise with no speech for about **20 seconds** (a fan, traffic, a TV next door) → recording stops.
- Speech carries on to your full recording limit as normal.
- On Android the microphone is opened through the same audio path your phone's own dictation uses, so its noise suppression applies.

The check is deliberately forgiving — when it isn't sure, it lets the audio through, because losing a real sentence is worse than transcribing a noisy one. When you tap the microphone and record yourself, nothing is filtered: what you record is always sent.

### Common voice-input messages (web)
- **"No microphone found. Please connect one and try again."** — check your mic is plugged in and selected.
- **"No speech detected — try speaking closer to your microphone."**
- **"Voice input isn't available in your current language. Try switching to English in Settings."**

## Daily voice limits when signed out

When you're using Imotara without an account, cloud voice features have small daily caps:

- **Read-aloud:** about **15 per day**.
- **Voice transcription:** about **20 per day**.

Signing in removes both caps — voice is unlimited for signed-in accounts. Text chat is never blocked either way.

## Fixing silent read-aloud on Android

If read-aloud is silent on Android, you may see the message: **"Voice not available for this language on your device. Either install this language in your mobile or login into Imotara account from Settings."** Two easy fixes:

1. **Option A — install the voice on your phone:** go to your phone's system settings → **System → Languages → Text-to-speech output → install voice data**, and install the voice for your language. (On some phones, switching the text-to-speech engine to Google's also helps.)
2. **Option B — sign in to Imotara:** signing in lets read-aloud use Imotara's cloud voices instead of your device's built-in voice, so it works for every language.

## Odia voice-input note

Odia is fully supported for typing, chat replies, and read-aloud. However, **spoken Odia is not supported by the voice transcription engine**, so Odia speech may be mis-detected as another language. Typing is more reliable in Odia for now — we're sorry for the limitation.

## Quick voice checklist

If voice isn't working, check:
1. **You're online** — voice features need an internet connection.
2. **You haven't hit the signed-out daily cap** — sign in for unlimited voice.
3. **On Android**, the language's voice is installed on your device, or you're signed in.
4. **The companion gender/language** settings match what you expect to hear.

Still stuck? Write to **info@imotara.com** and we'll help.
