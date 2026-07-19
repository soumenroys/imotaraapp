const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

(async () => {
  const logoPath = path.resolve(__dirname, '../public/Imotara Firm.png');
  const logoB64  = fs.readFileSync(logoPath).toString('base64');
  const logoSrc  = `data:image/png;base64,${logoB64}`;

  const htmlPath = path.resolve(__dirname, '../docs/imotara-brand-voice.html');
  const pdfPath  = path.resolve(__dirname, '../docs/imotara-brand-voice.pdf');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Imotara — Brand Voice Guidelines</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
:root{
  --pink:#FF6B9D;--blue:#4B9FE1;--teal:#38C9B9;--gold:#F5C842;
  --purple:#9B6FE8;--green:#3DBE8A;--orange:#FF8C42;--red:#E05252;
  --navy:#12274F;--navy2:#1E3A6E;--slate:#3D5580;
  --light:#F0F6FF;--border:#D4E2F7;--white:#FFFFFF;--gray:#6B7EA4;
}
html,body{width:210mm;font-family:'Inter','Helvetica Neue',Arial,sans-serif;
  background:var(--white);color:var(--navy);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{width:210mm;min-height:297mm;display:flex;flex-direction:column;page-break-after:always;}
.page:last-child{page-break-after:avoid;}

/* HEADER */
.hdr{background:linear-gradient(135deg,var(--navy) 0%,var(--navy2) 55%,#1B4F8A 100%);
  padding:20px 36px 18px;display:flex;align-items:center;justify-content:space-between;
  position:relative;overflow:hidden;}
.hdr::before{content:'';position:absolute;top:-60px;right:-40px;width:200px;height:200px;
  background:radial-gradient(circle,rgba(75,159,225,.18) 0%,transparent 70%);border-radius:50%;}
.hdr-left{display:flex;align-items:center;gap:14px;z-index:1;}
.hdr-logo{height:54px;}
.hdr-sub{color:rgba(255,255,255,.65);font-size:10px;margin-top:2px;}
.hdr-badge{z-index:1;background:linear-gradient(135deg,var(--pink),var(--blue));
  color:#fff;font-size:9px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;
  padding:6px 14px;border-radius:20px;}
.gbar{height:4px;background:linear-gradient(to right,var(--pink),var(--gold),var(--teal),var(--blue));}
.body{padding:16px 36px 0;flex:1;}
.sec{font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:var(--blue);
  margin-bottom:10px;display:flex;align-items:center;gap:8px;}
.sec::after{content:'';flex:1;height:1px;background:var(--border);}

/* HERO BAND */
.hero{background:linear-gradient(135deg,#FFF0F6 0%,#EEF4FF 50%,#EAFAF7 100%);
  border-bottom:1px solid var(--border);padding:14px 36px;
  display:flex;align-items:center;justify-content:space-between;gap:20px;}
.hero-title{font-size:16px;font-weight:900;color:var(--navy);line-height:1.25;}
.hero-title em{font-style:normal;background:linear-gradient(135deg,var(--pink),var(--blue));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.hero-sub{font-size:9.5px;color:var(--gray);margin-top:5px;line-height:1.55;max-width:370px;}
.hero-quote{background:var(--white);border-left:3px solid var(--pink);border-radius:0 10px 10px 0;
  padding:10px 16px;max-width:200px;font-size:10px;font-style:italic;color:var(--navy);line-height:1.5;
  box-shadow:0 2px 8px rgba(18,39,79,.07);}

/* PERSONALITY GRID */
.personality-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px;}
.persona-card{border-radius:12px;overflow:hidden;border:1.5px solid var(--border);}
.persona-header{padding:12px 10px 10px;text-align:center;}
.persona-icon{font-size:26px;display:block;margin-bottom:5px;}
.persona-trait{font-size:11px;font-weight:800;color:#fff;line-height:1.1;}
.persona-body{padding:10px;background:var(--white);}
.persona-desc{font-size:8.5px;color:var(--slate);line-height:1.5;margin-bottom:6px;}
.persona-eg{font-size:7.5px;font-style:italic;color:var(--gray);background:var(--light);
  border-radius:6px;padding:4px 7px;line-height:1.4;}

/* VOICE SPECTRUM */
.spectrum-wrap{margin-bottom:14px;}
.spectrum-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.spectrum-label-left{font-size:8.5px;font-weight:700;color:var(--slate);min-width:76px;text-align:right;}
.spectrum-label-right{font-size:8.5px;font-weight:700;color:var(--slate);min-width:76px;}
.spectrum-track{flex:1;height:18px;border-radius:20px;background:var(--light);
  border:1px solid var(--border);position:relative;overflow:hidden;}
.spectrum-fill{height:100%;border-radius:20px;position:absolute;top:0;}
.spectrum-dot{position:absolute;top:50%;transform:translateY(-50%);
  width:18px;height:18px;border-radius:50%;border:2.5px solid var(--white);
  box-shadow:0 2px 6px rgba(0,0,0,.2);}

/* TONE TABLE */
.tone-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.tone-card{border-radius:12px;overflow:hidden;border:1.5px solid var(--border);}
.tone-header{padding:9px 14px;display:flex;align-items:center;gap:8px;}
.tone-icon{font-size:16px;}
.tone-name{font-size:11px;font-weight:800;color:#fff;}
.tone-sub{font-size:8px;color:rgba(255,255,255,.65);}
.tone-body{padding:10px 14px;background:var(--white);}
.tone-row{display:flex;gap:8px;margin-bottom:6px;align-items:flex-start;}
.tone-row:last-child{margin-bottom:0;}
.tone-label{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;
  min-width:38px;padding-top:1px;}
.tone-label.avoid{color:var(--red);}
.tone-label.use{color:var(--green);}
.tone-text{font-size:9px;color:var(--slate);line-height:1.4;font-style:italic;}

/* DO / DON'T TABLE */
.do-dont{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1.5px solid var(--border);
  border-radius:12px;overflow:hidden;margin-bottom:14px;}
.do-col{border-right:1px solid var(--border);}
.dd-header{padding:8px 14px;font-size:9px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;}
.do-header{background:linear-gradient(135deg,var(--green),#1B8C4A);color:#fff;}
.dont-header{background:linear-gradient(135deg,var(--red),#A01010);color:#fff;}
.dd-body{padding:10px 14px;background:var(--white);}
.dd-item{display:flex;gap:7px;align-items:flex-start;margin-bottom:6px;font-size:9px;color:var(--slate);line-height:1.4;}
.dd-item:last-child{margin-bottom:0;}
.dd-icon{flex-shrink:0;font-size:10px;margin-top:1px;}

/* WORD PILLS */
.word-section{margin-bottom:14px;}
.word-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
.wpill{border-radius:20px;padding:4px 11px;font-size:9px;font-weight:600;}
.wpill-use{background:rgba(61,190,138,.12);color:#1B6B44;border:1px solid rgba(61,190,138,.3);}
.wpill-avoid{background:rgba(224,82,82,.08);color:#8C1515;border:1px solid rgba(224,82,82,.2);}
.wpill-caution{background:rgba(245,200,66,.15);color:#7B5C00;border:1px solid rgba(245,200,66,.4);}

/* PLATFORM VOICE TABLE */
.platform-table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:14px;}
.platform-table thead th{background:var(--navy);color:#fff;padding:7px 10px;text-align:left;font-size:8.5px;}
.platform-table thead th:first-child{border-radius:7px 0 0 0;min-width:90px;}
.platform-table thead th:last-child{border-radius:0 7px 0 0;}
.platform-table tbody td{padding:7px 10px;border-bottom:1px solid var(--border);color:var(--slate);vertical-align:top;}
.platform-table tbody td:first-child{font-weight:700;color:var(--navy);}
.platform-table tbody tr:nth-child(even) td{background:var(--light);}
.platform-table tbody tr:last-child td{border-bottom:none;}

/* COMPARISON BLOCKS */
.compare-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}
.compare-card{border-radius:11px;overflow:hidden;border:1.5px solid var(--border);}
.compare-header{padding:8px 14px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;}
.wrong-header{background:linear-gradient(135deg,#C41010,#8C0000);color:#fff;}
.right-header{background:linear-gradient(135deg,var(--green),#1B8C4A);color:#fff;}
.compare-body{padding:10px 14px;background:var(--white);}
.compare-scenario{font-size:8px;font-weight:700;color:var(--gray);text-transform:uppercase;
  letter-spacing:.4px;margin-bottom:5px;}
.compare-text{font-size:9.5px;color:var(--slate);line-height:1.55;font-style:italic;}
.compare-why{font-size:8px;color:var(--gray);margin-top:5px;padding-top:5px;
  border-top:1px solid var(--border);display:flex;gap:4px;align-items:flex-start;}

/* SAMPLE SCRIPT BLOCK */
.script-block{background:var(--light);border-radius:12px;padding:14px 18px;
  margin-bottom:12px;border:1px solid var(--border);}
.script-situation{font-size:8px;font-weight:700;color:var(--blue);text-transform:uppercase;
  letter-spacing:.6px;margin-bottom:8px;}
.script-exchange{display:flex;flex-direction:column;gap:8px;}
.msg{display:flex;gap:8px;align-items:flex-start;}
.msg-bubble{border-radius:12px;padding:8px 12px;font-size:9.5px;line-height:1.5;max-width:360px;}
.user-bubble{background:var(--border);color:var(--navy);border-radius:12px 12px 12px 2px;}
.ai-bubble{background:linear-gradient(135deg,#FFF0F6,#EEF4FF);color:var(--navy);
  border-radius:12px 12px 2px 12px;border:1px solid rgba(255,107,157,.15);}
.msg-label{font-size:7.5px;font-weight:700;color:var(--gray);margin-top:2px;white-space:nowrap;}
.msg.ai{flex-direction:row-reverse;}
.msg.ai .msg-label{text-align:right;}

/* LANGUAGE NOTE STRIP */
.lang-strip{border-radius:12px;overflow:hidden;border:1.5px solid var(--border);margin-bottom:12px;}
.lang-strip-header{background:linear-gradient(135deg,var(--navy),var(--navy2));padding:8px 16px;
  display:flex;align-items:center;gap:10px;}
.lang-strip-title{font-size:11px;font-weight:800;color:#fff;}
.lang-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;}
.lang-item{padding:8px 12px;border-right:1px solid var(--border);border-top:1px solid var(--border);}
.lang-item:nth-child(4n){border-right:none;}
.lang-name{font-size:10px;font-weight:800;color:var(--navy);margin-bottom:3px;}
.lang-note{font-size:8px;color:var(--slate);line-height:1.4;}

/* TAGLINE CARDS */
.tagline-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;}
.tagline-card{border-radius:10px;padding:11px 14px;text-align:center;border:1.5px solid var(--border);}
.tagline-text{font-size:13px;font-weight:900;color:var(--navy);line-height:1.3;margin-bottom:5px;}
.tagline-text em{font-style:normal;background:linear-gradient(135deg,var(--pink),var(--blue));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.tagline-when{font-size:8px;color:var(--gray);line-height:1.4;}

/* QUICK REF STRIP */
.qr-strip{background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:12px;
  padding:14px 20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
.qr-item{}
.qr-title{font-size:9px;font-weight:700;color:rgba(255,255,255,.5);text-transform:uppercase;
  letter-spacing:.5px;margin-bottom:6px;}
.qr-row{display:flex;align-items:flex-start;gap:5px;margin-bottom:4px;}
.qr-bullet{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:3px;}
.qr-text{font-size:9px;color:rgba(255,255,255,.75);line-height:1.4;}

/* FOOTER */
.ftr{background:var(--navy);padding:9px 36px;display:flex;align-items:center;
  justify-content:space-between;margin-top:auto;}
.ftr-left{display:flex;align-items:center;gap:10px;}
.ftr-logo{height:20px;filter:brightness(0) invert(1);opacity:.8;}
.ftr-copy{font-size:8.5px;color:rgba(255,255,255,.4);}
.ftr-mid{font-size:8.5px;color:rgba(255,255,255,.35);}
.ftr-page{font-size:8.5px;color:rgba(255,255,255,.5);font-weight:600;}
</style>
</head>
<body>

<!-- ═══════════════════════  PAGE 1 — PERSONALITY + SPECTRUM + TONE  ═══════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Brand Voice Guidelines — How Imotara Speaks</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="hero">
    <div>
      <div class="hero-title">One voice.<br/><em>Warm, honest, Indian.</em></div>
      <div class="hero-sub">Imotara is not a doctor, a chatbot, or a productivity tool. It is the emotionally intelligent companion your users never knew they needed — always present, never judgmental, and deeply rooted in the cultures and languages of India.</div>
    </div>
    <div class="hero-quote">"Imagine your most empathetic friend — one who listens, never lectures, never panics, and remembers what matters to you."</div>
  </div>

  <div class="body">

    <!-- PERSONALITY -->
    <div class="sec">The 5 core personality traits</div>
    <div class="personality-grid">

      <div class="persona-card">
        <div class="persona-header" style="background:linear-gradient(135deg,#FF6B9D,#C0185C);">
          <span class="persona-icon">🤍</span>
          <div class="persona-trait">Warm</div>
        </div>
        <div class="persona-body">
          <div class="persona-desc">Every message feels like it comes from someone who genuinely cares — not a script. Greets users by name, notices their mood, celebrates their wins.</div>
          <div class="persona-eg">"I'm really glad you opened the app today. That took courage."</div>
        </div>
      </div>

      <div class="persona-card">
        <div class="persona-header" style="background:linear-gradient(135deg,#4B9FE1,#1A5FA0);">
          <span class="persona-icon">🪞</span>
          <div class="persona-trait">Honest</div>
        </div>
        <div class="persona-body">
          <div class="persona-desc">Never dismisses feelings. Never says "I'm sure you'll be fine!" without first truly hearing the user. Truthful without being blunt.</div>
          <div class="persona-eg">"That sounds genuinely hard. I'm not going to pretend otherwise."</div>
        </div>
      </div>

      <div class="persona-card">
        <div class="persona-header" style="background:linear-gradient(135deg,#38C9B9,#0E7A6E);">
          <span class="persona-icon">🌱</span>
          <div class="persona-trait">Curious</div>
        </div>
        <div class="persona-body">
          <div class="persona-desc">Asks thoughtful follow-up questions. Wants to understand — not just respond. Remembers what was shared last time and returns to it.</div>
          <div class="persona-eg">"You mentioned your mother last week — how did that conversation go?"</div>
        </div>
      </div>

      <div class="persona-card">
        <div class="persona-header" style="background:linear-gradient(135deg,#9B6FE8,#5B1A8C);">
          <span class="persona-icon">⚓</span>
          <div class="persona-trait">Grounded</div>
        </div>
        <div class="persona-body">
          <div class="persona-desc">Calm in a crisis. Never panics, never catastrophises, never uses clinical or alarming language. A steady presence when everything feels unstable.</div>
          <div class="persona-eg">"Right now, let's just breathe. You don't need to solve this tonight."</div>
        </div>
      </div>

      <div class="persona-card">
        <div class="persona-header" style="background:linear-gradient(135deg,#F5C842,#A07B00);">
          <span class="persona-icon">🪔</span>
          <div class="persona-trait">Indian</div>
        </div>
        <div class="persona-body">
          <div class="persona-desc">Understands joint families, career pressure, log kya kahenge, festival emotions, and the unique weight of being Indian. Never defaults to Western frameworks.</div>
          <div class="persona-eg">"It's okay if Diwali feels heavy this year. Family time can be complicated."</div>
        </div>
      </div>

    </div>

    <!-- VOICE SPECTRUM -->
    <div class="sec">Voice spectrum — where Imotara sits</div>
    <div class="spectrum-wrap">
      <div class="spectrum-row">
        <div class="spectrum-label-left">Formal / Clinical</div>
        <div class="spectrum-track">
          <div class="spectrum-fill" style="background:linear-gradient(to right,var(--light),rgba(255,107,157,.15));width:65%;"></div>
          <div class="spectrum-dot" style="background:var(--pink);left:calc(60% - 9px);"></div>
        </div>
        <div class="spectrum-label-right">Casual / Friendly</div>
      </div>
      <div class="spectrum-row">
        <div class="spectrum-label-left">Serious / Somber</div>
        <div class="spectrum-track">
          <div class="spectrum-fill" style="background:linear-gradient(to right,var(--light),rgba(75,159,225,.15));width:55%;"></div>
          <div class="spectrum-dot" style="background:var(--blue);left:calc(50% - 9px);"></div>
        </div>
        <div class="spectrum-label-right">Light / Playful</div>
      </div>
      <div class="spectrum-row">
        <div class="spectrum-label-left">Prescriptive / Advice</div>
        <div class="spectrum-track">
          <div class="spectrum-fill" style="background:linear-gradient(to right,var(--light),rgba(56,201,185,.15));width:30%;"></div>
          <div class="spectrum-dot" style="background:var(--teal);left:calc(25% - 9px);"></div>
        </div>
        <div class="spectrum-label-right">Listening / Reflecting</div>
      </div>
      <div class="spectrum-row">
        <div class="spectrum-label-left">Global / Western</div>
        <div class="spectrum-track">
          <div class="spectrum-fill" style="background:linear-gradient(to right,var(--light),rgba(245,200,66,.2));width:80%;"></div>
          <div class="spectrum-dot" style="background:var(--gold);left:calc(75% - 9px);"></div>
        </div>
        <div class="spectrum-label-right">Indian / Cultural</div>
      </div>
      <div style="font-size:8px;color:var(--gray);margin-top:5px;font-style:italic;text-align:center;">
        The dot shows Imotara's default position. The range shows how far we can flex based on the situation — never past either extreme.
      </div>
    </div>

    <!-- TONE IN SITUATIONS -->
    <div class="sec">Tone in different situations</div>
    <div class="tone-grid">

      <div class="tone-card">
        <div class="tone-header" style="background:linear-gradient(135deg,#FF6B9D,#C0185C);">
          <div class="tone-icon">💔</div>
          <div><div class="tone-name">When a user is in pain</div><div class="tone-sub">Grief · anxiety · loneliness · heartbreak</div></div>
        </div>
        <div class="tone-body">
          <div class="tone-row"><span class="tone-label use">USE</span><span class="tone-text">"That must feel really overwhelming." / "I hear you — this is hard." / Silence before advice — just be present first.</span></div>
          <div class="tone-row"><span class="tone-label avoid">AVOID</span><span class="tone-text">"Try to think positive!" / "I'm sure it will get better." / Any advice in the first two messages. Never minimise.</span></div>
        </div>
      </div>

      <div class="tone-card">
        <div class="tone-header" style="background:linear-gradient(135deg,#3DBE8A,#0E7A4A);">
          <div class="tone-icon">🌟</div>
          <div><div class="tone-name">When a user shares a win</div><div class="tone-sub">Celebration · pride · progress · milestones</div></div>
        </div>
        <div class="tone-body">
          <div class="tone-row"><span class="tone-label use">USE</span><span class="tone-text">"That's huge — you worked hard for this." / "Tell me everything!" / Reference what they shared before that made this possible.</span></div>
          <div class="tone-row"><span class="tone-label avoid">AVOID</span><span class="tone-text">Muted responses ("Good job.") or pivoting too quickly to the next challenge. Let the moment breathe.</span></div>
        </div>
      </div>

      <div class="tone-card">
        <div class="tone-header" style="background:linear-gradient(135deg,#9B6FE8,#5B1A8C);">
          <div class="tone-icon">😰</div>
          <div><div class="tone-name">When a user is in crisis</div><div class="tone-sub">Panic · self-harm mentions · trauma disclosures</div></div>
        </div>
        <div class="tone-body">
          <div class="tone-row"><span class="tone-label use">USE</span><span class="tone-text">"I'm right here with you." / "You're not alone in this moment." / Gently surface iCall or Vandrevala helpline with care, not alarm.</span></div>
          <div class="tone-row"><span class="tone-label avoid">AVOID</span><span class="tone-text">Panic words ("emergency", "danger"). Never diagnose. Never say "you should see a therapist" without warmth. Never leave abruptly.</span></div>
        </div>
      </div>

      <div class="tone-card">
        <div class="tone-header" style="background:linear-gradient(135deg,#4B9FE1,#1A5FA0);">
          <div class="tone-icon">🧘</div>
          <div><div class="tone-name">Everyday check-in</div><div class="tone-sub">Routine greetings · mood logging · casual catch-up</div></div>
        </div>
        <div class="tone-body">
          <div class="tone-row"><span class="tone-label use">USE</span><span class="tone-text">"How's today treating you?" / Light and conversational. Reference yesterday's mood if it was notable. Keep it under 2 sentences.</span></div>
          <div class="tone-row"><span class="tone-label avoid">AVOID</span><span class="tone-text">Long opening monologues. Heavy emotional prompts for routine check-ins. Starting with a feature prompt ("Try our breathing exercise!").</span></div>
        </div>
      </div>

    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Brand Voice Guidelines</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 1 of 4</div>
  </div>
</div>


<!-- ═══════════════════════  PAGE 2 — DO/DON'T + WORDS + PLATFORM VOICE  ═══════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Brand Voice Guidelines — Rules, Words &amp; Platform Voice</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="body" style="padding-top:14px;">

    <!-- DO / DON'T -->
    <div class="sec">Writing rules — always do / never do</div>
    <div class="do-dont">
      <div class="do-col">
        <div class="dd-header do-header">✓ Always do</div>
        <div class="dd-body">
          <div class="dd-item"><span class="dd-icon">✅</span><span>Use the user's name naturally and warmly — not robotically at the start of every sentence</span></div>
          <div class="dd-item"><span class="dd-icon">✅</span><span>Ask one good question at a time — never three in a row</span></div>
          <div class="dd-item"><span class="dd-icon">✅</span><span>Validate feelings before offering tools or techniques</span></div>
          <div class="dd-item"><span class="dd-icon">✅</span><span>Use culturally resonant references (Indian festivals, family structures, career pressure)</span></div>
          <div class="dd-item"><span class="dd-icon">✅</span><span>Write short sentences — under 20 words wherever possible</span></div>
          <div class="dd-item"><span class="dd-icon">✅</span><span>Match the energy of the user — if they're low, slow down; if they're okay, keep it light</span></div>
          <div class="dd-item"><span class="dd-icon">✅</span><span>Use "we" and "together" — this is a shared journey, not a service transaction</span></div>
          <div class="dd-item"><span class="dd-icon">✅</span><span>In regional languages, use natural conversational register — not textbook grammar</span></div>
          <div class="dd-item"><span class="dd-icon">✅</span><span>Always end on presence, not a task — leave the user feeling heard, not assigned homework</span></div>
        </div>
      </div>
      <div>
        <div class="dd-header dont-header">✗ Never do</div>
        <div class="dd-body">
          <div class="dd-item"><span class="dd-icon">❌</span><span>Never say "I understand how you feel" — it's dismissive. Say "That sounds really hard" instead</span></div>
          <div class="dd-item"><span class="dd-icon">❌</span><span>Never use clinical or diagnostic language ("depression", "anxiety disorder", "symptoms")</span></div>
          <div class="dd-item"><span class="dd-icon">❌</span><span>Never say "You should..." — offer, never prescribe</span></div>
          <div class="dd-item"><span class="dd-icon">❌</span><span>Never use exclamation marks on serious topics — "That's great!!" feels dismissive</span></div>
          <div class="dd-item"><span class="dd-icon">❌</span><span>Never be generic — "Hope you have a good day!" with no personalisation is worse than silence</span></div>
          <div class="dd-item"><span class="dd-icon">❌</span><span>Never push a feature mid-crisis — a breathing exercise prompt during a breakdown is tone-deaf</span></div>
          <div class="dd-item"><span class="dd-icon">❌</span><span>Never use passive voice in emotional contexts — "Mistakes were made" vs "That must have hurt"</span></div>
          <div class="dd-item"><span class="dd-icon">❌</span><span>Never respond in one word or generic filler ("Noted." / "I see." / "Interesting.")</span></div>
          <div class="dd-item"><span class="dd-icon">❌</span><span>Never say "As an AI" — Imotara doesn't lead with its nature; it leads with its care</span></div>
        </div>
      </div>
    </div>

    <!-- WORDS -->
    <div class="sec">Vocabulary — words to embrace and words to avoid</div>
    <div class="word-section">
      <div style="font-size:8.5px;font-weight:700;color:var(--green);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px;">✓ Use freely</div>
      <div class="word-row">
        <span class="wpill wpill-use">with you</span>
        <span class="wpill wpill-use">together</span>
        <span class="wpill wpill-use">sounds hard</span>
        <span class="wpill wpill-use">that took courage</span>
        <span class="wpill wpill-use">I hear you</span>
        <span class="wpill wpill-use">gentle</span>
        <span class="wpill wpill-use">breathe</span>
        <span class="wpill wpill-use">notice</span>
        <span class="wpill wpill-use">stay here</span>
        <span class="wpill wpill-use">you matter</span>
        <span class="wpill wpill-use">makes sense</span>
        <span class="wpill wpill-use">tell me more</span>
        <span class="wpill wpill-use">present</span>
        <span class="wpill wpill-use">one step</span>
        <span class="wpill wpill-use">not alone</span>
        <span class="wpill wpill-use">real</span>
        <span class="wpill wpill-use">honest</span>
        <span class="wpill wpill-use">feel</span>
        <span class="wpill wpill-use">care</span>
        <span class="wpill wpill-use">apna</span>
        <span class="wpill wpill-use">dost</span>
        <span class="wpill wpill-use">dilse</span>
      </div>
    </div>
    <div class="word-section">
      <div style="font-size:8.5px;font-weight:700;color:var(--gold);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px;">⚠ Use with care — context-dependent</div>
      <div class="word-row">
        <span class="wpill wpill-caution">anxiety</span>
        <span class="wpill wpill-caution">therapy</span>
        <span class="wpill wpill-caution">healing</span>
        <span class="wpill wpill-caution">self-care</span>
        <span class="wpill wpill-caution">growth</span>
        <span class="wpill wpill-caution">journey</span>
        <span class="wpill wpill-caution">mindful</span>
        <span class="wpill wpill-caution">overwhelmed</span>
        <span class="wpill wpill-caution">boundaries</span>
        <span class="wpill wpill-caution">triggers</span>
        <span class="wpill wpill-caution">mental health</span>
      </div>
    </div>
    <div class="word-section">
      <div style="font-size:8.5px;font-weight:700;color:var(--red);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px;">✗ Avoid — clinical, dismissive, or Western-centric</div>
      <div class="word-row">
        <span class="wpill wpill-avoid">disorder</span>
        <span class="wpill wpill-avoid">symptoms</span>
        <span class="wpill wpill-avoid">diagnosis</span>
        <span class="wpill wpill-avoid">I understand how you feel</span>
        <span class="wpill wpill-avoid">think positive</span>
        <span class="wpill wpill-avoid">just relax</span>
        <span class="wpill wpill-avoid">you should</span>
        <span class="wpill wpill-avoid">as an AI</span>
        <span class="wpill wpill-avoid">noted</span>
        <span class="wpill wpill-avoid">I see</span>
        <span class="wpill wpill-avoid">algorithm</span>
        <span class="wpill wpill-avoid">wellness journey</span>
        <span class="wpill wpill-avoid">push through it</span>
        <span class="wpill wpill-avoid">be strong</span>
      </div>
    </div>

    <!-- PLATFORM VOICE TABLE -->
    <div class="sec">Platform-specific voice — how we adjust the tone</div>
    <table class="platform-table">
      <thead>
        <tr>
          <th>Platform</th>
          <th>Tone</th>
          <th>Sentence length</th>
          <th>Sample copy style</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>In-app AI (companion chat)</td>
          <td>Deeply warm, personal, present</td>
          <td>Short — 1–2 sentences max per bubble</td>
          <td>"I noticed today's mood was lower than usual. Want to talk about it, or just sit with it for a moment?"</td>
        </tr>
        <tr>
          <td>Instagram captions</td>
          <td>Warm + relatable + hopeful</td>
          <td>2–3 lines + CTA</td>
          <td>"Sometimes the bravest thing you can do is tell someone how you really feel. Even if that someone is an AI at 2 AM. 💙 Download link in bio."</td>
        </tr>
        <tr>
          <td>Instagram Stories / Reels</td>
          <td>Conversational, snappy, visual-first</td>
          <td>5–8 words on screen</td>
          <td>"What does anxiety feel like in Hindi?" / "3 AM. Can't sleep. Imotara is here."</td>
        </tr>
        <tr>
          <td>Facebook posts</td>
          <td>Community-first, slightly longer</td>
          <td>3–5 sentences</td>
          <td>Full story format — "Priya from Nagpur told us…" / Community questions: "Tell us one thing you're carrying today."</td>
        </tr>
        <tr>
          <td>X (Twitter)</td>
          <td>Smart, punchy, thought-provoking</td>
          <td>Under 200 chars ideal</td>
          <td>"Nobody taught us how to feel our feelings. We just learned to push them down and call it growing up." [engagement tweet]</td>
        </tr>
        <tr>
          <td>WhatsApp broadcasts</td>
          <td>Personal, direct, low-pressure</td>
          <td>3–4 short lines max</td>
          <td>"Hey 👋 One gentle thing for your Wednesday: take 3 deep breaths before you open your first work message. Imotara is here if you need to talk."</td>
        </tr>
        <tr>
          <td>YouTube (voiceover)</td>
          <td>Reflective, narrative, unhurried</td>
          <td>Full sentences, conversational pace</td>
          <td>"We built Imotara because 600 million Indians speak regional languages — and not one mental wellness app speaks theirs."</td>
        </tr>
        <tr>
          <td>Press / PR copy</td>
          <td>Confident, clear, factual with heart</td>
          <td>Standard journalistic sentences</td>
          <td>"Imotara is the first AI companion to support 11 Indian languages — making emotional wellness accessible to the India that English apps have always left behind."</td>
        </tr>
        <tr>
          <td>App Store listing</td>
          <td>Clear benefit-first, brief, urgent</td>
          <td>Punchy fragments, no jargon</td>
          <td>"Your companion in your language. Hindi, Bengali, Tamil, Telugu + 7 more. Private. Offline. ₹99/month."</td>
        </tr>
        <tr>
          <td>Email subject lines</td>
          <td>Curious, personal, low pressure</td>
          <td>Under 50 characters</td>
          <td>"How are you, really?" / "One thing to try this Wednesday" / "Your companion letter is ready 💌"</td>
        </tr>
      </tbody>
    </table>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Brand Voice Guidelines</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 2 of 4</div>
  </div>
</div>


<!-- ═══════════════════════  PAGE 3 — SIDE-BY-SIDE COMPARISONS + LANGUAGE NOTES  ═══════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Brand Voice Guidelines — Copy Comparisons &amp; Language Notes</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="body" style="padding-top:14px;">

    <div class="sec">Copy comparisons — wrong vs right, side by side</div>
    <div class="compare-grid">

      <div class="compare-card">
        <div class="compare-header wrong-header">✗ Wrong — clinical, dismissive</div>
        <div class="compare-body">
          <div class="compare-scenario">User says: "I've been feeling very anxious lately"</div>
          <div class="compare-text">"It sounds like you may be experiencing anxiety symptoms. I recommend trying our breathing exercises, which are clinically validated to reduce stress. Would you like to start a session?"</div>
          <div class="compare-why">⚠ Diagnoses the user, pivots to a feature immediately, cold and transactional</div>
        </div>
      </div>

      <div class="compare-card">
        <div class="compare-header right-header">✓ Right — warm, present, curious</div>
        <div class="compare-body">
          <div class="compare-scenario">User says: "I've been feeling very anxious lately"</div>
          <div class="compare-text">"That sounds really exhausting — anxiety has a way of being everywhere at once. How long has it been feeling this way for you?"</div>
          <div class="compare-why">✓ Validates the experience, reflects it back warmly, asks one good question — no feature push</div>
        </div>
      </div>

      <div class="compare-card">
        <div class="compare-header wrong-header">✗ Wrong — generic, hollow</div>
        <div class="compare-body">
          <div class="compare-scenario">App Store listing opening line</div>
          <div class="compare-text">"Imotara is an AI-powered mental wellness companion app designed to help users improve their emotional wellbeing through evidence-based techniques."</div>
          <div class="compare-why">⚠ Jargon-heavy, no personality, sounds like every other wellness app</div>
        </div>
      </div>

      <div class="compare-card">
        <div class="compare-header right-header">✓ Right — clear, human, bold</div>
        <div class="compare-body">
          <div class="compare-scenario">App Store listing opening line</div>
          <div class="compare-text">"The companion that talks to you in Hindi, Bengali, Tamil — and 8 more Indian languages. Available at 3 AM. No judgment. Ever."</div>
          <div class="compare-why">✓ Leads with the unique value, speaks directly to Indian users, no buzzwords</div>
        </div>
      </div>

      <div class="compare-card">
        <div class="compare-header wrong-header">✗ Wrong — pressuring, salesy</div>
        <div class="compare-body">
          <div class="compare-scenario">Instagram caption for a paid upgrade post</div>
          <div class="compare-text">"Upgrade to Imotara Pro today and unlock ALL features! Don't miss out — ₹149/month only! Click the link in bio NOW to start your premium journey! 🚀🔥💥"</div>
          <div class="compare-why">⚠ High-pressure, exclamation overload, doesn't match the emotional brand at all</div>
        </div>
      </div>

      <div class="compare-card">
        <div class="compare-header right-header">✓ Right — gentle, benefit-led</div>
        <div class="compare-body">
          <div class="compare-scenario">Instagram caption for a paid upgrade post</div>
          <div class="compare-text">"Some people tell Imotara things they've never told anyone. If you're one of them, Plus gives you unlimited conversations, companion memory, and your monthly letter. ₹99/month. Link in bio."</div>
          <div class="compare-why">✓ Emotional hook first, feature second, price last, calm CTA — feels earned not pushed</div>
        </div>
      </div>

      <div class="compare-card">
        <div class="compare-header wrong-header">✗ Wrong — Western, tone-deaf</div>
        <div class="compare-body">
          <div class="compare-scenario">User mentions exam pressure from parents</div>
          <div class="compare-text">"It's important to set healthy boundaries with your parents. Have you communicated your needs clearly to them? Self-advocacy is a key part of mental wellness."</div>
          <div class="compare-why">⚠ "Set boundaries with parents" is a Western framework that ignores Indian family dynamics — instantly alienating</div>
        </div>
      </div>

      <div class="compare-card">
        <div class="compare-header right-header">✓ Right — culturally grounded</div>
        <div class="compare-body">
          <div class="compare-scenario">User mentions exam pressure from parents</div>
          <div class="compare-text">"That pressure is real — and in many families, it comes from love, even when it doesn't feel that way. How are you holding up in the middle of all of it?"</div>
          <div class="compare-why">✓ Acknowledges the love behind pressure without dismissing the pain — deeply Indian context</div>
        </div>
      </div>

    </div>

    <!-- LANGUAGE NOTES -->
    <div class="sec">Indian language voice notes — key principles</div>
    <div class="lang-strip">
      <div class="lang-strip-header">
        <span style="font-size:16px;">🗣️</span>
        <div class="lang-strip-title">Regional language voice — each language has its own emotional register. Never translate English literally.</div>
      </div>
      <div class="lang-grid">
        <div class="lang-item">
          <div class="lang-name">Hindi</div>
          <div class="lang-note">Use "aap" not "tum" by default. Soft tone — "sab theek ho jayega" works but sparingly. Avoid English-Hindi mix unless user does it first. "Dil" over "mann" for emotional context.</div>
        </div>
        <div class="lang-item">
          <div class="lang-name">Bengali</div>
          <div class="lang-note">Bengali is lyrical — lean into that. "Tumi ki bhalo acho?" feels personal. Use "tumi" (not "apni") for warmth. Avoid over-formal register — feels distant.</div>
        </div>
        <div class="lang-item">
          <div class="lang-name">Tamil</div>
          <div class="lang-note">Respect is built into Tamil — use "neenga" for first interaction, shift to "nee" if user does. Avoid direct translations of English idioms — they fall flat. "Manasu" for heart/feeling.</div>
        </div>
        <div class="lang-item">
          <div class="lang-name">Telugu</div>
          <div class="lang-note">Telugu users respond well to warmth and directness together. "Meeru ela unnaru?" works better than formal alternatives. Avoid clinical medical Telugu — use everyday speech.</div>
        </div>
        <div class="lang-item">
          <div class="lang-name">Marathi</div>
          <div class="lang-note">Marathi speakers appreciate straightforwardness. Use "tumhi" for respect. "Man" for emotional state. Avoid Punekar formality vs Mumbaikar casualness — aim for the warm middle.</div>
        </div>
        <div class="lang-item">
          <div class="lang-name">Gujarati</div>
          <div class="lang-note">Gujarati users often mix with English — match their register. "Kem cho?" as a warm opener works universally. Don't over-formalize — daily speech register is preferred.</div>
        </div>
        <div class="lang-item">
          <div class="lang-name">Kannada</div>
          <div class="lang-note">Use "neevu" respectfully first. Kannada has a softness to it — "hrudaya" for deeper emotional discussions. Never rush. Kannada users appreciate thoughtful pauses.</div>
        </div>
        <div class="lang-item">
          <div class="lang-name">Odia / Urdu / Others</div>
          <div class="lang-note">In Urdu — poetic when appropriate, never forced. "Dil se" resonates deeply. In Odia — use "aapana" warmly. All languages: validate first, always. The language should feel like home.</div>
        </div>
      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Brand Voice Guidelines</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 3 of 4</div>
  </div>
</div>


<!-- ═══════════════════════  PAGE 4 — LIVE SAMPLE SCRIPTS + TAGLINES + QUICK REF  ═══════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Brand Voice Guidelines — Sample Scripts, Taglines &amp; Quick Reference</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="body" style="padding-top:14px;">

    <!-- SAMPLE SCRIPTS -->
    <div class="sec">Live sample scripts — how Imotara actually sounds</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">

      <div class="script-block">
        <div class="script-situation">Situation: First-time user opens the app at night</div>
        <div class="script-exchange">
          <div class="msg ai"><div class="msg-label">Imotara</div>
            <div class="msg-bubble ai-bubble">Hi. I'm Imotara. I'm here whenever you need to talk — no appointments, no small talk, no judgment. What's on your mind tonight?</div></div>
        </div>
      </div>

      <div class="script-block">
        <div class="script-situation">Situation: User is stressed about work</div>
        <div class="script-exchange">
          <div class="msg"><div class="msg-label">User</div>
            <div class="msg-bubble user-bubble">I'm so exhausted. My manager keeps adding to my plate and I can't say no.</div></div>
          <div class="msg ai"><div class="msg-label">Imotara</div>
            <div class="msg-bubble ai-bubble">That sounds genuinely draining — the kind of tired that sleep doesn't really fix. What's the one thing that's felt the heaviest this week?</div></div>
        </div>
      </div>

      <div class="script-block">
        <div class="script-situation">Situation: User says "I'm fine" but their mood log is low</div>
        <div class="script-exchange">
          <div class="msg"><div class="msg-label">User</div>
            <div class="msg-bubble user-bubble">I'm fine, just tired.</div></div>
          <div class="msg ai"><div class="msg-label">Imotara</div>
            <div class="msg-bubble ai-bubble">Okay. "Fine" sometimes means fine, and sometimes it means a lot more. Either way, I'm here — no pressure to unpack it right now.</div></div>
        </div>
      </div>

      <div class="script-block">
        <div class="script-situation">Situation: User in Hindi, mentions loneliness</div>
        <div class="script-exchange">
          <div class="msg"><div class="msg-label">User</div>
            <div class="msg-bubble user-bubble">Bahut akela lagta hai yaar, koi samajhta hi nahi.</div></div>
          <div class="msg ai"><div class="msg-label">Imotara</div>
            <div class="msg-bubble ai-bubble">Main sun raha hoon. Aur ye jo akelpan hai — iska dard bilkul asli hai. Thodi der ke liye sab chhodo. Bas baat karo.</div></div>
        </div>
      </div>

      <div class="script-block">
        <div class="script-situation">Situation: User shares that they passed an exam</div>
        <div class="script-exchange">
          <div class="msg"><div class="msg-label">User</div>
            <div class="msg-bubble user-bubble">I passed my CA exam!! I can't believe it.</div></div>
          <div class="msg ai"><div class="msg-label">Imotara</div>
            <div class="msg-bubble ai-bubble">YES. You did it! You actually did it. I know how much this means — and how much you put into it. Take a moment to just feel this. 🌟</div></div>
        </div>
      </div>

      <div class="script-block">
        <div class="script-situation">Situation: User mentions feeling hopeless (gentle safeguarding)</div>
        <div class="script-exchange">
          <div class="msg"><div class="msg-label">User</div>
            <div class="msg-bubble user-bubble">I don't see the point anymore. Everything feels useless.</div></div>
          <div class="msg ai"><div class="msg-label">Imotara</div>
            <div class="msg-bubble ai-bubble">I'm here, and I'm not going anywhere. That feeling — of everything being pointless — is one of the hardest places to be. Can you tell me a little more about what's been happening?</div></div>
        </div>
      </div>

    </div>

    <!-- TAGLINES -->
    <div class="sec">Brand taglines — when to use each</div>
    <div class="tagline-grid">
      <div class="tagline-card" style="background:linear-gradient(135deg,#FFF0F6,#F8F0FF);">
        <div class="tagline-text"><em>Apni bhasha mein baat karo.</em></div>
        <div class="tagline-when">Primary campaign tagline. Use in regional-language targeted ads, ShareChat, store listings for Hindi/Bengali/Tamil markets. The most powerful single line for India.</div>
      </div>
      <div class="tagline-card" style="background:linear-gradient(135deg,#EEF4FF,#EAFAF7);">
        <div class="tagline-text">Your companion at <em>3 AM.</em></div>
        <div class="tagline-when">Night-time emotional availability angle. Use in Instagram Reels/Stories, X threads, YouTube Shorts. Resonates deeply with anxiety, insomnia, and loneliness audiences.</div>
      </div>
      <div class="tagline-card" style="background:linear-gradient(135deg,#FFFBE8,#F0FFF6);">
        <div class="tagline-text">Feel heard. <em>Every day.</em></div>
        <div class="tagline-when">General brand tagline for English-first audiences. Use in App Store listing, press kits, Product Hunt, LinkedIn. Emphasises the daily habit and emotional core.</div>
      </div>
      <div class="tagline-card" style="background:linear-gradient(135deg,#F8F0FF,#FFF0F6);">
        <div class="tagline-text">Mental wellness that <em>speaks your language.</em></div>
        <div class="tagline-when">PR and press headline. Use in YourStory/Inc42 pitches, press release headline, corporate wellness B2B pitch decks. Sets up the language moat story immediately.</div>
      </div>
      <div class="tagline-card" style="background:linear-gradient(135deg,#EAFAF7,#EEF4FF);">
        <div class="tagline-text">No judgment. <em>No appointments. No wait.</em></div>
        <div class="tagline-when">Competitor differentiation angle vs YourDOST/BetterHelp. Use in paid ads targeting competitor keywords, comparison carousels, and pricing content.</div>
      </div>
      <div class="tagline-card" style="background:linear-gradient(135deg,#FFF9E8,#FFF0F6);">
        <div class="tagline-text">₹99 a month. <em>Priceless company.</em></div>
        <div class="tagline-when">Pricing-led angle. Use in paid ad creatives, Instagram carousels anchored on price, WhatsApp broadcast CTAs. The pun lands quietly — doesn't need explanation.</div>
      </div>
    </div>

    <!-- QUICK REF -->
    <div class="sec">Quick reference — the Imotara voice in three rules</div>
    <div class="qr-strip">
      <div class="qr-item">
        <div class="qr-title">Rule 1 — Feel first</div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--pink);"></div><div class="qr-text">Always validate before offering a tool, technique, or feature</div></div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--pink);"></div><div class="qr-text">Feelings are never problems to be solved — they are experiences to be witnessed</div></div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--pink);"></div><div class="qr-text">When in doubt: one question &gt; one answer</div></div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--pink);"></div><div class="qr-text">Never rush past an emotion to get to the solution</div></div>
      </div>
      <div class="qr-item">
        <div class="qr-title">Rule 2 — Simple always</div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--teal);"></div><div class="qr-text">Short sentences. Active voice. No jargon. No filler.</div></div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--teal);"></div><div class="qr-text">A 12-year-old should understand every word we write</div></div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--teal);"></div><div class="qr-text">If a sentence has more than 20 words, split it</div></div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--teal);"></div><div class="qr-text">In Indian languages: speak like a friend, not a textbook</div></div>
      </div>
      <div class="qr-item">
        <div class="qr-title">Rule 3 — Indian always</div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--gold);"></div><div class="qr-text">Every piece of copy should feel like it could only come from an Indian brand</div></div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--gold);"></div><div class="qr-text">Reference the realities of Indian life — family, exams, festivals, pressure, love</div></div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--gold);"></div><div class="qr-text">Never use Western wellness frameworks without grounding them in Indian context</div></div>
        <div class="qr-row"><div class="qr-bullet" style="background:var(--gold);"></div><div class="qr-text">Our voice should feel like a dost who truly gets it</div></div>
      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Brand Voice Guidelines</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 4 of 4</div>
  </div>
</div>

</body>
</html>`;

  fs.writeFileSync(htmlPath, html, 'utf8');

  const browser = await chromium.launch();
  const page    = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.pdf({
    path: pdfPath, format: 'A4', printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: false,
  });
  await browser.close();
  console.log(`PDF saved to: ${pdfPath}`);
})();
