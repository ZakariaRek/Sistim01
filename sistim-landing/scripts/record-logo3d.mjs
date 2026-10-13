// Records a short screen video (webm) of the form with the 3D logo spinning on each step.
// Usage: node scripts/record-logo3d.mjs [baseUrl] [locale]   -> qa/logo3d-recording.webm
import { chromium } from 'playwright';
import { rename, rm } from 'node:fs/promises';
const base = process.argv[2] || 'http://localhost:4321';
const locale = process.argv[3] || 'en';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
await rm('qa/rec', { recursive: true, force: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: 'qa/rec', size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto(`${base}/${locale}/consultation/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('.logo3d')?.dataset.ready === 'true', null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.click('label.type-card:has(input[value="architect"])');
await page.waitForTimeout(2600);
await page.check('input[name=need][value=booking]');
await page.click('form[data-step=need] button[type=submit]');
await page.waitForTimeout(2600);
await page.click('form[data-step=name] .brief-actions button.btn-ghost');
await page.waitForTimeout(2600);
await page.click('form[data-step=need] button[type=submit]');
await page.waitForTimeout(2000);
const video = page.video();
await ctx.close();
await rename(await video.path(), 'qa/logo3d-recording.webm');
await rm('qa/rec', { recursive: true, force: true });
await browser.close();
console.log('qa/logo3d-recording.webm');
