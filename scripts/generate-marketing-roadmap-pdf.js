const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

(async () => {
  const logoPath = path.resolve(__dirname, '../public/Imotara Firm.png');
  const logoB64  = fs.readFileSync(logoPath).toString('base64');
  const logoSrc  = `data:image/png;base64,${logoB64}`;

  const htmlPath = path.resolve(__dirname, '../docs/imotara-marketing-roadmap.html');
  const pdfPath  = path.resolve(__dirname, '../docs/imotara-marketing-roadmap.pdf');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Imotara — Marketing Priority Roadmap</title>
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
.body{padding:16px 36px 0;flex:1;}
.sec{font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:var(--blue);
  margin-bottom:10px;display:flex;align-items:center;gap:8px;}
.sec::after{content:'';flex:1;height:1px;background:var(--border);}

/* HERO */
.hero{background:linear-gradient(135deg,#FFF0F6 0%,#EEF4FF 50%,#EAFAF7 100%);
  border-bottom:1px solid var(--border);padding:13px 36px;
  display:flex;align-items:center;justify-content:space-between;}
.hero-title{font-size:16px;font-weight:900;color:var(--navy);line-height:1.25;}
.hero-title em{font-style:normal;background:linear-gradient(135deg,var(--pink),var(--blue));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.hero-sub{font-size:9.5px;color:var(--gray);margin-top:4px;line-height:1.5;max-width:360px;}
.hero-right{display:flex;flex-direction:column;gap:5px;align-items:flex-end;}
.hero-pill{background:var(--white);border:1px solid var(--border);border-radius:20px;
  padding:4px 12px;font-size:8.5px;font-weight:600;color:var(--navy);
  display:flex;align-items:center;gap:6px;}
.hero-pill .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}

/* PHASE BLOCK */
.phase{border-radius:14px;border:1.5px solid var(--border);overflow:hidden;margin-bottom:13px;}
.phase-header{padding:11px 18px;display:flex;align-items:center;gap:14px;}
.phase-num{font-size:28px;font-weight:900;color:rgba(255,255,255,.25);line-height:1;min-width:34px;}
.phase-title-group{}
.phase-title{font-size:13px;font-weight:900;color:var(--white);line-height:1.1;}
.phase-subtitle{font-size:9px;color:rgba(255,255,255,.65);margin-top:2px;}
.phase-timeline{margin-left:auto;background:rgba(255,255,255,.15);border-radius:12px;
  padding:4px 12px;font-size:8.5px;font-weight:700;color:#fff;white-space:nowrap;}
.phase-body{padding:12px 18px;background:var(--white);display:grid;gap:10px;}

/* TASK ROW */
.task-row{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:flex-start;
  padding:7px 10px;border-radius:8px;border:1px solid var(--border);}
.task-priority{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;
  justify-content:center;font-size:9px;font-weight:800;color:#fff;flex-shrink:0;}
.p1{background:var(--red);}
.p2{background:var(--orange);}
.p3{background:var(--blue);}
.p4{background:var(--gray);}
.task-content{}
.task-title{font-size:10px;font-weight:700;color:var(--navy);line-height:1.2;}
.task-desc{font-size:8.5px;color:var(--slate);line-height:1.4;margin-top:2px;}
.task-tags{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;}
.tag{font-size:7.5px;font-weight:600;padding:2px 7px;border-radius:8px;}
.task-effort{text-align:right;flex-shrink:0;min-width:52px;}
.effort-label{font-size:7px;color:var(--gray);text-transform:uppercase;letter-spacing:.4px;}
.effort-bars{display:flex;gap:2px;margin-top:3px;justify-content:flex-end;}
.ebar{width:10px;height:6px;border-radius:2px;background:var(--border);}
.ebar.on{background:var(--teal);}

/* COLS 2 and 3 */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:13px;}
.three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:13px;}

/* CHANNEL BLOCK */
.channel-block{border:1px solid var(--border);border-radius:12px;overflow:hidden;}
.channel-header{padding:9px 14px;display:flex;align-items:center;gap:8px;}
.channel-icon{font-size:18px;flex-shrink:0;}
.channel-name{font-size:11px;font-weight:800;color:#fff;}
.channel-type{font-size:8px;color:rgba(255,255,255,.6);margin-top:1px;}
.channel-body{padding:10px 14px;background:var(--white);}
.channel-metric{display:flex;justify-content:space-between;margin-bottom:7px;padding-bottom:7px;border-bottom:1px solid var(--border);}
.cm-label{font-size:8px;color:var(--gray);}
.cm-value{font-size:8.5px;font-weight:700;color:var(--navy);}
.channel-tactic{font-size:8.5px;color:var(--slate);line-height:1.5;}
.channel-tactic li{margin-left:12px;margin-bottom:2px;}

/* PLATFORM COLORS */
.ph-instagram{background:linear-gradient(135deg,#E1306C,#833AB4,#FD1D1D);}
.ph-facebook{background:linear-gradient(135deg,#1877F2,#0D5FBF);}
.ph-youtube{background:linear-gradient(135deg,#FF0000,#CC0000);}
.ph-whatsapp{background:linear-gradient(135deg,#25D366,#128C7E);}
.ph-x{background:linear-gradient(135deg,#000,#1a1a1a);}
.ph-linkedin{background:linear-gradient(135deg,#0A66C2,#004182);}
.ph-google{background:linear-gradient(135deg,#4285F4,#34A853,#FBBC05,#EA4335);}
.ph-sharechat{background:linear-gradient(135deg,#E8670A,#C04A00);}
.ph-pinterest{background:linear-gradient(135deg,#E60023,#AD081B);}
.ph-influencer{background:linear-gradient(135deg,var(--purple),#5B1A8C);}
.ph-pr{background:linear-gradient(135deg,var(--teal),var(--blue));}
.ph-email{background:linear-gradient(135deg,var(--navy),var(--navy2));}
.ph-aso{background:linear-gradient(135deg,#555,#222);}
.ph-community{background:linear-gradient(135deg,var(--green),#1B8C4A);}

/* KPI TABLE */
.kpi-table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:12px;}
.kpi-table thead th{background:var(--navy);color:#fff;padding:7px 10px;text-align:center;font-size:8.5px;}
.kpi-table thead th:first-child{text-align:left;border-radius:7px 0 0 0;}
.kpi-table thead th:last-child{border-radius:0 7px 0 0;}
.kpi-table tbody td{padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);}
.kpi-table tbody td:first-child{text-align:left;font-weight:600;color:var(--navy);}
.kpi-table tbody tr:nth-child(even) td{background:var(--light);}
.kpi-table tbody tr:last-child td{border-bottom:none;}

/* GANTT-STYLE TIMELINE */
.timeline-wrap{margin-bottom:13px;}
.timeline-row{display:grid;grid-template-columns:120px 1fr;gap:8px;align-items:center;margin-bottom:5px;}
.tl-label{font-size:8.5px;font-weight:600;color:var(--navy);text-align:right;padding-right:4px;}
.tl-track{height:20px;background:var(--light);border-radius:6px;position:relative;display:flex;align-items:center;}
.tl-bar{height:16px;border-radius:5px;margin:2px;position:absolute;display:flex;align-items:center;padding:0 6px;}
.tl-bar-label{font-size:7px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;}
.tl-months{display:grid;grid-template-columns:120px repeat(6,1fr);gap:8px;margin-bottom:3px;}
.tl-month{font-size:7.5px;color:var(--gray);text-align:center;font-weight:600;}

/* BUDGET TABLE */
.budget-table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:12px;}
.budget-table thead th{background:var(--navy);color:#fff;padding:7px 10px;font-size:8.5px;text-align:center;}
.budget-table thead th:first-child{text-align:left;border-radius:7px 0 0 0;}
.budget-table thead th:last-child{border-radius:0 7px 0 0;}
.budget-table tbody td{padding:6px 10px;border-bottom:1px solid var(--border);color:var(--slate);text-align:center;}
.budget-table tbody td:first-child{text-align:left;font-weight:600;color:var(--navy);}
.budget-table tbody tr:last-child td{border-bottom:none;font-weight:700;background:var(--light);color:var(--navy);}
.budget-table tbody tr:nth-child(even) td{background:var(--light);}

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

<!-- ══════════════════════════════  PAGE 1 — OVERVIEW + PHASES 1 & 2  ══════════════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Marketing Priority Roadmap — All Channels, All Phases</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="hero">
    <div>
      <div class="hero-title">Full-funnel marketing plan.<br/><em>From zero to scale.</em></div>
      <div class="hero-sub">4 phases · 60+ tactics · 15 platforms · digital, social, influencer, PR, community, and paid. Sequenced by impact and budget so every rupee works hardest first.</div>
    </div>
    <div class="hero-right">
      <div class="hero-pill"><span class="dot" style="background:var(--red)"></span> Phase 1 — Foundation (Month 1–2)</div>
      <div class="hero-pill"><span class="dot" style="background:var(--orange)"></span> Phase 2 — Build (Month 2–4)</div>
      <div class="hero-pill"><span class="dot" style="background:var(--blue)"></span> Phase 3 — Scale (Month 3–6)</div>
      <div class="hero-pill"><span class="dot" style="background:var(--purple)"></span> Phase 4 — Amplify (Month 6+)</div>
    </div>
  </div>

  <div class="body">

    <!-- PHASE 1 -->
    <div class="phase">
      <div class="phase-header" style="background:linear-gradient(135deg,#B22020,#8C1515);">
        <div class="phase-num">01</div>
        <div class="phase-title-group">
          <div class="phase-title">Foundation — Zero-cost, highest impact</div>
          <div class="phase-subtitle">App stores · organic social setup · review management · free listings · product triggers</div>
        </div>
        <div class="phase-timeline">Month 1 – 2</div>
      </div>
      <div class="phase-body" style="grid-template-columns:1fr 1fr;">

        <div class="task-row">
          <div class="task-priority p1">P1</div>
          <div class="task-content">
            <div class="task-title">In-app rating prompt after 3rd session</div>
            <div class="task-desc">Ratings are the #1 App Store ranking signal. Trigger a gentle prompt after the user has had 3 emotionally positive sessions. Target: 4.5+ stars on both stores.</div>
            <div class="task-tags">
              <span class="tag" style="background:#EEF4FF;color:var(--navy2);">iOS App Store</span>
              <span class="tag" style="background:#E8F5E9;color:#1B5E20;">Google Play</span>
              <span class="tag" style="background:#FFF3E0;color:#E65100;">In-app</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p1">P1</div>
          <div class="task-content">
            <div class="task-title">Screenshot overlays — all 5 key screens</div>
            <div class="task-desc">Redesign store screenshots with bold text overlays ("Apni bhasha mein baat karo", "No ads. No data selling."). Add for iOS, Android, and Play Feature Graphic.</div>
            <div class="task-tags">
              <span class="tag" style="background:#EEF4FF;color:var(--navy2);">iOS</span>
              <span class="tag" style="background:#E8F5E9;color:#1B5E20;">Android</span>
              <span class="tag" style="background:#FFF9C4;color:#7B5C00;">Design</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p1">P1</div>
          <div class="task-content">
            <div class="task-title">Play Store tags + App Store category</div>
            <div class="task-desc">Add tags: Wellness, Mental Health, Journaling, Mood Tracker, AI Chat. Switch App Store category to Health &amp; Fitness (Medical subcategory) for lower competition.</div>
            <div class="task-tags">
              <span class="tag" style="background:#E8F5E9;color:#1B5E20;">Google Play</span>
              <span class="tag" style="background:#EEF4FF;color:var(--navy2);">iOS ASO</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p1">P1</div>
          <div class="task-content">
            <div class="task-title">Reply to every App Store &amp; Play Store review</div>
            <div class="task-desc">Respond to all reviews within 48 hours. Both Google and Apple boost ranking for apps with active developer responses. Template: empathise → solve → invite re-review.</div>
            <div class="task-tags">
              <span class="tag" style="background:#EEF4FF;color:var(--navy2);">iOS</span>
              <span class="tag" style="background:#E8F5E9;color:#1B5E20;">Android</span>
              <span class="tag" style="background:#FFF9C4;color:#7B5C00;">Ongoing</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p1">P1</div>
          <div class="task-content">
            <div class="task-title">AlternativeTo, Product Hunt (prep) + BetaList listing</div>
            <div class="task-desc">Submit to AlternativeTo as alternative to Wysa/Replika/Headspace. Prepare Product Hunt launch assets (tagline, GIF demo, maker story). List on BetaList for early adopters.</div>
            <div class="task-tags">
              <span class="tag" style="background:#F5F0FF;color:#5C3D9E;">AlternativeTo</span>
              <span class="tag" style="background:#FFF3E0;color:#E65100;">Product Hunt</span>
              <span class="tag" style="background:#EDFAF2;color:#1B6B44;">BetaList</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p1">P1</div>
          <div class="task-content">
            <div class="task-title">Set up Instagram, Facebook, X, YouTube &amp; LinkedIn pages</div>
            <div class="task-desc">Create official Imotara pages on all platforms. Consistent profile — same logo, bio, and link. Pin one high-quality intro post on each. Add Play Store + App Store links in all bios.</div>
            <div class="task-tags">
              <span class="tag" style="background:#FCE4EC;color:#880E4F;">Instagram</span>
              <span class="tag" style="background:#E3F2FD;color:#0D47A1;">Facebook</span>
              <span class="tag" style="background:#F5F5F5;color:#212121;">X</span>
              <span class="tag" style="background:#FFEBEE;color:#B71C1C;">YouTube</span>
              <span class="tag" style="background:#E3F2FD;color:#0D47A1;">LinkedIn</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar"></div></div>
          </div>
        </div>

      </div>
    </div>

    <!-- PHASE 2 -->
    <div class="phase">
      <div class="phase-header" style="background:linear-gradient(135deg,#B85A00,#8C3E00);">
        <div class="phase-num">02</div>
        <div class="phase-title-group">
          <div class="phase-title">Build — Organic content + community + ASO localisation</div>
          <div class="phase-subtitle">Content calendar · regional store listings · WhatsApp strategy · SEO blog · community seeding</div>
        </div>
        <div class="phase-timeline">Month 2 – 4</div>
      </div>
      <div class="phase-body" style="grid-template-columns:1fr 1fr;">

        <div class="task-row">
          <div class="task-priority p2">P2</div>
          <div class="task-content">
            <div class="task-title">Hindi + Bengali + Tamil regional store listings</div>
            <div class="task-desc">Translate app title, description, keywords into Hindi, Bengali, Tamil, Telugu, Marathi. 5 separate language-targeted listings. No competitor does this — instant organic advantage in 500M+ speaker segment.</div>
            <div class="task-tags">
              <span class="tag" style="background:#E8F5E9;color:#1B5E20;">Google Play</span>
              <span class="tag" style="background:#EEF4FF;color:var(--navy2);">iOS ASO</span>
              <span class="tag" style="background:#FFF9C4;color:#7B5C00;">Hindi</span>
              <span class="tag" style="background:#FFF9C4;color:#7B5C00;">Bengali</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p2">P2</div>
          <div class="task-content">
            <div class="task-title">Instagram content calendar (3×/week)</div>
            <div class="task-desc">Reels: "5 signs you need emotional support today" · "What type of Imotara companion are you?" · Mood check-in polls. Carousels: mental health tips in Hindi. Stories: daily micro-check-ins.</div>
            <div class="task-tags">
              <span class="tag" style="background:#FCE4EC;color:#880E4F;">Instagram Reels</span>
              <span class="tag" style="background:#FCE4EC;color:#880E4F;">Stories</span>
              <span class="tag" style="background:#FCE4EC;color:#880E4F;">Carousels</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p2">P2</div>
          <div class="task-content">
            <div class="task-title">YouTube Shorts (2×/week) + 1 long-form/month</div>
            <div class="task-desc">Shorts: "How Imotara responds in Hindi", "3 AM anxiety — what Imotara says", "60-second breathing exercise". Long-form: "I used a Hindi AI therapist for 30 days — here's what happened."</div>
            <div class="task-tags">
              <span class="tag" style="background:#FFEBEE;color:#B71C1C;">YouTube Shorts</span>
              <span class="tag" style="background:#FFEBEE;color:#B71C1C;">Long-form</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p2">P2</div>
          <div class="task-content">
            <div class="task-title">WhatsApp Business + broadcast strategy</div>
            <div class="task-desc">Set up WhatsApp Business with automated welcome message + store links. Create a "Daily Wellness" broadcast list. Share a 60-second Hindi audio wellness tip 3×/week. Build to 1,000 subscribers before paid WhatsApp ads.</div>
            <div class="task-tags">
              <span class="tag" style="background:#E8F5E9;color:#1B5E20;">WhatsApp Business</span>
              <span class="tag" style="background:#E8F5E9;color:#1B5E20;">Broadcast</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p2">P2</div>
          <div class="task-content">
            <div class="task-title">Facebook Groups + community seeding</div>
            <div class="task-desc">Join and contribute value to: mental health India groups, Indian expat groups, working women groups, parenting groups, Hindi-speaking communities. Share Imotara only after building presence. Create an "Imotara Users" group.</div>
            <div class="task-tags">
              <span class="tag" style="background:#E3F2FD;color:#0D47A1;">Facebook Groups</span>
              <span class="tag" style="background:#EDFAF2;color:#1B6B44;">Community</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p2">P2</div>
          <div class="task-content">
            <div class="task-title">SEO blog — 4 articles + LinkedIn thought leadership</div>
            <div class="task-desc">Target: "best mental health app India 2026", "Hindi mental wellness app", "AI therapy alternative India". LinkedIn: 2×/week posts on emotional wellness at work. Quora answers on mental health India questions.</div>
            <div class="task-tags">
              <span class="tag" style="background:#E8F5E9;color:#1B5E20;">SEO Blog</span>
              <span class="tag" style="background:#E3F2FD;color:#0D47A1;">LinkedIn</span>
              <span class="tag" style="background:#FFF9C4;color:#7B5C00;">Quora</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Marketing Priority Roadmap</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 1 of 4</div>
  </div>
</div>


<!-- ══════════════════════════════  PAGE 2 — PHASES 3 & 4  ══════════════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Marketing Priority Roadmap — Scale &amp; Amplify</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="body" style="padding-top:14px;">

    <!-- PHASE 3 -->
    <div class="phase">
      <div class="phase-header" style="background:linear-gradient(135deg,#1A5C8F,#0E3D6E);">
        <div class="phase-num">03</div>
        <div class="phase-title-group">
          <div class="phase-title">Scale — Influencers · PR · Product Hunt · ShareChat · X</div>
          <div class="phase-subtitle">Regional creators · press coverage · Pinterest · email marketing · referral programme · Threads</div>
        </div>
        <div class="phase-timeline">Month 3 – 6</div>
      </div>
      <div class="phase-body" style="grid-template-columns:1fr 1fr;">

        <div class="task-row">
          <div class="task-priority p3">P3</div>
          <div class="task-content">
            <div class="task-title">Regional influencer outreach — 10 creators</div>
            <div class="task-desc">Target: 5 Hindi creators (200k–1M followers, mental health / self-care / student life), 3 Bengali creators, 2 Tamil/Telugu creators. Offer free Pro + ₹3–5k per dedicated Reel or YouTube video. Track with UTM links + promo codes.</div>
            <div class="task-tags">
              <span class="tag" style="background:#FCE4EC;color:#880E4F;">Instagram</span>
              <span class="tag" style="background:#FFEBEE;color:#B71C1C;">YouTube</span>
              <span class="tag" style="background:#F5F0FF;color:#5C3D9E;">Influencer</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p3">P3</div>
          <div class="task-content">
            <div class="task-title">Product Hunt launch day — full campaign</div>
            <div class="task-desc">Coordinate maker post + 50+ upvotes from day-1 supporters. Share to all channels simultaneously. Submit to "Mental Health" and "AI" collections. Aim for Top 5 of the Day. Huge English-tech-audience exposure.</div>
            <div class="task-tags">
              <span class="tag" style="background:#FFF3E0;color:#E65100;">Product Hunt</span>
              <span class="tag" style="background:#EEF4FF;color:var(--navy2);">Launch Event</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p3">P3</div>
          <div class="task-content">
            <div class="task-title">Press outreach — YourStory, Inc42, Hindustan Times Tech</div>
            <div class="task-desc">Pitch angle: "The only mental health AI that speaks 11 Indian languages — and it's ₹79/month." Send personalised pitches to 8 tech journalists. Offer exclusive demo + founder interview. Target: 3 feature articles in Month 4.</div>
            <div class="task-tags">
              <span class="tag" style="background:#EDFAF2;color:#1B6B44;">YourStory</span>
              <span class="tag" style="background:#EEF4FF;color:var(--navy2);">Inc42</span>
              <span class="tag" style="background:#FFF9C4;color:#7B5C00;">The Ken</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p3">P3</div>
          <div class="task-content">
            <div class="task-title">ShareChat + Moj + Josh — regional short-video</div>
            <div class="task-desc">ShareChat has 250M+ users who prefer Hindi/regional content. Post same wellness content adapted for regional audiences. Partner with 2–3 regional creators who are already active on these platforms. No competitor is here yet.</div>
            <div class="task-tags">
              <span class="tag" style="background:#FFF3E0;color:#8C3E00;">ShareChat</span>
              <span class="tag" style="background:#FFF3E0;color:#8C3E00;">Moj</span>
              <span class="tag" style="background:#FFF3E0;color:#8C3E00;">Josh</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p3">P3</div>
          <div class="task-content">
            <div class="task-title">X (Twitter) — mental health conversations + threads</div>
            <div class="task-desc">Post 5×/week. Format: "Thread: 5 signs of quiet burnout 🧵", polls ("What do you do when anxious at 2 AM?"), live-tweet World Mental Health Day (Oct 10). Engage with Indian mental health professionals. Use hashtags: #MentalHealthIndia #ManoSwasthya.</div>
            <div class="task-tags">
              <span class="tag" style="background:#F5F5F5;color:#212121;">X Threads</span>
              <span class="tag" style="background:#F5F5F5;color:#212121;">Polls</span>
              <span class="tag" style="background:#F5F5F5;color:#212121;">Hashtags</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p3">P3</div>
          <div class="task-content">
            <div class="task-title">Email marketing + in-app push notification campaigns</div>
            <div class="task-desc">Weekly "Wellness Wednesday" email to registered users: 1 tip, 1 feature spotlight, 1 testimonial. Push campaigns: World Mental Health Day (Oct 10), New Year (Jan 1), Holi/Diwali cultural hooks. Re-engagement push after 7 days of inactivity.</div>
            <div class="task-tags">
              <span class="tag" style="background:#EEF4FF;color:var(--navy2);">Email</span>
              <span class="tag" style="background:#E8F5E9;color:#1B5E20;">Push Notifications</span>
              <span class="tag" style="background:#FFF9C4;color:#7B5C00;">Re-engagement</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p3">P3</div>
          <div class="task-content">
            <div class="task-title">Pinterest boards — emotional wellness + Indian culture</div>
            <div class="task-desc">Create boards: "Mindful Mornings India", "Hindi Wellness Quotes", "Signs You Need Emotional Support", "Indian Self-Care Rituals". Pin infographics daily. Pinterest drives high organic reach for wellness content among 25–40 women.</div>
            <div class="task-tags">
              <span class="tag" style="background:#FFEBEE;color:#B71C1C;">Pinterest</span>
              <span class="tag" style="background:#FCE4EC;color:#880E4F;">Infographics</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar"></div></div>
          </div>
        </div>

        <div class="task-row">
          <div class="task-priority p3">P3</div>
          <div class="task-content">
            <div class="task-title">Referral programme — "Give a month, get a month"</div>
            <div class="task-desc">In-app referral: share a code → both user and friend get 1 month Plus free. Share to WhatsApp in 2 taps. Track via unique codes per user. This is the single highest-ROI growth lever once the base user count reaches 5,000+.</div>
            <div class="task-tags">
              <span class="tag" style="background:#EDFAF2;color:#1B6B44;">Referral</span>
              <span class="tag" style="background:#E8F5E9;color:#1B5E20;">WhatsApp Share</span>
              <span class="tag" style="background:#FFF3E0;color:#E65100;">Viral</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

      </div>
    </div>

    <!-- PHASE 4 -->
    <div class="phase">
      <div class="phase-header" style="background:linear-gradient(135deg,#5B1A8C,#3D0070);">
        <div class="phase-num">04</div>
        <div class="phase-title-group">
          <div class="phase-title">Amplify — Paid ads · partnerships · enterprise · events</div>
          <div class="phase-subtitle">Meta ads · Google UAC · Apple Search Ads · college partnerships · corporate wellness · NGO tie-ups · Snapchat</div>
        </div>
        <div class="phase-timeline">Month 6+</div>
      </div>
      <div class="phase-body" style="grid-template-columns:1fr 1fr 1fr;">

        <div class="task-row" style="grid-column:span 1;">
          <div class="task-priority p4">P4</div>
          <div class="task-content">
            <div class="task-title">Meta Ads (Facebook + Instagram)</div>
            <div class="task-desc">Start ₹10–15k/month. Target: Urban India, 22–35, mental health / wellness interests. A/B test 3 creatives: price anchor, language moat, privacy angle. Retarget website + app visitors.</div>
            <div class="task-tags">
              <span class="tag" style="background:#E3F2FD;color:#0D47A1;">Facebook Ads</span>
              <span class="tag" style="background:#FCE4EC;color:#880E4F;">Instagram Ads</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

        <div class="task-row" style="grid-column:span 1;">
          <div class="task-priority p4">P4</div>
          <div class="task-content">
            <div class="task-title">Google UAC + Apple Search Ads</div>
            <div class="task-desc">Google App Campaigns: "emotional support", "mental wellness hindi", "mood journal india". Apple Search Ads: "therapy alternative", "mood tracker". Budget: ₹8–12k/month initially. Scale on CPI &lt; ₹40.</div>
            <div class="task-tags">
              <span class="tag" style="background:#E3F2FD;color:#0D47A1;">Google UAC</span>
              <span class="tag" style="background:#EEF4FF;color:var(--navy2);">Apple Search Ads</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

        <div class="task-row" style="grid-column:span 1;">
          <div class="task-priority p4">P4</div>
          <div class="task-content">
            <div class="task-title">YouTube Ads + Snapchat (18–24)</div>
            <div class="task-desc">YouTube pre-roll on mental health, student, and lifestyle channels. 6-second bumper ads + 15-second skippable. Snapchat Story Ads for 18–24 urban audience — vertical video, download CTA.</div>
            <div class="task-tags">
              <span class="tag" style="background:#FFEBEE;color:#B71C1C;">YouTube Ads</span>
              <span class="tag" style="background:#FCE4EC;color:#880E4F;">Snapchat Ads</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

        <div class="task-row" style="grid-column:span 1;">
          <div class="task-priority p4">P4</div>
          <div class="task-content">
            <div class="task-title">Corporate wellness partnerships (B2B)</div>
            <div class="task-desc">Pitch HR heads at 20 Bengaluru/Mumbai startups with 50–500 employees. Offer "Employee Wellness Pack" — bulk Pro licenses at ₹59/seat/month. LinkedIn outreach + email drip campaign targeting HR/People Ops roles.</div>
            <div class="task-tags">
              <span class="tag" style="background:#E3F2FD;color:#0D47A1;">LinkedIn</span>
              <span class="tag" style="background:#EDFAF2;color:#1B6B44;">B2B</span>
              <span class="tag" style="background:#EEF4FF;color:var(--navy2);">Enterprise</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

        <div class="task-row" style="grid-column:span 1;">
          <div class="task-priority p4">P4</div>
          <div class="task-content">
            <div class="task-title">NGO &amp; college wellness partnerships</div>
            <div class="task-desc">Approach 10 NGOs (women's welfare, rural youth) for bulk subsidised licensing. Partner with 5 college counselling departments for free bulk student access. These create press-worthy stories + organic word-of-mouth at scale.</div>
            <div class="task-tags">
              <span class="tag" style="background:#EDFAF2;color:#1B6B44;">NGO</span>
              <span class="tag" style="background:#F5F0FF;color:#5C3D9E;">EDU</span>
              <span class="tag" style="background:#FFF9C4;color:#7B5C00;">Partnership</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

        <div class="task-row" style="grid-column:span 1;">
          <div class="task-priority p4">P4</div>
          <div class="task-content">
            <div class="task-title">World Mental Health Day campaign (Oct 10)</div>
            <div class="task-desc">Full multi-channel campaign: Free Plus for 24 hours → press release → coordinated post across all platforms → influencer posts same day → email blast → push notification. Aim: 10,000 new installs in one day.</div>
            <div class="task-tags">
              <span class="tag" style="background:#FCE4EC;color:#880E4F;">Instagram</span>
              <span class="tag" style="background:#E3F2FD;color:#0D47A1;">Facebook</span>
              <span class="tag" style="background:#FFEBEE;color:#B71C1C;">YouTube</span>
              <span class="tag" style="background:#E8F5E9;color:#1B5E20;">WhatsApp</span>
            </div>
          </div>
          <div class="task-effort"><div class="effort-label">Effort</div>
            <div class="effort-bars"><div class="ebar on"></div><div class="ebar on"></div><div class="ebar on"></div></div>
          </div>
        </div>

      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Marketing Priority Roadmap</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 2 of 4</div>
  </div>
</div>


<!-- ══════════════════════════════  PAGE 3 — PLATFORM-BY-PLATFORM SOCIAL MEDIA GUIDE  ══════════════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Platform-by-Platform Social Media &amp; Digital Playbook</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="body" style="padding-top:14px;">

    <div class="sec">Social media — platform-by-platform tactics</div>
    <div class="three-col">

      <div class="channel-block">
        <div class="channel-header ph-instagram">
          <div class="channel-icon">📸</div>
          <div><div class="channel-name">Instagram</div><div class="channel-type">Primary growth engine</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Target audience</span><span class="cm-value">18–35, urban India</span>
          </div>
          <ul class="channel-tactic">
            <li><b>Reels 4×/week</b> — emotional wellness tips, Hindi + English</li>
            <li><b>Stories daily</b> — polls ("How do you feel today?"), quizzes</li>
            <li><b>Carousels 2×/week</b> — "Signs of burnout", "5 grounding techniques"</li>
            <li><b>Collab posts</b> with mental health influencers</li>
            <li><b>IG Live</b> — monthly "Ask the companion" Q&amp;A</li>
            <li><b>Highlights</b> — Features / Pricing / Download / Reviews</li>
          </ul>
        </div>
      </div>

      <div class="channel-block">
        <div class="channel-header ph-facebook">
          <div class="channel-icon">👍</div>
          <div><div class="channel-name">Facebook</div><div class="channel-type">Community + Regional India</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Target audience</span><span class="cm-value">25–45, Tier 2/3 India</span>
          </div>
          <ul class="channel-tactic">
            <li><b>Page posts 3×/week</b> — Hindi wellness content</li>
            <li><b>Facebook Groups</b> — seed content in mental health + parenting groups</li>
            <li><b>Create "Imotara Users" group</b> — community space</li>
            <li><b>Facebook Live</b> — fortnightly wellness sessions in Hindi</li>
            <li><b>Paid Ads</b> (Phase 4) — lookalike + interest targeting</li>
            <li><b>Share Hindi audio clips</b> — Imotara voice in regional languages</li>
          </ul>
        </div>
      </div>

      <div class="channel-block">
        <div class="channel-header ph-youtube">
          <div class="channel-icon">▶️</div>
          <div><div class="channel-name">YouTube</div><div class="channel-type">SEO + Long-form trust</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Target audience</span><span class="cm-value">18–30, students + professionals</span>
          </div>
          <ul class="channel-tactic">
            <li><b>Shorts 3×/week</b> — "How Imotara replied in Hindi", "3 AM check-in"</li>
            <li><b>Long-form 1×/month</b> — "30-day AI therapy experiment"</li>
            <li><b>Hindi channel</b> — separate playlist for regional content</li>
            <li><b>Testimonial videos</b> — real users sharing experience</li>
            <li><b>Ads</b> — pre-roll on mental health, JEE prep, lifestyle channels</li>
            <li><b>SEO titles</b> — "Hindi mental health app India 2026"</li>
          </ul>
        </div>
      </div>

      <div class="channel-block">
        <div class="channel-header ph-whatsapp">
          <div class="channel-icon">💬</div>
          <div><div class="channel-name">WhatsApp</div><div class="channel-type">India's #1 messaging platform</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Target audience</span><span class="cm-value">All ages, all tiers</span>
          </div>
          <ul class="channel-tactic">
            <li><b>WhatsApp Business</b> — auto-reply with download links</li>
            <li><b>Broadcast list</b> — 3×/week wellness tip + app update</li>
            <li><b>Status content</b> — 60-second Hindi wellness audio clips</li>
            <li><b>In-app "Share to WhatsApp"</b> — referral codes</li>
            <li><b>Group seeding</b> — mom groups, college groups, office groups</li>
            <li><b>WhatsApp Ads</b> via Meta Ads Manager (Phase 4)</li>
          </ul>
        </div>
      </div>

      <div class="channel-block">
        <div class="channel-header ph-x">
          <div class="channel-icon">𝕏</div>
          <div><div class="channel-name">X (Twitter)</div><div class="channel-type">Thought leadership + press</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Target audience</span><span class="cm-value">22–38, tech-savvy, journalists</span>
          </div>
          <ul class="channel-tactic">
            <li><b>Threads 2×/week</b> — "5 quiet signs of burnout", "How to talk to your AI"</li>
            <li><b>Polls daily</b> — "What time do you feel most anxious?"</li>
            <li><b>Reply to mental health conversations</b> — add Imotara angle</li>
            <li><b>Follow + engage</b> journalists at YourStory, Inc42, TOI</li>
            <li><b>Hashtags</b>: #MentalHealthIndia #AIWellness #ManoSwasthya</li>
            <li><b>Product Hunt countdown</b> thread day before launch</li>
          </ul>
        </div>
      </div>

      <div class="channel-block">
        <div class="channel-header ph-linkedin">
          <div class="channel-icon">💼</div>
          <div><div class="channel-name">LinkedIn</div><div class="channel-type">B2B + HR + press outreach</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Target audience</span><span class="cm-value">HR, founders, 25–45 professionals</span>
          </div>
          <ul class="channel-tactic">
            <li><b>Founder posts 3×/week</b> — building Imotara, mental health at work</li>
            <li><b>Company page</b> — product updates, user stories, team posts</li>
            <li><b>Articles</b> — "Why Indian employees won't talk to HR about mental health"</li>
            <li><b>Direct outreach</b> to HR heads for corporate wellness pilots</li>
            <li><b>LinkedIn Ads</b> (Phase 4) — target HR/People Ops by company size</li>
            <li><b>Thought leadership</b> — comment on mental health at work posts</li>
          </ul>
        </div>
      </div>

    </div>

    <div class="sec">Digital marketing — paid, SEO &amp; performance</div>
    <div class="three-col">

      <div class="channel-block">
        <div class="channel-header ph-google">
          <div class="channel-icon">🔍</div>
          <div><div class="channel-name">Google — SEO + Ads</div><div class="channel-type">Search intent capture</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Budget (Phase 4)</span><span class="cm-value">₹8–12k/month</span>
          </div>
          <ul class="channel-tactic">
            <li><b>SEO blog</b> — 2 articles/month targeting high-intent keywords</li>
            <li><b>Google UAC</b> — automated app install campaigns</li>
            <li><b>Search Ads</b> — "therapy alternative India", "Hindi wellness app"</li>
            <li><b>Display retargeting</b> — users who visited imotara.com</li>
            <li><b>YouTube Pre-roll</b> — 15s non-skippable on mental health content</li>
          </ul>
        </div>
      </div>

      <div class="channel-block">
        <div class="channel-header ph-sharechat">
          <div class="channel-icon">🎬</div>
          <div><div class="channel-name">ShareChat + Moj + Josh</div><div class="channel-type">Regional India short video</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Audience size</span><span class="cm-value">250M+ regional users</span>
          </div>
          <ul class="channel-tactic">
            <li><b>Hindi/Bengali/Tamil content</b> — same wellness Reels adapted</li>
            <li><b>Partner with 3 regional creators</b> who are native to these platforms</li>
            <li><b>No competitor is here</b> — first-mover advantage in regional short video</li>
            <li><b>ShareChat Ads</b> (Phase 4) — very low CPM vs Instagram</li>
            <li><b>Daily upload</b> — regional wellness quotes + tips</li>
          </ul>
        </div>
      </div>

      <div class="channel-block">
        <div class="channel-header ph-email">
          <div class="channel-icon">📧</div>
          <div><div class="channel-name">Email + Push Notifications</div><div class="channel-type">Retention + re-engagement</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Target open rate</span><span class="cm-value">&gt;30%</span>
          </div>
          <ul class="channel-tactic">
            <li><b>Welcome sequence</b> — 5-email onboarding for new signups</li>
            <li><b>"Wellness Wednesday"</b> — weekly email: tip + feature + story</li>
            <li><b>Monthly companion letter preview</b> — teaser to drive app opens</li>
            <li><b>Re-engagement push</b> — after 7 days of inactivity</li>
            <li><b>Festival campaigns</b> — Diwali, New Year, World Mental Health Day</li>
          </ul>
        </div>
      </div>

    </div>

    <div class="sec">Additional channels — influencer, PR, community</div>
    <div class="three-col">

      <div class="channel-block">
        <div class="channel-header ph-influencer">
          <div class="channel-icon">🌟</div>
          <div><div class="channel-name">Influencer Marketing</div><div class="channel-type">Trust + regional reach</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Budget</span><span class="cm-value">₹3–5k per Reel</span>
          </div>
          <ul class="channel-tactic">
            <li><b>Tier 1</b> — 2 Hindi creators (500k–1M followers)</li>
            <li><b>Tier 2</b> — 5 micro-creators (50k–200k) in mental health niche</li>
            <li><b>Tier 3</b> — 10 nano-creators (5k–50k) in regional languages</li>
            <li><b>College creators</b> — hostel-life, student wellness accounts</li>
            <li><b>Track with UTM links</b> + unique promo codes per creator</li>
          </ul>
        </div>
      </div>

      <div class="channel-block">
        <div class="channel-header ph-pr">
          <div class="channel-icon">📰</div>
          <div><div class="channel-name">PR &amp; Press</div><div class="channel-type">Credibility + backlinks</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Target</span><span class="cm-value">3 features in Month 4</span>
          </div>
          <ul class="channel-tactic">
            <li><b>YourStory</b> — founder story + "building for Bharat"</li>
            <li><b>Inc42</b> — mental health market opportunity + Imotara stats</li>
            <li><b>The Ken</b> — privacy angle, local-first story</li>
            <li><b>Hindustan Times Tech</b> — regional language AI story</li>
            <li><b>Product Hunt</b> — Top 5 of Day target = 50k+ exposure</li>
          </ul>
        </div>
      </div>

      <div class="channel-block">
        <div class="channel-header ph-community">
          <div class="channel-icon">🤝</div>
          <div><div class="channel-name">Community &amp; Reddit</div><div class="channel-type">Organic word-of-mouth</div></div>
        </div>
        <div class="channel-body">
          <div class="channel-metric">
            <span class="cm-label">Cost</span><span class="cm-value">Zero — time only</span>
          </div>
          <ul class="channel-tactic">
            <li><b>r/india + r/bangalore + r/delhi</b> — share as user, not brand</li>
            <li><b>r/mentalhealth_india</b> — answer questions genuinely</li>
            <li><b>Quora</b> — answer "best mental health app India" questions</li>
            <li><b>Discord servers</b> — student, developer, wellness communities</li>
            <li><b>Threads (Meta)</b> — casual, behind-the-scenes brand voice</li>
          </ul>
        </div>
      </div>

    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Marketing Priority Roadmap</span></div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 3 of 4</div>
  </div>
</div>


<!-- ══════════════════════════════  PAGE 4 — TIMELINE + BUDGET + KPIs  ══════════════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">6-Month Timeline, Budget &amp; Success KPIs</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="body" style="padding-top:14px;">

    <!-- GANTT TIMELINE -->
    <div class="sec">6-month execution timeline</div>
    <div class="timeline-wrap">
      <div class="tl-months">
        <div></div>
        <div class="tl-month">Month 1</div>
        <div class="tl-month">Month 2</div>
        <div class="tl-month">Month 3</div>
        <div class="tl-month">Month 4</div>
        <div class="tl-month">Month 5</div>
        <div class="tl-month">Month 6</div>
      </div>
      <div class="timeline-row"><div class="tl-label">In-app rating prompt</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--red);left:0%;width:16%;"><div class="tl-bar-label">Setup</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">Store screenshots</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--red);left:0%;width:33%;"><div class="tl-bar-label">Design + publish</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">Social pages setup</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--red);left:0%;width:16%;"><div class="tl-bar-label">All platforms</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">Instagram content</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--orange);left:16%;width:84%;"><div class="tl-bar-label">3×/week ongoing</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">YouTube Shorts</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--orange);left:16%;width:84%;"><div class="tl-bar-label">2×/week ongoing</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">WhatsApp Business</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--orange);left:16%;width:84%;"><div class="tl-bar-label">Broadcast + referral</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">Regional ASO listings</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--orange);left:16%;width:33%;"><div class="tl-bar-label">5 languages</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">SEO Blog</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--orange);left:16%;width:84%;"><div class="tl-bar-label">2 articles/month</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">Influencer outreach</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--blue);left:33%;width:50%;"><div class="tl-bar-label">10 creators</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">Product Hunt launch</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--blue);left:50%;width:16%;"><div class="tl-bar-label">Launch day</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">Press outreach</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--blue);left:33%;width:50%;"><div class="tl-bar-label">YourStory, Inc42, etc.</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">ShareChat + Moj</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--blue);left:33%;width:67%;"><div class="tl-bar-label">Regional video</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">Referral programme</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--blue);left:33%;width:67%;"><div class="tl-bar-label">Build + launch</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">Meta Ads (paid)</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--purple);left:66%;width:34%;"><div class="tl-bar-label">₹10–15k/mo</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">Google UAC + Apple SA</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--purple);left:66%;width:34%;"><div class="tl-bar-label">₹8–12k/mo</div></div></div></div>
      <div class="timeline-row"><div class="tl-label">Corporate B2B outreach</div>
        <div class="tl-track"><div class="tl-bar" style="background:var(--purple);left:66%;width:34%;"><div class="tl-bar-label">20 companies</div></div></div></div>
    </div>

    <!-- BUDGET TABLE -->
    <div class="sec">Monthly marketing budget (Phase 4 steady state)</div>
    <table class="budget-table">
      <thead>
        <tr>
          <th>Channel</th>
          <th>Month 1–2</th>
          <th>Month 3–4</th>
          <th>Month 5–6</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>App Store & Play Store (ASO)</td><td>₹0</td><td>₹0</td><td>₹0</td><td>Time only — zero cash</td></tr>
        <tr><td>Instagram + Facebook organic</td><td>₹0</td><td>₹0</td><td>₹0</td><td>Content creation time</td></tr>
        <tr><td>YouTube content production</td><td>₹2,000</td><td>₹3,000</td><td>₹3,000</td><td>Editing tools / freelancer</td></tr>
        <tr><td>Influencer fees (10 creators)</td><td>₹0</td><td>₹25,000</td><td>₹15,000</td><td>₹3–5k per dedicated Reel</td></tr>
        <tr><td>PR outreach (tools + time)</td><td>₹0</td><td>₹2,000</td><td>₹2,000</td><td>Email tools, media list</td></tr>
        <tr><td>Meta Ads (FB + IG)</td><td>₹0</td><td>₹0</td><td>₹12,000</td><td>Start after 50+ ratings</td></tr>
        <tr><td>Google UAC</td><td>₹0</td><td>₹0</td><td>₹8,000</td><td>App install campaigns</td></tr>
        <tr><td>Apple Search Ads</td><td>₹0</td><td>₹0</td><td>₹5,000</td><td>iOS install campaigns</td></tr>
        <tr><td>ShareChat / Moj ads</td><td>₹0</td><td>₹2,000</td><td>₹3,000</td><td>Very low CPM, high reach</td></tr>
        <tr><td>Email tool (Mailchimp/Brevo)</td><td>₹0</td><td>₹1,500</td><td>₹1,500</td><td>Free up to 2,000 subscribers</td></tr>
        <tr><td><strong>TOTAL</strong></td><td><strong>₹2,000</strong></td><td><strong>₹33,500</strong></td><td><strong>₹49,500</strong></td><td>Scale with revenue</td></tr>
      </tbody>
    </table>

    <!-- KPI TABLE -->
    <div class="sec">Success KPIs — what to measure each month</div>
    <table class="kpi-table">
      <thead>
        <tr>
          <th>KPI</th>
          <th>Month 1–2 Target</th>
          <th>Month 3–4 Target</th>
          <th>Month 5–6 Target</th>
          <th>Platform to track</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>New app installs / month</td><td>200–500</td><td>1,000–2,000</td><td>3,000–5,000</td><td>App Store Connect / Play Console</td></tr>
        <tr><td>App Store rating</td><td>4.0+</td><td>4.3+</td><td>4.5+</td><td>Both stores</td></tr>
        <tr><td>Number of ratings (total)</td><td>10+</td><td>50+</td><td>150+</td><td>Both stores</td></tr>
        <tr><td>Instagram followers</td><td>500</td><td>2,000</td><td>5,000</td><td>Instagram Insights</td></tr>
        <tr><td>Instagram Reel avg views</td><td>1,000</td><td>5,000</td><td>15,000</td><td>Instagram Insights</td></tr>
        <tr><td>YouTube subscribers</td><td>100</td><td>500</td><td>2,000</td><td>YouTube Studio</td></tr>
        <tr><td>WhatsApp broadcast subscribers</td><td>200</td><td>1,000</td><td>3,000</td><td>WhatsApp Business</td></tr>
        <tr><td>Monthly Active Users (MAU)</td><td>300</td><td>1,500</td><td>5,000</td><td>Supabase / analytics</td></tr>
        <tr><td>Paid subscribers (Plus + Pro)</td><td>20</td><td>100</td><td>300</td><td>Razorpay / IAP dashboard</td></tr>
        <tr><td>Press mentions</td><td>0</td><td>2</td><td>5+</td><td>Google Alerts</td></tr>
        <tr><td>CPI from paid ads (when live)</td><td>—</td><td>—</td><td>&lt;₹40</td><td>Meta / Google Ads</td></tr>
      </tbody>
    </table>

    <!-- CONTENT PILLARS STRIP -->
    <div style="background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:12px;padding:13px 20px;display:flex;gap:0;align-items:stretch;">
      <div style="flex:1;border-right:1px solid rgba(255,255,255,.15);padding-right:16px;">
        <div style="font-size:10px;font-weight:800;color:#fff;margin-bottom:5px;">🎯 4 Core Content Pillars</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">
          <div style="background:rgba(255,255,255,.08);border-radius:7px;padding:6px 8px;">
            <div style="font-size:8.5px;font-weight:700;color:var(--gold);">Emotional Education</div>
            <div style="font-size:8px;color:rgba(255,255,255,.6);margin-top:2px;">"5 signs of quiet burnout" · "What anxiety feels like in Hindi"</div>
          </div>
          <div style="background:rgba(255,255,255,.08);border-radius:7px;padding:6px 8px;">
            <div style="font-size:8.5px;font-weight:700;color:var(--teal);">Feature Spotlight</div>
            <div style="font-size:8px;color:rgba(255,255,255,.6);margin-top:2px;">Screen recordings · "Did you know Imotara does X?" demos</div>
          </div>
          <div style="background:rgba(255,255,255,.08);border-radius:7px;padding:6px 8px;">
            <div style="font-size:8.5px;font-weight:700;color:var(--pink);">User Stories</div>
            <div style="font-size:8px;color:rgba(255,255,255,.6);margin-top:2px;">Testimonials · "I tried Imotara for 30 days" · Before/after moods</div>
          </div>
          <div style="background:rgba(255,255,255,.08);border-radius:7px;padding:6px 8px;">
            <div style="font-size:8.5px;font-weight:700;color:var(--blue);">Cultural Connection</div>
            <div style="font-size:8px;color:rgba(255,255,255,.6);margin-top:2px;">Indian festivals + mental health · Hindi/regional quotes · mythology wellness</div>
          </div>
        </div>
      </div>
      <div style="padding-left:16px;display:flex;flex-direction:column;justify-content:center;min-width:130px;">
        <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Golden Rule</div>
        <div style="font-size:11px;font-weight:800;color:#fff;line-height:1.4;font-style:italic;">"Lead with emotion. Follow with feature. Close with download."</div>
      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left"><img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · Marketing Priority Roadmap</span></div>
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
