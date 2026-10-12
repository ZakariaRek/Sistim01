// Split full-page screenshots into viewable slices: node scripts/qa-slice.mjs qa/ar-1440-full.png 1600
import sharp from 'sharp';
const [file, h = '1600'] = process.argv.slice(2);
const meta = await sharp(file).metadata();
const step = Number(h);
for (let y = 0, i = 0; y < meta.height; y += step, i++) {
  await sharp(file).extract({ left: 0, top: y, width: meta.width, height: Math.min(step, meta.height - y) }).toFile(file.replace('.png', `-s${i}.png`));
}
console.log(file, meta.width, meta.height, Math.ceil(meta.height / step), 'slices');
