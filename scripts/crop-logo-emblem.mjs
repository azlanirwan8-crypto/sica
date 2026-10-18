/**
 * Memotong logo menjadi emblem saja (tanpa wordmark "SICA" yang terbaked di gambar)
 * supaya lockup teks bisa memakai tipografi asli — lebih tajam dan konsisten.
 *
 * Jalankan: node scripts/crop-logo-emblem.mjs <input.png> <output.png> <rowCut>
 *   rowCut = batas bawah (eksklusif) area emblem; baris >= rowCut dibuang.
 */
import { createRequire } from 'node:module';

const require = createRequire('file:///c:/SICA/');
const sharpMod = require('C:\\SICA\\node_modules\\.pnpm\\sharp@0.33.5\\node_modules\\sharp');
const sharp = sharpMod.default ?? sharpMod;

const [, , inputArg, outputArg, rowCutArg] = process.argv;
const rowCut = Number.parseInt(rowCutArg ?? '', 10);
if (!inputArg || !outputArg || !Number.isFinite(rowCut)) {
  console.error('Pemakaian: node crop-logo-emblem.mjs <input.png> <output.png> <rowCut>');
  process.exit(1);
}

const { data, info } = await sharp(inputArg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const opaque = (x, y) => data[(y * width + x) * channels + 3] > 20;

let top = height;
let bottom = 0;
for (let y = 0; y < Math.min(rowCut, height); y++) {
  for (let x = 0; x < width; x++) {
    if (opaque(x, y)) {
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      break;
    }
  }
}
let left = width;
let right = 0;
for (let y = top; y <= bottom; y++) {
  for (let x = 0; x < width; x++) if (opaque(x, y)) { if (x < left) left = x; break; }
  for (let x = width - 1; x >= 0; x--) if (opaque(x, y)) { if (x > right) right = x; break; }
}

const pad = 2;
const x = Math.max(0, left - pad);
const y = Math.max(0, top - pad);
const cropW = Math.min(width - x, right - left + 1 + pad * 2);
const cropH = Math.min(bottom - y + 1 + pad * 2, rowCut - y);

await sharp(inputArg).extract({ left: x, top: y, width: cropW, height: cropH }).png().toFile(outputArg);
console.log(`emblem ${cropW}x${cropH} (crop dari ${width}x${height}, offset x=${x} y=${y}) → ${outputArg}`);
