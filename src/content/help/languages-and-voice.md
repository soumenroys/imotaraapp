# Languages & Voice

Everything about Imotara's 22 languages, switching languages mid-chat, read-aloud voices, voice input, and fixing common voice issues.

## The 22 supported languages

Imotara speaks 22 languages, across chat replies, read-aloud voices, and emotion understanding:

**Indian languages (12):** English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu.

**Global languages (10):** Spanish, French, German, Portuguese, Russian, Arabic, Chinese (Mandarin), Japanese, Hebrew, Indonesian.

Every one of these works for AI replies (both online and offline), read-aloud voices, and mood detection.

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

## Voice input (speak instead of type)

1. Tap the **microphone** button in the composer. On web the tooltip reads **Speak your message** (or **Speak — will send automatically** in hands-free mode); while active it shows **Stop listening**.
2. The first time, allow microphone access when your browser or phone asks. If you blocked it earlier on web, you'll see **"Microphone access denied — allow it in your browser settings."**
3. Speak clearly. Recording stops automatically at your **Max recording duration** setting — tap the mic again to stop early.
4. If **Confirm before sending** is on (web), you can review and edit the transcript before it sends.

### Voice input settings
- **Max recording duration** — how long the mic records before auto-stopping (**Settings → Appearance** on web; **Settings → Voice input** on mobile).
- **Recording quality** — High / Low (web).
- **Confirm before sending** — review the transcript before it's sent (web).

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
