/* Pencari kebocoran atribusi (2026-10-21): baris usulan §4.5.6 mana yang membuat `platform`
   terpetakan ke M-02, dan nama usulan apa saja yang dihitung untuk M-02 — lewat token eksplisit
   ATAU lewat partisi SKU (jalur fallback, yang membuat atribusi jadi kasar).
 * Penggunaan: node .tools/m02-leak-probe.mjs [MODUL]   (baku: M-02)
 */
import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const TARGET = process.argv[2] || 'M-02';
const rb = readFileSync('C:/SICA/docs/RBAC_MATRIX.md', 'utf8').split(NL);
const modToks = (s) => [...new Set(s.match(/\b(M-\d{2}|APP)\b/g) || [])].filter((x) => x !== 'APP');
/* partisi §4.5.1: entitlement/SKU -> Set(modul), dibaca dengan aturan yang sama dengan module-readiness */
const part = new Map();
{
  let in451 = false;
  for (const l of rb) {
    if (/^#### 4\.5\.1/.test(l)) { in451 = true; continue; }
    if (in451 && /^(###|####)\s/.test(l)) in451 = false;
    if (!in451 || !l.startsWith('|')) continue;
    const c = l.split('|').map((s) => s.trim());
    const mods = modToks(c.slice(1).join(' '));
    if (!mods.length || c.length < 3) continue;
    const ent = (c[1] || '').replace(/`/g, '').split(' ')[0];
    if (!part.has(ent)) part.set(ent, new Set());
    for (const m of mods) part.get(ent).add(m);
  }
}
let in456 = false;
const hits = [];
for (let i = 0; i < rb.length; i++) {
  const l = rb[i];
  if (/^#### 4\.5\.6/.test(l)) { in456 = true; continue; }
  if (in456 && /^(###|####|##)\s/.test(l) && !/^#### 4\.5\.6/.test(l)) in456 = false;
  if (!in456 || !l.startsWith('|')) continue;
  const c = l.split('|').map((s) => s.trim());
  const numbered = /^\|\s*(\d+)\s*\|\s*`([a-z_]+(?:\.[a-z_0-9]+)+)`\s*\|\s*`?([a-z_]+)`?\s*\|[^|]*\|\s*`?([A-Z]+)`?\s*\|/.test(l);
  if (numbered) continue;
  if (!/^`[a-z_0-9.]+`$/.test(c[1] || '')) continue;
  const code = c[1].replace(/`/g, '');
  const joined = c.join(' ');
  const mods = modToks(joined);
  /* Kandidat entitlement sama dengan milik `module-readiness`: kolom 3 lalu 4 (denah §4.5.6 menaruh
     SKU di posisi yang berbeda-beda tergantung gelombangnya). */
  const cand = [(c[3] || ''), (c[4] || '')].map((s) => String(s).replace(/`/g, '').trim().split(' ')[0]);
  const ent = cand.find((x) => part.has(x)) || cand[0];
  const viaPart = mods.length ? [] : [...(part.get(ent) || [])];
  const milik = mods.includes(TARGET) ? 'token eksplisit' : (viaPart.includes(TARGET) ? 'partisi SKU (entitlement=' + ent + ')' : '');
  if (!milik) continue;
  hits.push({ baris: i + 1, seg: code.split('.')[0], code, ditolak: /DITOLAK/.test(joined), jalur: milik, sel: (c[5] || '').slice(0, 70) });
}
console.log('baris usulan §4.5.6 yang terpetakan ke ' + TARGET + ' = ' + hits.length);
for (const h of hits) console.log('  ' + h.baris + ' · ' + h.code + ' · seg=' + h.seg + ' · DITOLAK=' + (h.ditolak ? 'ya' : 'tidak') + ' · jalur=' + h.jalur + ' · ' + h.sel);

