// QA: free-consultation page (4-step form + split brand panel), end to end.
// Usage: node scripts/qa-consult.mjs [baseUrl]
// Build with PUBLIC_CONSULTATION_ENDPOINT=https://formspree.io/f/qa-test first: that URL is intercepted
// here, so nothing is really sent.
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:4321';
const browser = await chromium.launch();
const issues = [];
const log = (...a) => console.log(...a);

async function open(locale, width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 812 : 900 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !m.text().includes('GL Driver') && !m.text().includes('500') && issues.push(`${locale}-${width}: ${m.text()}`));
  page.on('pageerror', (e) => issues.push(`${locale}-${width}: ${e.message}`));
  let posted = null;
  await page.route('https://formspree.io/**', async (route) => {
    posted = JSON.parse(route.request().postData() || '{}');
    await route.fulfill(opts.fail ? { status: 500, body: '{}' } : { status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto(`${base}/${locale}/consultation/${opts.query || ''}`, { waitUntil: 'networkidle' });
  return { ctx, page, posted: () => posted };
}
const stepId = (page) => page.getAttribute('form[data-step]', 'data-step', { timeout: 1200 }).catch(() => null);
const shot = (page, name) => page.screenshot({ path: `qa/consult-${name}.png` });
const NAMES = { first: { ar: 'ياسمين', fr: 'Yasmine', en: 'Yasmine' }, last: { ar: 'العلوي', fr: 'Alaoui', en: 'Alaoui' } };

async function fillFlow(page, locale, { type = 'health', skipNeed = false, need = 'booking', shots = '', phone = '06 12 34 56 78' } = {}) {
  // 1 type: a pointer pick advances by itself
  await page.click(`label.type-card:has(input[value="${type}"])`);
  await page.waitForTimeout(900);
  if (shots) await shot(page, `${shots}-step2`);
  // 2 need (optional)
  if (skipNeed) await page.click('form[data-step=need] .brief-actions button:not(.btn-primary):not(.btn-ghost)');
  else {
    await page.check(`input[name=need][value="${need}"]`);
    await page.fill('#f-sentence', 'A short sentence');
    await page.click('form[data-step=need] button[type=submit]');
  }
  await page.waitForTimeout(700);
  // 3 name
  await page.fill('#f-first', NAMES.first[locale]);
  await page.fill('#f-last', NAMES.last[locale]);
  if (shots) await shot(page, `${shots}-step3`);
  await page.click('form[data-step=name] button[type=submit]');
  await page.waitForTimeout(700);
  // 4 phone + consent
  await page.fill('#f-phone', phone);
  await page.check('form[data-step=phone] input[type=checkbox]:not([name=website])');
  if (shots) await shot(page, `${shots}-step4`);
}

// 1) Full flow in all three locales at 375 and 1440
for (const locale of ['ar', 'fr', 'en']) {
  for (const width of [375, 1440]) {
    const tag = `${locale}-${width}`;
    const { ctx, page, posted } = await open(locale, width);
    const shots = (locale === 'ar' && width === 1440) || (locale === 'fr' && width === 1440) || (locale === 'en' && width === 375) ? tag : '';
    if (shots) await shot(page, `${tag}-step1`);
    await fillFlow(page, locale, { type: ['health', 'shop', 'architect'][['ar', 'fr', 'en'].indexOf(locale)], shots });
    await page.waitForTimeout(3200); // minimum fill time of the spam check
    await page.click('form[data-step=phone] button[type=submit]');
    await page.waitForTimeout(1500);
    if (shots) await shot(page, `${tag}-thanks`);
    const p = posted();
    log(`${tag.padEnd(8)} thanks: "${(await page.textContent('h1'))?.trim()}" | POST phone=${p?.phone} type=${p?.payload?.answers?.type} need=${p?.payload?.answers?.need} locale=${p?.payload?.locale}`);
    log(`${''.padEnd(8)} WhatsApp: ${decodeURIComponent(await page.getAttribute('a[href^="https://wa.me/"]', 'href'))}`);
    log(`${''.padEnd(8)} progress cleared: ${(await page.evaluate(() => localStorage.getItem('sistim-consult'))) === null}`);
    await ctx.close();
  }
}

// 2) Skip on the optional step, validation, consent, phone formats
{
  const { ctx, page, posted } = await open('en', 390);
  await page.click('form[data-step=type] button[type=submit]'); await page.waitForTimeout(300);
  log('type required ->', await page.textContent('.brief-error'));
  await fillFlow(page, 'en', { type: 'finance', skipNeed: true });
  await page.fill('#f-phone', '12345');
  await page.click('form[data-step=phone] button[type=submit]'); await page.waitForTimeout(300);
  log('bad phone + consent ->', (await page.$$eval('.brief-error', (e) => e.map((x) => x.textContent))).join(' | '));
  const formats = { '0612345678': '+212612345678', '+212 7 10 55 09 20': '+212710550920', '00212710550920': '+212710550920', '+33 6 12 34 56 78': '+33612345678', '+1 415 555 0132': '+14155550132', '٠٦١٢٣٤٥٦٧٨': '+212612345678', '0512345678': 'invalid', '+212 612': 'invalid', '+123': 'invalid' };
  for (const [input, want] of Object.entries(formats)) {
    await page.fill('#f-phone', input);
    await page.check('form[data-step=phone] input[type=checkbox]:not([name=website])').catch(() => {});
    await page.waitForTimeout(3200);
    await page.click('form[data-step=phone] button[type=submit]'); await page.waitForTimeout(700);
    const sent = posted();
    const thanks = await page.isVisible('.brief-q:has-text("Thank you")');
    log(`  phone ${JSON.stringify(input).padEnd(24)} -> ${thanks ? sent?.phone : 'rejected'} (expected ${want})`);
    if (thanks) { await page.goto(`${base}/en/consultation/`, { waitUntil: 'networkidle' }); await fillFlow(page, 'en', { type: 'finance', skipNeed: true }); }
  }
  log('skipped need sent as:', JSON.stringify(posted()?.payload?.answers));
  await ctx.close();
}

// 3) Health note, Back, resume, ?need= prefill, keyboard only
{
  const { ctx, page } = await open('fr', 390, { query: '?need=saas' });
  await page.click('label.type-card:has(input[value="health"])'); await page.waitForTimeout(800);
  log('?need=saas prefilled:', await page.isChecked('input[name=need][value=saas]'));
  await page.click('form[data-step=need] button[type=submit]'); await page.waitForTimeout(600);
  await page.fill('#f-first', 'Omar'); await page.fill('#f-last', 'Idrissi');
  await page.click('form[data-step=name] button[type=submit]'); await page.waitForTimeout(600);
  log('health note shown on phone step:', await page.isVisible('.brief-note'));
  await page.click('form[data-step=phone] .brief-actions button.btn-ghost'); await page.waitForTimeout(500);
  log('Back ->', await stepId(page), '| name kept:', await page.inputValue('#f-first'));
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  log('resumed at:', await stepId(page), '| name kept after reload:', await page.inputValue('#f-first').catch(() => 'n/a'));
  await ctx.close();
}
{
  const { ctx, page } = await open('en', 1280);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await page.focus('input[name=type] >> nth=0');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  log('keyboard: arrow + Enter ->', await stepId(page));
  await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  log('keyboard: Enter on optional step ->', await stepId(page), '| focus:', await page.evaluate(() => document.activeElement?.id));
  await ctx.close();
}

// 4) Failed submit keeps the lead
{
  const { ctx, page } = await open('ar', 375, { fail: true });
  await fillFlow(page, 'ar', { type: 'shop', skipNeed: true, shots: 'ar-375-fail' });
  await page.waitForTimeout(3200);
  await page.click('form[data-step=phone] button[type=submit]'); await page.waitForTimeout(1200);
  await shot(page, 'ar-375-error');
  log('failed submit ->', (await page.textContent('h1'))?.trim(), '| WhatsApp + mailto offered:', await page.isVisible('a[href^="https://wa.me/"]'), await page.isVisible('a[href^="mailto:"]'),
    '| progress kept:', (await page.evaluate(() => localStorage.getItem('sistim-consult'))) !== null);
  await ctx.close();
}

// 5) Reduced motion: circuit fully drawn, nothing animating
{
  const { ctx, page } = await open('en', 1440, { reduced: true });
  await page.waitForTimeout(600);
  const state = await page.evaluate(() => {
    const segs = [...document.querySelectorAll('.consult-art .cx-seg')].map((p) => getComputedStyle(p).strokeDashoffset);
    return { dashoffsets: segs, floatAnim: getComputedStyle(document.querySelector('.ill-float')).animationName };
  });
  log('reduced motion:', JSON.stringify(state));
  await shot(page, 'en-1440-reduced');
  await ctx.close();
}

// 6) The six illustration swaps (and the generic default), cropped from the panel
{
  const { ctx, page } = await open('fr', 1440);
  const sharp = (await import('sharp')).default;
  const types = ['health', 'shop', 'architect', 'finance', 'freelancer', 'other'];
  log('default illustration:', await page.getAttribute('.ill-box', 'data-active'));
  const tiles = [];
  for (const t of types) {
    await page.click(`label.type-card:has(input[value="${t}"])`);
    await page.waitForTimeout(950);
    const active = await page.getAttribute('.ill-box', 'data-active');
    const box = await page.locator('.ill-box').boundingBox();
    tiles.push(await page.screenshot({ clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } }));
    const sizeKb = await page.evaluate((id) => new Blob([document.querySelector(`.ill[data-ill="${id}"]`).outerHTML]).size / 1024, active);
    log(`  ${t.padEnd(11)} -> illustration "${active}" (${sizeKb.toFixed(1)} KB markup)`);
    await page.click('form[data-step=need] .brief-actions button.btn-ghost'); // Back to step 1
    await page.waitForTimeout(500);
  }
  const w = (await sharp(tiles[0]).metadata()).width, h = (await sharp(tiles[0]).metadata()).height;
  await sharp({ create: { width: w * 3, height: h * 2, channels: 3, background: '#171D29' } })
    .composite(await Promise.all(tiles.map(async (t, i) => ({ input: await sharp(t).resize(w, h).toBuffer(), left: (i % 3) * w, top: Math.floor(i / 3) * h })))).png().toFile('qa/consult-illustrations.png');
  await ctx.close();
}

// 7) RTL mirroring: form/panel sides, circuit flip, progress direction
for (const locale of ['ar', 'en']) {
  const { ctx, page } = await open(locale, 1440);
  const m = await page.evaluate(() => {
    const f = document.querySelector('main').getBoundingClientRect();
    const p = document.querySelector('.consult-art').getBoundingClientRect();
    const seg = document.querySelector('.consult-steps > span').getBoundingClientRect();
    const last = [...document.querySelectorAll('.consult-steps > span')].pop().getBoundingClientRect();
    return { formCenter: Math.round(f.x + f.width / 2), panelCenter: Math.round(p.x + p.width / 2), firstSegX: Math.round(seg.x), lastSegX: Math.round(last.x),
      circuitTransform: getComputedStyle(document.querySelector('.consult-art svg')).transform, dir: document.documentElement.dir };
  });
  log(`mirroring ${locale}: dir=${m.dir} form on the ${m.formCenter > m.panelCenter ? 'RIGHT' : 'LEFT'} (panel ${m.panelCenter < m.formCenter ? 'left' : 'right'}) | progress starts at ${m.firstSegX > m.lastSegX ? 'right' : 'left'} | circuit transform ${m.circuitTransform}`);
  await ctx.close();
}

log('console issues:', issues.length ? issues : 'none');
await browser.close();
