// QA: templates section + viewer page.  node scripts/qa-templates.mjs [baseUrl]
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:4321';
const browser = await chromium.launch();
const issues = [];
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scrollToSel = (page, sel, off = 90) => page.evaluate(([s, o]) => {
  const y = document.querySelector(s).getBoundingClientRect().top + scrollY - o;
  window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y);
}, [sel, off]);

async function newPage(width, height, locale = 'en', opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !m.text().includes('GL Driver') && issues.push(`${locale}-${width}: ${m.text().slice(0, 150)}`));
  page.on('pageerror', (e) => issues.push(`${locale}-${width}: ${e.message}`));
  return { ctx, page };
}

// 1) landing section in 3 locales at 1440 and 375
for (const locale of ['en', 'ar', 'fr']) {
  for (const width of [1440, 375]) {
    const { ctx, page } = await newPage(width, width < 500 ? 812 : 900, locale);
    await page.goto(`${base}/${locale}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await scrollToSel(page, '#work');
    await page.waitForTimeout(2200);
    const info = await page.evaluate(() => ({
      cards: document.querySelectorAll('#work .tpl').length,
      broken: [...document.querySelectorAll('#work .tpl-shot')].filter((i) => !i.complete || i.naturalWidth === 0).length,
      hrefs: [...document.querySelectorAll('#work .tpl')].map((a) => new URL(a.href).pathname).join(' '),
      overflowX: document.documentElement.scrollWidth - innerWidth,
      navLabel: document.querySelector('header nav a[href="#work"]')?.textContent?.trim() || '(nav collapsed)',
    }));
    log(`${locale}-${width}: ${info.cards} cards, broken images ${info.broken}, overflowX ${info.overflowX}, nav "${info.navLabel}"`);
    if (width === 1440) log('   links:', info.hrefs);
    await page.screenshot({ path: `qa/tpl-${locale}-${width}-section.png` });
    await ctx.close();
  }
}

// 2) hover scroll on a card (desktop)
{
  const { ctx, page } = await newPage(1440, 900, 'en');
  await page.goto(`${base}/en/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await scrollToSel(page, '#work', 140);
  await page.waitForTimeout(2200);
  const card = page.locator('#work .tpl').nth(1);
  const pos = () => card.locator('.tpl-shot').evaluate((i) => getComputedStyle(i).objectPosition);
  const before = await pos();
  await card.hover();
  await page.waitForTimeout(3500);
  const mid = await pos();
  await page.screenshot({ path: 'qa/tpl-en-1440-hover.png' });
  log(`hover scroll preview: object-position ${before} -> ${mid} (moves while hovered)`);
  await ctx.close();
}

// 3) click a card -> viewer: frame renders, scroll inside it, internal anchor, external link, device toggle
{
  const { ctx, page } = await newPage(1440, 900, 'en');
  await page.goto(`${base}/en/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await scrollToSel(page, '#work', 140);
  await page.waitForTimeout(1500);
  await page.locator('#work .tpl').first().click();
  await page.waitForURL('**/en/templates/dentist/', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('.viewer')?.dataset.loaded === 'true', null, { timeout: 15000 });
  const frameEl = page.frameLocator('.viewer-frame');
  await page.waitForTimeout(2500);
  const fr = page.frames().find((f) => f.url().includes('.dc.html'));
  const rendered = await fr.evaluate(() => ({ h: document.documentElement.scrollHeight, text: document.body.innerText.slice(0, 60).replace(/\n/g, ' ') }));
  log(`viewer: ${page.url().replace(base, '')} | template height ${rendered.h}px | starts "${rendered.text}"`);
  await page.screenshot({ path: 'qa/tpl-viewer-en-desktop-top.png' });

  // scroll the template inside the frame with the mouse wheel
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(900);
  const scrolled = await fr.evaluate(() => Math.round(scrollY));
  log(`scroll inside the frame: scrollY ${scrolled}px (page itself still fits the viewport: ${await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)})`);
  await page.screenshot({ path: 'qa/tpl-viewer-en-desktop-scrolled.png' });

  // external links open a new tab instead of loading into the frame
  const popupP = page.waitForEvent('popup', { timeout: 6000 }).catch(() => null);
  await fr.evaluate(() => { const a = [...document.querySelectorAll('a[href^="https://wa.me"]')][0]; a?.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(300);
  await fr.evaluate(() => [...document.querySelectorAll('a[href^="https://wa.me"]')][0]?.click());
  const popup = await popupP;
  log('WhatsApp link inside the demo opens a new tab:', popup ? popup.url().slice(0, 40) : 'NO POPUP', '| frame still on the template:', fr.url().includes('.dc.html'));
  await popup?.close();

  // device toggle
  await page.click('[data-set-device="mobile"]');
  await page.waitForTimeout(900);
  const dev = await page.evaluate(() => ({ w: Math.round(document.querySelector('.viewer-device').getBoundingClientRect().width), device: document.querySelector('.viewer').dataset.device }));
  log(`mobile toggle: device frame ${dev.w}px wide (${dev.device})`);
  await page.screenshot({ path: 'qa/tpl-viewer-en-mobile.png' });

  // CTA + back
  const cta = await page.locator('.viewer-bar a.btn-primary').getAttribute('href');
  log('CTA ->', cta);
  await page.click('.viewer-back');
  await page.waitForURL('**/en/#work', { timeout: 10000 });
  log('Back ->', new URL(page.url()).pathname + new URL(page.url()).hash);
  await ctx.close();
}

// 4) viewer in Darija (RTL) at desktop + each template loads at 375
{
  const { ctx, page } = await newPage(1440, 900, 'ar');
  await page.goto(`${base}/ar/templates/restaurant/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.viewer')?.dataset.loaded === 'true', null, { timeout: 15000 });
  await page.waitForTimeout(2000);
  const rtl = await page.evaluate(() => {
    const back = document.querySelector('.viewer-back').getBoundingClientRect(), cta = document.querySelector('.viewer-bar .btn-primary').getBoundingClientRect();
    return { dir: document.documentElement.dir, backOnRight: back.x > cta.x };
  });
  log(`viewer AR: dir=${rtl.dir}, back button on the ${rtl.backOnRight ? 'RIGHT (start side)' : 'left'}`);
  await page.screenshot({ path: 'qa/tpl-viewer-ar-desktop.png' });
  await ctx.close();
}
for (const slug of ['dentist', 'cars', 'portfolio', 'restaurant']) {
  const { ctx, page } = await newPage(375, 812, 'fr');
  await page.goto(`${base}/fr/templates/${slug}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('.viewer')?.dataset.loaded === 'true', null, { timeout: 15000 });
  await page.waitForTimeout(2200);
  const fr = page.frames().find((f) => f.url().includes('.dc.html'));
  const h = await fr.evaluate(() => document.documentElement.scrollHeight);
  const ox = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  log(`  mobile ${slug}: template height ${h}px, page overflowX ${ox}`);
  if (slug === 'cars') await page.screenshot({ path: 'qa/tpl-viewer-fr-375.png' });
  await ctx.close();
}

// 5) reduced motion: no hover scrolling
{
  const { ctx, page } = await newPage(1440, 900, 'en', { reducedMotion: 'reduce' });
  await page.goto(`${base}/en/`, { waitUntil: 'networkidle' });
  const tr = await page.locator('#work .tpl-shot').first().evaluate((i) => getComputedStyle(i).transitionDuration);
  log('reduced motion: preview transition duration', tr);
  await ctx.close();
}
log('console issues:', issues.length ? [...new Set(issues)] : 'none');
await browser.close();
