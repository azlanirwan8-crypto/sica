import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const rd = (f) => readFileSync('C:/SICA/docs/' + f, 'utf8');
const L = (f) => rd(f).split(NL);
const out = [];
const say = (s) => out.push(s);

/* §20.4 kamus: baris 4 kolom per gugus */
{
  const b = L('DATA_MODEL.md');
  const s = b.findIndex((l) => /^### 20\.4/.test(l));
  const e = b.findIndex((l) => /^### 20\.5/.test(l));
  let rows = 0; const per = [];
  let cur = null, n = 0;
  for (const l of b.slice(s, e)) {
    const h = l.match(/^#### (20\.4\.\d)/);
    if (h) { if (cur) per.push(cur + '=' + n); cur = h[1]; n = 0; continue; }
    if (cur && l.startsWith('|') && !/^\|---/.test(l) && !/^\|\s*Master\s*\|/.test(l)) { n++; rows++; }
  }
  if (cur) per.push(cur + '=' + n);
  say('§20.4 baris kamus=' + rows + ' per gugus :: ' + per.join(', '));
}

/* PRD §5.14 sub-bagian: FR, parameter, kamus, penolakan, AC, NFR */
{
  const b = L('PRD.md');
  const s = b.findIndex((l) => /^### 5\.14 /.test(l));
  let e = b.length;
  for (let i = s + 1; i < b.length; i++) if (/^## 6\./.test(b[i])) { e = i; break; }
  const seg = b.slice(s, e);
  const blocks = [];
  let cur = null;
  for (const l of seg) {
    const h = l.match(/^#### (5\.14\.\d)(.*)$/);
    if (h) { cur = { id: h[1], title: h[2].slice(0, 34).trim(), rows: 0 }; blocks.push(cur); continue; }
    if (cur && l.startsWith('|') && !/^\|---/.test(l) && !/\|\s*---\s*\|/.test(l)) {
      if (/^\|\s*(Kolom|Field|Mata|Rujukan)\b/.test(l)) continue;
      cur.rows++;
    }
  }
  say('§5.14 blok: ' + blocks.map((x) => x.id + '(' + x.rows + ')' + (x.title.includes('param') || x.title.includes('Katalog') ? '' : '')).join(' '));
  blocks.forEach((x) => say('   ' + x.id + ' baris=' + x.rows + ' — ' + x.title));
}

/* prefix normatif: daftar 38 prefix + cek per modul yang tadi dianggap kosong */
{
  const b = L('RBAC_MATRIX.md');
  const s = b.findIndex((l) => /^## 4\./.test(l));
  const e = b.findIndex((l) => /^## 5\./.test(l));
  const codes = [];
  for (const l of b.slice(s, e)) {
    const m = l.match(/^\|\s*\d+\s*\|\s*\u0060([a-z_]+)\.[a-z_.]+\u0060/) || l.match(/^\|\s*\d+\s*\|\s*\u0060([a-z_]+(?:\.[a-z_]+)+)\u0060/);
    if (m) codes.push(m[1]);
  }
  const pref = new Set(codes.map((c) => c.split('.')[0]));
  say('prefix §4 (berbasis baris bernomor)=' + pref.size + ' :: ' + [...pref].sort().join(','));
  const probes = { 'M-03': 'role', 'M-09': 'pmb', 'M-12': 'curriculum', 'M-14': 'schedule', 'M-16': 'lms', 'M-17': 'exam', 'M-31': 'accreditation', 'M-32': 'iku', 'M-33': 'contingency' };
  const hits = Object.entries(probes).map(([m, p]) => m + ':' + (pref.has(p) ? 'ADA' : 'tidak'));
  say('probe prefix: ' + hits.join(', '));
  /* cari kode yang benar-benar ada untuk modul tersebut di seluruh berkas */
  const all = rd('RBAC_MATRIX.md');
  for (const [m, p] of Object.entries(probes)) {
    const found = [...all.matchAll(new RegExp('\u0060([a-z_]*' + p + '[a-z_]*(?:\\.[a-z_]+)+)\u0060', 'g'))].map((x) => x[1]);
    if (found.length) say('   ' + m + ' → ' + [...new Set(found)].slice(0, 4).join(', '));
  }
}
console.log(out.join(NL));
