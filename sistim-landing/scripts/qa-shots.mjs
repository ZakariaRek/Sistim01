// QA: screenshots per locale/width + console errors + horizontal overflow check.
// Usage: node scripts/qa-shots.mjs [baseUrl] [widths] [locales] [--full] [--reduced]
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:4321';
const widths = (process.argv[3] || '375,768,1440').split(',').map(Number);
const locales = (process.argv[4] || 'ar,fr,en').split(',');
const full = process.argv.includes('--full');
const reduced = process.argv.includes('--reduced');
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
for (const loc of locales) {
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 812 : w < 1000 ? 1024 : 900 }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference', locale: 'ar-MA' });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
    const path = `/${loc}/`;
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3200);
    const tag = `${loc}-${w}${reduced ? '-reduced' : ''}`;
    await page.screenshot({ path: `qa/${tag}-hero.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (full) {
      // Step through the page one viewport at a time (avoids full-page stitching artefacts
      // with fixed elements), then compose the frames into one contact sheet.
      const vh = page.viewportSize().height;
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      const frames = [];
      for (let y = 0, i = 0; y < total; y += vh, i++) {
        await page.evaluate((top) => (window.__lenis ? window.__lenis.scrollTo(top, { immediate: true }) : window.scrollTo(0, top)), y);
        await page.waitForTimeout(1300);
        frames.push(await page.screenshot());
      }
      const { default: sharp } = await import('sharp');
      const cols = w < 500 ? Math.min(frames.length, 8) : w < 1000 ? 5 : 3;
      const scale = w < 500 ? 1 : w < 1000 ? 0.5 : 0.5;
      const fw = Math.round(w * scale), fh = Math.round(vh * scale);
      const rows = Math.ceil(frames.length / cols);
      const parts = await Promise.all(frames.map(async (f, i) => ({ input: await sharp(f).resize(fw, fh).toBuffer(), left: (i % cols) * (fw + 8), top: Math.floor(i / cols) * (fh + 8) })));
      await sharp({ create: { width: cols * (fw + 8), height: rows * (fh + 8), channels: 3, background: '#ff00ff' } }).composite(parts).png().toFile(`qa/${tag}-sheet.png`);
    }
    console.log(tag, 'overflowX:', overflow, logs.length ? logs : 'no console issues');
    await ctx.close();
  }
}
await browser.close();
