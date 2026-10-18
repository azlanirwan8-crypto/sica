/**
 * Membuat varian logo dengan background transparan.
 *
 * Flood-fill dari piksel tepi: area terang yang terhubung dengan border jadi
 * alpha 0, sedangkan putih di dalam bentuk logo (mis. batang huruf "I") tetap utuh.
 *
 * Jalankan: node scripts/make-logo-transparent.mjs <input.png> <output.png>
 */
import { createRequire } from 'node:module';

const require = createRequire('file:///c:/SICA/');
const sharpModule = require('C:\\SICA\\node_modules\\.pnpm\\sharp@0.33.5\\node_modules\\sharp');
const sharp = sharpModule.default ?? sharpModule;

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) {
  console.error('Pemakaian: node make-logo-transparent.mjs <input.png> <output.png>');
  process.exit(1);
}

const { data: raw, info } = await sharp(inputArg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const px = Buffer.from(raw);

const isLight = (i) => px[i] > 205 && px[i + 1] > 205 && px[i + 2] > 205;

// Antrian seed = seluruh piksel pada border gambar.
const queue = [];
const inQueue = new Uint8Array(width * height);
const push = (x, y) => {
  const p = y * width + x;
  if (inQueue[p]) return;
  inQueue[p] = 1;
  queue.push(p);
};
for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }

let removed = 0;
for (let head = 0; head < queue.length; head++) {
  const p = queue[head];
  const i = p * channels;
  if (!isLight(i)) continue;
  px[i + 3] = 0;
  removed++;
  const x = p % width;
  const y = (p - x) / width;
  if (x > 0) push(x - 1, y);
  if (x < width - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < height - 1) push(x, y + 1);
}

// Tepi anti-alias menyisakan halo terang: turunkan alpha untuk piksel yang
// masih terang tetapi sudah berada di dekat area transparan.
for (let p = 0; p < width * height; p++) {
  const i = p * channels;
  if (px[i + 3] === 0) continue;
  if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) {
    const x = p % width;
    const y = (p - x) / width;
    let touchingTransparent = false;
    for (let dy = -1; dy <= 1 && !touchingTransparent; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (px[(ny * width + nx) * channels + 3] === 0) { touchingTransparent = true; break; }
      }
    }
    if (touchingTransparent) px[i + 3] = 0;
  }
}

await sharp(px, { raw: { width, height, channels } }).png().toFile(outputArg);
console.log(`${width}x${height} — ${removed} piksel background dibuat transparan (${((removed / (width * height)) * 100).toFixed(1)}%)`);
console.log(`→ ${outputArg}`);
