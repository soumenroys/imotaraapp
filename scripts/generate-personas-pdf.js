const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

(async () => {
  const logoPath = path.resolve(__dirname, '../public/Imotara Firm.png');
  const logoB64  = fs.readFileSync(logoPath).toString('base64');
  const logoSrc  = `data:image/png;base64,${logoB64}`;

  const htmlPath = path.resolve(__dirname, '../docs/imotara-target-audience-personas.html');
  const pdfPath  = path.resolve(__dirname, '../docs/imotara-target-audience-personas.pdf');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Imotara — Target Audience Personas</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
:root{
  --pink:#FF6B9D;--blue:#4B9FE1;--teal:#38C9B9;--gold:#F5C842;
  --purple:#9B6FE8;--green:#3DBE8A;--orange:#FF8C42;--red:#E05252;
  --navy:#12274F;--navy2:#1E3A6E;--slate:#3D5580;
  --light:#F0F6FF;--border:#D4E2F7;--white:#FFFFFF;--gray:#6B7EA4;
}
html,body{
  width:210mm;
  font-family:'Inter','Helvetica Neue',Arial,sans-serif;
  background:var(--white);color:var(--navy);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
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

/* BODY */
.body{padding:18px 36px 0;flex:1;}
.sec{font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:var(--blue);
  margin-bottom:12px;display:flex;align-items:center;gap:8px;}
.sec::after{content:'';flex:1;height:1px;background:var(--border);}

/* HERO */
.hero{background:linear-gradient(135deg,#FFF0F6 0%,#EEF4FF 50%,#EAFAF7 100%);
  border-bottom:1px solid var(--border);padding:14px 36px;
  display:flex;align-items:center;justify-content:space-between;}
.hero-title{font-size:16px;font-weight:900;color:var(--navy);line-height:1.25;}
.hero-title em{font-style:normal;background:linear-gradient(135deg,var(--pink),var(--blue));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.hero-sub{font-size:10px;color:var(--gray);margin-top:4px;line-height:1.5;max-width:360px;}
.hero-stats{display:flex;flex-direction:column;gap:5px;align-items:flex-end;}
.hero-stat{background:var(--white);border:1px solid var(--border);border-radius:20px;
  padding:5px 13px;font-size:9px;font-weight:600;color:var(--navy);
  display:flex;align-items:center;gap:6px;}
.hero-stat .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}

/* ═══ PERSONA CARD ═══ */
.persona-card{border-radius:16px;border:1.5px solid var(--border);overflow:hidden;margin-bottom:14px;}

.pc-header{padding:16px 20px;display:flex;align-items:flex-start;gap:16px;position:relative;}
.pc-avatar{
  width:64px;height:64px;border-radius:16px;
  display:flex;align-items:center;justify-content:center;
  font-size:30px;flex-shrink:0;
}
.pc-identity{}
.pc-name{font-size:17px;font-weight:900;color:var(--white);line-height:1;}
.pc-role{font-size:10px;font-weight:500;color:rgba(255,255,255,.7);margin-top:3px;}
.pc-location{font-size:9px;color:rgba(255,255,255,.55);margin-top:2px;display:flex;align-items:center;gap:4px;}
.pc-persona-tag{
  position:absolute;top:16px;right:16px;
  font-size:8.5px;font-weight:700;letter-spacing:.5px;
  padding:4px 12px;border-radius:20px;background:rgba(255,255,255,.18);color:#fff;
  border:1px solid rgba(255,255,255,.2);
}
.pc-quote-band{
  padding:10px 20px;
  font-size:11px;font-weight:600;font-style:italic;
  color:rgba(255,255,255,.9);line-height:1.5;
  border-top:1px solid rgba(255,255,255,.1);
}
.pc-quote-band::before{content:'"';font-size:18px;font-weight:900;opacity:.5;margin-right:3px;}
.pc-quote-band::after{content:'"';font-size:18px;font-weight:900;opacity:.5;margin-left:3px;}

.pc-body{padding:14px 20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;background:var(--white);}

.pc-section-title{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--blue);margin-bottom:7px;}
.pc-demo-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;}
.pc-demo-item{background:var(--light);border-radius:6px;padding:4px 7px;}
.pc-demo-label{font-size:7.5px;color:var(--gray);font-weight:500;}
.pc-demo-value{font-size:9px;color:var(--navy);font-weight:600;margin-top:1px;}

.pc-list{list-style:none;display:flex;flex-direction:column;gap:4px;}
.pc-list li{font-size:9px;color:var(--slate);line-height:1.45;
  display:flex;align-items:flex-start;gap:5px;padding-left:0;}
.pc-list li::before{content:'';flex-shrink:0;width:5px;height:5px;border-radius:50%;margin-top:4px;}
.pain li::before{background:var(--red);}
.goal li::before{background:var(--green);}

.pc-features{display:flex;flex-direction:column;gap:0;}
.pc-feature{font-size:9px;color:var(--slate);padding:4px 0;border-bottom:1px dashed var(--border);
  display:flex;align-items:center;gap:5px;line-height:1.3;}
.pc-feature:last-child{border-bottom:none;}
.pc-feature .icon{font-size:11px;flex-shrink:0;}

.pc-footer{
  padding:10px 20px;display:flex;align-items:center;justify-content:space-between;
  border-top:1px solid var(--border);
}
.pc-msg-label{font-size:8px;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:var(--blue);margin-bottom:3px;}
.pc-msg-text{font-size:10px;font-weight:700;color:var(--navy);font-style:italic;line-height:1.35;}
.pc-channel-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:4px;}
.pc-channel-label{font-size:8px;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:var(--blue);}
.pc-channels{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;}
.channel-pill{font-size:8px;font-weight:600;padding:3px 9px;border-radius:12px;border:1px solid var(--border);}

/* per-persona accent colours */
.acc-1 .pc-header{background:linear-gradient(135deg,#C04B7A,#7B3DBE);}
.acc-1 .pc-avatar{background:rgba(255,255,255,.18);}
.acc-1 .pc-quote-band{background:linear-gradient(135deg,rgba(192,75,122,.85),rgba(123,61,190,.85));}
.acc-1 .pc-footer{background:#FFF5FA;}

.acc-2 .pc-header{background:linear-gradient(135deg,#1B6BAA,#0E4A7A);}
.acc-2 .pc-avatar{background:rgba(255,255,255,.15);}
.acc-2 .pc-quote-band{background:linear-gradient(135deg,rgba(27,107,170,.85),rgba(14,74,122,.85));}
.acc-2 .pc-footer{background:#F0F8FF;}

.acc-3 .pc-header{background:linear-gradient(135deg,#1B7A5A,#0E5A3F);}
.acc-3 .pc-avatar{background:rgba(255,255,255,.15);}
.acc-3 .pc-quote-band{background:linear-gradient(135deg,rgba(27,122,90,.85),rgba(14,90,63,.85));}
.acc-3 .pc-footer{background:#F0FBF6;}

.acc-4 .pc-header{background:linear-gradient(135deg,#9B5C1A,#7A3E0E);}
.acc-4 .pc-avatar{background:rgba(255,255,255,.15);}
.acc-4 .pc-quote-band{background:linear-gradient(135deg,rgba(155,92,26,.85),rgba(122,62,14,.85));}
.acc-4 .pc-footer{background:#FFF8F0;}

/* ═══ PAGE 3 STYLES ═══ */
.matrix-table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:16px;}
.matrix-table thead th{background:var(--navy);color:#fff;padding:8px 10px;text-align:center;font-size:8.5px;}
.matrix-table thead th:first-child{text-align:left;border-radius:7px 0 0 0;min-width:80px;}
.matrix-table thead th:last-child{border-radius:0 7px 0 0;}
.matrix-table thead .th1{background:#8B2E60;}
.matrix-table thead .th2{background:#1A5C8F;}
.matrix-table thead .th3{background:#1A6E50;}
.matrix-table thead .th4{background:#7A3E0E;}
.matrix-table tbody td{padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);}
.matrix-table tbody td:first-child{text-align:left;font-weight:700;color:var(--navy);}
.matrix-table tbody tr:nth-child(even) td{background:var(--light);}
.matrix-table tbody tr:last-child td{border-bottom:none;}
.mchk{color:var(--green);font-size:13px;font-weight:700;}
.mcrs{color:#E0E7F0;font-size:13px;}
.mhigh{color:var(--pink);font-size:10px;font-weight:700;}

.channel-card{border:1px solid var(--border);border-radius:12px;padding:14px 16px;}
.channel-card-title{font-size:11px;font-weight:800;color:var(--navy);margin-bottom:2px;display:flex;align-items:center;gap:6px;}
.channel-card-sub{font-size:9px;color:var(--gray);margin-bottom:10px;}
.channel-rows{display:flex;flex-direction:column;gap:5px;}
.channel-row{display:flex;align-items:flex-start;gap:8px;}
.channel-row-platform{font-size:9px;font-weight:700;color:var(--navy);min-width:80px;flex-shrink:0;}
.channel-row-detail{font-size:9px;color:var(--slate);line-height:1.45;}

.insight-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.insight-card{background:var(--light);border-radius:10px;padding:12px 14px;border:1px solid var(--border);}
.insight-title{font-size:10px;font-weight:700;color:var(--navy);margin-bottom:5px;display:flex;align-items:center;gap:5px;}
.insight-body{font-size:9px;color:var(--slate);line-height:1.55;}

.summary-strip{background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:10px;
  padding:13px 22px;display:flex;justify-content:space-around;align-items:center;margin-bottom:14px;}
.ss-item{text-align:center;}
.ss-num{font-size:20px;font-weight:900;color:var(--gold);line-height:1;}
.ss-lbl{font-size:8px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;}
.ss-div{width:1px;background:rgba(255,255,255,.15);align-self:stretch;}

/* FOOTER */
.ftr{background:var(--navy);padding:9px 36px;display:flex;align-items:center;justify-content:space-between;margin-top:auto;}
.ftr-left{display:flex;align-items:center;gap:10px;}
.ftr-logo{height:20px;filter:brightness(0) invert(1);opacity:.8;}
.ftr-copy{font-size:8.5px;color:rgba(255,255,255,.4);}
.ftr-mid{font-size:8.5px;color:rgba(255,255,255,.35);}
.ftr-page{font-size:8.5px;color:rgba(255,255,255,.5);font-weight:600;}
</style>
</head>
<body>

<!-- ══════════════════  PAGE 1 — PERSONAS 1 & 2  ══════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Target Audience Personas — Who Uses Imotara</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="hero">
    <div>
      <div class="hero-title">4 primary personas.<br/><em>Real people, real pain points.</em></div>
      <div class="hero-sub">Each persona represents a distinct user segment — different motivations, languages, and life contexts. All united by one need: a calm, private space to feel heard.</div>
    </div>
    <div class="hero-stats">
      <div class="hero-stat"><span class="dot" style="background:var(--pink)"></span> Urban Professional</div>
      <div class="hero-stat"><span class="dot" style="background:var(--blue)"></span> College Student</div>
      <div class="hero-stat"><span class="dot" style="background:var(--green)"></span> Regional India</div>
      <div class="hero-stat"><span class="dot" style="background:var(--orange)"></span> Homemaker / Parent</div>
    </div>
  </div>

  <div class="body">

    <!-- ── PERSONA 1: PRIYA ── -->
    <div class="persona-card acc-1">
      <div class="pc-header">
        <div class="pc-avatar">👩‍💼</div>
        <div class="pc-identity">
          <div class="pc-name">Priya Sharma</div>
          <div class="pc-role">Product Manager · EdTech Startup · Mumbai</div>
          <div class="pc-location">📍 Andheri, Mumbai &nbsp;·&nbsp; 27 years &nbsp;·&nbsp; She/Her</div>
        </div>
        <div class="pc-persona-tag">Persona 1 — Urban Professional</div>
      </div>
      <div class="pc-quote-band">
        I know therapy would probably help, but ₹2,000 per session every week? I just can't. And who has time to book and commute?
      </div>
      <div class="pc-body">
        <div>
          <div class="pc-section-title">Demographics</div>
          <div class="pc-demo-grid">
            <div class="pc-demo-item"><div class="pc-demo-label">Age</div><div class="pc-demo-value">25–32</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">City tier</div><div class="pc-demo-value">Tier 1 metro</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Income</div><div class="pc-demo-value">₹8–18 LPA</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Language</div><div class="pc-demo-value">English / Hindi</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Device</div><div class="pc-demo-value">iPhone 13+</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Uses app</div><div class="pc-demo-value">Late night</div></div>
          </div>
        </div>
        <div>
          <div class="pc-section-title">Pain Points</div>
          <ul class="pc-list pain">
            <li>High-pressure job, burnout is normalised in their circle</li>
            <li>Therapy is too expensive and logistically hard</li>
            <li>Can't talk to colleagues about mental health — stigma at work</li>
            <li>Feels guilty taking time for herself amid workload</li>
            <li>Journaling apps feel too clinical and transactional</li>
          </ul>
        </div>
        <div>
          <div class="pc-section-title">Top Imotara Features</div>
          <div class="pc-features">
            <div class="pc-feature"><span class="icon">💬</span> Late-night AI chat — no judgement</div>
            <div class="pc-feature"><span class="icon">📊</span> Monthly companion letter + emotion timeline</div>
            <div class="pc-feature"><span class="icon">🎙️</span> Voice input when too tired to type</div>
            <div class="pc-feature"><span class="icon">🔒</span> Privacy-first — no colleague can see</div>
            <div class="pc-feature"><span class="icon">🧵</span> Multiple threads — separates work / personal</div>
          </div>
        </div>
      </div>
      <div class="pc-footer">
        <div>
          <div class="pc-msg-label">Message that resonates</div>
          <div class="pc-msg-text">"₹79/month. Less than one therapy copay. Available at 2 AM."</div>
        </div>
        <div class="pc-channel-wrap">
          <div class="pc-channel-label">Best channels</div>
          <div class="pc-channels">
            <span class="channel-pill" style="background:#E7F3FF;border-color:#C0D9F5;color:#1B4F8A;">Instagram Reels</span>
            <span class="channel-pill" style="background:#FFF0F5;border-color:#FFB3D1;color:#8B1A4A;">LinkedIn</span>
            <span class="channel-pill" style="background:#F0F8FF;border-color:#B3D4F5;color:#1A5C8F;">Google UAC</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── PERSONA 2: ARJUN ── -->
    <div class="persona-card acc-2">
      <div class="pc-header">
        <div class="pc-avatar">🧑‍🎓</div>
        <div class="pc-identity">
          <div class="pc-name">Arjun Mehta</div>
          <div class="pc-role">B.Tech 2nd Year · NIT Delhi · Away from Home for First Time</div>
          <div class="pc-location">📍 Delhi (from Jaipur) &nbsp;·&nbsp; 20 years &nbsp;·&nbsp; He/Him</div>
        </div>
        <div class="pc-persona-tag">Persona 2 — College Student</div>
      </div>
      <div class="pc-quote-band">
        I miss home more than I expected. I can't tell my parents — they'll worry. And talking to friends about feelings just feels… awkward.
      </div>
      <div class="pc-body">
        <div>
          <div class="pc-section-title">Demographics</div>
          <div class="pc-demo-grid">
            <div class="pc-demo-item"><div class="pc-demo-label">Age</div><div class="pc-demo-value">18–23</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">City tier</div><div class="pc-demo-value">Studying Tier 1</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Income</div><div class="pc-demo-value">₹0–2k pocket money</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Language</div><div class="pc-demo-value">Hindi / English</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Device</div><div class="pc-demo-value">Android mid-range</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Uses app</div><div class="pc-demo-value">Night, in hostel</div></div>
          </div>
        </div>
        <div>
          <div class="pc-section-title">Pain Points</div>
          <ul class="pc-list pain">
            <li>Homesickness, academic pressure, first heartbreak — all at once</li>
            <li>No safe space to talk — peers mock vulnerability</li>
            <li>Campus counselling has long wait times and feels formal</li>
            <li>Can't afford any paid therapy or app subscription</li>
            <li>Poor hostel internet — needs offline support</li>
          </ul>
        </div>
        <div>
          <div class="pc-section-title">Top Imotara Features</div>
          <div class="pc-features">
            <div class="pc-feature"><span class="icon">📡</span> Offline AI — works on patchy hostel Wi-Fi</div>
            <div class="pc-feature"><span class="icon">🌱</span> Free tier — 20 msgs/day is enough for daily check-in</div>
            <div class="pc-feature"><span class="icon">🎭</span> Companion feels like a non-judgemental friend</div>
            <div class="pc-feature"><span class="icon">🌬️</span> Breathing modal for exam anxiety</div>
            <div class="pc-feature"><span class="icon">🔥</span> Streak — daily habit that builds self-awareness</div>
          </div>
        </div>
      </div>
      <div class="pc-footer">
        <div>
          <div class="pc-msg-label">Message that resonates</div>
          <div class="pc-msg-text">"Free. Private. Always there. Even at 3 AM in your hostel room."</div>
        </div>
        <div class="pc-channel-wrap">
          <div class="pc-channel-label">Best channels</div>
          <div class="pc-channels">
            <span class="channel-pill" style="background:#E7F3FF;border-color:#C0D9F5;color:#1B4F8A;">YouTube Pre-roll</span>
            <span class="channel-pill" style="background:#F5F0FF;border-color:#C9BCFF;color:#4A2D8F;">Instagram Stories</span>
            <span class="channel-pill" style="background:#EDFAF2;border-color:#B8EDE3;color:#1B6B44;">College Communities</span>
          </div>
        </div>
      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Target Audience Personas</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 1 of 3</div>
  </div>
</div>


<!-- ══════════════════  PAGE 2 — PERSONAS 3 & 4  ══════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Target Audience Personas — Who Uses Imotara</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="body" style="padding-top:16px;">

    <!-- ── PERSONA 3: SUNITA ── -->
    <div class="persona-card acc-3">
      <div class="pc-header">
        <div class="pc-avatar">👩‍🏫</div>
        <div class="pc-identity">
          <div class="pc-name">Sunita Devi</div>
          <div class="pc-role">Primary School Teacher · Government School · Patna, Bihar</div>
          <div class="pc-location">📍 Patna &nbsp;·&nbsp; 34 years &nbsp;·&nbsp; She/Her &nbsp;·&nbsp; Married, 2 children</div>
        </div>
        <div class="pc-persona-tag">Persona 3 — Regional India</div>
      </div>
      <div class="pc-quote-band">
        कोई मेरी बात नहीं सुनता। घर में तो हमेशा किसी का काम होता है। अपने लिए एक पल भी नहीं। (Nobody listens to me. At home it's always someone else's needs. Not a moment for myself.)
      </div>
      <div class="pc-body">
        <div>
          <div class="pc-section-title">Demographics</div>
          <div class="pc-demo-grid">
            <div class="pc-demo-item"><div class="pc-demo-label">Age</div><div class="pc-demo-value">28–42</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">City tier</div><div class="pc-demo-value">Tier 2 / 3</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Income</div><div class="pc-demo-value">₹2–5 LPA household</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Language</div><div class="pc-demo-value">Hindi (primary)</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Device</div><div class="pc-demo-value">Android budget phone</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Uses app</div><div class="pc-demo-value">Morning / after school</div></div>
          </div>
        </div>
        <div>
          <div class="pc-section-title">Pain Points</div>
          <ul class="pc-list pain">
            <li>No mental health services exist in her city — nearest counsellor is in a different district</li>
            <li>Uncomfortable discussing emotional struggles in English</li>
            <li>Stigma around mental health — family would not understand therapy</li>
            <li>Internet is 3G / intermittent — apps must work offline</li>
            <li>Very low disposable income — free tier is critical to adoption</li>
          </ul>
        </div>
        <div>
          <div class="pc-section-title">Top Imotara Features</div>
          <div class="pc-features">
            <div class="pc-feature"><span class="icon">🌏</span> Full Hindi AI — feels natural, not translated</div>
            <div class="pc-feature"><span class="icon">📡</span> Offline AI — works without 4G</div>
            <div class="pc-feature"><span class="icon">🎙️</span> Voice input — speaks Hindi, AI understands</div>
            <div class="pc-feature"><span class="icon">🔒</span> Private — no one in family can see</div>
            <div class="pc-feature"><span class="icon">🌱</span> Free tier — zero cost barrier</div>
          </div>
        </div>
      </div>
      <div class="pc-footer">
        <div>
          <div class="pc-msg-label">Message that resonates</div>
          <div class="pc-msg-text">"अपनी भाषा में, अपनी मर्ज़ी से — कोई judgement नहीं।"<br/><span style="font-size:9px;font-weight:400;color:var(--slate);">(In your language, on your terms — no judgement.)</span></div>
        </div>
        <div class="pc-channel-wrap">
          <div class="pc-channel-label">Best channels</div>
          <div class="pc-channels">
            <span class="channel-pill" style="background:#EDFAF2;border-color:#B8EDE3;color:#1B6B44;">WhatsApp Groups</span>
            <span class="channel-pill" style="background:#FFF8E1;border-color:#FFE082;color:#7B5C00;">YouTube (Hindi)</span>
            <span class="channel-pill" style="background:#F0F8FF;border-color:#B3D4F5;color:#1A5C8F;">Facebook Groups</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── PERSONA 4: KAVITHA ── -->
    <div class="persona-card acc-4">
      <div class="pc-header">
        <div class="pc-avatar">👩‍👧‍👦</div>
        <div class="pc-identity">
          <div class="pc-name">Kavitha Nair</div>
          <div class="pc-role">Homemaker + Part-time Freelance Designer · Bengaluru</div>
          <div class="pc-location">📍 Bengaluru &nbsp;·&nbsp; 39 years &nbsp;·&nbsp; She/Her &nbsp;·&nbsp; Married, twins (age 7)</div>
        </div>
        <div class="pc-persona-tag">Persona 4 — Homemaker / Parent</div>
      </div>
      <div class="pc-quote-band">
        Everyone asks how the kids are. No one asks how I am. I've forgotten who I was before becoming "Amma". I need somewhere that's just mine.
      </div>
      <div class="pc-body">
        <div>
          <div class="pc-section-title">Demographics</div>
          <div class="pc-demo-grid">
            <div class="pc-demo-item"><div class="pc-demo-label">Age</div><div class="pc-demo-value">33–50</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">City tier</div><div class="pc-demo-value">Tier 1 / 2</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Income</div><div class="pc-demo-value">Household ₹10–20 LPA</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Language</div><div class="pc-demo-value">Malayalam / English</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Device</div><div class="pc-demo-value">Android flagship / iPhone</div></div>
            <div class="pc-demo-item"><div class="pc-demo-label">Uses app</div><div class="pc-demo-value">After children sleep</div></div>
          </div>
        </div>
        <div>
          <div class="pc-section-title">Pain Points</div>
          <ul class="pc-list pain">
            <li>"Invisible load" of parenting — emotional exhaustion unrecognised by family</li>
            <li>Identity loss — was a professional, now primarily a caregiver</li>
            <li>No peer group that understands (friends are also busy parents)</li>
            <li>Therapists in her area don't speak Malayalam</li>
            <li>Feels guilty spending money on herself when family needs come first</li>
          </ul>
        </div>
        <div>
          <div class="pc-section-title">Top Imotara Features</div>
          <div class="pc-features">
            <div class="pc-feature"><span class="icon">🌏</span> Malayalam AI — mother tongue support is rare</div>
            <div class="pc-feature"><span class="icon">💌</span> Monthly letter — feels seen and remembered</div>
            <div class="pc-feature"><span class="icon">📊</span> Emotion timeline — tracks mood patterns over months</div>
            <div class="pc-feature"><span class="icon">✉️</span> Future letters — writes to herself for the future</div>
            <div class="pc-feature"><span class="icon">🎭</span> Companion persona — sets it up as an elder sister</div>
          </div>
        </div>
      </div>
      <div class="pc-footer">
        <div>
          <div class="pc-msg-label">Message that resonates</div>
          <div class="pc-msg-text">"You take care of everyone. Let someone take care of you — even for 10 minutes a day."</div>
        </div>
        <div class="pc-channel-wrap">
          <div class="pc-channel-label">Best channels</div>
          <div class="pc-channels">
            <span class="channel-pill" style="background:#FFF8F0;border-color:#FFD4A8;color:#7A3E0E;">Instagram (Parenting)</span>
            <span class="channel-pill" style="background:#FFF0F5;border-color:#FFB3D1;color:#8B1A4A;">Pinterest</span>
            <span class="channel-pill" style="background:#EDFAF2;border-color:#B8EDE3;color:#1B6B44;">WhatsApp Mom Groups</span>
          </div>
        </div>
      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Target Audience Personas</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 2 of 3</div>
  </div>
</div>


<!-- ══════════════════  PAGE 3 — MESSAGING MATRIX + CHANNELS + INSIGHTS  ══════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Messaging Matrix, Channel Guide &amp; Audience Insights</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="body" style="padding-top:16px;">

    <!-- SUMMARY STRIP -->
    <div class="summary-strip">
      <div class="ss-item"><div class="ss-num">600M+</div><div class="ss-lbl">Indians in non-English mother tongue</div></div>
      <div class="ss-div"></div>
      <div class="ss-item"><div class="ss-num">1 in 7</div><div class="ss-lbl">Indians has a mental health condition</div></div>
      <div class="ss-div"></div>
      <div class="ss-item"><div class="ss-num">&lt;1%</div><div class="ss-lbl">Access professional mental health care</div></div>
      <div class="ss-div"></div>
      <div class="ss-item"><div class="ss-num">₹1,500+</div><div class="ss-lbl">Cost of 1 therapy session</div></div>
      <div class="ss-div"></div>
      <div class="ss-item"><div class="ss-num">22–35</div><div class="ss-lbl">Highest mental health app adoption age</div></div>
    </div>

    <!-- MESSAGING MATRIX -->
    <div class="sec">Messaging matrix — what to say to whom</div>
    <table class="matrix-table">
      <thead>
        <tr>
          <th>Message angle</th>
          <th class="th1">👩‍💼 Priya<br/><span style="font-weight:400;font-size:7.5px;">Urban Pro</span></th>
          <th class="th2">🧑‍🎓 Arjun<br/><span style="font-weight:400;font-size:7.5px;">College Student</span></th>
          <th class="th3">👩‍🏫 Sunita<br/><span style="font-weight:400;font-size:7.5px;">Regional India</span></th>
          <th class="th4">👩‍👧‍👦 Kavitha<br/><span style="font-weight:400;font-size:7.5px;">Homemaker/Parent</span></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>₹79 vs therapy cost</td>
          <td><span class="mhigh">★ Lead</span></td>
          <td><span class="mchk">✓</span></td>
          <td><span class="mcrs">—</span></td>
          <td><span class="mchk">✓</span></td>
        </tr>
        <tr>
          <td>Free tier — no cost to start</td>
          <td><span class="mchk">✓</span></td>
          <td><span class="mhigh">★ Lead</span></td>
          <td><span class="mhigh">★ Lead</span></td>
          <td><span class="mchk">✓</span></td>
        </tr>
        <tr>
          <td>Hindi / regional language support</td>
          <td><span class="mcrs">—</span></td>
          <td><span class="mchk">✓</span></td>
          <td><span class="mhigh">★ Lead</span></td>
          <td><span class="mhigh">★ Lead</span></td>
        </tr>
        <tr>
          <td>Privacy — nobody reads your chats</td>
          <td><span class="mhigh">★ Lead</span></td>
          <td><span class="mchk">✓</span></td>
          <td><span class="mchk">✓</span></td>
          <td><span class="mhigh">★ Lead</span></td>
        </tr>
        <tr>
          <td>Available 24/7 — even at 2–3 AM</td>
          <td><span class="mhigh">★ Lead</span></td>
          <td><span class="mhigh">★ Lead</span></td>
          <td><span class="mcrs">—</span></td>
          <td><span class="mchk">✓</span></td>
        </tr>
        <tr>
          <td>Offline AI — works without internet</td>
          <td><span class="mcrs">—</span></td>
          <td><span class="mhigh">★ Lead</span></td>
          <td><span class="mhigh">★ Lead</span></td>
          <td><span class="mcrs">—</span></td>
        </tr>
        <tr>
          <td>Monthly companion letter</td>
          <td><span class="mchk">✓</span></td>
          <td><span class="mcrs">—</span></td>
          <td><span class="mcrs">—</span></td>
          <td><span class="mhigh">★ Lead</span></td>
        </tr>
        <tr>
          <td>"You take care of everyone — let someone take care of you"</td>
          <td><span class="mcrs">—</span></td>
          <td><span class="mcrs">—</span></td>
          <td><span class="mchk">✓</span></td>
          <td><span class="mhigh">★ Lead</span></td>
        </tr>
        <tr>
          <td>No judgement, no stigma</td>
          <td><span class="mchk">✓</span></td>
          <td><span class="mhigh">★ Lead</span></td>
          <td><span class="mhigh">★ Lead</span></td>
          <td><span class="mchk">✓</span></td>
        </tr>
      </tbody>
    </table>

    <!-- CHANNEL GUIDE -->
    <div class="sec">Channel guide — where to find each persona</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">

      <div class="channel-card" style="border-color:#E8D5F0;background:#FDF5FF;">
        <div class="channel-card-title" style="color:#8B2E60;">👩‍💼 Reaching Priya (Urban Professional)</div>
        <div class="channel-card-sub">Lives on Instagram, LinkedIn, and Spotify. Skips ads but watches Reels. High willingness to pay.</div>
        <div class="channel-rows">
          <div class="channel-row"><div class="channel-row-platform">Instagram</div><div class="channel-row-detail">Reels format: "Things no one tells you about burnout" — value-first, soft CTA at end</div></div>
          <div class="channel-row"><div class="channel-row-platform">LinkedIn</div><div class="channel-row-detail">Thought-leadership posts on workplace mental health. Target HR decision-makers for org licensing.</div></div>
          <div class="channel-row"><div class="channel-row-platform">Google Search</div><div class="channel-row-detail">Keywords: "therapy alternative India", "mental health app India", "burnout support app"</div></div>
          <div class="channel-row"><div class="channel-row-platform">Spotify / Podcast</div><div class="channel-row-detail">Mid-roll ads on mental health and productivity podcasts in English</div></div>
        </div>
      </div>

      <div class="channel-card" style="border-color:#C0D9F5;background:#F0F8FF;">
        <div class="channel-card-title" style="color:#1A5C8F;">🧑‍🎓 Reaching Arjun (College Student)</div>
        <div class="channel-card-sub">YouTube, Instagram, Discord. Strong referral potential within hostel/college networks. Price-sensitive.</div>
        <div class="channel-rows">
          <div class="channel-row"><div class="channel-row-platform">YouTube</div><div class="channel-row-detail">Pre-roll on study videos, JEE/competitive exam channels. Show the free tier prominently.</div></div>
          <div class="channel-row"><div class="channel-row-platform">Instagram Stories</div><div class="channel-row-detail">Relatable memes + mental health awareness content in Hindi-English mix</div></div>
          <div class="channel-row"><div class="channel-row-platform">College tie-ups</div><div class="channel-row-detail">Partner with DUSU, IIT/NIT student wellness boards. Bulk free access for campus wellness weeks.</div></div>
          <div class="channel-row"><div class="channel-row-platform">WhatsApp / Discord</div><div class="channel-row-detail">Peer-to-peer referral — "my friend uses it" is the strongest conversion trigger for this age group</div></div>
        </div>
      </div>

      <div class="channel-card" style="border-color:#B8EDE3;background:#EDFAF7;">
        <div class="channel-card-title" style="color:#1B6B44;">👩‍🏫 Reaching Sunita (Regional India)</div>
        <div class="channel-card-sub">Facebook, YouTube (Hindi), WhatsApp. Low tech-confidence. Needs word-of-mouth trust before downloading.</div>
        <div class="channel-rows">
          <div class="channel-row"><div class="channel-row-platform">YouTube Hindi</div><div class="channel-row-detail">Videos titled "मन की बात app से करें" — Hindi explainer of Imotara in 60 seconds</div></div>
          <div class="channel-row"><div class="channel-row-platform">Facebook Groups</div><div class="channel-row-detail">Women's groups, teacher communities, parent groups — share helpful mental health content</div></div>
          <div class="channel-row"><div class="channel-row-platform">WhatsApp Forward</div><div class="channel-row-detail">Design shareable infographic: "Hindi mein apni baat karo" with Play Store link</div></div>
          <div class="channel-row"><div class="channel-row-platform">NGO partnerships</div><div class="channel-row-detail">Bulk onboarding through women's welfare NGOs in Tier 2/3 cities</div></div>
        </div>
      </div>

      <div class="channel-card" style="border-color:#FFD4A8;background:#FFF8F0;">
        <div class="channel-card-title" style="color:#7A3E0E;">👩‍👧‍👦 Reaching Kavitha (Homemaker/Parent)</div>
        <div class="channel-card-sub">Instagram (parenting pages), Pinterest, YouTube cooking/lifestyle, WhatsApp mom groups. High emotional resonance.</div>
        <div class="channel-rows">
          <div class="channel-row"><div class="channel-row-platform">Instagram</div><div class="channel-row-detail">Parenting + self-care crossover content. "It's okay to not be okay as a parent" — soft emotional hooks</div></div>
          <div class="channel-row"><div class="channel-row-platform">WhatsApp Mom Groups</div><div class="channel-row-detail">Refer-a-friend campaign: "A quiet 10 minutes just for you" — share a free month upgrade code</div></div>
          <div class="channel-row"><div class="channel-row-platform">YouTube</div><div class="channel-row-detail">Pre-roll on Malayalam/Kannada lifestyle channels. Language-specific ads perform far better here.</div></div>
          <div class="channel-row"><div class="channel-row-platform">Meta Ads</div><div class="channel-row-detail">Target: 30–45, married women, Tier 1/2 cities, interested in parenting + wellness + self-care</div></div>
        </div>
      </div>

    </div>

    <!-- STRATEGIC INSIGHTS -->
    <div class="sec">Strategic insights for Suchismita</div>
    <div class="insight-grid">
      <div class="insight-card">
        <div class="insight-title">🔑 The free tier is the growth engine</div>
        <div class="insight-body">Personas 2 and 3 (Arjun, Sunita) will never pay upfront. Lead every campaign with "Free — no credit card" and let the product convert them. Paid campaigns should target Personas 1 and 4 who have higher willingness to pay.</div>
      </div>
      <div class="insight-card">
        <div class="insight-title">🌏 Language is the unlock for scale</div>
        <div class="insight-body">All 4 personas are poorly served by English-only wellness apps. Lead every Hindi, Bengali, Tamil, Malayalam campaign with the language angle — it's the single most differentiating claim Imotara has that no competitor can match.</div>
      </div>
      <div class="insight-card">
        <div class="insight-title">🔒 Never mention the AI first</div>
        <div class="insight-body">None of these 4 personas care about the AI technology. They care about feeling heard, private, and supported. Lead with the emotional outcome ("someone who listens") and mention AI only as a trust signal ("secure, private, never shared").</div>
      </div>
      <div class="insight-card">
        <div class="insight-title">📱 Mobile-first, always</div>
        <div class="insight-body">All 4 personas use smartphones as their primary device. Design all content for vertical video and mobile screens. The web app is secondary — it's for the 5% who find Imotara via Google. 95% of organic growth will come through app stores and mobile social.</div>
      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Target Audience Personas</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 3 of 3</div>
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
