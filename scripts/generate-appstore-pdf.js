const { chromium } = require('playwright');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function makeQR(text, color = '#12274F') {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    width: 200,
    margin: 2,
    color: { dark: color, light: '#FFFFFF' },
  });
}

(async () => {
  // Generate QR codes
  const qrPlay   = await makeQR('https://play.google.com/store/apps/details?id=com.imotara.imotara', '#12274F');
  const qrApple  = await makeQR('https://apps.apple.com/in/app/imotara/id6746965704', '#12274F');
  const qrWeb    = await makeQR('https://imotara.com', '#12274F');

  const logoPath = path.resolve(__dirname, '../public/Imotara Firm.png');
  const logoB64  = fs.readFileSync(logoPath).toString('base64');
  const logoSrc  = `data:image/png;base64,${logoB64}`;

  const htmlPath = path.resolve(__dirname, '../docs/imotara-appstore-links.html');
  const pdfPath  = path.resolve(__dirname, '../docs/imotara-appstore-links.pdf');

  // ── Build HTML ────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Imotara — App Store Links &amp; Screenshots</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
:root{
  --pink:#FF6B9D;--blue:#4B9FE1;--teal:#38C9B9;--gold:#F5C842;
  --purple:#9B6FE8;--green:#3DBE8A;--orange:#FF8C42;
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
.hdr{
  background:linear-gradient(135deg,var(--navy) 0%,var(--navy2) 55%,#1B4F8A 100%);
  padding:20px 36px 18px;display:flex;align-items:center;justify-content:space-between;
  position:relative;overflow:hidden;
}
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

/* HERO (page 1) */
.hero{
  background:linear-gradient(135deg,#FFF0F6 0%,#EEF4FF 50%,#EAFAF7 100%);
  border-bottom:1px solid var(--border);
  padding:16px 36px;display:flex;align-items:center;justify-content:space-between;
}
.hero-title{font-size:17px;font-weight:900;color:var(--navy);line-height:1.25;}
.hero-title em{font-style:normal;background:linear-gradient(135deg,var(--pink),var(--blue));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.hero-sub{font-size:10px;color:var(--gray);margin-top:4px;line-height:1.5;}
.avail-pills{display:flex;flex-direction:column;gap:5px;align-items:flex-end;}
.avail-pill{background:var(--white);border:1px solid var(--border);border-radius:20px;
  padding:5px 12px;font-size:9px;font-weight:600;color:var(--navy);
  display:flex;align-items:center;gap:7px;}
.avail-pill .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}

/* STORE CARDS */
.store-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px;}
.store-card{
  border-radius:16px;border:1.5px solid var(--border);
  padding:20px 16px 18px;text-align:center;
  display:flex;flex-direction:column;align-items:center;gap:0;
  position:relative;overflow:hidden;
}
.store-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;}
.sc-ios::before  {background:linear-gradient(to right,#555,#333);}
.sc-play::before {background:linear-gradient(to right,#34A853,#4285F4);}
.sc-web::before  {background:linear-gradient(to right,var(--pink),var(--blue));}

.sc-icon{font-size:30px;margin-bottom:10px;}
.sc-platform{font-size:13px;font-weight:800;color:var(--navy);margin-bottom:2px;}
.sc-sub{font-size:9px;color:var(--gray);margin-bottom:14px;line-height:1.4;}
.sc-qr{width:100px;height:100px;border-radius:10px;border:2px solid var(--border);margin-bottom:12px;}
.sc-id{
  font-size:8.5px;color:var(--slate);background:var(--light);
  border-radius:8px;padding:5px 10px;width:100%;word-break:break-all;
  text-align:center;line-height:1.5;margin-bottom:10px;
}
.sc-btn{
  display:block;width:100%;padding:9px 0;border-radius:20px;
  font-size:9.5px;font-weight:700;text-decoration:none;
}
.btn-ios  {background:#000;color:#fff;}
.btn-play {background:linear-gradient(135deg,#34A853,#4285F4);color:#fff;}
.btn-web  {background:linear-gradient(135deg,var(--pink),var(--blue));color:#fff;}

/* HOW TO DOWNLOAD */
.how-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px;}
.how-card{border:1px solid var(--border);border-radius:10px;padding:13px 14px;background:var(--light);}
.how-step{font-size:18px;font-weight:900;color:var(--border);margin-bottom:6px;line-height:1;}
.how-title{font-size:10px;font-weight:700;color:var(--navy);margin-bottom:4px;}
.how-body{font-size:9px;color:var(--slate);line-height:1.55;}

/* PLATFORM STRIP */
.platform-strip{
  background:linear-gradient(135deg,var(--navy),var(--navy2));
  border-radius:10px;padding:13px 22px;
  display:flex;justify-content:space-around;align-items:center;margin-bottom:18px;
}
.ps-item{text-align:center;}
.ps-icon{font-size:22px;margin-bottom:4px;}
.ps-label{font-size:10px;font-weight:700;color:#fff;}
.ps-sub{font-size:8.5px;color:rgba(255,255,255,.5);margin-top:2px;}
.ps-div{width:1px;background:rgba(255,255,255,.15);align-self:stretch;}

/* ═══ PAGE 2 — PHONE MOCKUPS  ═══ */
.screens-hero{
  background:linear-gradient(135deg,#EEF4FF 0%,#F5F0FF 100%);
  border-bottom:1px solid var(--border);padding:14px 36px;
}
.screens-hero-title{font-size:15px;font-weight:900;color:var(--navy);}
.screens-hero-title em{font-style:normal;background:linear-gradient(135deg,var(--purple),var(--blue));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.screens-hero-sub{font-size:10px;color:var(--gray);margin-top:4px;}

/* phone frame */
.phones-row{display:flex;gap:10px;align-items:flex-start;justify-content:center;margin-bottom:16px;}
.phone-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;}
.phone-label{font-size:9px;font-weight:700;color:var(--slate);text-transform:uppercase;letter-spacing:1px;}
.phone-caption{font-size:8.5px;color:var(--gray);text-align:center;line-height:1.4;max-width:100px;}

.phone{
  width:100px;height:186px;border-radius:18px;
  border:3px solid var(--navy);background:var(--navy);
  position:relative;overflow:hidden;flex-shrink:0;
  box-shadow:0 6px 20px rgba(18,39,79,.25);
}
.phone::before{
  content:'';position:absolute;top:5px;left:50%;transform:translateX(-50%);
  width:28px;height:5px;background:var(--navy);
  border-radius:3px;z-index:10;
}
.phone-screen{
  position:absolute;top:2px;left:2px;right:2px;bottom:2px;
  border-radius:16px;overflow:hidden;
}

/* ── SCREEN 1: CHAT ── */
.screen-chat{
  background:linear-gradient(180deg,#1A2F5E 0%,#0F1E3D 100%);
  height:100%;display:flex;flex-direction:column;
}
.chat-header{
  background:linear-gradient(135deg,#1E3A6E,#12274F);
  padding:8px 8px 6px;display:flex;align-items:center;gap:5px;
}
.chat-avatar{width:18px;height:18px;border-radius:50%;
  background:linear-gradient(135deg,var(--pink),var(--blue));
  display:flex;align-items:center;justify-content:center;
  font-size:8px;flex-shrink:0;color:#fff;}
.chat-name{font-size:7px;font-weight:700;color:#fff;}
.chat-online{width:5px;height:5px;border-radius:50%;background:var(--green);margin-left:auto;}
.chat-body{flex:1;padding:6px;display:flex;flex-direction:column;gap:4px;overflow:hidden;}
.msg-them{
  background:rgba(255,255,255,.1);border-radius:8px 8px 8px 2px;
  padding:5px 7px;max-width:80%;align-self:flex-start;
}
.msg-me{
  background:linear-gradient(135deg,var(--pink),#c84b7a);
  border-radius:8px 8px 2px 8px;
  padding:5px 7px;max-width:80%;align-self:flex-end;
}
.msg-text{font-size:6px;color:#fff;line-height:1.4;}
.msg-time{font-size:5px;color:rgba(255,255,255,.4);margin-top:2px;text-align:right;}
.chat-input{
  background:rgba(255,255,255,.08);margin:4px 6px;
  border-radius:12px;padding:5px 8px;
  display:flex;align-items:center;gap:4px;
}
.chat-input-text{font-size:6px;color:rgba(255,255,255,.35);flex:1;}
.chat-input-mic{font-size:8px;}

/* ── SCREEN 2: MOOD ── */
.screen-mood{
  background:linear-gradient(180deg,#FFFAF0 0%,#FFF3F8 100%);
  height:100%;display:flex;flex-direction:column;
}
.mood-header{
  background:linear-gradient(135deg,#1E3A6E,#12274F);
  padding:8px 8px 6px;
}
.mood-hdr-title{font-size:7px;font-weight:700;color:#fff;text-align:center;}
.mood-hdr-sub{font-size:5.5px;color:rgba(255,255,255,.6);text-align:center;margin-top:1px;}
.mood-body{flex:1;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;}
.mood-question{font-size:6.5px;font-weight:700;color:var(--navy);text-align:center;line-height:1.4;}
.mood-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;width:100%;}
.mood-btn{
  background:var(--white);border-radius:8px;padding:4px 2px;
  text-align:center;border:1.5px solid var(--border);
}
.mood-btn.sel{border-color:var(--pink);background:#FFF0F5;}
.mood-emoji{font-size:11px;display:block;}
.mood-label{font-size:5px;color:var(--slate);margin-top:2px;}
.mood-next{
  background:linear-gradient(135deg,var(--pink),var(--blue));
  color:#fff;font-size:7px;font-weight:700;
  padding:6px 0;border-radius:12px;width:100%;text-align:center;
}

/* ── SCREEN 3: HOME ── */
.screen-home{
  background:linear-gradient(180deg,#F0F6FF 0%,#E8F4FF 100%);
  height:100%;display:flex;flex-direction:column;
}
.home-header{
  background:linear-gradient(135deg,#1E3A6E,#12274F);
  padding:8px 8px 8px;
}
.home-greeting{font-size:7px;color:rgba(255,255,255,.65);}
.home-name{font-size:9px;font-weight:800;color:#fff;}
.home-body{flex:1;padding:6px;display:flex;flex-direction:column;gap:5px;overflow:hidden;}
.home-card{background:var(--white);border-radius:8px;padding:6px 7px;border:1px solid var(--border);}
.home-card-title{font-size:6px;font-weight:700;color:var(--navy);margin-bottom:3px;}
.streak-row{display:flex;gap:3px;}
.streak-dot{width:10px;height:10px;border-radius:3px;background:var(--light);}
.streak-dot.active{background:linear-gradient(135deg,var(--pink),var(--blue));}
.home-mood-row{display:flex;gap:4px;align-items:center;}
.home-mood-big{font-size:18px;}
.home-mood-info{display:flex;flex-direction:column;}
.home-mood-label{font-size:6px;font-weight:600;color:var(--navy);}
.home-mood-sub{font-size:5px;color:var(--gray);}
.home-chat-btn{
  background:linear-gradient(135deg,var(--pink),var(--blue));
  border-radius:10px;padding:7px 8px;
  display:flex;align-items:center;gap:5px;
}
.home-chat-icon{font-size:14px;}
.home-chat-text{font-size:6.5px;font-weight:700;color:#fff;line-height:1.3;}

/* ── SCREEN 4: HISTORY ── */
.screen-hist{
  background:linear-gradient(180deg,#EDFAF2 0%,#EEF4FF 100%);
  height:100%;display:flex;flex-direction:column;
}
.hist-header{
  background:linear-gradient(135deg,#1E3A6E,#12274F);
  padding:8px 8px 6px;
}
.hist-hdr-title{font-size:7px;font-weight:700;color:#fff;text-align:center;}
.hist-body{flex:1;padding:6px;display:flex;flex-direction:column;gap:5px;overflow:hidden;}
.hist-chart{background:var(--white);border-radius:8px;padding:5px 6px;border:1px solid var(--border);}
.hist-chart-title{font-size:6px;font-weight:700;color:var(--navy);margin-bottom:4px;}
.hist-bars{display:flex;align-items:flex-end;gap:3px;height:28px;}
.hbar{border-radius:3px 3px 0 0;flex:1;}
.hist-labels{display:flex;gap:3px;margin-top:2px;}
.hlabel{flex:1;font-size:4.5px;color:var(--gray);text-align:center;}
.hist-entries{display:flex;flex-direction:column;gap:3px;}
.hist-entry{background:var(--white);border-radius:7px;padding:4px 6px;border:1px solid var(--border);display:flex;align-items:center;gap:5px;}
.hist-entry-emoji{font-size:10px;}
.hist-entry-text{flex:1;}
.hist-entry-date{font-size:5px;color:var(--gray);}
.hist-entry-preview{font-size:6px;color:var(--slate);line-height:1.3;}

/* ── SCREEN 5: SETTINGS ── */
.screen-settings{
  background:linear-gradient(180deg,#F5F0FF 0%,#EEF4FF 100%);
  height:100%;display:flex;flex-direction:column;
}
.settings-header{
  background:linear-gradient(135deg,#1E3A6E,#12274F);
  padding:8px 8px 6px;
}
.settings-hdr-title{font-size:7px;font-weight:700;color:#fff;text-align:center;}
.settings-body{flex:1;padding:6px;display:flex;flex-direction:column;gap:4px;overflow:hidden;}
.comp-card{
  background:linear-gradient(135deg,#1E3A6E,#12274F);
  border-radius:10px;padding:7px 8px;
  display:flex;align-items:center;gap:6px;
}
.comp-ava{width:24px;height:24px;border-radius:50%;
  background:linear-gradient(135deg,var(--pink),var(--blue));
  display:flex;align-items:center;justify-content:center;font-size:11px;}
.comp-name{font-size:8px;font-weight:700;color:#fff;}
.comp-role{font-size:6px;color:rgba(255,255,255,.55);}
.settings-row{background:var(--white);border-radius:7px;padding:5px 7px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.settings-row-label{font-size:6.5px;color:var(--navy);font-weight:600;}
.settings-row-val{font-size:6px;color:var(--gray);}
.toggle{width:16px;height:9px;border-radius:5px;background:var(--green);position:relative;}
.toggle::after{content:'';position:absolute;right:1px;top:1px;width:7px;height:7px;border-radius:50%;background:#fff;}
.toggle.off{background:var(--border);}
.toggle.off::after{right:auto;left:1px;}

/* ═══ PAGE 3 — WEB + FEATURE OVERVIEW ═══ */
.web-hero{
  background:linear-gradient(135deg,#FFF0F6 0%,#EEF4FF 100%);
  border-bottom:1px solid var(--border);padding:14px 36px;
}
.web-hero-title{font-size:15px;font-weight:900;color:var(--navy);}
.web-hero-title em{font-style:normal;background:linear-gradient(135deg,var(--pink),var(--blue));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.web-hero-sub{font-size:10px;color:var(--gray);margin-top:4px;}

/* browser mockup */
.browser-wrap{
  border:2px solid var(--navy);border-radius:14px;overflow:hidden;
  box-shadow:0 8px 24px rgba(18,39,79,.18);margin-bottom:16px;
}
.browser-bar{
  background:var(--navy);padding:7px 12px;
  display:flex;align-items:center;gap:8px;
}
.browser-dots{display:flex;gap:4px;}
.browser-dot{width:8px;height:8px;border-radius:50%;}
.browser-url{
  flex:1;background:rgba(255,255,255,.1);border-radius:8px;
  padding:4px 10px;font-size:8px;color:rgba(255,255,255,.7);
  display:flex;align-items:center;gap:5px;
}
.browser-lock{color:var(--green);font-size:8px;}
.browser-content{
  background:linear-gradient(180deg,#0F1E3D 0%,#1A2F5E 100%);
  display:flex;height:130px;
}
/* web sidebar */
.wb-sidebar{
  width:52px;background:rgba(0,0,0,.3);
  padding:8px 4px;display:flex;flex-direction:column;gap:4px;align-items:center;
  border-right:1px solid rgba(255,255,255,.08);
}
.wb-nav-item{
  width:36px;padding:5px 0;border-radius:8px;
  text-align:center;font-size:9px;
}
.wb-nav-item.active{background:rgba(255,255,255,.12);}
.wb-nav-label{font-size:5px;color:rgba(255,255,255,.4);margin-top:2px;}
/* web main */
.wb-main{flex:1;padding:8px 10px;display:flex;flex-direction:column;gap:5px;}
.wb-thread-list{display:flex;flex-direction:column;gap:3px;width:68px;flex-shrink:0;margin-right:8px;}
.wb-thread{font-size:5.5px;color:rgba(255,255,255,.5);padding:4px 6px;border-radius:6px;white-space:nowrap;overflow:hidden;}
.wb-thread.active{background:rgba(255,255,255,.1);color:#fff;}
.wb-chat-col{flex:1;display:flex;flex-direction:column;gap:4px;}
.wb-chat-header{display:flex;align-items:center;gap:5px;margin-bottom:4px;}
.wb-avatar{width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,var(--pink),var(--blue));display:flex;align-items:center;justify-content:center;font-size:8px;}
.wb-chat-name{font-size:7px;font-weight:700;color:#fff;}
.wb-msg-ai{background:rgba(255,255,255,.08);border-radius:6px 6px 6px 2px;padding:5px 7px;max-width:90%;font-size:5.5px;color:rgba(255,255,255,.85);line-height:1.5;}
.wb-msg-user{background:linear-gradient(135deg,rgba(255,107,157,.4),rgba(75,159,225,.3));border-radius:6px 6px 2px 6px;padding:5px 7px;max-width:70%;align-self:flex-end;font-size:5.5px;color:rgba(255,255,255,.9);}
.wb-input{background:rgba(255,255,255,.07);border-radius:8px;padding:5px 8px;display:flex;align-items:center;gap:5px;margin-top:auto;}
.wb-input-text{font-size:5.5px;color:rgba(255,255,255,.3);flex:1;}
.wb-input-icons{display:flex;gap:4px;font-size:8px;}

/* feature compare */
.feat-compare{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;}
.feat-col{border:1px solid var(--border);border-radius:10px;padding:13px 14px;}
.feat-col-title{font-size:10px;font-weight:800;color:var(--navy);margin-bottom:8px;display:flex;align-items:center;gap:6px;}
.feat-list{list-style:none;display:flex;flex-direction:column;gap:4px;}
.feat-list li{font-size:9px;color:var(--slate);display:flex;align-items:flex-start;gap:6px;line-height:1.4;}
.feat-list li .tk{color:var(--green);font-size:10px;flex-shrink:0;}

/* rating strip */
.rating-strip{
  background:linear-gradient(135deg,var(--navy),var(--navy2));
  border-radius:10px;padding:12px 20px;
  display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;
}
.rating-left{}
.rating-title{font-size:11px;font-weight:800;color:#fff;margin-bottom:3px;}
.rating-sub{font-size:9px;color:rgba(255,255,255,.6);}
.rating-right{display:flex;gap:16px;}
.rating-item{text-align:center;}
.rating-stars{font-size:13px;color:var(--gold);}
.rating-platform{font-size:8px;color:rgba(255,255,255,.5);margin-top:2px;}

/* search terms */
.search-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;}
.search-card{
  background:var(--light);border:1px solid var(--border);
  border-radius:10px;padding:10px 12px;
}
.search-store{font-size:8.5px;font-weight:700;color:var(--navy);margin-bottom:5px;}
.search-terms{display:flex;flex-wrap:wrap;gap:4px;}
.stag{font-size:8px;background:var(--white);border:1px solid var(--border);color:var(--slate);padding:2px 7px;border-radius:10px;}

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

<!-- ══════════════════════════════  PAGE 1 — DOWNLOAD LINKS  ══════════════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">App Store Links, QR Codes &amp; Screenshots</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="hero">
    <div>
      <div class="hero-title">Download Imotara<br/><em>on any device, instantly.</em></div>
      <div class="hero-sub">Available on iOS, Android, and Web — free to start.<br/>Scan a QR code or search "Imotara" in your app store.</div>
    </div>
    <div class="avail-pills">
      <div class="avail-pill"><span class="dot" style="background:#000"></span> iOS App Store</div>
      <div class="avail-pill"><span class="dot" style="background:#34A853"></span> Google Play Store</div>
      <div class="avail-pill"><span class="dot" style="background:var(--blue)"></span> Web — imotara.com</div>
    </div>
  </div>

  <div class="body">
    <div class="sec">Scan to download</div>
    <div class="store-grid">

      <!-- iOS -->
      <div class="store-card sc-ios">
        <div class="sc-icon"> </div>
        <div class="sc-platform">iOS App Store</div>
        <div class="sc-sub">iPhone &amp; iPad<br/>iOS 15.0 or later</div>
        <img class="sc-qr" src="${qrApple}" alt="iOS QR Code"/>
        <div class="sc-id">apps.apple.com/in/app/imotara<br/>Bundle: com.imotara.imotara</div>
        <span class="sc-btn btn-ios">Download on the App Store</span>
      </div>

      <!-- Play -->
      <div class="store-card sc-play">
        <div class="sc-icon">🤖</div>
        <div class="sc-platform">Google Play Store</div>
        <div class="sc-sub">Android phones &amp; tablets<br/>Android 8.0 or later</div>
        <img class="sc-qr" src="${qrPlay}" alt="Android QR Code"/>
        <div class="sc-id">play.google.com/store/apps<br/>Package: com.imotara.imotara</div>
        <span class="sc-btn btn-play">Get it on Google Play</span>
      </div>

      <!-- Web -->
      <div class="store-card sc-web">
        <div class="sc-icon">🌐</div>
        <div class="sc-platform">Web App</div>
        <div class="sc-sub">All browsers, all devices<br/>No installation needed</div>
        <img class="sc-qr" src="${qrWeb}" alt="Web QR Code"/>
        <div class="sc-id">imotara.com<br/>Works on Chrome, Safari, Firefox</div>
        <span class="sc-btn btn-web">Open imotara.com</span>
      </div>

    </div>

    <!-- PLATFORM STRIP -->
    <div class="platform-strip">
      <div class="ps-item"><div class="ps-icon"> </div><div class="ps-label">iOS</div><div class="ps-sub">iPhone + iPad · iOS 15+</div></div>
      <div class="ps-div"></div>
      <div class="ps-item"><div class="ps-icon">🤖</div><div class="ps-label">Android</div><div class="ps-sub">Phones + Tablets · Android 8+</div></div>
      <div class="ps-div"></div>
      <div class="ps-item"><div class="ps-icon">🌐</div><div class="ps-label">Web</div><div class="ps-sub">Chrome · Safari · Firefox · Edge</div></div>
      <div class="ps-div"></div>
      <div class="ps-item"><div class="ps-icon">🔓</div><div class="ps-label">Free to Start</div><div class="ps-sub">No credit card · Install in 30 sec</div></div>
      <div class="ps-div"></div>
      <div class="ps-item"><div class="ps-icon">🌏</div><div class="ps-label">22 Languages</div><div class="ps-sub">Auto-detected or manually set</div></div>
    </div>

    <!-- HOW TO DOWNLOAD -->
    <div class="sec">How to get started in 3 steps</div>
    <div class="how-grid">
      <div class="how-card">
        <div class="how-step">01</div>
        <div class="how-title">Download &amp; Install</div>
        <div class="how-body">Scan the QR code above or search "Imotara" in the App Store / Google Play. On web, simply open imotara.com in any browser — no install needed.</div>
      </div>
      <div class="how-card">
        <div class="how-step">02</div>
        <div class="how-title">Set Up Your Companion</div>
        <div class="how-body">Choose your preferred language, name your companion, set the relationship vibe (Friend / Mentor / Coach) and response style. Takes under 2 minutes.</div>
      </div>
      <div class="how-card">
        <div class="how-step">03</div>
        <div class="how-title">Start Your First Conversation</div>
        <div class="how-body">Tell Imotara how you're feeling today. No sign-up required on first use. Create an account whenever you're ready to sync across devices or unlock Plus features.</div>
      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left">
      <img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · App Store Links &amp; Screenshots</span>
    </div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 1 of 3</div>
  </div>
</div>


<!-- ══════════════════════════════  PAGE 2 — MOBILE SCREENSHOTS  ══════════════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Mobile App — Screen Walkthrough</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="screens-hero">
    <div class="screens-hero-title">5 key screens — <em>beautiful, calm, and intuitive</em></div>
    <div class="screens-hero-sub">iOS &amp; Android · Dark-theme AI chat · Mood tracking · Companion persona · History analytics · Settings</div>
  </div>

  <div class="body">

    <div class="sec" style="margin-top:4px;">Mobile app screens (iOS &amp; Android)</div>
    <div class="phones-row">

      <!-- SCREEN 1: CHAT -->
      <div class="phone-wrap">
        <div class="phone">
          <div class="phone-screen">
            <div class="screen-chat">
              <div class="chat-header">
                <div class="chat-avatar">✨</div>
                <div>
                  <div class="chat-name">Imotara</div>
                </div>
                <div class="chat-online"></div>
              </div>
              <div class="chat-body">
                <div class="msg-them"><div class="msg-text">I'm here with you. How are you feeling right now? 💙</div><div class="msg-time">10:42 AM</div></div>
                <div class="msg-me"><div class="msg-text">A bit overwhelmed with work lately</div><div class="msg-time">10:43 AM</div></div>
                <div class="msg-them"><div class="msg-text">That sounds really heavy. Can you tell me what's been piling up?</div><div class="msg-time">10:43 AM</div></div>
                <div class="msg-me"><div class="msg-text">Deadlines, meetings, no time to breathe</div><div class="msg-time">10:44 AM</div></div>
                <div class="msg-them"><div class="msg-text">I hear you. Let's pause for a moment together... 🌿</div><div class="msg-time">10:44 AM</div></div>
              </div>
              <div class="chat-input">
                <div class="chat-input-text">Type or speak…</div>
                <div class="chat-input-mic">🎙️</div>
              </div>
            </div>
          </div>
        </div>
        <div class="phone-label">AI Chat</div>
        <div class="phone-caption">Emotionally aware conversation with typing &amp; voice input</div>
      </div>

      <!-- SCREEN 2: MOOD -->
      <div class="phone-wrap">
        <div class="phone">
          <div class="phone-screen">
            <div class="screen-mood">
              <div class="mood-header">
                <div class="mood-hdr-title">Daily Check-In</div>
                <div class="mood-hdr-sub">Sunday, 28 June</div>
              </div>
              <div class="mood-body">
                <div class="mood-question">How are you feeling<br/>right now?</div>
                <div class="mood-grid">
                  <div class="mood-btn sel"><span class="mood-emoji">😔</span><div class="mood-label">Sad</div></div>
                  <div class="mood-btn"><span class="mood-emoji">😤</span><div class="mood-label">Angry</div></div>
                  <div class="mood-btn"><span class="mood-emoji">😨</span><div class="mood-label">Anxious</div></div>
                  <div class="mood-btn"><span class="mood-emoji">😌</span><div class="mood-label">Calm</div></div>
                  <div class="mood-btn"><span class="mood-emoji">😊</span><div class="mood-label">Happy</div></div>
                  <div class="mood-btn"><span class="mood-emoji">😴</span><div class="mood-label">Tired</div></div>
                  <div class="mood-btn"><span class="mood-emoji">🤩</span><div class="mood-label">Excited</div></div>
                  <div class="mood-btn"><span class="mood-emoji">😶</span><div class="mood-label">Numb</div></div>
                </div>
                <div class="mood-next">Continue →</div>
              </div>
            </div>
          </div>
        </div>
        <div class="phone-label">Mood Check-In</div>
        <div class="phone-caption">8 emotion states, daily tracking</div>
      </div>

      <!-- SCREEN 3: HOME -->
      <div class="phone-wrap">
        <div class="phone">
          <div class="phone-screen">
            <div class="screen-home">
              <div class="home-header">
                <div class="home-greeting">Good morning,</div>
                <div class="home-name">Priya 👋</div>
              </div>
              <div class="home-body">
                <div class="home-card">
                  <div class="home-card-title">🔥 Your streak — 14 days</div>
                  <div class="streak-row">
                    <div class="streak-dot active"></div><div class="streak-dot active"></div>
                    <div class="streak-dot active"></div><div class="streak-dot active"></div>
                    <div class="streak-dot active"></div><div class="streak-dot active"></div>
                    <div class="streak-dot active"></div>
                  </div>
                </div>
                <div class="home-card">
                  <div class="home-card-title">Yesterday's mood</div>
                  <div class="home-mood-row">
                    <div class="home-mood-big">😌</div>
                    <div class="home-mood-info">
                      <div class="home-mood-label">Calm</div>
                      <div class="home-mood-sub">Better than last week</div>
                    </div>
                  </div>
                </div>
                <div class="home-chat-btn">
                  <div class="home-chat-icon">💬</div>
                  <div class="home-chat-text">Talk to Imotara<br/><span style="font-weight:400;font-size:5.5px;">Your companion is ready</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="phone-label">Home Dashboard</div>
        <div class="phone-caption">Streak tracking, mood recap, quick-start chat</div>
      </div>

      <!-- SCREEN 4: HISTORY -->
      <div class="phone-wrap">
        <div class="phone">
          <div class="phone-screen">
            <div class="screen-hist">
              <div class="hist-header">
                <div class="hist-hdr-title">Your Journey</div>
              </div>
              <div class="hist-body">
                <div class="hist-chart">
                  <div class="hist-chart-title">30-day mood chart</div>
                  <div class="hist-bars">
                    <div class="hbar" style="height:60%;background:var(--pink);opacity:.7;"></div>
                    <div class="hbar" style="height:40%;background:var(--blue);opacity:.7;"></div>
                    <div class="hbar" style="height:80%;background:var(--teal);opacity:.7;"></div>
                    <div class="hbar" style="height:55%;background:var(--purple);opacity:.7;"></div>
                    <div class="hbar" style="height:70%;background:var(--green);opacity:.7;"></div>
                    <div class="hbar" style="height:45%;background:var(--gold);opacity:.7;"></div>
                    <div class="hbar" style="height:90%;background:var(--teal);opacity:.7;"></div>
                  </div>
                  <div class="hist-labels">
                    <div class="hlabel">W1</div><div class="hlabel">W2</div><div class="hlabel">W3</div>
                    <div class="hlabel">W4</div><div class="hlabel">W5</div><div class="hlabel">W6</div><div class="hlabel">W7</div>
                  </div>
                </div>
                <div class="hist-entries">
                  <div class="hist-entry">
                    <div class="hist-entry-emoji">😊</div>
                    <div class="hist-entry-text">
                      <div class="hist-entry-preview">Felt lighter after our chat...</div>
                      <div class="hist-entry-date">Jun 27 · 8:30 PM</div>
                    </div>
                  </div>
                  <div class="hist-entry">
                    <div class="hist-entry-emoji">😔</div>
                    <div class="hist-entry-text">
                      <div class="hist-entry-preview">Work stress came back today</div>
                      <div class="hist-entry-date">Jun 26 · 11:20 AM</div>
                    </div>
                  </div>
                  <div class="hist-entry">
                    <div class="hist-entry-emoji">😌</div>
                    <div class="hist-entry-text">
                      <div class="hist-entry-preview">Breathing exercise helped a lot</div>
                      <div class="hist-entry-date">Jun 25 · 7:00 AM</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="phone-label">History</div>
        <div class="phone-caption">Mood charts, emotion timeline, journal entries</div>
      </div>

      <!-- SCREEN 5: SETTINGS -->
      <div class="phone-wrap">
        <div class="phone">
          <div class="phone-screen">
            <div class="screen-settings">
              <div class="settings-header">
                <div class="settings-hdr-title">Your Companion</div>
              </div>
              <div class="settings-body">
                <div class="comp-card">
                  <div class="comp-ava">🌟</div>
                  <div>
                    <div class="comp-name">Aanya</div>
                    <div class="comp-role">Friend · 28 years · Female</div>
                  </div>
                </div>
                <div class="settings-row">
                  <div class="settings-row-label">Relationship vibe</div>
                  <div class="settings-row-val">Best Friend</div>
                </div>
                <div class="settings-row">
                  <div class="settings-row-label">Response style</div>
                  <div class="settings-row-val">Comfort me</div>
                </div>
                <div class="settings-row">
                  <div class="settings-row-label">Language</div>
                  <div class="settings-row-val">Hindi</div>
                </div>
                <div class="settings-row">
                  <div class="settings-row-label">Daily reminders</div>
                  <div class="toggle"></div>
                </div>
                <div class="settings-row">
                  <div class="settings-row-label">Dark mode</div>
                  <div class="toggle"></div>
                </div>
                <div class="settings-row">
                  <div class="settings-row-label">Voice playback</div>
                  <div class="toggle off"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="phone-label">Companion Settings</div>
        <div class="phone-caption">Name, vibe, language, tone, reminders</div>
      </div>

    </div>

    <!-- WEB APP PREVIEW -->
    <div class="sec">Web app — imotara.com</div>
    <div class="browser-wrap">
      <div class="browser-bar">
        <div class="browser-dots">
          <div class="browser-dot" style="background:#FF5F57;"></div>
          <div class="browser-dot" style="background:#FFBD2E;"></div>
          <div class="browser-dot" style="background:#28C840;"></div>
        </div>
        <div class="browser-url">
          <span class="browser-lock">🔒</span>
          imotara.com
        </div>
      </div>
      <div class="browser-content">
        <!-- Sidebar -->
        <div class="wb-sidebar">
          <div style="font-size:14px;margin-bottom:6px;">💬</div>
          <div class="wb-nav-item active"><div>🏠</div><div class="wb-nav-label">Home</div></div>
          <div class="wb-nav-item"><div>📊</div><div class="wb-nav-label">History</div></div>
          <div class="wb-nav-item"><div>🌱</div><div class="wb-nav-label">Grow</div></div>
          <div class="wb-nav-item"><div>⚙️</div><div class="wb-nav-label">Settings</div></div>
        </div>
        <!-- Main -->
        <div class="wb-main" style="flex-direction:row;gap:8px;">
          <!-- Thread list -->
          <div class="wb-thread-list">
            <div style="font-size:6px;color:rgba(255,255,255,.4);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px;">Conversations</div>
            <div class="wb-thread active">Today's feelings</div>
            <div class="wb-thread">Work stress — Mon</div>
            <div class="wb-thread">Family dinner talk</div>
            <div class="wb-thread">Sleep issues</div>
            <div class="wb-thread">Weekend plans</div>
          </div>
          <!-- Chat -->
          <div class="wb-chat-col">
            <div class="wb-chat-header">
              <div class="wb-avatar">✨</div>
              <div class="wb-chat-name">Imotara · Online</div>
            </div>
            <div class="wb-msg-ai">Good morning! I noticed you've been checking in every day this week. That's wonderful — how are you feeling today? 🌅</div>
            <div class="wb-msg-user">Still a bit tired but better than yesterday</div>
            <div class="wb-msg-ai">I'm really glad to hear that. Small improvements matter so much. Would you like to explore what helped yesterday, or just have a quiet chat?</div>
            <div class="wb-input">
              <div class="wb-input-text">Message Imotara…</div>
              <div class="wb-input-icons"><span>🎙️</span><span>📎</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- NOTE ON SCREENSHOTS -->
    <div style="background:linear-gradient(135deg,#FFF3CD,#FFEEBA);border:1px solid #FFD700;border-radius:10px;padding:11px 16px;display:flex;gap:10px;align-items:flex-start;">
      <div style="font-size:18px;flex-shrink:0;">📸</div>
      <div>
        <div style="font-size:10px;font-weight:700;color:#7B5C00;margin-bottom:3px;">Note for Marketing Team (Suchismita)</div>
        <div style="font-size:9.5px;color:#8A6C00;line-height:1.55;">These are illustrated screen mockups for planning purposes. For actual app store submissions, social media posts, and press kits, <strong>real device screenshots</strong> should be captured from the live app and exported at full resolution (1290×2796px for iOS, 1080×1920px for Android). The P1 marketing task includes adding text-overlay screenshots — coordinate with the developer to schedule a screenshot session on iPhone 15 Pro and a Pixel 8.</div>
      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left">
      <img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · App Store Links &amp; Screenshots</span>
    </div>
    <div class="ftr-mid">imotara.com &nbsp;·&nbsp; soumenroys@gmail.com</div>
    <div class="ftr-page">Page 2 of 3</div>
  </div>
</div>


<!-- ══════════════════════════════  PAGE 3 — PLATFORM FEATURES + ASO  ══════════════════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="${logoSrc}" alt="Imotara"/>
      <div><div class="hdr-sub">Platform Features &amp; App Store Optimisation (ASO)</div></div>
    </div>
    <div class="hdr-badge">Confidential · June 2026</div>
  </div>
  <div class="gbar"></div>

  <div class="web-hero">
    <div class="web-hero-title">Mobile vs Web — <em>feature highlights by platform</em></div>
    <div class="web-hero-sub">Both platforms share the core AI experience. Mobile adds offline AI and native features; Web adds multi-thread management and richer history tools.</div>
  </div>

  <div class="body">
    <div class="sec" style="margin-top:4px;">Platform feature highlights</div>
    <div class="feat-compare">
      <div class="feat-col" style="background:linear-gradient(145deg,#F5F9FF,#fff);">
        <div class="feat-col-title"> iOS &amp; Android — Mobile</div>
        <ul class="feat-list">
          <li><span class="tk">✓</span> <strong>Offline AI fallback</strong> — works without internet in all 22 languages</li>
          <li><span class="tk">✓</span> Guided breathing modal triggered from chat</li>
          <li><span class="tk">✓</span> Daily streak counter with visual progress ring</li>
          <li><span class="tk">✓</span> 30-day mood line chart + 12-week emotion heatmap</li>
          <li><span class="tk">✓</span> Emotion Radar Chart (6-axis personality view)</li>
          <li><span class="tk">✓</span> Future letters — write to your future self, timed unlock</li>
          <li><span class="tk">✓</span> Cultural stories, mythology, wisdom quotes</li>
          <li><span class="tk">✓</span> Inactivity nudge push notification after 48h silence</li>
          <li><span class="tk">✓</span> First-chat 3-question intake arc (onboarding)</li>
          <li><span class="tk">✓</span> Razorpay UPI + Apple In-App Purchase</li>
          <li><span class="tk">✓</span> Age-based companion avatars</li>
        </ul>
      </div>
      <div class="feat-col" style="background:linear-gradient(145deg,#FFF5F8,#fff);">
        <div class="feat-col-title">🌐 Web App — imotara.com</div>
        <ul class="feat-list">
          <li><span class="tk">✓</span> <strong>Streaming replies</strong> — AI tokens appear word by word</li>
          <li><span class="tk">✓</span> Multi-thread panel — unlimited named conversation threads</li>
          <li><span class="tk">✓</span> Cross-thread memory — AI aware of past thread topics</li>
          <li><span class="tk">✓</span> Conflict detection — spots contradictions with prior statements</li>
          <li><span class="tk">✓</span> On This Day — surfaces a matching journal entry from 1 year ago</li>
          <li><span class="tk">✓</span> Tone reflection card (post-session emotion summary)</li>
          <li><span class="tk">✓</span> Emotion timeline + filter bar in History</li>
          <li><span class="tk">✓</span> Data export — JSON and CSV of full history</li>
          <li><span class="tk">✓</span> Reply origin badge (cloud vs offline AI indicator)</li>
          <li><span class="tk">✓</span> Reflect page — guided journaling prompts</li>
          <li><span class="tk">✓</span> Full admin panel at /admin (internal)</li>
        </ul>
      </div>
    </div>

    <!-- RATING STRIP -->
    <div class="rating-strip">
      <div class="rating-left">
        <div class="rating-title">App Store ratings &amp; reviews</div>
        <div class="rating-sub">Organic reviews from real users — no incentivised ratings.<br/>Reply to all reviews within 48 hours to boost store ranking.</div>
      </div>
      <div class="rating-right">
        <div class="rating-item">
          <div class="rating-stars">★★★★★</div>
          <div style="font-size:10px;font-weight:700;color:#fff;margin-top:2px;">App Store</div>
          <div class="rating-platform">iOS · Actively growing</div>
        </div>
        <div class="rating-item">
          <div class="rating-stars">★★★★★</div>
          <div style="font-size:10px;font-weight:700;color:#fff;margin-top:2px;">Google Play</div>
          <div class="rating-platform">Android · Actively growing</div>
        </div>
      </div>
    </div>

    <!-- ASO SEARCH TERMS -->
    <div class="sec">App Store Optimisation — recommended search terms</div>
    <div class="search-grid">
      <div class="search-card">
        <div class="search-store"> iOS App Store — Keywords</div>
        <div class="search-terms">
          <span class="stag">mental wellness</span><span class="stag">emotional support</span>
          <span class="stag">mood journal</span><span class="stag">ai companion</span>
          <span class="stag">hindi wellness</span><span class="stag">mental health india</span>
          <span class="stag">mood tracker</span><span class="stag">journaling app</span>
          <span class="stag">self care</span><span class="stag">stress relief</span>
        </div>
      </div>
      <div class="search-card">
        <div class="search-store">🤖 Google Play — Tags</div>
        <div class="search-terms">
          <span class="stag">Wellness</span><span class="stag">Mental Health</span>
          <span class="stag">Journaling</span><span class="stag">Mood Tracker</span>
          <span class="stag">Self-care</span><span class="stag">Mindfulness</span>
          <span class="stag">AI Chat</span><span class="stag">Indian Languages</span>
          <span class="stag">Emotional Health</span>
        </div>
      </div>
      <div class="search-card">
        <div class="search-store">🌐 SEO — Web Search Keywords</div>
        <div class="search-terms">
          <span class="stag">best mental health app India</span>
          <span class="stag">Hindi wellness app</span>
          <span class="stag">AI therapy alternative India</span>
          <span class="stag">emotional support app 2026</span>
          <span class="stag">mood tracker Indian languages</span>
        </div>
      </div>
    </div>

    <!-- APP INFO TABLE -->
    <div class="sec">App technical details — for store listings</div>
    <table style="width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:14px;">
      <thead>
        <tr>
          <th style="background:var(--navy);color:#fff;padding:7px 10px;text-align:left;border-radius:7px 0 0 0;font-size:9px;">Detail</th>
          <th style="background:#34A853;color:#fff;padding:7px 10px;text-align:center;font-size:9px;"> iOS App Store</th>
          <th style="background:#4285F4;color:#fff;padding:7px 10px;text-align:center;font-size:9px;">🤖 Google Play</th>
          <th style="background:var(--navy2);color:#fff;padding:7px 10px;text-align:center;border-radius:0 7px 0 0;font-size:9px;">🌐 Web</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--slate);font-weight:500;">App / Bundle ID</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">com.imotara.imotara</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">com.imotara.imotara</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">imotara.com</td></tr>
        <tr style="background:var(--light);"><td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--slate);font-weight:500;">Current version</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">v1.2.2 (build 102)</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">v1.2.2 (build 102)</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">v1.2.2</td></tr>
        <tr><td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--slate);font-weight:500;">Minimum OS</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">iOS 15.0+</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">Android 8.0+</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">Any modern browser</td></tr>
        <tr style="background:var(--light);"><td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--slate);font-weight:500;">Category</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">Health &amp; Fitness / Medical</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">Health &amp; Fitness</td>
          <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;color:var(--slate);">—</td></tr>
        <tr><td style="padding:6px 10px;color:var(--slate);font-weight:500;">Age rating</td>
          <td style="padding:6px 10px;text-align:center;color:var(--slate);">4+ (no adult content)</td>
          <td style="padding:6px 10px;text-align:center;color:var(--slate);">Everyone</td>
          <td style="padding:6px 10px;text-align:center;color:var(--slate);">13+ (self-declared)</td></tr>
      </tbody>
    </table>

    <!-- SCREENSHOT SPEC BOX -->
    <div style="background:var(--light);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:0;">
      <div style="font-size:9.5px;font-weight:700;color:var(--navy);margin-bottom:6px;">📐 Required screenshot specifications for store submissions</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:9px;color:var(--slate);">
        <div><strong style="color:var(--navy);">iOS (iPhone 15 Pro)</strong><br/>1290 × 2796 px · PNG · No alpha<br/>Min 3, max 10 screenshots<br/>Recommended: 5–7 with text overlays</div>
        <div><strong style="color:var(--navy);">Android (Pixel 8 / Galaxy S24)</strong><br/>1080 × 1920 px or 1440 × 2560 px<br/>PNG or JPEG · Max 8MB each<br/>Recommended: 5–8 screenshots</div>
        <div><strong style="color:var(--navy);">Suggested 5 screens to capture:</strong><br/>1. Chat conversation<br/>2. Mood check-in grid<br/>3. Home dashboard + streak<br/>4. History / emotion chart<br/>5. Companion settings</div>
      </div>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-left">
      <img class="ftr-logo" src="${logoSrc}" alt="Imotara"/>
      <span class="ftr-copy">© 2026 Imotara · Confidential · App Store Links &amp; Screenshots</span>
    </div>
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
    path:              pdfPath,
    format:            'A4',
    printBackground:   true,
    margin:            { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: false,
  });
  await browser.close();
  console.log(`PDF saved to: ${pdfPath}`);
})();
