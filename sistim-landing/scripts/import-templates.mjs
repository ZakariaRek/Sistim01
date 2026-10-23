// Imports the demo templates from ../template/*.zip into public/templates/<slug>/ and renders a
// preview image for each card.
//   npm run templates            import everything + previews
//   node scripts/import-templates.mjs dentist cars     only these slugs
//   node scripts/import-templates.mjs --no-previews    skip the screenshots
// The zips are never modified. Files are extracted with a path-traversal check, README files are dropped.
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES, PREVIEW } from '../src/config/templates.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const ZIP_DIR = path.resolve(ROOT, '..', 'template');
const args = process.argv.slice(2);
const noPreviews = args.includes('--no-previews');
const only = args.filter((a) => !a.startsWith('--'));
const list = TEMPLATES.filter((t) => !only.length || only.includes(t.slug));

if (!existsSync(ZIP_DIR)) throw new Error(`Folder not found: ${ZIP_DIR}`);
const zips = (await readdir(ZIP_DIR)).filter((f) => f.toLowerCase().endsWith('.zip'));

function findZip(prefix) {
  const p = prefix.normalize('NFC').toLowerCase();
  const hits = zips.filter((f) => f.normalize('NFC').toLowerCase().startsWith(p));
  if (hits.length !== 1) throw new Error(`Expected exactly one zip starting with "${prefix}" in ${ZIP_DIR}, found ${hits.length}`);
  return path.join(ZIP_DIR, hits[0]);
}

// 1) extract
for (const t of list) {
  const dest = path.join(PUBLIC, 'templates', t.slug);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  const zip = new AdmZip(findZip(t.zipPrefix));
  let n = 0;
  for (const e of zip.getEntries()) {
    if (e.isDirectory || /(^|\/)README\.md$/i.test(e.entryName)) continue;
    const target = path.resolve(dest, e.entryName);
    if (!target.startsWith(dest + path.sep)) throw new Error(`Unsafe path in zip: ${e.entryName}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, e.getData());
    n++;
  }
  if (!existsSync(path.join(dest, t.entry))) throw new Error(`${t.slug}: entry file ${t.entry} not found in the zip`);
  console.log(`imported ${t.slug}: ${n} files -> public/templates/${t.slug}/`);
}
if (noPreviews) process.exit(0);

// 2) previews: serve public/ locally, screenshot each template at desktop width, keep the top part
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer(async (req, res) => {
  try {
    const file = path.join(PUBLIC, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(PUBLIC) || !(await stat(file)).isFile()) throw new Error('nf');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch();
const VIEW_W = 1280;
const SRC_H = Math.round((VIEW_W * PREVIEW.height) / PREVIEW.width); // source height that maps to the preview size
for (const t of list) {
  const page = await browser.newPage({ viewport: { width: VIEW_W, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/templates/${t.slug}/${encodeURIComponent(t.entry)}`, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(1500);
  const full = await page.screenshot({ fullPage: true });
  const meta = await sharp(full).metadata();
  if (meta.height < 800) console.warn(`  ! ${t.slug}: page rendered only ${meta.height}px tall: is it blank?`);
  const h = Math.min(meta.height, SRC_H);
  let img = sharp(full).extract({ left: 0, top: 0, width: VIEW_W, height: h }).resize({ width: PREVIEW.width });
  if (h < SRC_H) img = img.extend({ bottom: Math.round(((SRC_H - h) * PREVIEW.width) / VIEW_W), background: '#F5F5F5' });
  await img.resize({ width: PREVIEW.width, height: PREVIEW.height, fit: 'cover', position: 'top' }).webp({ quality: 80 }).toFile(path.join(PUBLIC, 'templates', t.slug, 'preview.webp'));
  console.log(`preview ${t.slug}: page ${meta.height}px tall${errors.length ? ` | page errors: ${errors.join(' ; ')}` : ''}`);
  await page.close();
}
await browser.close();
server.close();
