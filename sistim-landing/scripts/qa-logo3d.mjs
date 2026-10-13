// QA for the 3D logo on /consultation (software WebGL in headless Chromium).
// Usage: node scripts/qa-logo3d.mjs [baseUrl]
// Build with PUBLIC_CONSULTATION_ENDPOINT=https://formspree.io/f/qa-test first: that URL is intercepted here.
import { chromium } from 'playwright';
import sharp from 'sharp';
const base = process.argv[2] || 'http://localhost:4321';
const GL = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const issues = [];
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: GL });

async function open(locale, { width = 1440, height = 900, reduced = false, noWebgl = false, throttle = 0, fail = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  if (noWebgl) await ctx.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...r) { return /webgl/i.test(type) ? null : orig.call(this, type, ...r); };
  });
  const page = await ctx.newPage();
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !m.text().includes('GL Driver') && !m.text().includes('500') && issues.push(`${locale}-${width}: ${m.text().slice(0, 160)}`));
  page.on('pageerror', (e) => issues.push(`${locale}-${width}: ${e.message}`));
  await page.route('https://formspree.io/**', (route) => route.fulfill(fail ? { status: 500, body: '{}' } : { status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  if (throttle) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  await page.goto(`${base}/${locale}/consultation/?qa3d=1`, { waitUntil: 'networkidle' });
  return { ctx, page };
}
// A tap that does not wait for a busy (software-rendered) page: pointerdown + click straight in the DOM
const tap = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  el.click();
}, sel);
/** Records the spin angle on every animation frame for `ms`; returns [[t, angle], ...]. */
const sampleSpin = (page, ms) => page.evaluate((ms) => new Promise((res) => {
  const hook = document.querySelector('canvas.logo3d-canvas').__logo;
  const out = [], t0 = performance.now();
  const f = () => { const t = performance.now() - t0; out.push([t, hook.info().spin]); if (t < ms) requestAnimationFrame(f); else res(out); };
  requestAnimationFrame(f);
}), ms);
const wrap = (d) => ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; // the angle is normalised at the end of a spin
/** Total turns and the peak speed over sliding 250 ms windows (single-frame deltas are too jittery in software GL). */
const speed = (samples) => {
  const cum = [0];
  for (let k = 1; k < samples.length; k++) cum.push(cum[k - 1] + wrap(samples[k][1] - samples[k - 1][1]));
  let peak = 0;
  for (let a = 0; a < samples.length; a++) {
    let b = a;
    while (b < samples.length && samples[b][0] - samples[a][0] < 250) b++;
    if (b >= samples.length) break;
    peak = Math.max(peak, Math.abs(cum[b] - cum[a]) / (Math.PI * 2) / ((samples[b][0] - samples[a][0]) / 1000));
  }
  return { turns: Math.abs(cum[cum.length - 1]) / (Math.PI * 2), peak };
};
const ready = (page, ms = 20000) => page.waitForFunction(() => document.querySelector('.logo3d')?.dataset.ready === 'true', null, { timeout: ms });
const info = (page) => page.evaluate(() => document.querySelector('canvas.logo3d-canvas')?.__logo?.info());
const stage = (page) => page.locator('.logo3d-stage').boundingBox();
const shotStage = async (page, name, pad = 0) => {
  const b = await stage(page);
  await page.screenshot({ path: `qa/${name}.png`, clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 } });
};
const bbox = async (buf, test) => {
  const { data, info: i } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < i.height; y++) for (let x = 0; x < i.width; x++) {
    const o = (y * i.width + x) * 4;
    if (test(data[o], data[o + 1], data[o + 2], data[o + 3])) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
};

// 1) front pose vs the original badge: overlay + silhouette overlap
{
  const { ctx, page } = await open('en');
  await ready(page);
  await page.evaluate(() => document.querySelector('canvas.logo3d-canvas').__logo.freeze(0));
  await sleep(300);
  const b = await stage(page);
  const shot = await page.screenshot({ clip: { x: b.x, y: b.y, width: b.width, height: b.height } });
  const white = (r, g, bl) => r > 215 && g > 215 && bl > 215;
  const orig = await sharp('../brand/logo-badge.jpg').extract({ left: 440, top: 520, width: 1210, height: 840 }).png().toBuffer();
  const ob = await bbox(orig, white);
  const sb = await bbox(shot, white);
  const origCrop = await sharp(orig).extract(ob).png().toBuffer();
  const fitted = await sharp(shot).extract(sb).resize(ob.width, ob.height, { fit: 'fill' }).png().toBuffer();
  const scaled = await sharp(fitted).ensureAlpha().composite([{ input: Buffer.from([0, 0, 0, 128]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }]).png().toBuffer();
  const overlay = await sharp(origCrop).composite([{ input: scaled, blend: 'over' }]).png().toBuffer();
  await sharp(overlay).resize({ width: 1000 }).toFile('qa/logo3d-overlay.png');
  // silhouette IoU after fitting the letter bbox
  const a = await sharp(origCrop).removeAlpha().raw().toBuffer(), c = await sharp(fitted).removeAlpha().raw().toBuffer();
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i += 3) {
    const wa = a[i] > 200 && a[i + 1] > 200 && a[i + 2] > 200;
    const wc = c[i] > 190 && c[i + 1] > 190 && c[i + 2] > 190;
    if (wa && wc) inter++; if (wa || wc) uni++;
  }
  log(`front pose vs badge: letter silhouette IoU ${(inter / uni).toFixed(3)} (perspective + bevel shading, letter bbox fitted)`);
  await ctx.close();
}

// 2) one spin across a step change (type pick), speed limit, chip, reverse on Back
{
  const { ctx, page } = await open('en');
  await ready(page);
  await sleep(900);
  const tiles = [];
  const samplesP = tap(page, 'label.type-card:has(input[value="shop"])').then(() => sampleSpin(page, 1900));
  for (let k = 0; k < 6; k++) { const b = await stage(page); tiles.push(await page.screenshot({ clip: { x: b.x, y: b.y, width: b.width, height: b.height } })); await sleep(120); }
  const r = speed(await samplesP);
  log(`step spin: ${r.turns.toFixed(2)} turns, peak ${r.peak.toFixed(2)} turns/s (limit 1.15); form advanced to`, await page.getAttribute('form[data-step]', 'data-step'));
  const w = (await sharp(tiles[0]).metadata()).width, h = (await sharp(tiles[0]).metadata()).height;
  await sharp({ create: { width: w * tiles.length, height: h, channels: 3, background: '#2C3548' } })
    .composite(await Promise.all(tiles.map(async (t, i) => ({ input: await sharp(t).resize(w, h).toBuffer(), left: i * w, top: 0 })))).png().toFile('qa/logo3d-spin.png');
  log('chip under the canvas:', JSON.stringify(await page.textContent('.logo3d-chip')));
  await shotStage(page, 'logo3d-chip', 30);
  await sleep(1500);
  const backP = tap(page, 'form[data-step=need] .brief-actions button.btn-ghost').then(() => sampleSpin(page, 1900));
  const back = await backP;
  let minA = 1e9, maxA = -1e9;
  back.forEach(([, a]) => { minA = Math.min(minA, a); maxA = Math.max(maxA, a); });
  const rb = speed(back);
  // forward spins raise state.spin from 0 to 2pi; reverse spins lower it from 0 to -2pi
  log(`Back: ${rb.turns.toFixed(2)} turns, peak ${rb.peak.toFixed(2)} turns/s, angle range ${minA.toFixed(2)}..${maxA.toFixed(2)} rad (${minA < -0.5 ? 'reverse direction confirmed' : 'forward?'})`);
  await ctx.close();
}

// 3) 20 consecutive step changes: renderer memory must stay flat
{
  const { ctx, page } = await open('en');
  await ready(page);
  await sleep(800);
  const start = await info(page);
  const series = [];
  await tap(page, 'label.type-card:has(input[value="health"])');
  await sleep(1700);
  for (let n = 0; n < 20; n++) {
    const step = await page.getAttribute('form[data-step]', 'data-step');
    if (step === 'need') {
      if (n % 2) await tap(page, 'form[data-step=need] .brief-actions button.btn-ghost');
      else await tap(page, 'form[data-step=need] button[type=submit]');
    } else if (step === 'name') await tap(page, 'form[data-step=name] .brief-actions button.btn-ghost');
    else if (step === 'type') await tap(page, 'label.type-card:has(input[value="shop"])');
    await sleep(1650);
    const i = await info(page);
    series.push(`${i.geometries}/${i.textures}/${i.programs}`);
  }
  const end = await info(page);
  log(`memory (geometries/textures/programs): start ${start.geometries}/${start.textures}/${start.programs}, after 20 step changes ${end.geometries}/${end.textures}/${end.programs}; samples ${[...new Set(series)].join(' ')}`);
  // dispose runs cleanly and releases the context
  const disposed = await page.evaluate(() => { try { document.querySelector('canvas.logo3d-canvas').__logo.dispose(); return 'ok'; } catch (e) { return String(e); } });
  log('dispose():', disposed);
  await ctx.close();
}

// 4) the thank-you moment: speed, landing, circuit completing
{
  const { ctx, page } = await open('ar');
  await ready(page);
  await sleep(800);
  await page.click('label.type-card:has(input[value="health"])'); await sleep(1700);
  await page.click('form[data-step=need] .brief-actions button:not(.btn-primary):not(.btn-ghost)'); await sleep(1700);
  await page.fill('#f-first', 'ياسمين'); await page.fill('#f-last', 'العلوي');
  await page.click('form[data-step=name] button[type=submit]'); await sleep(1700);
  await page.fill('#f-phone', '0612345678');
  await page.check('form[data-step=phone] input[type=checkbox]:not([name=website])');
  await sleep(3200);
  const panel = await page.locator('.consult-art').boundingBox();
  const samplesP = page.evaluate(() => new Promise((res) => {
    const hook = document.querySelector('canvas.logo3d-canvas').__logo;
    const out = [], t0 = performance.now();
    document.querySelector('form[data-step=phone] button[type=submit]').click();
    const f = () => { const t = performance.now() - t0; out.push([t, hook.info().spin]); if (t < 4800) requestAnimationFrame(f); else res(out); };
    requestAnimationFrame(f);
  }));
  const frames = [];
  for (let k = 0; k < 6; k++) { await sleep(k === 0 ? 100 : 650); frames.push(await page.screenshot({ clip: { x: panel.x, y: panel.y, width: panel.width, height: panel.height } })); }
  const samples = await samplesP;
  const r = speed(samples);
  log(`submit spin: ${r.turns.toFixed(2)} turns, peak ${r.peak.toFixed(2)} turns/s, final angle ${(await info(page)).spin.toFixed(3)} rad (0 = front-facing)`);
  const fw = Math.round(panel.width / 2), fh = Math.round(panel.height / 2);
  await sharp({ create: { width: fw * 3, height: fh * 2, channels: 3, background: '#171D29' } })
    .composite(await Promise.all(frames.map(async (f, i) => ({ input: await sharp(f).resize(fw, fh).toBuffer(), left: (i % 3) * fw, top: Math.floor(i / 3) * fh })))).png().toFile('qa/logo3d-thanks.png');
  await page.screenshot({ path: 'qa/logo3d-ar-1440-thanks.png' });
  await ctx.close();
}

// 5) desktop AR (RTL), desktop FR with a chosen type, mobile EN banner
{
  const { ctx, page } = await open('ar');
  await ready(page); await sleep(600);
  await page.screenshot({ path: 'qa/logo3d-ar-1440.png' });
  await ctx.close();
}
{
  const { ctx, page } = await open('fr');
  await ready(page); await sleep(600);
  await page.click('label.type-card:has(input[value="architect"])'); await sleep(2400);
  await page.screenshot({ path: 'qa/logo3d-fr-1440.png' });
  await ctx.close();
}
{
  const { ctx, page } = await open('en', { width: 375, height: 812 });
  await ready(page); await sleep(600);
  await page.screenshot({ path: 'qa/logo3d-en-375.png' });
  const r = await page.evaluate(() => {
    const c = document.querySelector('.logo3d-stage').getBoundingClientRect(), art = document.querySelector('.consult-art').getBoundingClientRect();
    return { banner: Math.round(art.height), stage: [Math.round(c.width), Math.round(c.height)], overflowX: document.documentElement.scrollWidth - innerWidth };
  });
  log('mobile banner:', JSON.stringify(r));
  await ctx.close();
}

// 6) fallbacks
{
  const { ctx, page } = await open('en', { noWebgl: true });
  await sleep(1200);
  const s1 = await page.evaluate(() => ({ canvas: !!document.querySelector('canvas.logo3d-canvas'), mode: document.querySelector('.logo3d').dataset.mode, posterVisible: getComputedStyle(document.querySelector('.logo3d-poster')).opacity }));
  await page.click('label.type-card:has(input[value="finance"])'); await sleep(500);
  const turn = await page.evaluate(() => getComputedStyle(document.querySelector('.logo3d-poster')).animationName);
  log('no WebGL:', JSON.stringify(s1), '| step animation:', turn);
  await page.screenshot({ path: 'qa/logo3d-nowebgl.png' });
  await ctx.close();
}
{
  const { ctx, page } = await open('en', { reduced: true });
  await sleep(1200);
  const s = await page.evaluate(() => ({ canvas: !!document.querySelector('canvas.logo3d-canvas'), mode: document.querySelector('.logo3d').dataset.mode }));
  await page.click('label.type-card:has(input[value="finance"])'); await sleep(300);
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.logo3d-poster')).animationName);
  log('reduced motion:', JSON.stringify(s), '| step animation:', anim, '(glow only, no rotation)');
  await page.screenshot({ path: 'qa/logo3d-reduced.png' });
  await ctx.close();
}

// 7) CPU throttled 4x
{
  const { ctx, page } = await open('en', { throttle: 4 });
  await ready(page, 40000);
  await sleep(2500);
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
  const i = await info(page);
  log(`CPU 4x throttle: ${fps.toFixed(1)} fps, lowQuality=${i.lowQuality}, pixelRatio=${i.pixelRatio}, bench frames ${i.benchFrames}, median frame ${i.medianDt.toFixed(0)} ms`);
  await page.click('label.type-card:has(input[value="shop"])'); await sleep(2000);
  await page.screenshot({ path: 'qa/logo3d-throttled.png' });
  await ctx.close();
}

log('console issues:', issues.length ? [...new Set(issues)] : 'none');
await browser.close();
