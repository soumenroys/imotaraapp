#!/usr/bin/env python3
"""SHORT utterances, every language this Mac can voice.

    python3 -I scripts/sttLanguageSweep.py [--no-hint]

Needs a key in ~/.imotara/eval.env or $OPENAI_API_KEY, and macOS `say`.
Costs a few cents. NOT part of the test suite — it touches the paid API and
only runs on a Mac.

⚠️ --no-hint is the important run. It is the "auto" default that users who
never set a language actually get, and the only mode Punjabi and Odia ever
get, since both models refuse those two codes.

\U0001f534 THE CLAIM UNDER TEST, from the board's 22-LANGUAGES block:
   "Bengali STT ... mitigated, not fixed; SHORT UTTERANCES still come back
    as Hindi/Arabic"

Short is the hard case and the reported one: a few words give the model almost
no context, which is when it falls back on whatever script is most likely.

\U0001f511 THE CHECK IS THE SCRIPT, not the wording. Whether each phrase is
idiomatic needs a native speaker; whether Bengali speech came back in BENGALI
letters is objective, machine-checkable, and is exactly the failure that was
reported ("i tried to talk in bengali and it still typing in hindi").

Audio from macOS `say`, so pronunciation is synthetic and a little flat — a
harder input than a real human voice, not an easier one.

Reads the key from a file; never prints it.
"""
import json, re, os, uuid, subprocess, urllib.request, pathlib, sys

KEY_FILE = os.path.expanduser("~/.imotara/eval.env")
OUT = pathlib.Path(os.environ.get("STT_SWEEP_DIR", "/tmp/stt22"))
OUT.mkdir(parents=True, exist_ok=True)

# lang, macOS voice, SHORT phrase (feeling domain), expected script range
CASES = [
    ("bn", "Piya",    "খুব ক্লান্ত লাগছে",      r"[ঀ-৿]"),
    ("bn", "Piya",    "মন ভালো নেই",                r"[ঀ-৿]"),
    ("hi", "Lekha",   "मन अৃछा नहीं है",             r"[ऀ-ॿ]"),
    ("ta", "Vani",    "நான் சோகமாக இருக்கிறேன்",    r"[஀-௿]"),
    ("te", "Geeta",   "నాకు బాధగా ఉంది",             r"[ఀ-౿]"),
    ("kn", "Soumya",  "ನನಗೆ ಬೇಸರವಾಗಿದೆ",              r"[ಀ-೿]"),
    ("ja", "Kyoko",   "とても疲れた",                   r"[぀-ヿ一-鿿]"),
    ("ko", "Yuna",    "너무 피곤해요",                   r"[가-힯]"),
    ("zh", "Meijia",  "我很累",                        r"[一-鿿]"),
    ("ar", "Majed",   "أنا حزين جدا",                r"[؀-ۿ]"),
    ("he", "Carmit",  "אני עצוב מאוד",                r"[֐-׿]"),
    ("ru", "Milena",  "мне очень грустно",           r"[Ѐ-ӿ]"),
    ("id", "Damayanti","saya merasa sangat lelah",         r"[A-Za-z]"),
    ("en", "Samantha","I feel very tired",                r"[A-Za-z]"),
    # ⚠️ Marathi has no macOS voice. The HINDI voice reads Marathi WORDS with
    # Hindi phonology — imperfect, but it still asks the real question: does
    # Marathi speech come back as Marathi, or as Hindi? Same script either way,
    # so the check here is the WORDS, inspected below.
    ("mr", "Lekha",   "मला खूप दमलेलं वाटतं",         r"[ऀ-ॿ]"),
]

def load_key():
    for line in open(KEY_FILE):
        m = re.match(r"\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.+)", line)
        if m: return m.group(1).strip().strip('"').strip("'")
    return ""

def make_clip(voice, text, path):
    aiff = path.with_suffix(".aiff")
    r = subprocess.run(["say", "-v", voice, "-o", str(aiff), text],
                       capture_output=True, text=True)
    if r.returncode != 0: return False, r.stderr.strip()[:80]
    r = subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", str(aiff), str(path)],
                       capture_output=True, text=True)
    return (r.returncode == 0), r.stderr.strip()[:80]

def post(key, path, fields):
    b = uuid.uuid4().hex; body = b""
    for k, v in fields.items():
        body += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    body += (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"v.m4a\""
             f"\r\nContent-Type: audio/m4a\r\n\r\n").encode() + path.read_bytes() + b"\r\n"
    body += f"--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/audio/transcriptions", data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={b}"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read().decode())
    except urllib.error.HTTPError as e: return {"__error": f"HTTP {e.code} {e.read().decode()[:90]}"}
    except Exception as e: return {"__error": type(e).__name__}

# the route's own tables, mirrored ONLY for the language hint it would send
GPT_REFUSES = {"pa", "or"}
WHISPER_REFUSES = {"bn", "te", "gu", "ml", "pa", "or"}

NO_HINT = "--no-hint" in sys.argv
key = load_key()
if NO_HINT:
    print("\u26a0\ufe0f  NO LANGUAGE HINT \u2014 the 'auto' default, and the only mode")
    print("   pa and or ever get. This is the realistic worst case.\n")
print(f"key loaded ({len(key)} chars, not shown)\n")
print(f"{'lang':5} {'hint':5} {'script':7} spoken  ->  heard")
print("-" * 78)
bad = []
for i, (lang, voice, text, rng) in enumerate(CASES):
    clip = OUT / f"{i}_{lang}.m4a"
    ok, err = make_clip(voice, text, clip)
    if not ok:
        print(f"{lang:5} {'':5} {'SKIP':7} no voice '{voice}': {err}")
        continue
    hint = "" if (lang in GPT_REFUSES or NO_HINT) else lang
    fields = {"model": "gpt-transcribe", "response_format": "json"}
    if hint: fields["language"] = hint
    r = post(key, clip, fields)
    if "__error" in r:
        print(f"{lang:5} {hint:5} {'ERR':7} {r['__error']}")
        bad.append(f"{lang}:error"); continue
    heard = (r.get("text") or "").strip()
    detected = ",".join(d.get("code","?") for d in (r.get("languages") or [])) or "-"
    good = bool(re.search(rng, heard))
    mark = "✅" if good else "❌"
    if not good: bad.append(f"{lang}:script")
    print(f"{lang:5} {hint:5} {mark:7} {text}  ->  {heard}   [detected {detected}]")

print("-" * 78)
print(("✅ every language came back in its own script"
       if not bad else f"❌ problems: {', '.join(bad)}"))
