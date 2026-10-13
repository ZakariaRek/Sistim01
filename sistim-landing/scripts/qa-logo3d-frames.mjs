// QA: freeze the 3D letter at fixed angles and capture the canvas, plus a poster for comparison.
import { chromium } from 'playwright';
import sharp from 'sharp';
const base = process.argv[2] || 'http://localhost:4321';
const angles = (process.argv[3] || '0,45,90,180').split(',').map(Number);
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`${base}/en/consultation/?qa3d=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('.logo3d')?.dataset.ready === 'true', null, { timeout: 15000 });
const box = await page.locator('.logo3d-stage').boundingBox();
const tiles = [];
for (const a of angles) {
  await page.evaluate((deg) => document.querySelector('canvas.logo3d-canvas').__logo.freeze(deg), a);
  await page.waitForTimeout(250);
  tiles.push(await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } }));
  console.log('frame', a);
}
const w = Math.round(box.width), h = Math.round(box.height);
const bg = { create: { width: w * tiles.length, height: h, channels: 3, background: '#2C3548' } };
await sharp(bg).composite(await Promise.all(tiles.map(async (t, i) => ({ input: await sharp(t).resize(w, h).toBuffer(), left: i * w, top: 0 })))).png().toFile('qa/logo3d-frames.png');
await browser.close();
