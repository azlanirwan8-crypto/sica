import { readFileSync, existsSync } from 'node:fs';
/* Paritas kunci i18n id.json vs en.json — kunci hilang/lebih di kedua sisi, dihitung sebagai set, bukan jumlah baris. */
const paths = [
  ['id', 'apps/web/src/locales/id.json'],
  ['en', 'apps/web/src/locales/en.json'],
];
const found = paths.filter(([, p]) => existsSync(p));
if (found.length < 2) { console.log('berkas locale tidak lengkap: ' + found.map(([l, p]) => l + '=' + p).join(' ')); process.exit(0); }
const flat = (obj, prefix = '', out = new Set()) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
    else out.add(key);
  }
  return out;
};
const idSet = flat(JSON.parse(readFileSync(found[0][1], 'utf8')));
const enSet = flat(JSON.parse(readFileSync(found[1][1], 'utf8')));
const onlyId = [...idSet].filter((k) => !enSet.has(k));
const onlyEn = [...enSet].filter((k) => !idSet.has(k));
console.log(`kunci id = ${idSet.size} · kunci en = ${enSet.size}`);
console.log(`hanya di id = ${onlyId.length} · hanya di en = ${onlyEn.length}`);
console.log('contoh hanya-id: ' + onlyId.slice(0, 8).join(', '));
console.log('contoh hanya-en: ' + onlyEn.slice(0, 8).join(', '));
const ns = new Map();
for (const k of [...idSet, ...enSet]) { const p = k.split('.')[0]; ns.set(p, (ns.get(p) || 0) + 1); }
console.log('namespace = ' + ns.size + ' :: ' + [...ns].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + ':' + v).join(' '));
console.log(onlyId.length + onlyEn.length === 0 ? 'i18n-parity: HIJAU' : `i18n-parity: PERLU DILIHAT — ${onlyId.length + onlyEn.length} kunci tidak berpasangan`);
