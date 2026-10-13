// QA of interactive states: mobile menu, form validation, reduced motion, keyboard focus.
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:4321';
const browser = await chromium.launch();
const logs = [];
async function ctx(opts) { const c = await browser.newContext(opts); const p = await c.newPage(); p.on('console', (m) => ['error', 'warning'].includes(m.type()) && logs.push(m.text())); p.on('pageerror', (e) => logs.push(e.message)); return { c, p }; }

// 1) mobile menu open (AR)
{ const { c, p } = await ctx({ viewport: { width: 375, height: 812 } });
  await p.goto(base + '/ar/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await p.click('[data-menu-toggle]'); await p.waitForTimeout(400);
  await p.screenshot({ path: 'qa/ar-375-menu.png' });
  console.log('menu expanded:', await p.getAttribute('[data-menu-toggle]', 'aria-expanded'), 'focused:', await p.evaluate(() => document.activeElement?.textContent?.trim()));
  await p.keyboard.press('Escape'); console.log('after Esc hidden:', await p.evaluate(() => document.getElementById('mobile-menu').hidden));
  await c.close(); }

// 3) reduced motion: everything visible statically
{ const { c, p } = await ctx({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await p.goto(base + '/en/', { waitUntil: 'networkidle' });
  const state = await p.evaluate(() => ({ motionClass: document.documentElement.classList.contains('motion'), lenis: document.documentElement.classList.contains('lenis'), canvasVisible: getComputedStyle(document.querySelector('#top canvas')).opacity }));
  console.log('reduced:', state);
  await p.evaluate(() => document.getElementById('process').scrollIntoView()); await p.waitForTimeout(400);
  await p.screenshot({ path: 'qa/en-1440-reduced-process.png' });
  await c.close(); }

// 4) keyboard: skip link + focus ring
{ const { c, p } = await ctx({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + '/ar/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  await p.keyboard.press('Tab'); await p.screenshot({ path: 'qa/ar-1440-skip.png', clip: { x: 0, y: 0, width: 1440, height: 200 } });
  for (let i = 0; i < 3; i++) await p.keyboard.press('Tab');
  await p.screenshot({ path: 'qa/ar-1440-focus.png', clip: { x: 0, y: 0, width: 1440, height: 200 } });
  await c.close(); }
console.log('console issues:', logs.length ? logs : 'none');
await browser.close();
