// Renders the 1200×630 Open Graph image for each locale with headless Chromium.
// Run: node scripts/og-images.mjs  (re-run after changing the hero copy)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { ar } from '../src/i18n/ar.ts';
import { fr } from '../src/i18n/fr.ts';
import { en } from '../src/i18n/en.ts';

// Inline assets as data URIs (setContent pages cannot load file:// URLs)
const pub = (p) => `data:${p.endsWith('.png') ? 'image/png' : 'font/woff2'};base64,${readFileSync(new URL(`../public/${p}`, import.meta.url)).toString('base64')}`;
const dicts = { ar, fr, en };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [loc, d] of Object.entries(dicts)) {
  const rtl = loc === 'ar';
  await page.setContent(`<!doctype html><html lang="${loc}" dir="${rtl ? 'rtl' : 'ltr'}"><head><style>
    @font-face { font-family: R; src: url('${pub('fonts/readex-pro-arabic-wght-normal.woff2')}'); font-weight: 160 700; unicode-range: U+0600-06FF, U+FB50-FDFF, U+FE70-FEFC; }
    @font-face { font-family: R; src: url('${pub('fonts/readex-pro-latin-wght-normal.woff2')}'); font-weight: 160 700; }
    * { margin: 0; box-sizing: border-box; }
    body { width: 1200px; height: 630px; background: radial-gradient(900px 600px at ${rtl ? '15%' : '85%'} 30%, rgb(22 171 121 / .16), transparent 60%), linear-gradient(180deg, #232B3B, #171D29); color: #fff; font-family: R, sans-serif; display: grid; grid-template-columns: 1.15fr 1fr; align-items: center; gap: 40px; padding: 70px; position: relative; overflow: hidden; }
    .grid { position: absolute; inset: 0; background-image: linear-gradient(rgb(255 255 255 / .04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / .04) 1px, transparent 1px); background-size: 48px 48px; }
    .k { display: flex; align-items: center; gap: 12px; color: #3CCB98; font-size: 22px; margin-bottom: 22px; }
    .k i { width: 12px; height: 12px; border-radius: 50%; background: #16AB79; box-shadow: 0 0 14px #16AB79; }
    h1 { font-size: ${rtl ? 54 : 56}px; line-height: ${rtl ? 1.45 : 1.08}; font-weight: 600; letter-spacing: ${rtl ? 0 : '-0.02em'}; position: relative; }
    img { width: 100%; position: relative; }
    .bar { position: absolute; inset: auto 0 0 0; height: 6px; background: linear-gradient(90deg, transparent, #16AB79, transparent); }
  </style></head><body><div class="grid"></div>
    <div style="position:relative"><p class="k"><i></i>${d.hero.kicker}</p><h1>${d.hero.title}</h1></div>
    <img src="${pub('brand/wordmark-circuit-960.png')}" alt="">
    <div class="bar"></div></body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/og/og-${loc}.png` });
  console.log('og', loc);
}
await browser.close();
