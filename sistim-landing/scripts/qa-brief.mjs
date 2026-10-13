// QA: drive the free-consultation brief end to end.
// Usage: node scripts/qa-brief.mjs [baseUrl]
// Build with PUBLIC_CONSULTATION_ENDPOINT=https://formspree.io/f/qa-test first: that endpoint is
// intercepted here, so nothing is really sent.
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:4321';
const browser = await chromium.launch();
const issues = [];

async function open(locale, width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 812 : 900 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !m.text().includes('GL Driver') && issues.push(`${locale}: ${m.text()}`));
  page.on('pageerror', (e) => issues.push(`${locale}: ${e.message}`));
  let posted = null;
  await page.route('https://formspree.io/**', async (route) => {
    posted = JSON.parse(route.request().postData() || '{}');
    await route.fulfill(opts.fail ? { status: 500, body: '{}' } : { status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto(`${base}/${locale}/consultation/${opts.query || ''}`, { waitUntil: 'networkidle' });
  return { ctx, page, posted: () => posted };
}

const stepId = (page) => page.getAttribute('form[data-step]', 'data-step', { timeout: 1500 }).catch(() => null);
const cont = (page) => page.click('form[data-step] button[type=submit]');

/** Answer the current step. pick = { fieldId: optionValue }; otherwise the first option. */
async function answer(page, pick) {
  const handled = new Set();
  for (const input of await page.$$('form[data-step] input:not([name=website]), form[data-step] textarea')) {
    const type = await input.getAttribute('type');
    const name = await input.getAttribute('name');
    if (type === 'radio' || (type === 'checkbox' && name)) {
      if (handled.has(name)) continue;
      handled.add(name);
      const want = pick[name];
      const target = want ? await page.$(`form[data-step] input[name="${name}"][value="${want}"]`) : await page.$(`form[data-step] input[name="${name}"]`);
      if (target && !(await target.isChecked())) await target.check();
    } else if (type === 'checkbox') {
      if (!(await input.isChecked())) await input.check();
    } else if (type === 'tel') await input.fill('06 12 34 56 78');
    else if (type === 'url') { if (name === 'websiteUrl') await input.fill('monsite.ma'); }
    else if (type === 'email') { /* optional */ }
    else if (!(await input.inputValue())) await input.fill(name === 'firstName' ? 'Yasmine' : 'QA answer');
  }
}

async function runFlow(locale, width, pick, opts = {}) {
  const { ctx, page, posted } = await open(locale, width, opts);
  const tag = `${locale}-${width}${opts.tag ? '-' + opts.tag : ''}`;
  if (opts.shots) await page.screenshot({ path: `qa/brief-${tag}-intro.png` });
  await page.click('.brief-panel button.btn-primary');
  const seen = [];
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    const id = await stepId(page);
    if (!id) break;
    await answer(page, pick);
    if (opts.shots && i === 0) await page.screenshot({ path: `qa/brief-${tag}-step1.png` });
    if (opts.shots && id === opts.adaptiveShot) await page.screenshot({ path: `qa/brief-${tag}-adaptive.png` });
    seen.push(id);
    if ((await stepId(page)) === id) await cont(page).catch(() => {});
    await page.waitForTimeout(550);
    if ((await stepId(page)) === id) {
      issues.push(`${tag}: stuck on ${id}: ${await page.textContent('.brief-error').catch(() => '')}`);
      break;
    }
  }
  if (opts.shots) await page.screenshot({ path: `qa/brief-${tag}-summary.png`, fullPage: true });
  await page.waitForTimeout(8200); // respect the minimum fill time of the spam check
  await page.click('form button[type=submit]');
  await page.waitForTimeout(900);
  if (opts.shots) await page.screenshot({ path: `qa/brief-${tag}-${opts.fail ? 'error' : 'thanks'}.png`, fullPage: true });
  const result = (await page.textContent('.brief-panel h2'))?.trim();
  const p = posted();
  const stored = await page.evaluate(() => localStorage.getItem('sistim-brief'));
  console.log(`${tag.padEnd(22)} steps(${seen.length}): ${seen.join(' > ')}`);
  console.log(`${''.padEnd(22)} result: "${result}" | POST: ${p ? `phone=${p.phone} locale=${p.payload?.locale} msgLines=${p.message.split('\n').length}` : 'none'} | progress kept: ${!!stored}`);
  if (opts.waCheck) {
    const wa = await page.getAttribute('a[href^="https://wa.me/"]', 'href');
    console.log(`${''.padEnd(22)} WhatsApp link (${wa.length} chars): ${decodeURIComponent(wa).slice(0, 160).replace(/\n/g, ' / ')}…`);
  }
  await ctx.close();
}

// 1) Branching per business type (+ SaaS need + website URL) in all three locales
const branches = {
  health: { businessType: 'health', need: 'booking', today: 'nothing' },
  shop: { businessType: 'shop', need: 'store', today: 'social' },
  architect: { businessType: 'architect', need: 'portfolio', today: 'website' },
  finance: { businessType: 'finance', need: 'saas', today: 'nothing' },
  freelancer: { businessType: 'freelancer', need: 'portfolio', today: 'nothing' },
};
for (const [name, pick] of Object.entries(branches)) await runFlow('en', 1440, { ...pick, channel: 'whatsapp_chat' }, { tag: name });
await runFlow('ar', 375, { ...branches.health, channel: 'whatsapp_call' }, { shots: true, adaptiveShot: 'healthRecords', tag: 'health', waCheck: true });
await runFlow('ar', 1440, { ...branches.shop, channel: 'phone' }, { shots: true, adaptiveShot: 'shopPayments', tag: 'shop' });
await runFlow('fr', 375, { ...branches.architect, channel: 'whatsapp_call' }, { shots: true, adaptiveShot: 'archPhotos', tag: 'arch' });
await runFlow('fr', 1440, { ...branches.finance, channel: 'whatsapp_chat' }, { tag: 'finance' });
await runFlow('en', 375, { ...branches.shop, channel: 'phone' }, { shots: true, adaptiveShot: 'shopProducts', tag: 'shop' });
await runFlow('en', 1440, { ...branches.health, channel: 'whatsapp_call' }, { shots: true, tag: 'fail', fail: true, waCheck: true });
await runFlow('ar', 375, { ...branches.freelancer, channel: 'whatsapp_chat' }, { tag: 'reduced', reduced: true });

// 2) Validation, Back, resume, ?need= prefill
{
  const { ctx, page } = await open('en', 390, { query: '?need=saas' });
  await page.click('.brief-panel button.btn-primary');
  await page.waitForTimeout(300);
  await cont(page); await page.waitForTimeout(300);
  console.log('validation (empty first name):', await page.textContent('.brief-error'), '| aria-describedby:', await page.getAttribute('#f-firstName', 'aria-describedby'), '| focused:', await page.evaluate(() => document.activeElement?.id));
  await page.fill('#f-firstName', 'Omar'); await cont(page); await page.waitForTimeout(450);
  await cont(page); await page.waitForTimeout(300);
  console.log('validation (no option):', await page.textContent('.brief-error'));
  await page.check('input[value=health]'); await cont(page); await page.waitForTimeout(500);
  console.log('need prefilled from ?need=saas:', await page.isChecked('input[name=need][value=saas]'));
  await page.click('form[data-step] .brief-actions > button.btn-ghost'); await page.waitForTimeout(450);
  console.log('Back ->', await stepId(page));
  await page.reload({ waitUntil: 'networkidle' });
  console.log('resume offered after reload:', await page.isVisible('text=Continue where I left off'));
  await page.click('text=Continue where I left off'); await page.waitForTimeout(450);
  console.log('resumed at:', await stepId(page));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  console.log('keyboard only (arrow + Enter) ->', await stepId(page));
  await ctx.close();
}
// 3) Skip + contact validation + phone normalisation
{
  const { ctx, page } = await open('fr', 1440);
  await page.click('.brief-panel button.btn-primary');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    const id = await stepId(page);
    if (id === 'references') { await page.click('text=Passer'); await page.waitForTimeout(450); console.log('Skip on references ->', await stepId(page)); continue; }
    if (id === 'contact') {
      await page.check('input[name=channel] >> nth=0'); await page.check('input[name=bestTime] >> nth=0');
      await page.fill('#f-phone', '12345'); await page.fill('#f-name', 'Yasmine');
      await cont(page); await page.waitForTimeout(300);
      console.log('contact errors:', (await page.$$eval('.brief-error', (e) => e.map((x) => x.textContent))).join(' | '));
      await page.fill('#f-phone', '+212 7 10 55 09 20'); await page.check('form[data-step] input[type=checkbox]:not([name])');
      await cont(page); await page.waitForTimeout(450);
      console.log('valid phone accepted, moved on to:', await stepId(page));
      break;
    }
    await answer(page, { businessType: 'other' });
    if ((await stepId(page)) === id) await cont(page).catch(() => {});
    await page.waitForTimeout(450);
  }
  await ctx.close();
}
console.log('console issues:', issues.length ? issues : 'none');
await browser.close();
