// Usage: node shoot.js <url> <out.png> [width height scale]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = 1400, h = 1000, s = 2] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +s });
  p.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  await p.screenshot({ path: out });
  await b.close();
})();
