import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const rd = (f) => readFileSync('C:/SICA/docs/' + f, 'utf8');
const L = (f) => rd(f).split(NL);
const out = [];
const say = (s) => out.push(s);

/* A. katalog parameter §21.3 */
{
  const b = L('DATA_MODEL.md');
  const s = b.findIndex((l) => /^### 21\.3/.test(l));
  const e = b.findIndex((l) => /^### 21\.4/.test(l));
  const rows = b.slice(s, e).filter((l) => /^\|\s*\d+\s*\|/.test(l));
  const keys = new Set();
  for (const l of rows) for (const m of l.matchAll(/\u0060([a-z][a-z0-9_]*\.[a-z0-9_.]+)\u0060\s*=/g)) keys.add(m[1]);
  const crud = rows.filter((l) => /master_system_parameters/.test(l)).length;
  const elsewhere = rows.filter((l) => !/master_system_parameters/.test(l)).length;
  say('§21.3 baris katalog=' + rows.length + ' · rumah=master_system_parameters ' + crud + ' · rumah lain (tabel/enum/kamus) ' + elsewhere + ' · kunci eksplisit terukur=' + keys.size);
}

/* B. katalog kamus §20.4 enam gugus */
{
  const b = L('DATA_MODEL.md');
  const s = b.findIndex((l) => /^### 20\.4/.test(l));
  const e = b.findIndex((l) => /^### 20\.5/.test(l));
  const seg = b.slice(s, e);
  const groups = seg.filter((l) => /^#### 20\.4\.\d/.test(l)).length;
  const rows = seg.filter((l) => /^\|\s*\d+\s*\|/.test(l));
  const kinds = new Set();
  for (const l of rows) for (const m of l.matchAll(/\u0060([a-z][a-z0-9_]{2,})\u0060/g)) kinds.add(m[1]);
  say('§20.4 gugus=' + groups + ' · baris kamus=' + rows.length);
}

/* C. FR/BR/AC yang DIDEFINISIKAN di PRD §5.14 (baris tabel, bukan sebutan) */
{
  const b = L('PRD.md');
  const s = b.findIndex((l) => /^### 5\.14 /.test(l));
  let e = b.length;
  for (let i = s + 1; i < b.length; i++) if (/^## 6\./.test(b[i])) { e = i; break; }
  const seg = b.slice(s, e);
  const fr = new Set(); const br = new Set(); const ac = new Set();
  for (const l of seg) {
    if (!/^\|\s*(FR|BR|AC)-/.test(l) && !/^\|\s*`?(FR|BR|AC)-/.test(l)) continue;
    const id = (l.match(/\b((?:FR|BR|AC)-[A-Z]{2,5}-\d{2,3})\b/) || [])[1];
    if (!id) continue;
    (id.startsWith('FR') ? fr : id.startsWith('BR') ? br : ac).add(id);
  }
  const paramRow = seg.filter((l) => /^\|\s*\d+\s*\|/.test(l)).length;
  say('§5.14 definisi baris: FR=' + fr.size + ' BR=' + br.size + ' AC=' + ac.size + ' · baris bernomor (parameter+kamus+penolakan+DoD)=' + paramRow);
}

/* D. cakupan prefix izin normatif per M (apakah modul punya izin sama sekali) */
{
  const b = L('RBAC_MATRIX.md');
  const s = b.findIndex((l) => /^## 4\./.test(l));
  const e = b.findIndex((l) => /^## 5\./.test(l));
  const codes = [];
  for (const l of b.slice(s, e)) { const m = l.match(/^\|\s*\d+\s*\|\s*\u0060([a-z_]+)\.[a-z_.]+\u0060/); if (m) codes.push(m[1]); }
  const prefixes = new Set(codes);
  const pairs = {
    'M-01': ['tenant', 'entitlement', 'platform'], 'M-02': ['master', 'reference', 'attribute', 'setting'],
    'M-03': ['role', 'permission', 'authz'], 'M-04': ['helpdesk', 'ticket'], 'M-05': ['audit', 'pii', 'security'],
    'M-07': ['hr', 'bkd'], 'M-09': ['pmb', 'lead', 'camaba'], 'M-10': ['finance', 'invoice', 'payment', 'tuition'],
    'M-12': ['curriculum', 'cpl', 'rps', 'obe'], 'M-13': ['enrollment', 'krs', 'advising'], 'M-14': ['schedule', 'class', 'room'],
    'M-15': ['modality', 'session', 'teaching'], 'M-16': ['lms'], 'M-17': ['exam', 'proctor'], 'M-18': ['attendance'],
    'M-19': ['grade', 'assessment', 'transcript'], 'M-20': ['thesis'], 'M-23': ['convocation', 'graduation'],
    'M-26': ['graduation', 'simulation', 'enrollment'], 'M-27': ['tracer'], 'M-30': ['graduation', 'clearance', 'yudisium'],
    'M-31': ['accreditation', 'lkps'], 'M-32': ['iku', 'analytics'], 'M-33': ['schedule', 'room'], 'M-34': ['feeder'],
    'M-37': ['spmi', 'audit', 'quality'], 'M-38': ['mbkm', 'fieldwork'], APP: ['mobile', 'sync', 'enrollment'],
  };
  const missing = [];
  for (const [m, cand] of Object.entries(pairs)) {
    const hit = cand.filter((c) => prefixes.has(c));
    if (!hit.length) missing.push(m);
  }
  say('prefix normatif unik di §4 = ' + prefixes.size + ' · modul WITHOUT prefix normatif apa pun: ' + (missing.length ? missing.join(',') : 'tidak ada'));
}

console.log(out.join(NL));
