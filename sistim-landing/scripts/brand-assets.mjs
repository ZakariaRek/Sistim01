// Derives web-ready brand assets from the untouched originals in ../brand/.
// Run: npm run brand
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const SRC_URL = new URL('../../brand/', import.meta.url);
const SRC = (f) => fileURLToPath(new URL(f, SRC_URL));
const OUT_URL = new URL('../public/', import.meta.url);
const out = (f) => fileURLToPath(new URL(f, OUT_URL));
await mkdir(out('brand/'), { recursive: true });

// Sampled from the logo files (see scripts/sample-palette.mjs)
const NAVY = [35, 43, 59];      // #232B3B
const EMERALD = [22, 171, 121]; // #16AB79
const WHITE = [255, 255, 255];

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Navy -> transparent. Each pixel is projected onto navy->white and navy->emerald,
 *  the closest fit wins and becomes a pure brand colour with a soft alpha. */
async function keyNavy(file, { only } = {}) {
  const { data, info } = await sharp(SRC(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  const fgs = [WHITE, EMERALD].map((fg) => {
    const d = fg.map((v, i) => v - NAVY[i]);
    return { fg, d, dd: d.reduce((s, v) => s + v * v, 0) };
  });
  for (let p = 0, q = 0; p < data.length; p += 3, q += 4) {
    const c = [data[p] - NAVY[0], data[p + 1] - NAVY[1], data[p + 2] - NAVY[2]];
    let best = null;
    for (const f of fgs) {
      const t = (c[0] * f.d[0] + c[1] * f.d[1] + c[2] * f.d[2]) / f.dd;
      const r = Math.hypot(c[0] - t * f.d[0], c[1] - t * f.d[1], c[2] - t * f.d[2]);
      if (!best || r < best.r) best = { r, t, fg: f.fg };
    }
    let a = smooth(0.1, 0.8, best.t);
    if (only === 'white' && best.fg !== WHITE) a = 0;
    if (only === 'emerald' && best.fg !== EMERALD) a = 0;
    out[q] = best.fg[0]; out[q + 1] = best.fg[1]; out[q + 2] = best.fg[2];
    out[q + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
}

const toBuf = (img) => img.png().toBuffer();
async function save(img, name, widths, formats = ['png', 'webp', 'avif']) {
  const base = await toBuf(img);
  for (const w of widths) {
    for (const fmt of formats) {
      const suffix = widths.length > 1 ? `-${w}` : '';
      await sharp(base).resize({ width: w })[fmt]({ quality: fmt === 'png' ? undefined : 82, effort: 6 })
        .toFile(out(`brand/${name}${suffix}.${fmt}`));
    }
  }
  const m = await sharp(base).resize({ width: widths[0] }).metadata();
  console.log(name, widths, `${m.width}x${m.height}`);
}

// 1) Circuit wordmark: full (footer / OG) and letters-only crop (hero, circuit redrawn in SVG)
const circuit = await keyNavy('logo-wordmark-circuit.jpg');
const circuitFull = sharp(await toBuf(circuit)).trim({ threshold: 1 });
await save(circuitFull, 'wordmark-circuit', [480, 960]);
const letters = await keyNavy('logo-wordmark-circuit.jpg', { only: 'white' });
const lettersCrop = sharp(await toBuf(letters)).extract({ left: 500, top: 340, width: 1800, height: 900 });
await save(lettersCrop, 'wordmark-letters', [720, 1200]);

// 2) Swoosh wordmark (nav)
const swoosh = await keyNavy('logo-wordmark-swoosh.jpg');
await save(sharp(await toBuf(swoosh)).trim({ threshold: 1 }), 'wordmark-swoosh', [128, 256]);

// 3) Badge mark: the "س" + green dot of the badge on its own navy disc (legible at favicon sizes)
const badge = await keyNavy('logo-badge.jpg');
const glyph = await sharp(await toBuf(badge)).extract({ left: 440, top: 520, width: 1210, height: 840 }).png().toBuffer();
const D = 1600;
const disc = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}"><circle cx="${D / 2}" cy="${D / 2}" r="${D / 2}" fill="#232B3B"/></svg>`);
const square = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}"><rect width="${D}" height="${D}" fill="#232B3B"/></svg>`);
const glyphScaled = await sharp(glyph).resize({ width: 1060 }).toBuffer();
const gm = await sharp(glyphScaled).metadata();
const pos = { left: Math.round((D - gm.width) / 2), top: Math.round((D - gm.height) / 2) };
const markDisc = await sharp(disc).composite([{ input: glyphScaled, ...pos }]).png().toBuffer();
const markSquare = await sharp(square).composite([{ input: glyphScaled, ...pos }]).png().toBuffer();
await save(sharp(markDisc), 'mark', [96]);

// Optional thank-you photo (only used when SHOW_THANKYOU_PHOTO is true in src/config/consultation.ts)
if (existsSync(SRC('thankyou.jpg'))) {
  await sharp(SRC('thankyou.jpg')).resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out('brand/thankyou.webp'));
  console.log('thankyou.webp written');
}

// Favicons
const ico = [];
for (const s of [16, 32, 48]) ico.push({ s, buf: await sharp(markDisc).resize(s, s).png().toBuffer() });
await sharp(markDisc).resize(32, 32).png().toFile(out('favicon-32.png'));
await sharp(markSquare).resize(180, 180).png().toFile(out('apple-touch-icon.png'));
await sharp(markSquare).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(markSquare).resize(512, 512).png().toFile(out('icon-512.png'));
// PNG-in-ICO container
const header = Buffer.alloc(6 + 16 * ico.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(ico.length, 4);
let offset = header.length;
ico.forEach(({ s, buf }, i) => {
  const o = 6 + i * 16;
  header.writeUInt8(s, o); header.writeUInt8(s, o + 1); header.writeUInt8(0, o + 2); header.writeUInt8(0, o + 3);
  header.writeUInt16LE(1, o + 4); header.writeUInt16LE(32, o + 6);
  header.writeUInt32LE(buf.length, o + 8); header.writeUInt32LE(offset, o + 12);
  offset += buf.length;
});
await writeFile(out('favicon.ico'), Buffer.concat([header, ...ico.map((i) => i.buf)]));
console.log('favicons done');
