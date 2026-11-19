// node render.js  ->  logo.png (transparent) and logo-preview.png (on sky blue)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [q, out] of [['', 'logo.png'], ['?preview', 'logo-preview.png']]) {
    const p = await b.newPage({ viewport: { width: 2600, height: 1800 }, deviceScaleFactor: 1 });
    await p.goto('http://localhost:8766/logo.html' + q);
    await p.waitForFunction(() => document.title === 'ready');
    await p.waitForTimeout(300);
    await (await p.$('#logo')).screenshot({ path: out, omitBackground: !q });
    await p.close();
  }
  await b.close();
})();
