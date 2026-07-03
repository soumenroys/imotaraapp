const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

(async () => {
  const logoPath = path.resolve(__dirname, '../public/Imotara Firm.png');
  const logoB64  = fs.readFileSync(logoPath).toString('base64');
  const logoSrc  = `data:image/png;base64,${logoB64}`;

  const htmlPath = path.resolve(__dirname, '../docs/imotara-competitor-landscape.html');
  const pdfPath  = path.resolve(__dirname, '../docs/imotara-competitor-landscape.pdf');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Imotara — Competitor Landscape</title>
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
.hdr::after{content:'';position:absolute;bottom:-50px;left:40%;width:160px;height:160px;
  background:radial-gradient(circle,rgba(255,107,157,.12) 0%,transparent 70%);border-radius:50%;}
.hdr-left{display:flex;align-items:center;gap:14px;z-index:1;}
.hdr-logo{height:54px;}
.hdr-sub{color:rgba(255,255,255,.65);font-size:10px;margin-top:2px;}
.hdr-badge{z-index:1;background:linear-gradient(135deg,var(--pink),var(--blue));
  color:#fff;font-size:9px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;
  padding:6px 14px;border-radius:20px;}
.gbar{height:4px;background:linear-gradient(to right,var(--pink),var(--gold),var(--teal),var(--blue));}
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
.hero-right{display:flex;flex-direction:column;gap:5px;align-items:flex-end;}
.hero-pill{background:var(--white);border:1px solid var(--border);border-radius:20px;
  padding:5px 13px;font-size:9px;font-weight:600;color:var(--navy);
  display:flex;align-items:center;gap:7px;}
.hero-pill .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}

/* ═══ COMPETITOR CARDS 3×2 ═══ */
.comp-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;}
.comp-card{border-radius:14px;border:1.5px solid var(--border);overflow:hidden;position:relative;}
.comp-card-header{padding:12px 14px 10px;display:flex;align-items:flex-start;gap:10px;}
.comp-logo-box{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;
  justify-content:center;font-size:20px;flex-shrink:0;}
.comp-name{font-size:12px;font-weight:800;color:var(--white);line-height:1.1;}
.comp-tagline{font-size:8.5px;color:rgba(255,255,255,.65);margin-top:2px;line-height:1.3;}
.comp-body{padding:10px 14px;background:var(--white);}
.comp-meta{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;}
.comp-meta-item{background:var(--light);border-radius:6px;padding:3px 6px;}
.comp-meta-label{font-size:7px;color:var(--gray);font-weight:600;}
.comp-meta-value{font-size:8.5px;color:var(--navy);font-weight:700;margin-top:1px;}
.comp-strengths{margin-bottom:6px;}
.comp-s-title{font-size:7.5px;font-weight:700;color:var(--green);text-transform:uppercase;
  letter-spacing:.5px;margin-bottom:4px;}
.comp-s-list{list-style:none;display:flex;flex-direction:column;gap:2px;}
.comp-s-list li{font-size:8.5px;color:var(--slate);display:flex;gap:5px;align-items:flex-start;line-height:1.35;}
.comp-s-list li::before{content:'✓';color:var(--green);font-size:8px;flex-shrink:0;margin-top:1px;}
.comp-weaknesses{}
.comp-w-title{font-size:7.5px;font-weight:700;color:var(--red);text-transform:uppercase;
  letter-spacing:.5px;margin-bottom:4px;}
.comp-w-list{list-style:none;display:flex;flex-direction:column;gap:2px;}
.comp-w-list li{font-size:8.5px;color:var(--slate);display:flex;gap:5px;align-items:flex-start;line-height:1.35;}
.comp-w-list li::before{content:'✗';color:var(--red);font-size:8px;flex-shrink:0;margin-top:1px;}
.comp-footer{background:var(--light);padding:6px 14px;border-top:1px solid var(--border);
  font-size:8px;color:var(--navy);font-weight:600;font-style:italic;}

/* per-brand accents */
.brand-wysa .comp-card-header{background:linear-gradient(135deg,#3A6EA5,#1E4D8C);}
.brand-wysa .comp-logo-box{background:rgba(255,255,255,.15);}
.brand-yourdost .comp-card-header{background:linear-gradient(135deg,#E8490A,#B83408);}
.brand-yourdost .comp-logo-box{background:rgba(255,255,255,.15);}
.brand-innerhour .comp-card-header{background:linear-gradient(135deg,#5B3E8C,#3D2070);}
.brand-innerhour .comp-logo-box{background:rgba(255,255,255,.15);}
.brand-replika .comp-card-header{background:linear-gradient(135deg,#2C7873,#1A5250);}
.brand-replika .comp-logo-box{background:rgba(255,255,255,.15);}
.brand-woebot .comp-card-header{background:linear-gradient(135deg,#D46B1A,#A34E0E);}
.brand-woebot .comp-logo-box{background:rgba(255,255,255,.15);}
.brand-headspace .comp-card-header{background:linear-gradient(135deg,#F47C3C,#C4500A);}
.brand-headspace .comp-logo-box{background:rgba(255,255,255,.15);}

/* ═══ PAGE 2 STYLES ═══ */
.matrix-table{width:100%;border-collapse:collapse;font-size:8.5px;margin-bottom:14px;}
.matrix-table thead th{background:var(--navy);color:#fff;padding:7px 8px;text-align:center;font-size:8px;font-weight:700;}
.matrix-table thead th:first-child{text-align:left;border-radius:7px 0 0 0;min-width:110px;}
.matrix-table thead th:last-child{border-radius:0 7px 0 0;background:linear-gradient(135deg,var(--pink),var(--blue));}
.matrix-table thead .th-imotara{background:linear-gradient(135deg,var(--pink),var(--blue));}
.matrix-table tbody td{padding:5px 8px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);font-size:8.5px;}
.matrix-table tbody td:first-child{text-align:left;font-weight:600;color:var(--navy);}
.matrix-table tbody td:last-child{background:rgba(255,107,157,.05);}
.matrix-table tbody tr:nth-child(even) td{background:var(--light);}
.matrix-table tbody tr:nth-child(even) td:last-child{background:rgba(255,107,157,.08);}
.matrix-table tbody tr:last-child td{border-bottom:none;}
.matrix-table .cat-row td{background:var(--navy) !important;color:rgba(255,255,255,.6);
  font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:5px 8px;}
.chk{color:var(--green);font-size:12px;font-weight:700;}
.crs{color:#CBD5E1;font-size:12px;}
.lim{color:var(--gold);font-size:9px;font-weight:700;}
.win{color:var(--pink);font-size:9px;font-weight:800;}

/* pricing comparison */
.price-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:14px;}
.price-col{border-radius:10px;border:1.5px solid var(--border);overflow:hidden;text-align:center;}
.price-col.imotara-col{border-color:var(--pink);box-shadow:0 0 0 2px rgba(255,107,157,.15);}
.price-col-header{padding:8px 4px;font-size:8px;font-weight:800;color:var(--white);}
.price-col.imotara-col .price-col-header{background:linear-gradient(135deg,var(--pink),var(--blue));}
.price-col-body{padding:8px 4px;}
.price-free{font-size:11px;font-weight:900;color:var(--green);}
.price-paid{font-size:10px;font-weight:800;color:var(--navy);margin-top:2px;}
.price-note{font-size:7px;color:var(--gray);margin-top:3px;line-height:1.3;}

/* ═══ PAGE 3 STYLES ═══ */

/* POSITIONING MAP */
.pos-map-wrap{position:relative;margin-bottom:16px;}
.pos-map{
  width:100%;height:200px;
  background:linear-gradient(135deg,#F8FAFF 0%,#FFF5F8 100%);
  border:1.5px solid var(--border);border-radius:14px;
  position:relative;overflow:hidden;
}
/* Quadrant fill */
.pos-map::before{
  content:'';position:absolute;right:0;bottom:0;
  width:50%;height:50%;
  background:rgba(255,107,157,.07);
  border-top:1.5px dashed rgba(255,107,157,.3);
  border-left:1.5px dashed rgba(255,107,157,.3);
}
/* Axis lines */
.axis-x{position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(18,39,79,.12);}
.axis-y{position:absolute;top:0;bottom:0;left:50%;width:1px;background:rgba(18,39,79,.12);}
/* Axis labels */
.axis-label{position:absolute;font-size:7.5px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;}
.al-left{left:8px;top:50%;transform:translateY(-50%);}
.al-right{right:8px;top:50%;transform:translateY(-50%);}
.al-top{top:8px;left:50%;transform:translateX(-50%);}
.al-bottom{bottom:8px;left:50%;transform:translateX(-50%);}
/* Quadrant labels */
.quad-label{position:absolute;font-size:8px;font-weight:600;padding:3px 8px;border-radius:8px;}
.ql-tl{top:14px;left:14px;background:rgba(203,213,225,.2);color:#94A3B8;}
.ql-tr{top:14px;right:14px;background:rgba(203,213,225,.2);color:#94A3B8;}
.ql-bl{bottom:14px;left:14px;background:rgba(203,213,225,.2);color:#94A3B8;}
.ql-br{bottom:14px;right:14px;background:rgba(255,107,157,.1);color:var(--pink);font-weight:800;}
/* Competitor dots */
.dot-wrap{position:absolute;display:flex;flex-direction:column;align-items:center;gap:3px;transform:translate(-50%,-50%);}
.cdot{width:14px;height:14px;border-radius:50%;border:2px solid var(--white);
  box-shadow:0 2px 6px rgba(0,0,0,.18);flex-shrink:0;}
.cdot-label{font-size:7px;font-weight:700;color:var(--navy);white-space:nowrap;
  background:rgba(255,255,255,.9);padding:1px 5px;border-radius:6px;
  box-shadow:0 1px 3px rgba(0,0,0,.1);}
.cdot-imotara{width:18px;height:18px;background:linear-gradient(135deg,var(--pink),var(--blue));border-color:var(--white);box-shadow:0 3px 10px rgba(255,107,157,.4);}
.cdot-label-imotara{color:var(--pink);font-weight:900;font-size:8px;}

/* moat strip */
.moat-strip{background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:12px;
  padding:14px 22px;display:flex;align-items:center;gap:16px;margin-bottom:14px;}
.moat-icon{font-size:28px;flex-shrink:0;}
.moat-title{font-size:12px;font-weight:800;color:#fff;margin-bottom:3px;}
.moat-body{font-size:9.5px;color:rgba(255,255,255,.7);line-height:1.6;}
.moat-div{width:1px;background:rgba(255,255,255,.15);align-self:stretch;}
.moat-stats{display:flex;flex-direction:column;gap:6px;min-width:130px;}
.moat-stat{display:flex;align-items:center;gap:8px;}
.moat-stat-num{font-size:16px;font-weight:900;color:var(--gold);line-height:1;min-width:36px;}
.moat-stat-lbl{font-size:8.5px;color:rgba(255,255,255,.6);}

/* takeaway grid */
.takeaway-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.takeaway-card{border-radius:10px;padding:12px 14px;border:1px solid var(--border);}
.takeaway-title{font-size:10px;font-weight:800;color:var(--navy);margin-bottom:5px;
  display:flex;align-items:center;gap:6px;}
.takeaway-body{font-size:9px;color:var(--slate);line-height:1.55;}

/* battle card */
.battle-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;}
.battle-card{border-radius:10px;border:1.5px solid var(--border);overflow:hidden;}
.battle-header{padding:8px 12px;display:flex;align-items:center;justify-content:space-between;}
.battle-vs{font-size:9px;font-weight:800;color:var(--white);}
.battle-body{padding:10px 12px;background:var(--white);}
.battle-row{display:flex;justify-content:space-between;align-items:flex-start;
  padding:4px 0;border-bottom:1px solid var(--border);gap:6px;}
.battle-row:last-child{border-bottom:none;}
.battle-dimension{font-size:8px;color:var(--gray);min-width:60px;flex-shrink:0;}
.battle-them{font-size:8.5px;color:var(--red);font-weight:600;text-align:center;flex:1;}
.battle-us{font-size:8.5px;color:var(--green);font-weight:600;text-align:center;flex:1;}

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

<!-- ══════════════════════════  PAGE 1 — COMPETITOR PROFILES  ══════════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Competitor Landscape — Know Your Market</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="hero">
    <div>
      <div class="hero-title">6 competitors profiled.<br/><em>Imotara's gaps in every one.</em></div>
      <div class="hero-sub">The Indian mental wellness market is underpenetrated and multilingual. Every major competitor leaves 600M+ regional-language speakers unserved. That is Imotara's structural opening.</div>
    </div>
    <div class="hero-right">
      <div class="hero-pill"><span class="dot" style="background:#3A6EA5"></span> Wysa — AI therapy, B2B</div>
      <div class="hero-pill"><span class="dot" style="background:#E8490A"></span> YourDOST — Human counsellors</div>
      <div class="hero-pill"><span class="dot" style="background:#5B3E8C"></span> InnerHour — Guided programs</div>
      <div class="hero-pill"><span class="dot" style="background:#2C7873"></span> Replika — AI companion (global)</div>
    </div>
  </div>

  <div class="body">
    <div class="sec">Competitor profiles</div>
    <div class="comp-grid">

      <!-- WYSA -->
      <div class="comp-card brand-wysa">
        <div class="comp-card-header">
          <div class="comp-logo-box">🤖</div>
          <div>
            <div class="comp-name">Wysa</div>
            <div class="comp-tagline">AI mental health chatbot<br/>Founded 2016 · Bengaluru / London</div>
          </div>
        </div>
        <div class="comp-body">
          <div class="comp-meta">
            <div class="comp-meta-item"><div class="comp-meta-label">Model</div><div class="comp-meta-value">B2B + B2C</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Pricing</div><div class="comp-meta-value">Free + ₹599/mo</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Users</div><div class="comp-meta-value">6M+ globally</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Languages</div><div class="comp-meta-value">English only</div></div>
          </div>
          <div class="comp-strengths">
            <div class="comp-s-title">Strengths</div>
            <ul class="comp-s-list">
              <li>Strong B2B — sold to employers, insurers</li>
              <li>Clinical validation, published research</li>
              <li>Backed by WHO & NHS endorsements</li>
            </ul>
          </div>
          <div class="comp-weaknesses">
            <div class="comp-w-title">Weaknesses vs Imotara</div>
            <ul class="comp-w-list">
              <li>English only — zero Indian languages</li>
              <li>No offline AI capability</li>
              <li>Feels clinical, not companionate</li>
            </ul>
          </div>
        </div>
        <div class="comp-footer">Imotara opening: 11 Indian languages + warm companion tone vs cold CBT interface</div>
      </div>

      <!-- YOURDOST -->
      <div class="comp-card brand-yourdost">
        <div class="comp-card-header">
          <div class="comp-logo-box">🧑‍⚕️</div>
          <div>
            <div class="comp-name">YourDOST</div>
            <div class="comp-tagline">Online counselling platform<br/>Founded 2014 · Bengaluru</div>
          </div>
        </div>
        <div class="comp-body">
          <div class="comp-meta">
            <div class="comp-meta-item"><div class="comp-meta-label">Model</div><div class="comp-meta-value">Human + AI</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Pricing</div><div class="comp-meta-value">₹499/session</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Users</div><div class="comp-meta-value">3M+ users</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Languages</div><div class="comp-meta-value">English + Hindi</div></div>
          </div>
          <div class="comp-strengths">
            <div class="comp-s-title">Strengths</div>
            <ul class="comp-s-list">
              <li>Large network of human counsellors</li>
              <li>Strong corporate employee wellness</li>
              <li>Established brand in India since 2014</li>
            </ul>
          </div>
          <div class="comp-weaknesses">
            <div class="comp-w-title">Weaknesses vs Imotara</div>
            <ul class="comp-w-list">
              <li>₹499/session — expensive for daily use</li>
              <li>Scheduling friction — not 24/7 AI-first</li>
              <li>No offline mode, no Indian language depth</li>
            </ul>
          </div>
        </div>
        <div class="comp-footer">Imotara opening: 24/7 availability + ₹79/mo vs ₹499/session scheduling friction</div>
      </div>

      <!-- INNERHOUR -->
      <div class="comp-card brand-innerhour">
        <div class="comp-card-header">
          <div class="comp-logo-box">🕰️</div>
          <div>
            <div class="comp-name">InnerHour</div>
            <div class="comp-tagline">Guided mental wellness programs<br/>Founded 2016 · Mumbai</div>
          </div>
        </div>
        <div class="comp-body">
          <div class="comp-meta">
            <div class="comp-meta-item"><div class="comp-meta-label">Model</div><div class="comp-meta-value">B2C programs</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Pricing</div><div class="comp-meta-value">Free + ₹499/mo</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Users</div><div class="comp-meta-value">1M+ downloads</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Languages</div><div class="comp-meta-value">English only</div></div>
          </div>
          <div class="comp-strengths">
            <div class="comp-s-title">Strengths</div>
            <ul class="comp-s-list">
              <li>Structured CBT/DBT programs</li>
              <li>Self-help worksheets and exercises</li>
              <li>Indian team, India-first focus</li>
            </ul>
          </div>
          <div class="comp-weaknesses">
            <div class="comp-w-title">Weaknesses vs Imotara</div>
            <ul class="comp-w-list">
              <li>English only — no regional languages</li>
              <li>Program-based, not conversational AI</li>
              <li>No offline mode, no companion relationship</li>
            </ul>
          </div>
        </div>
        <div class="comp-footer">Imotara opening: Conversational AI + regional languages vs rigid program structure</div>
      </div>

      <!-- REPLIKA -->
      <div class="comp-card brand-replika">
        <div class="comp-card-header">
          <div class="comp-logo-box">🤍</div>
          <div>
            <div class="comp-name">Replika</div>
            <div class="comp-tagline">AI companion app<br/>Founded 2017 · San Francisco</div>
          </div>
        </div>
        <div class="comp-body">
          <div class="comp-meta">
            <div class="comp-meta-item"><div class="comp-meta-label">Model</div><div class="comp-meta-value">B2C companion</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Pricing</div><div class="comp-meta-value">Free + $9.99/mo</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Users</div><div class="comp-meta-value">10M+ globally</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Languages</div><div class="comp-meta-value">English only</div></div>
          </div>
          <div class="comp-strengths">
            <div class="comp-s-title">Strengths</div>
            <ul class="comp-s-list">
              <li>Deep emotional companion model — high retention</li>
              <li>Massive global user base and brand recognition</li>
              <li>Persona customisation (relationship type)</li>
            </ul>
          </div>
          <div class="comp-weaknesses">
            <div class="comp-w-title">Weaknesses vs Imotara</div>
            <ul class="comp-w-list">
              <li>No Indian languages — entirely English</li>
              <li>No mental wellness tools (mood tracking, CBT)</li>
              <li>Data privacy concerns, US-based storage</li>
            </ul>
          </div>
        </div>
        <div class="comp-footer">Imotara opening: Indian languages + wellness tools + privacy-first local storage</div>
      </div>

      <!-- WOEBOT -->
      <div class="comp-card brand-woebot">
        <div class="comp-card-header">
          <div class="comp-logo-box">🤗</div>
          <div>
            <div class="comp-name">Woebot</div>
            <div class="comp-tagline">CBT-based AI chatbot<br/>Founded 2017 · San Francisco</div>
          </div>
        </div>
        <div class="comp-body">
          <div class="comp-meta">
            <div class="comp-meta-item"><div class="comp-meta-label">Model</div><div class="comp-meta-value">B2C + Research</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Pricing</div><div class="comp-meta-value">Free only</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Users</div><div class="comp-meta-value">1.5M+ globally</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Languages</div><div class="comp-meta-value">English only</div></div>
          </div>
          <div class="comp-strengths">
            <div class="comp-s-title">Strengths</div>
            <ul class="comp-s-list">
              <li>Stanford-backed, strong clinical research</li>
              <li>Free — low adoption barrier</li>
              <li>Proven CBT effectiveness in trials</li>
            </ul>
          </div>
          <div class="comp-weaknesses">
            <div class="comp-w-title">Weaknesses vs Imotara</div>
            <ul class="comp-w-list">
              <li>English only — no Indian language support</li>
              <li>Rigid CBT scripts — not conversational</li>
              <li>No mobile offline, no companion warmth</li>
            </ul>
          </div>
        </div>
        <div class="comp-footer">Imotara opening: Warmth + local languages + 71 tools vs rigid scripted CBT</div>
      </div>

      <!-- HEADSPACE / CALM -->
      <div class="comp-card brand-headspace">
        <div class="comp-card-header">
          <div class="comp-logo-box">🧘</div>
          <div>
            <div class="comp-name">Headspace / Calm</div>
            <div class="comp-tagline">Meditation &amp; mindfulness<br/>Global — US-based</div>
          </div>
        </div>
        <div class="comp-body">
          <div class="comp-meta">
            <div class="comp-meta-item"><div class="comp-meta-label">Model</div><div class="comp-meta-value">B2C + B2B</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Pricing</div><div class="comp-meta-value">$12–14/mo (USD)</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Users</div><div class="comp-meta-value">70M+ combined</div></div>
            <div class="comp-meta-item"><div class="comp-meta-label">Languages</div><div class="comp-meta-value">English primarily</div></div>
          </div>
          <div class="comp-strengths">
            <div class="comp-s-title">Strengths</div>
            <ul class="comp-s-list">
              <li>Global brand, huge content library</li>
              <li>Celebrity partnerships + media presence</li>
              <li>Strong corporate wellness revenue</li>
            </ul>
          </div>
          <div class="comp-weaknesses">
            <div class="comp-w-title">Weaknesses vs Imotara</div>
            <ul class="comp-w-list">
              <li>Not conversational — no AI companion</li>
              <li>USD pricing — expensive for India</li>
              <li>No Indian languages, no cultural context</li>
            </ul>
          </div>
        </div>
        <div class="comp-footer">Imotara opening: Conversational AI + Indian pricing + Indian languages vs content library</div>
      </div>

    </div>
  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Competitor Landscape</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 1 of 3</div>
  </div>
</div>


<!-- ══════════════════════════  PAGE 2 — FEATURE MATRIX + PRICING TABLE  ══════════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Feature Matrix &amp; Pricing Comparison</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="body" style="padding-top:16px;">

    <!-- FEATURE MATRIX -->
    <div class="sec">Head-to-head feature matrix</div>
    <table class="matrix-table">
      <thead>
        <tr>
          <th>Feature</th>
          <th>Wysa</th>
          <th>YourDOST</th>
          <th>InnerHour</th>
          <th>Replika</th>
          <th>Woebot</th>
          <th>Headspace</th>
          <th class="th-imotara">Imotara ✦</th>
        </tr>
      </thead>
      <tbody>
        <tr class="cat-row"><td colspan="8">Language &amp; Access</td></tr>
        <tr>
          <td>Indian languages (count)</td>
          <td><span class="lim">0</span></td>
          <td><span class="lim">1</span></td>
          <td><span class="lim">0</span></td>
          <td><span class="lim">0</span></td>
          <td><span class="lim">0</span></td>
          <td><span class="lim">0</span></td>
          <td><span class="win">11 ★</span></td>
        </tr>
        <tr>
          <td>Offline AI (no internet needed)</td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="chk">✓</span></td>
        </tr>
        <tr>
          <td>Voice input in Indian languages</td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="chk">✓</span></td>
        </tr>
        <tr>
          <td>Neural TTS (AI speaks aloud)</td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="lim">Partial</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="lim">Guided only</span></td>
          <td><span class="chk">✓</span></td>
        </tr>
        <tr class="cat-row"><td colspan="8">AI &amp; Conversation</td></tr>
        <tr>
          <td>Conversational AI (free-form chat)</td>
          <td><span class="chk">✓</span></td>
          <td><span class="lim">Human only</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="chk">✓</span></td>
          <td><span class="lim">Scripted CBT</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="chk">✓</span></td>
        </tr>
        <tr>
          <td>Companion persona customisation</td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="lim">Partial</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="chk">✓</span></td>
        </tr>
        <tr>
          <td>Companion memory (remembers facts)</td>
          <td><span class="crs">✗</span></td>
          <td><span class="lim">Notes only</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="chk">✓</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="chk">✓</span></td>
        </tr>
        <tr>
          <td>Monthly companion letter</td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="win">✓ ★ Unique</span></td>
        </tr>
        <tr class="cat-row"><td colspan="8">Privacy &amp; Data</td></tr>
        <tr>
          <td>Local-first storage (data on device)</td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="chk">✓</span></td>
        </tr>
        <tr>
          <td>No ads, no data selling</td>
          <td><span class="lim">Partial</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="lim">Partial</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="chk">✓</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="chk">✓</span></td>
        </tr>
        <tr>
          <td>India-based / local data storage</td>
          <td><span class="lim">Partial</span></td>
          <td><span class="chk">✓</span></td>
          <td><span class="chk">✓</span></td>
          <td><span class="crs">✗ US</span></td>
          <td><span class="crs">✗ US</span></td>
          <td><span class="crs">✗ US</span></td>
          <td><span class="chk">✓ Local</span></td>
        </tr>
        <tr class="cat-row"><td colspan="8">Wellness Tools &amp; Platform</td></tr>
        <tr>
          <td>Mood tracking + emotion timeline</td>
          <td><span class="chk">✓</span></td>
          <td><span class="lim">Basic</span></td>
          <td><span class="chk">✓</span></td>
          <td><span class="lim">Basic</span></td>
          <td><span class="lim">Basic</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="chk">✓</span></td>
        </tr>
        <tr>
          <td>Cultural content (Indian myths / wisdom)</td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="crs">✗</span></td>
          <td><span class="win">✓ ★ Unique</span></td>
        </tr>
        <tr>
          <td>iOS + Android + Web (all three)</td>
          <td><span class="lim">iOS+Android</span></td>
          <td><span class="lim">Web+App</span></td>
          <td><span class="lim">iOS+Android</span></td>
          <td><span class="lim">iOS+Android</span></td>
          <td><span class="lim">iOS+Android</span></td>
          <td><span class="lim">iOS+Android</span></td>
          <td><span class="chk">✓ All 3</span></td>
        </tr>
        <tr>
          <td>Indian pricing (₹ per month)</td>
          <td><span class="crs">₹599</span></td>
          <td><span class="crs">₹499/session</span></td>
          <td><span class="lim">₹499</span></td>
          <td><span class="crs">$9.99 USD</span></td>
          <td><span class="chk">Free only</span></td>
          <td><span class="crs">$12+ USD</span></td>
          <td><span class="win">₹79 ★</span></td>
        </tr>
      </tbody>
    </table>

    <!-- PRICING COMPARISON STRIP -->
    <div class="sec">Pricing at a glance</div>
    <div class="price-grid">
      <div class="price-col">
        <div class="price-col-header" style="background:#3A6EA5;">Wysa</div>
        <div class="price-col-body">
          <div class="price-free">Free</div>
          <div class="price-paid">₹599/mo</div>
          <div class="price-note">B2B plans available</div>
        </div>
      </div>
      <div class="price-col">
        <div class="price-col-header" style="background:#E8490A;">YourDOST</div>
        <div class="price-col-body">
          <div class="price-free">Free</div>
          <div class="price-paid">₹499/session</div>
          <div class="price-note">Per counsellor session</div>
        </div>
      </div>
      <div class="price-col">
        <div class="price-col-header" style="background:#5B3E8C;">InnerHour</div>
        <div class="price-col-body">
          <div class="price-free">Free</div>
          <div class="price-paid">₹499/mo</div>
          <div class="price-note">Program-based tiers</div>
        </div>
      </div>
      <div class="price-col">
        <div class="price-col-header" style="background:#2C7873;">Replika</div>
        <div class="price-col-body">
          <div class="price-free">Free</div>
          <div class="price-paid">~₹850/mo</div>
          <div class="price-note">$9.99 USD converted</div>
        </div>
      </div>
      <div class="price-col">
        <div class="price-col-header" style="background:#D4761A;">Woebot</div>
        <div class="price-col-body">
          <div class="price-free">Free</div>
          <div class="price-paid">—</div>
          <div class="price-note">No paid tier currently</div>
        </div>
      </div>
      <div class="price-col">
        <div class="price-col-header" style="background:#F47C3C;">Headspace</div>
        <div class="price-col-body">
          <div class="price-free">Trial</div>
          <div class="price-paid">~₹1,050/mo</div>
          <div class="price-note">$12.99 USD converted</div>
        </div>
      </div>
      <div class="price-col imotara-col">
        <div class="price-col-header">Imotara</div>
        <div class="price-col-body">
          <div class="price-free">Free</div>
          <div class="price-paid" style="color:var(--pink);">₹79/mo</div>
          <div class="price-note" style="color:var(--green);font-weight:700;">Lowest in category</div>
        </div>
      </div>
    </div>

    <!-- 3 BATTLE CARDS -->
    <div class="sec">Direct battle cards — Imotara vs top 3 India competitors</div>
    <div class="battle-grid">

      <div class="battle-card">
        <div class="battle-header" style="background:linear-gradient(135deg,#3A6EA5,#1E4D8C);">
          <div class="battle-vs">Imotara vs Wysa</div>
        </div>
        <div class="battle-body">
          <div class="battle-row">
            <div class="battle-dimension">Languages</div>
            <div class="battle-them">English only</div>
            <div class="battle-us">11 Indian + 10 global</div>
          </div>
          <div class="battle-row">
            <div class="battle-dimension">Pricing</div>
            <div class="battle-them">₹599/month</div>
            <div class="battle-us">₹79/month</div>
          </div>
          <div class="battle-row">
            <div class="battle-dimension">Offline AI</div>
            <div class="battle-them">No</div>
            <div class="battle-us">Yes — all 22 langs</div>
          </div>
          <div class="battle-row">
            <div class="battle-dimension">Tone</div>
            <div class="battle-them">Clinical / CBT</div>
            <div class="battle-us">Warm companion</div>
          </div>
        </div>
      </div>

      <div class="battle-card">
        <div class="battle-header" style="background:linear-gradient(135deg,#E8490A,#B83408);">
          <div class="battle-vs">Imotara vs YourDOST</div>
        </div>
        <div class="battle-body">
          <div class="battle-row">
            <div class="battle-dimension">Availability</div>
            <div class="battle-them">Schedule required</div>
            <div class="battle-us">24/7, instant</div>
          </div>
          <div class="battle-row">
            <div class="battle-dimension">Cost</div>
            <div class="battle-them">₹499/session</div>
            <div class="battle-us">₹79/month unlimited</div>
          </div>
          <div class="battle-row">
            <div class="battle-dimension">Languages</div>
            <div class="battle-them">English + some Hindi</div>
            <div class="battle-us">11 Indian languages</div>
          </div>
          <div class="battle-row">
            <div class="battle-dimension">Privacy</div>
            <div class="battle-them">Human reads session</div>
            <div class="battle-us">AI only, local storage</div>
          </div>
        </div>
      </div>

      <div class="battle-card">
        <div class="battle-header" style="background:linear-gradient(135deg,#2C7873,#1A5250);">
          <div class="battle-vs">Imotara vs Replika</div>
        </div>
        <div class="battle-body">
          <div class="battle-row">
            <div class="battle-dimension">Languages</div>
            <div class="battle-them">English only</div>
            <div class="battle-us">11 Indian + 10 global</div>
          </div>
          <div class="battle-row">
            <div class="battle-dimension">Wellness tools</div>
            <div class="battle-them">None (chat only)</div>
            <div class="battle-us">71 psychological tools</div>
          </div>
          <div class="battle-row">
            <div class="battle-dimension">Privacy</div>
            <div class="battle-them">US server storage</div>
            <div class="battle-us">Local-first, India</div>
          </div>
          <div class="battle-row">
            <div class="battle-dimension">Monthly letter</div>
            <div class="battle-them">No</div>
            <div class="battle-us">Yes — unique feature</div>
          </div>
        </div>
      </div>

    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Competitor Landscape</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 2 of 3</div>
  </div>
</div>


<!-- ══════════════════════════  PAGE 3 — POSITIONING MAP + STRATEGY  ══════════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Market Positioning Map &amp; Strategic Takeaways</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="body" style="padding-top:16px;">

    <!-- POSITIONING MAP -->
    <div class="sec">Market positioning map — Price vs Language accessibility</div>
    <div class="pos-map-wrap">
      <div class="pos-map">
        <!-- axes -->
        <div class="axis-x"></div>
        <div class="axis-y"></div>
        <!-- axis labels -->
        <div class="axis-label al-left">← English Only</div>
        <div class="axis-label al-right">Indian Languages →</div>
        <div class="axis-label al-top">↑ Expensive</div>
        <div class="axis-label al-bottom">Affordable ↓</div>
        <!-- quadrant labels -->
        <div class="quad-label ql-tl">Expensive + English Only</div>
        <div class="quad-label ql-tr">Expensive + Indian Languages</div>
        <div class="quad-label ql-bl">Cheap + English Only</div>
        <div class="quad-label ql-br">✦ Imotara's Sweet Spot</div>

        <!-- Headspace: expensive, english -->
        <div class="dot-wrap" style="left:14%;top:20%;">
          <div class="cdot" style="background:#F47C3C;"></div>
          <div class="cdot-label">Headspace / Calm</div>
        </div>
        <!-- Replika: mid-high, english -->
        <div class="dot-wrap" style="left:22%;top:40%;">
          <div class="cdot" style="background:#2C7873;"></div>
          <div class="cdot-label">Replika</div>
        </div>
        <!-- YourDOST: mid-high price, 1 Indian lang -->
        <div class="dot-wrap" style="left:34%;top:32%;">
          <div class="cdot" style="background:#E8490A;"></div>
          <div class="cdot-label">YourDOST</div>
        </div>
        <!-- Wysa: mid-high, english -->
        <div class="dot-wrap" style="left:18%;top:28%;">
          <div class="cdot" style="background:#3A6EA5;"></div>
          <div class="cdot-label">Wysa</div>
        </div>
        <!-- InnerHour: mid, english -->
        <div class="dot-wrap" style="left:25%;top:44%;">
          <div class="cdot" style="background:#5B3E8C;"></div>
          <div class="cdot-label">InnerHour</div>
        </div>
        <!-- Woebot: free, english -->
        <div class="dot-wrap" style="left:16%;top:70%;">
          <div class="cdot" style="background:#D4761A;"></div>
          <div class="cdot-label">Woebot</div>
        </div>
        <!-- BetterHelp: very expensive, english -->
        <div class="dot-wrap" style="left:10%;top:10%;">
          <div class="cdot" style="background:#B0000F;"></div>
          <div class="cdot-label">BetterHelp</div>
        </div>

        <!-- IMOTARA — the sweet spot -->
        <div class="dot-wrap" style="left:78%;top:72%;">
          <div class="cdot cdot-imotara"></div>
          <div class="cdot-label cdot-label-imotara">★ Imotara</div>
        </div>

        <!-- White space annotation -->
        <div style="position:absolute;right:6%;bottom:18%;
          border:1.5px dashed rgba(255,107,157,.5);border-radius:10px;
          padding:4px 8px;font-size:7.5px;font-weight:700;color:var(--pink);
          background:rgba(255,255,255,.85);">
          Uncontested white space
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;justify-content:center;">
        <div style="display:flex;align-items:center;gap:4px;font-size:8px;color:var(--slate);">
          <div style="width:9px;height:9px;border-radius:50%;background:var(--pink);flex-shrink:0;"></div> Imotara
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:8px;color:var(--slate);">
          <div style="width:9px;height:9px;border-radius:50%;background:#3A6EA5;flex-shrink:0;"></div> Wysa
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:8px;color:var(--slate);">
          <div style="width:9px;height:9px;border-radius:50%;background:#E8490A;flex-shrink:0;"></div> YourDOST
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:8px;color:var(--slate);">
          <div style="width:9px;height:9px;border-radius:50%;background:#5B3E8C;flex-shrink:0;"></div> InnerHour
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:8px;color:var(--slate);">
          <div style="width:9px;height:9px;border-radius:50%;background:#2C7873;flex-shrink:0;"></div> Replika
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:8px;color:var(--slate);">
          <div style="width:9px;height:9px;border-radius:50%;background:#D4761A;flex-shrink:0;"></div> Woebot
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:8px;color:var(--slate);">
          <div style="width:9px;height:9px;border-radius:50%;background:#F47C3C;flex-shrink:0;"></div> Headspace/Calm
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:8px;color:var(--slate);">
          <div style="width:9px;height:9px;border-radius:50%;background:#B0000F;flex-shrink:0;"></div> BetterHelp
        </div>
      </div>
    </div>

    <!-- MOAT STRIP -->
    <div class="moat-strip">
      <div class="moat-icon">🏰</div>
      <div style="flex:1;">
        <div class="moat-title">Imotara's competitive moat — impossible to replicate fast</div>
        <div class="moat-body">Building an emotional AI that genuinely understands 11 Indian languages — including gender-aware grammar, cultural idioms, and regional expressions — took months of engineering. A competitor can launch a Hindi button in a sprint. They cannot replicate culturally nuanced, grammatically correct, emotionally warm AI responses in Odia, Konkani, or Urdu in under a year. This is the moat.</div>
      </div>
      <div class="moat-div"></div>
      <div class="moat-stats">
        <div class="moat-stat"><div class="moat-stat-num">11</div><div class="moat-stat-lbl">Indian languages — no competitor matches</div></div>
        <div class="moat-stat"><div class="moat-stat-num">71</div><div class="moat-stat-lbl">Psychological tools — clinical depth</div></div>
        <div class="moat-stat"><div class="moat-stat-num">₹79</div><div class="moat-stat-lbl">vs avg ₹549 across all competitors</div></div>
      </div>
    </div>

    <!-- STRATEGIC TAKEAWAYS -->
    <div class="sec">Strategic takeaways for marketing (Suchismita)</div>
    <div class="takeaway-grid">
      <div class="takeaway-card" style="background:#FFF5F8;border-color:#FFD0E5;">
        <div class="takeaway-title">🗣️ Lead with language, every time</div>
        <div class="takeaway-body">Every competitor has a zero-Indian-language problem. This is the single most powerful opening line in any campaign, any market, any platform. "The only mental wellness app that speaks your language" is both true and undefendable by any competitor right now.</div>
      </div>
      <div class="takeaway-card" style="background:#EEF4FF;border-color:#C0D9F5;">
        <div class="takeaway-title">💰 The price angle is a layup vs every competitor</div>
        <div class="takeaway-body">At ₹79/month, Imotara is 7× cheaper than Wysa, 6× cheaper than one YourDOST session, and 13× cheaper than Headspace at USD pricing. Use price anchoring freely — it's objectively the most affordable full-featured wellness AI in India.</div>
      </div>
      <div class="takeaway-card" style="background:#EDFAF2;border-color:#B8EDE3;">
        <div class="takeaway-title">🔒 Privacy beats every global competitor</div>
        <div class="takeaway-body">Replika, Woebot, Headspace, and Calm all store data on US servers. Post India DPDP Act, this is a growing concern. Imotara's local-first storage ("your data stays on your phone") is a clear differentiator against all global apps — and increasingly important to Indian users.</div>
      </div>
      <div class="takeaway-card" style="background:#FFF8F0;border-color:#FFD4A8;">
        <div class="takeaway-title">📡 Offline AI opens 300M new users</div>
        <div class="takeaway-body">No competitor offers offline AI. This is not a niche feature — it's the key to reaching Tier 2/3 India where Wysa, Replika, and InnerHour simply cannot function reliably. Frame it as "Imotara works even where the internet doesn't" — it makes every competitor irrelevant in that market segment.</div>
      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Competitor Landscape</span></div>
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
