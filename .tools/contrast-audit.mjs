import fs from 'node:fs';

const css = fs.readFileSync(process.argv[2] ?? 'apps/web/src/app/globals.css', 'utf8');

function parseBlock(selector) {
  const start = css.indexOf(selector + ' {');
  if (start < 0) throw new Error('block not found: ' + selector);
  let i = css.indexOf('{', start);
  let depth = 0;
  let end = i;
  for (; end < css.length; end++) {
    if (css[end] === '{') depth++;
    else if (css[end] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = css.slice(i + 1, end);
  const map = new Map();
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (m[0].includes('--sica-color-')) continue;
    map.set(m[1], m[2].trim());
  }
  return map;
}

const root = parseBlock(':root');
const dark = parseBlock("[data-bs-theme='dark']");

function resolve(name, map, seen = 0) {
  if (seen > 12) return null;
  let v = map.get(name);
  if (v === undefined) v = root.get(name);
  if (v === undefined) return null;
  const varRef = v.match(/^var\((--[a-z0-9-]+)\)$/);
  if (varRef) return resolve(varRef[1], map, seen + 1);
  return v;
}

function toRgb(v) {
  if (!v) return null;
  const h = v.match(/^#([0-9a-fA-F]{6})$/);
  if (h) {
    const m = h[1];
    return { rgb: [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16)), a: 1 };
  }
  const r = v.match(/rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/);
  if (r) return { rgb: [+r[1], +r[2], +r[3]], a: r[4] === undefined ? 1 : Number(r[4]) };
  return null;
}

// Menangani bentuk rgb(var(--sica-rgb-slate-900)) dan kanal telanjang "248 250 252".
function channels(name, map) {
  let v = resolve(name, map);
  if (!v) return null;
  const inner = v.match(/^rgb\(\s*var\((--[a-z0-9-]+)\)\s*\)$/);
  if (inner) v = resolve(inner[1], map);
  if (!v) return null;
  const m = v.match(/^([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

// Compose a possibly translucent colour over an opaque backdrop.
function compose(fg, bg) {
  if (!fg) return null;
  if (fg.a >= 1) return fg.rgb;
  if (!bg) return null;
  return [0, 1, 2].map((i) => Math.round(fg.rgb[i] * fg.a + bg[i] * (1 - fg.a)));
}

function lin(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function lum(rgb) {
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}
function ratio(a, b) {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const pairs = [
  ['page-title', '--sica-text-heading', '--sica-surface-card', 28, 600],
  ['body text', '--sica-text-body', '--sica-surface-card', 14, 400],
  ['section-label', '--sica-text-muted', '--sica-surface-card', 11, 600],
  ['table-head', '--sica-text-muted', 'rgb-slate-50-soft', 11, 600],
  ['field-label', '--sica-text-body', '--sica-surface-card', 12, 600],
  ['field-hint', '--sica-text-muted', '--sica-surface-card', 12, 400],
  ['field-error', '--sica-danger-ink', '--sica-surface-card', 12, 500],
  ['dropdown-item', '--sica-text-body', '--sica-surface-card', 13, 500],
  ['dropdown-item:hover', '--sica-on-primary-soft', '--sica-surface-hover', 13, 500],
  ['eyebrow', '--sica-on-primary-soft', '--sica-primary-soft', 11, 600],
  ['badge-soft-primary', '--sica-on-primary-soft', '--sica-primary-soft', 10, 600],
  ['badge-soft-secondary', '--sica-on-secondary-soft', '--sica-secondary-soft', 10, 600],
  ['badge-soft-success', '--sica-on-success-soft', '--sica-success-soft', 10, 600],
  ['badge-soft-info', '--sica-on-info-soft', '--sica-info-soft', 10, 600],
  ['badge-soft-warning', '--sica-on-warning-soft', '--sica-warning-soft', 10, 600],
  ['badge-soft-danger', '--sica-on-danger-soft', '--sica-danger-soft', 10, 600],
  ['btn-soft-primary', '--sica-on-primary-soft', '--sica-primary-soft', 13, 600],
  ['btn-soft-warning', '--sica-on-warning-soft', '--sica-warning-soft', 13, 600],
  ['solid primary btn', '--sica-on-primary', '--sica-primary-solid', 13, 600],
  ['solid danger btn', '--sica-on-danger', '--sica-danger-solid', 13, 600],
  ['solid info btn', '--sica-on-info', '--sica-info-solid', 13, 600],
  ['solid warning btn', '--sica-on-warning', '--sica-warning', 13, 600],
  ['soft btn ink on soft', '--sica-primary-ink', '--sica-primary-soft', 13, 600],
  ['link / text-primary-ink', '--sica-primary-ink', '--sica-surface-card', 14, 400],
  ['muted on canvas', '--sica-text-muted', '--sica-surface-canvas', 12, 400],
  ['muted on inset', '--sica-text-muted', '--sica-surface-inset', 11, 600],
  ['avatar-title', '--sica-on-secondary-soft', '--sica-secondary-soft', 12, 600],
];

const special = {
  'rgb-slate-50-soft': (map) => {
    const sl50 = channels('--sica-rgb-slate-50', map);
    const card = toRgb(resolve('--sica-surface-card', map));
    if (!sl50 || !card) return null;
    return [0, 1, 2].map((i) => Math.round(sl50[i] * 0.85 + card.rgb[i] * 0.15));
  },
};

function need(size, weight) {
  const large = size >= 24 || (weight >= 700 && size >= 18.66);
  return large ? 3 : 4.5;
}

function effective(token, map) {
  const v = resolve(token, map);
  if (!v) return null;
  const direct = toRgb(v);
  if (direct) {
    if (direct.a >= 1) return direct.rgb;
    const card = toRgb(resolve('--sica-surface-card', map));
    return card ? compose(direct, card.rgb) : null;
  }
  return channels(token, map);
}

let fails = 0;
for (const themeName of ['LIGHT', 'DARK']) {
  const map = themeName === 'LIGHT' ? root : dark;
  console.log('=== ' + themeName + ' (surface card = ' + resolve('--sica-surface-card', map) + ')');
  for (const [label, fgTok, bgTok, size, bold] of pairs) {
    const fg = effective(fgTok, map);
    const bg = bgTok.startsWith('rgb-') ? special[bgTok](map) : effective(bgTok, map);
    if (!fg || !bg) {
      console.log('  ?? ' + label.padEnd(22) + 'tidak terukur (' + fgTok + ' / ' + bgTok + ')');
      continue;
    }
    const r = ratio(fg, bg);
    const thr = need(size, bold);
    const ok = r >= thr;
    if (!ok) fails++;
    console.log('  ' + (ok ? 'OK  ' : 'FAIL') + ' ' + label.padEnd(22) + r.toFixed(2) + ':1  butuh ' + thr + '  (' + size + 'px/' + bold + ')');
  }
}
console.log('FAILS = ' + fails);

// ── Solver: cari turunan gelap (hue dipertahankan) yang mencapai 4.5:1 ──────
function toHex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function solveDarken(baseHex, againstHexOrRgb, target = 4.5) {
  const base = toRgb(baseHex).rgb;
  const against = Array.isArray(againstHexOrRgb) ? againstHexOrRgb : toRgb(againstHexOrRgb).rgb;
  let best = null;
  for (let k = 1; k >= 0.2; k -= 0.005) {
    const c = base.map((v) => v * k);
    if (ratio(c, against) >= target) {
      best = { hex: toHex(c), k: k.toFixed(3), r: ratio(c, against).toFixed(2) };
      break;
    }
  }
  return best;
}
const WHITE = '#ffffff';
console.log('SOLVER (cahaya putih di atas isian solid)');
console.log('  primary', JSON.stringify(solveDarken('#0ab39c', WHITE)));
console.log('  danger ', JSON.stringify(solveDarken('#f06548', WHITE)));
console.log('  info   ', JSON.stringify(solveDarken('#299cdb', WHITE)));
console.log('  secondary', JSON.stringify(solveDarken('#405189', WHITE)));
console.log('SOLVER (teks gelap di atas putih / soft)');
console.log('  muted   ', JSON.stringify(solveDarken('#74788d', WHITE)));
console.log('  muted/soft-bg', JSON.stringify(solveDarken('#74788d', toRgb('#f1f4f9').rgb)));
console.log('  danger-ink', JSON.stringify(solveDarken('#d94c30', WHITE)));
console.log('  danger-ink/soft', JSON.stringify(solveDarken('#d94c30', toRgb('#fdeee9').rgb)));
console.log('SOLVER (teks terang di atas kartu gelap #1e2227)');
const DARKCARD = toRgb('#1e2227').rgb;
function solveLighten(baseHex, against, target = 4.5) {
  const base = toRgb(baseHex).rgb;
  let best = null;
  for (let k = 1; k <= 4; k += 0.02) {
    const c = base.map((v) => Math.min(255, v * k));
    if (ratio(c, against) >= target) {
      best = { hex: toHex(c), k: k.toFixed(2), r: ratio(c, against).toFixed(2) };
      break;
    }
  }
  return best;
}
console.log('  danger-hover', JSON.stringify(solveLighten('#d94c30', DARKCARD)));
console.log('  muted         ', JSON.stringify(solveLighten('#74788d', DARKCARD)));

