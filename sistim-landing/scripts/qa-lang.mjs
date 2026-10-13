// QA: language detection on "/" for several device languages and a stored preference.
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:4321';
const browser = await chromium.launch();
const cases = [
  { name: 'ar-MA device', languages: ['ar-MA', 'fr-FR'] },
  { name: 'fr-FR device', languages: ['fr-FR', 'en-US'] },
  { name: 'en-US device', languages: ['en-US'] },
  { name: 'es-ES device (no match)', languages: ['es-ES', 'de-DE'] },
  { name: 'es-ES then fr (2nd matches)', languages: ['es-ES', 'fr-CA'] },
  { name: 'ar-EG variant', languages: ['ar-EG'] },
  { name: 'stored "fr" on an en-US device', languages: ['en-US'], stored: 'fr' },
  { name: 'switcher click AR on /en/, then revisit /', languages: ['en-US'], clickAr: true },
  { name: 'no JavaScript', languages: ['fr-FR'], noJs: true },
];
for (const c of cases) {
  const ctx = await browser.newContext({ javaScriptEnabled: !c.noJs });
  await ctx.addInitScript((langs) => {
    Object.defineProperty(navigator, 'languages', { get: () => langs });
    Object.defineProperty(navigator, 'language', { get: () => langs[0] });
  }, c.languages);
  const page = await ctx.newPage();
  if (c.stored) { await page.goto(base + '/en/'); await page.evaluate((v) => localStorage.setItem('sistim-lang', v), c.stored); }
  if (c.clickAr) {
    await page.goto(base + '/en/', { waitUntil: 'networkidle' });
    await page.click('header a[data-lang-link="ar"] >> nth=0', { force: true }).catch(async () => { await page.setViewportSize({ width: 1280, height: 800 }); await page.click('header a[data-lang-link="ar"] >> nth=0'); });
    await page.waitForLoadState('networkidle');
  }
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const url = new URL(page.url()).pathname;
  const extra = c.noJs ? ` (chooser links: ${(await page.$$eval('a[data-lang-link]', (as) => as.map((a) => a.getAttribute('href')))).join(' ')})` : '';
  const history = c.noJs ? '' : ` | back-button target: ${await page.evaluate(() => history.length)} entries`;
  console.log(`${c.name.padEnd(42)} -> ${url}${extra}${history}`);
  await ctx.close();
}
await browser.close();
