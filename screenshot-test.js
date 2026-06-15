const { chromium } = require('playwright');

const VIEWPORTS = [
  { name: 'mobile-375',  width: 375,  height: 812  },
  { name: 'mobile-390',  width: 390,  height: 844  },
  { name: 'tablet-768',  width: 768,  height: 1024 },
  { name: 'tablet-1024', width: 1024, height: 1366 },
];

const PAGES = [
  { path: '/',         name: 'home'      },
  { path: '/chat',     name: 'chat'      },
  { path: '/history',  name: 'history'   },
  { path: '/upgrade',  name: 'upgrade'   },
  { path: '/donate',   name: 'donate'    },
  { path: '/connect',  name: 'connect'   },
  { path: '/pricing/corporate', name: 'corporate' },
  { path: '/settings', name: 'settings'  },
];

(async () => {
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    for (const pg of PAGES) {
      try {
        await page.goto(`http://localhost:3000${pg.path}`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.screenshot({ path: `/tmp/ss-${vp.name}-${pg.name}.png`, fullPage: false });
        console.log(`✅ ${vp.name} ${pg.name}`);
      } catch(e) {
        console.log(`❌ ${vp.name} ${pg.name}: ${e.message.split('\n')[0]}`);
      }
    }
    await context.close();
  }
  await browser.close();
})();
