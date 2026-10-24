import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const L = (f) => readFileSync(D + f, 'utf8').split(NL);
const sec = (lines, startRe, endRe) => {
  const s = lines.findIndex((l) => startRe.test(l));
  if (s === -1) return [];
  let e = lines.length;
  for (let i = s + 1; i < lines.length; i++) if (endRe.test(lines[i])) { e = i; break; }
  return lines.slice(s, e);
};
const r = [];

/* UI 17.2 role→card matrix: how many role sub-blocks and how many M-rows */
{
  const b = L('UI_UX_DESIGN.md');
  const blocks = sec(b, /^### 17\.2/, /^### 17\.3/);
  const roleHead = blocks.filter((l) => /^\*\*/.test(l)).length;
  const mRows = blocks.filter((l) => /^\|\s*M-\d{2}\s*\|/.test(l)).length;
  r.push('UI 17.2: baris M-xx=' + mRows + ' baris M-xx unik=' + new Set(blocks.filter((l) => /^\|\s*M-\d{2}\s*\|/.test(l)).map((l) => l.match(/M-\d{2}/)[0])).size + ' blok-tebal=' + roleHead);
  const h18 = sec(b, /^## 18\./, /^## 19\./).filter((l) => /^### 18\.\d+/.test(l));
  r.push('UI 18 headings: ' + h18.length + ' (blok layar 18.1–18.12 = 12; sisanya aturan/komponen/i18n/DoD)');
}

/* INTEGRATIONS 6.1 adapter rows */
{
  const b = L('INTEGRATIONS.md');
  const s = sec(b, /^### 6\.1/, /^### 6\.2/).filter((l) => /^\|\s*\*\*/.test(l));
  r.push('INTEGRATIONS 6.1 baris sistem=' + s.length);
  const d = L('INTEGRATIONS.md');
  const s64 = sec(d, /^### 6\.4/, /^### 6\.5/).filter((l) => /^\|\s*\*\*/.test(l));
  r.push('INTEGRATIONS 6.4 design-only rows=' + s64.length);
  const s67 = sec(d, /^### 6\.7/, /^## 7\.|^### 7\./).filter((l) => /^\|\s*\*\*/.test(l));
  r.push('INTEGRATIONS 6.7 register rows=' + s67.length);
}

/* API_SPEC 7 route rows, all shapes */
{
  const b = L('API_SPEC.md');
  const s = b.findIndex((l) => /^## 7\./.test(l));
  let e = b.length;
  for (let i = s + 1; i < b.length; i++) if (/^## (8|9)\./.test(b[i])) { e = i; break; }
  const body = b.slice(s, e);
  const meth = body.filter((l) => /^\|\s*`?(GET|POST|PATCH|PUT|DELETE)`?\s*\|/.test(l));
  const st = {};
  for (const l of meth) {
    const cells = l.split('|').map((c) => c.trim());
    const k = cells.find((c) => /spec-only|blocker|implemented/.test(c));
    if (k) st[k.replace(/`/g, '')] = (st[k.replace(/`/g, '')] ?? 0) + 1;
  }
  r.push('API_SPEC 7: baris metode=' + meth.length + ' status=' + JSON.stringify(st));
  const subs = body.filter((l) => /^### 7\.\d+/.test(l));
  r.push('API_SPEC 7 sub-bagian=' + subs.length);
}

/* DATA_MODEL 22 objects */
{
  const b = L('DATA_MODEL.md');
  const s = b.findIndex((l) => /^## 22\./.test(l));
  const body = b.slice(s).join(NL);
  const tbl = [...body.matchAll(/CREATE (?:OR REPLACE )?TABLE (?:IF NOT EXISTS )?([a-z_]+)/g)].map((m) => m[1]);
  const dup = tbl.filter((v, i) => tbl.indexOf(v) !== i);
  r.push('DATA_MODEL 22: CREATE TABLE statement=' + tbl.length + ' unik=' + new Set(tbl).size + ' dup=' + (dup.length ? [...new Set(dup)].join(',') : 'none'));
  const vw = [...body.matchAll(/CREATE (?:OR REPLACE )?VIEW (?:IF NOT EXISTS )?([a-z_]+)/g)].map((m) => m[1]);
  r.push('DATA_MODEL 22: VIEW=' + vw.length + ' unik=' + new Set(vw).size + ' :: ' + vw.join(','));
  const tp = [...body.matchAll(/CREATE TYPE ([a-z_]+) AS/g)].map((m) => m[1]);
  r.push('DATA_MODEL 22: ENUM TYPE=' + tp.length + ' unik=' + new Set(tp).size + ' dup=' + (tp.filter((v, i) => tp.indexOf(v) !== i).join(',') || 'none'));
  const mig = [...new Set([...body.matchAll(/\b(00[5-7]\d)\b/g)].map((m) => m[1]))].sort();
  r.push('DATA_MODEL 22: migrasi=' + mig.length + ' :: ' + mig.join(','));
}

/* PRD 5.12 usulan entitlement codes */
{
  const b = L('PRD.md');
  const s = b.findIndex((l) => /^#{2,4} 5\.12/.test(l));
  let e = b.length;
  for (let i = s + 1; i < b.length; i++) if (/^#{2,4} 5\.13/.test(b[i])) { e = i; break; }
  const codes = [];
  for (const l of b.slice(s, e)) {
    const m = l.match(/^\|\s*(M-\d{2}|APP)\s*\|/);
    if (!m) continue;
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    codes.push(cells[2]);
  }
  const usulan = codes.filter((c) => /usulan/.test(c));
  const named = [...new Set(usulan.flatMap((c) => c.match(/`([a-z_]+)`/g) || []).map((x) => x.replace(/`/g, '')))];
  r.push('PRD 5.12: baris=' + codes.length + ' sel-usulan=' + usulan.length + ' kode-usulan-unik=' + named.length + ' :: ' + named.join(','));
}

console.log(r.join(NL));
