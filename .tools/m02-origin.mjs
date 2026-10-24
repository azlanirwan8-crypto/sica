/**
 * m02-origin.mjs — scratch kajian M-02: untuk setiap rute yang dipetakan `crud-matrix` ke M-02,
 * cetak heading `API_SPEC` tempat path itu ditulis dan apakah heading itu benar-benar menyebut
 * M-02. Ini menjawab "59 rute itu milik M-02 atau terseret peta kurasi wilayah?". Bukan penjaga.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const out = execFileSync(process.execPath, ['.tools/crud-matrix.mjs', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const cr = JSON.parse(out.slice(out.indexOf('{')));
const spec = readFileSync('docs/API_SPEC.md', 'utf8').split(NL);
const heads = spec.map((l, i) => (/^#{2,6}\s+[\d.]/.test(l) ? i : -1)).filter((i) => i >= 0);
const headingFor = (lineNo) => {
  let best = -1;
  for (const h of heads) if (h < lineNo) best = h; else break;
  return best >= 0 ? spec[best] : '(tanpa heading)';
};
const row = (cr.rows || cr).find((r) => r.id === 'M-02');
const seen = new Map();
for (const r of row.routeList) seen.set(r.m + ' ' + r.p, r.v);
const tally = {};
let milikSendiri = 0;
for (const [key, v] of [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const path = key.split(' ').slice(1).join(' ');
  const bare = path.replace(/^\/api\/v1/, '').replace(/\{[^}]*\}/g, 'X').replace(/:[A-Za-z0-9]+/g, 'Y');
  const needle = bare.split('/').filter(Boolean).slice(0, 3).join('/');
  const li = spec.findIndex((l) => l.includes(needle) && /GET|POST|PUT|PATCH|DELETE/.test(l));
  const h = li >= 0 ? headingFor(li) : '(tidak ketemu)';
  const own = /M-02/.test(h);
  if (own) milikSendiri++;
  const tag = h.replace(/^#+\s*/, '').slice(0, 66);
  tally[tag] = tally[tag] || { n: 0, own };
  tally[tag].n++;
  console.log((own ? 'MILIK  ' : 'SILANG ') + v.padEnd(8) + bare.padEnd(52) + '· ' + tag);
}
console.log(NL + 'total rute M-02 = ' + seen.size + ' · ditulis di heading yang menyebut M-02 = ' + milikSendiri);
console.log('per heading:');
for (const [k, x] of Object.entries(tally).sort((a, b) => b[1].n - a[1].n)) console.log(String(x.n).padStart(3) + ' · ' + (x.own ? 'M-02' : 'bukan-M-02') + ' · ' + k);
