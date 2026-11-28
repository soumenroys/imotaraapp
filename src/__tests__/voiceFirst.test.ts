// #185 Voice first (owner, 28 Nov 2026): the message box opens in voice mode where speech can work;
// typing is one tap away and the choice is remembered. Nothing records before a tap.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { VOICE_FIRST, getVoiceFirstStrings, initialInputMode, voiceReadAloudOn, TYPE_FIRST_LANGS } from "@/lib/imotara/voiceFirstStrings";
import { INVITE } from "@/lib/imotara/checkInInviteStrings";
import { FUNNEL_STEPS } from "@/lib/analytics/visitTally";

const PAGE = fs.readFileSync(path.join(process.cwd(), "src/app/chat/page.tsx"), "utf8");

describe("#185 voice first — words", () => {
  it("all 22 languages, the same set as the check-in invite", () => {
    expect(Object.keys(VOICE_FIRST).sort()).toEqual(Object.keys(INVITE).sort());
    expect(Object.keys(VOICE_FIRST)).toHaveLength(22);
  });
  it("every string is filled in, and non-English ones are not left in English", () => {
    for (const [lang, s] of Object.entries(VOICE_FIRST)) {
      for (const v of Object.values(s)) expect(String(v).trim().length, lang).toBeGreaterThan(1);
      if (lang !== "en") expect(s.tap, lang).not.toBe(VOICE_FIRST.en.tap);
    }
  });
  it("unknown or regional codes fall back sensibly", () => {
    expect(getVoiceFirstStrings("bn-IN").tap).toBe(VOICE_FIRST.bn.tap);
    expect(getVoiceFirstStrings("xx").tap).toBe(VOICE_FIRST.en.tap);
    expect(getVoiceFirstStrings(null).tap).toBe(VOICE_FIRST.en.tap);
  });
});

describe("#185 voice first — which mode the box opens in", () => {
  it("a saved choice always wins", () => {
    expect(initialInputMode({ saved: "type", speechSupported: true, lang: "en" })).toBe("type");
    expect(initialInputMode({ saved: "voice", speechSupported: true, lang: "pa" })).toBe("voice");
  });
  it("first time: voice where speech works", () => {
    for (const lang of ["en", "bn", "hi", "ta", "ar", "ja", null]) expect(initialInputMode({ saved: null, speechSupported: true, lang })).toBe("voice");
  });
  it("first time: typing where voice is weak (Punjabi, Odia) or the browser has no speech recognition", () => {
    expect([...TYPE_FIRST_LANGS].sort()).toEqual(["or", "pa"]);
    expect(initialInputMode({ saved: null, speechSupported: true, lang: "pa" })).toBe("type");
    expect(initialInputMode({ saved: null, speechSupported: true, lang: "or-IN" })).toBe("type");
    expect(initialInputMode({ saved: null, speechSupported: false, lang: "en" })).toBe("type");
  });
  it("read aloud is on in voice mode unless switched off", () => {
    expect(voiceReadAloudOn(null)).toBe(true);
    expect(voiceReadAloudOn("1")).toBe(true);
    expect(voiceReadAloudOn("0")).toBe(false);
  });
});

describe("#185 voice first — the chat page", () => {
  it("⛔ nothing records on its own: the mic starts only from a tap (toggleVoice), never from the mode loading", () => {
    const load = PAGE.slice(PAGE.indexOf("const [inputMode, setInputModeState]"), PAGE.indexOf("function chooseInputMode"));
    expect(load).not.toMatch(/toggleVoice|\.start\(|getUserMedia/);
  });
  it("the voice panel shows only while the box is empty (carried-in text shows the text box)", () => {
    expect(PAGE).toContain('const voicePanelShown = mounted && speechSupported && inputMode === "voice" && !draft.trim();');
  });
  it("in voice mode, speaking sends — after hands-free and the confirm-transcript setting, which keep priority", () => {
    const r = PAGE.slice(PAGE.indexOf("rec.onresult = (e: any) => {"), PAGE.indexOf("rec.onerror = (e: any) => {"));
    const hf = r.indexOf("if (handsfreeRef.current)"), conf = r.indexOf("} else if (voiceConfirmEnabled)"), vm = r.indexOf('} else if (inputModeRef.current === "voice")');
    expect(hf).toBeGreaterThan(-1); expect(conf).toBeGreaterThan(hf); expect(vm).toBeGreaterThan(conf);
    expect(r.slice(vm, vm + 400)).toContain("if (!analyzingRef.current) sendMessageRef.current(transcript.trim());");
    // our own voice is still never taken as theirs
    expect(r.indexOf("if (speakingRef.current) return;")).toBeLessThan(hf);
  });
  it("replies are read aloud in voice mode only when the speaker is on — both reply paths", () => {
    const n = PAGE.split('(inputModeRef.current === "voice" && voiceReadAloudRef.current)').length - 1;
    expect(n).toBe(2);
  });
  it("a tap while a reply is being read stops the reading first, so their words are not dropped", () => {
    expect(PAGE).toContain("if (speakingRef.current && stopAutoSpeech()) speakingRef.current = false;");
    const t = PAGE.slice(PAGE.indexOf("function toggleVoice()"), PAGE.indexOf("rec.onresult = (e: any) => {"));
    expect(t.indexOf("stopAutoSpeech()")).toBeLessThan(t.indexOf("const rec = new SpeechRecognition();"));
    expect(PAGE).toMatch(/currentAutoSpeech = abort;[\s\S]*if \(currentAutoSpeech === abort\) currentAutoSpeech = null;/);
  });
  it("switching mode is counted anonymously (steps added at the end)", () => {
    expect(FUNNEL_STEPS).toMatchObject({ invite_already_on: 28, input_mode_voice: 29, input_mode_type: 30 });
  });
});
