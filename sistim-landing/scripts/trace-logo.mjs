// Traces the Sistim badge ("س" + green dot) from ../brand/logo-badge.jpg into clean vector paths.
//   node scripts/trace-logo.mjs
// Output:
//   src/assets/logo-s.svg                 two paths: #letter and #dot (used by the 3D scene)
//   public/brand/logo-s-poster.webp/.png  letter + dot on transparent (instant poster / no-WebGL fallback)
//   qa/trace-overlay.png                  traced SVG at 50% over the original, for visual verification
// The originals in ../brand/ are never touched.
import sharp from 'sharp';
import { Potrace } from 'potrace';
import { optimize } from 'svgo';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const p = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const SRC = p('../../brand/logo-badge.jpg');
const CROP = { left: 440, top: 520, width: 1210, height: 840 }; // letter + dot inside the 2048 badge
const SCALE = 4; // upscale before tracing: smoother, sub-pixel accurate edges
const EMERALD = '#16AB79'; // sampled from the logo (see scripts/sample-palette.mjs)

await mkdir(p('../src/assets'), { recursive: true });
await mkdir(p('../qa'), { recursive: true });

// 1) crop + upscale with smoothing; a tiny blur removes JPEG ringing before thresholding
const W = CROP.width * SCALE, H = CROP.height * SCALE;
const up = await sharp(SRC).extract(CROP).resize(W, H, { kernel: 'lanczos3' }).blur(1.4).removeAlpha().raw().toBuffer();

// 2) separate by colour. Midpoints between navy (35,43,59) and each ink give the true 50% edge.
const letter = Buffer.alloc(W * H, 255); // potrace wants black ink on white
const dot = Buffer.alloc(W * H, 255);
for (let i = 0, q = 0; i < up.length; i += 3, q++) {
  const r = up[i], g = up[i + 1], b = up[i + 2];
  if (g - r > 74 && g > 100) dot[q] = 0;
  else if (r > 145 && g > 145 && b > 145) letter[q] = 0;
}
const toPng = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();

// 3) vectorise each ink
function trace(png, params) {
  return new Promise((resolve, reject) => {
    const t = new Potrace({ turdSize: 60, alphaMax: 1.1, optCurve: true, optTolerance: 0.45, threshold: 128, blackOnWhite: true, ...params });
    t.loadImage(png, (err) => {
      if (err) return reject(err);
      const tag = t.getPathTag('#000');
      resolve(/ d="([^"]+)"/.exec(tag)[1]);
    });
  });
}
console.time('trace');
const [letterD, dotD] = await Promise.all([toPng(letter).then((b) => trace(b)), toPng(dot).then((b) => trace(b, { turdSize: 200 }))]);
console.timeEnd('trace');

// 4) assemble + optimise (SVGO) — keep ids so the 3D scene can find the parts
const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${CROP.width}" height="${CROP.height}">` +
  `<path id="letter" fill="#ffffff" fill-rule="evenodd" d="${letterD}"/>` +
  `<path id="dot" fill="${EMERALD}" fill-rule="evenodd" d="${dotD}"/></svg>`;
const { data: svg } = optimize(raw, {
  multipass: true,
  plugins: [{ name: 'preset-default', params: { overrides: { cleanupIds: false } } }, { name: 'cleanupNumericValues', params: { floatPrecision: 1 } }],
});
await writeFile(p('../src/assets/logo-s.svg'), svg);
console.log('logo-s.svg', (svg.length / 1024).toFixed(1), 'KB');

// 5) poster: the traced vector rendered with transparency
const POSTER_W = 900;
const poster = await sharp(Buffer.from(svg), { density: 300 }).resize({ width: POSTER_W }).png().toBuffer();
await sharp(poster).png({ compressionLevel: 9 }).toFile(p('../public/brand/logo-s-poster.png'));
await sharp(poster).webp({ quality: 90, alphaQuality: 100 }).toFile(p('../public/brand/logo-s-poster.webp'));

// 6) verify: overlay at 50% over the original, plus an IoU score against the original masks
const original = await sharp(SRC).extract(CROP).resize(POSTER_W).png().toBuffer();
const half = await sharp(poster).ensureAlpha(0.5).toBuffer();
await sharp(original).composite([{ input: half, blend: 'over' }]).png().toFile(p('../qa/trace-overlay.png'));

const small = await sharp(Buffer.from(svg), { density: 96 }).resize(CROP.width, CROP.height).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const ref = await sharp(SRC).extract(CROP).removeAlpha().raw().toBuffer();
let inter = 0, union = 0, dInter = 0, dUnion = 0;
for (let i = 0, q = 0; q < CROP.width * CROP.height; i += 3, q++) {
  const refWhite = ref[i] > 145 && ref[i + 1] > 145 && ref[i + 2] > 145;
  const refDot = ref[i + 1] - ref[i] > 74 && ref[i + 1] > 100;
  const a = small.data[q * 4 + 3] > 127;
  const isDot = a && small.data[q * 4 + 1] - small.data[q * 4] > 74;
  const isLetter = a && !isDot;
  if (refWhite && isLetter) inter++; if (refWhite || isLetter) union++;
  if (refDot && isDot) dInter++; if (refDot || isDot) dUnion++;
}
console.log(`IoU letter ${(inter / union).toFixed(4)}  dot ${(dInter / dUnion).toFixed(4)}`);
