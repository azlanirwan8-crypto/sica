#!/usr/bin/env node
/**
 * penjaga `palette-drift` — keputusan 2026-10-24 (UI_UX_DESIGN §2.6)
 *
 * Kerangka Velzon dikonfigurasi dari SCSS (`src/styles/_velzon-config.scss`)
 * sementara palet runtime tinggal di `:root` `app/globals.css`. Keduanya memuat
 * heksa yang SAMA. Alat ini membuktikan keduanya masih sama: bila salah satu
 * diedit dan yang lain tidak, gate ini merah — bukan dokumen yang berharap
 * keduanya "sebaiknya" seiring.
 *
 * Perbandingan dilakukan per pasangan yang sudah ditentukan (bukan pemindaian
 * bebas), supaya warna yang memang sengaja berbeda — mis. `--sica-primary-solid`
 * yang diturunkan untuk lolos AA — tidak ikut dituduh berbeda.
 *
 * known-answer: sebelum hasil nyata dicetak, parser diuji kebalikannya pada
 * masukan sintetis yang sengaja digeser; kalau parser gagal mendeteksinya, alat
 * ini berhenti dengan galat agar tidak pernah hijau karena buta.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, 'apps/web/src/styles/_velzon-config.scss');
const GLOBALS = path.join(ROOT, 'apps/web/src/app/globals.css');

/** [nama variabel SCSS, token globals, bentuk] */
const PAIRS = [
  ['$primary', '--sica-primary', 'hex'],
  ['$secondary', '--sica-secondary', 'hex'],
  ['$success', '--sica-success', 'hex'],
  ['$info', '--sica-info', 'hex'],
  ['$warning', '--sica-warning', 'hex'],
  ['$danger', '--sica-danger', 'hex'],
  ['$border-color', '--sica-border-color', 'hex'],
  ['$light', '--sica-surface-canvas', 'hex'],
  ['$body-bg', '--sica-surface-canvas', 'hex'],
  ['$body-color', '--sica-rgb-slate-600', 'channel'],
  ['$headings-color', '--sica-rgb-slate-900', 'channel'],
];

function readRequired(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`berkas sumber tidak ada: ${file}`);
  }
  return fs.readFileSync(file, 'utf8');
}

/** `$nama: #rrggbb;` — hanya baris konfigurasi (bukan komentar). */
function scssHex(css, name) {
  const re = new RegExp(`^\\s*\\${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`, 'm');
  return re.exec(css)?.[1].toLowerCase() ?? null;
}

/** `--nama: #rrggbb;` pada blok `:root`. */
function rootHex(css, token) {
  const block = rootBlock(css);
  const re = new RegExp(`(^|[\\s;])${token}:\\s*(#[0-9a-fA-F]{6})\\s*;`);
  return re.exec(block)?.[2].toLowerCase() ?? null;
}

/** `--nama: 10 179 156;` (kanal RGB ruang-jarak). */
function rootChannels(css, token) {
  const block = rootBlock(css);
  const re = new RegExp(`(^|[\\s;])${token}:\\s*([0-9.]+\\s+[0-9.]+\\s+[0-9.]+)\\s*;`);
  return re.exec(block)?.[2] ?? null;
}

function rootBlock(css) {
  const start = css.indexOf(':root');
  if (start < 0) throw new Error('blok :root tidak ditemukan di globals.css');
  const open = css.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (; end < css.length; end++) {
    if (css[end] === '{') depth++;
    else if (css[end] === '}' && --depth === 0) break;
  }
  return css.slice(open + 1, end);
}

function hexToChannels(hex) {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(' ');
}

/** Satu baris hasil: `null` = setara, string = alasan berbeda. */
function comparePairs(scss, css) {
  const rows = [];
  for (const [name, token, shape] of PAIRS) {
    const left = scssHex(scss, name);
    if (!left) {
      rows.push({ name, token, problem: `variabel SCSS ${name} tidak ditemukan` });
      continue;
    }
    if (shape === 'hex') {
      const right = rootHex(css, token);
      if (!right) rows.push({ name, token, problem: `token ${token} tidak ditemukan` });
      else if (left !== right) rows.push({ name, token, problem: `${left} != ${right}` });
      else rows.push({ name, token, problem: null });
    } else {
      const right = rootChannels(css, token);
      if (!right) rows.push({ name, token, problem: `token ${token} tidak ditemukan` });
      else if (hexToChannels(left) !== right) rows.push({ name, token, problem: `${left} (${hexToChannels(left)}) != ${right}` });
      else rows.push({ name, token, problem: null });
    }
  }
  return rows;
}

/**
 * known-answer — parser wajib BUTA pada pergeseran yang disengaja.
 * Tanpa langkah ini, regex yang tidak pernahMatch akan menghasilkan "0 berbeda"
 * dan gate hijau semu (pola yang sama dipakai `.tools/guard-order.mjs`).
 */
function selfTest() {
  const scss = '$primary: #0ab39c;\n';
  const matching = ":root { --sica-primary: #0ab39c; }";
  const drifted = ":root { --sica-primary: #ff0000; }";
  const missing = ':root { --sica-tidak-ada: #0ab39c; }';

  const pairs = [['$primary', '--sica-primary', 'hex']];
  const saved = PAIRS.slice();
  PAIRS.length = 0;
  PAIRS.push(...pairs);
  try {
    const okRows = comparePairs(scss, matching);
    if (okRows.length !== 1 || okRows[0].problem !== null) {
      throw new Error('known-answer gagal: pasangan setara terbaca berbeda');
    }
    const badRows = comparePairs(scss, drifted);
    if (badRows.length !== 1 || badRows[0].problem === null) {
      throw new Error('known-answer gagal: pergeseran #0ab39c → #ff0000 TIDAK terdeteksi');
    }
    const absentRows = comparePairs(scss, missing);
    if (absentRows.length !== 1 || absentRows[0].problem === null) {
      throw new Error('known-answer gagal: token hilang dibaca sebagai setara');
    }
  } finally {
    PAIRS.length = 0;
    PAIRS.push(...saved);
  }
  return 3;
}

const tested = selfTest();
const scss = readRequired(CONFIG);
const css = readRequired(GLOBALS);
const rows = comparePairs(scss, css);
const drift = rows.filter((r) => r.problem);

console.log(`known-answer lulus: ${tested}/3`);
console.log(` pasangan dijaga : ${rows.length}`);
for (const r of rows) {
  if (r.problem) console.log(`  BEDA  ${r.name} (${r.token}) — ${r.problem}`);
}
console.log(` drift           : ${drift.length}`);

if (drift.length > 0) {
  console.log('FAIL — palet SCSS dan :root globals.css berbeda; satukan nilainya.');
  process.exit(1);
}
console.log('PASS — konfigurasi kerangka setara dengan token runtime.');
