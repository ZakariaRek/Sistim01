// QA: free-consultation placement on the landing page (hero, band, mobile bar, final CTA).
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:4321';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const issues = [];
const scrollTo = (page, sel, block = 'start') => page.evaluate(([s, b]) => {
  const el = document.querySelector(s);
  const y = el.getBoundingClientRect().top + scrollY - (b === 'center' ? innerHeight / 2 - el.offsetHeight / 2 : 90);
  window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y);
}, [sel, block]);

for (const locale of ['ar', 'fr', 'en']) {
  for (const width of [375, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 812 : 900 } });
    const page = await ctx.newPage();
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !m.text().includes('GL Driver') && issues.push(`${locale}-${width}: ${m.text()}`));
    page.on('pageerror', (e) => issues.push(`${locale}-${width}: ${e.message}`));
    await page.goto(`${base}/${locale}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const tag = `${locale}-${width}`;
    await page.screenshot({ path: `qa/consult-${tag}-hero.png` });
    const links = await page.$$eval(`a[href="/${locale}/consultation/"]`, (as) => as.length);
    const bar = async () => page.evaluate(() => document.getElementById('mobile-bar')?.classList.contains('is-visible'));
    const barAtHero = await bar();
    await scrollTo(page, '.consult-band', 'center');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `qa/consult-${tag}-band.png` });
    const barMid = await bar();
    await scrollTo(page, '#process');
    await page.waitForTimeout(1500);
    if (width < 500) await page.screenshot({ path: `qa/consult-${tag}-mobilebar.png` });
    await scrollTo(page, '#contact');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `qa/consult-${tag}-final.png` });
    const barAtFinal = await bar();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(`${tag.padEnd(9)} consultation links: ${links} | mobile bar at hero/mid/final: ${barAtHero}/${barMid}/${barAtFinal} | overflowX ${overflow}`);
    await ctx.close();
  }
}
console.log('console issues:', issues.length ? issues : 'none');
await browser.close();
