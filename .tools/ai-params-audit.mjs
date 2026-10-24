import { readFileSync, existsSync } from 'node:fs';

/* AUDIT DASHBOARD AI & PARAMETERISASI (diperbaiki 2026-10-21)
   Dua cacat versi pertama, keduanya kelas `RD-62`/`RD-76` (alat lebih sering salah daripada dokumen):
   (1) atribusi engine memakai jendela 900 karakter, sehingga "retention" tertambat ke ALG-6 padahal
       §12.5 adalah ALG-10 · EWS/Dropout Risk Scorer; (2) cek rute memakai substring `/api/v1/master/kinds`
       yang tidak ada, padahal rute kamus ditulis sebagai heading `#### 4.14.2 … POST /master/kinds` dan
       sejenis. Sekarang: atribusi dari JUDUL bagian engine, rute dari baris yang memuat METODE HTTP. */

const dm = readFileSync('docs/DATA_MODEL.md', 'utf8');
const ar = readFileSync('docs/ARCHITECTURE.md', 'utf8');
const api = readFileSync('docs/API_SPEC.md', 'utf8');
const rb = readFileSync('docs/RBAC_MATRIX.md', 'utf8');
const prd = readFileSync('docs/PRD.md', 'utf8');
const uix = readFileSync('docs/UI_UX_DESIGN.md', 'utf8');
const seed = existsSync('docs/SEED_DATA.md') ? readFileSync('docs/SEED_DATA.md', 'utf8') : '';
const NL = String.fromCharCode(10);

// 1. Peta engine: judul bagian `### 12.x ALG-n · Nama` dan tabel §13.5 yang menamai kode
const engineIdx = [];
{
  const lines = ar.split(NL);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#{2,4}.*?\bALG-(\d+)\b\s*[·—-]?\s*([^\n|]{0,80})/);
    if (m) {
      let body = '';
      for (let j = i + 1; j < lines.length && !/^#{2,4} /.test(lines[j]); j++) body += lines[j] + NL;
      engineIdx.push({ alg: 'ALG-' + m[1], name: m[2].trim(), body: body.slice(0, 4000) });
    }
  }
}
const algs = [...new Set([...ar.matchAll(/ALG-\d+/g)].map((m) => m[0]))].sort((a, b) => +a.slice(4) - +b.slice(4));
console.log(`ALG terukur di ARCHITECTURE = ${algs.length} (${algs[0]}…${algs[algs.length - 1]}) · bagian berjudul engine = ${engineIdx.length}`);

const CANDID = [
  ['Anomaly detection multivariat (Isolation Forest / LOF)', ['isolation forest', 'lof', 'anomaly detection', 'anomaly multivariat']],
  ['Predictive retention / risiko DO', ['dropout', 'drop out', 'risiko do', 'retention', 'early warning']],
  ['EWS kinerja BKD dosen', ['bkd']],
  ['EWS capaian CPL/CPMK OBE', ['cpl attainment', 'obe cpl', 'cpl/ckmk', 'cpl']],
  ['Rekonsiliasi presensi dua sumber', ['rekonsiliasi']],
  ['Peta sebaran sesi (bukan engine, gejala)', ['session_geo']],
];
const results = [...new Set([...dm.matchAll(/CREATE TABLE ([a-z_]*(?:findings|results|scores|flags|proposals|warnings|risk_scores)[a-z_]*)/g)].map((m) => m[1]))];
console.log('\n-- mesin yang diminta brief: kode, tabel hasil, dan rumahnya --');
for (const [nama, keys] of CANDID) {
  const hit = engineIdx.find((e) => keys.some((k) => (e.name + ' ' + e.body).toLowerCase().includes(k)));
  const tabel = results.find((r) => keys.some((k) => r.toLowerCase().includes(k.split(' ')[0]))) || null;
  console.log(`${hit ? 'KODE ' + hit.alg.padEnd(7) + '(' + hit.name.slice(0, 46) + ')' : 'TANPA KODE'} · hasil=${tabel || 'tidak ada tabel bernama itu'} · ${nama}`);
}
console.log(`\ntabel *_findings/*_results/*_scores/*_flags/*_proposals/*_warnings = ${results.length} :: ${results.join(', ')}`);
console.log(`golden vector: ARCH=${(ar.match(/golden/gi) || []).length} · API=${(api.match(/golden/gi) || []).length} · DM=${(dm.match(/golden/gi) || []).length}`);
console.log(`WASM: ARCH=${(ar.match(/WASM/g) || []).length} · API=${(api.match(/WASM/g) || []).length} · DM=${(dm.match(/WASM/g) || []).length} · PRD=${(prd.match(/WASM/g) || []).length} · UI=${(uix.match(/WASM/g) || []).length}`);

// 2. TOGGLE_ACTIVE + cakupan aksi
console.log('\n-- TOGGLE_ACTIVE sebagai aksi --');
for (const [f, t] of [['RBAC', rb], ['API_SPEC', api], ['PRD', prd], ['DATA_MODEL', dm], ['UI_UX', uix]]) {
  console.log(`  ${f}: TOGGLE_ACTIVE=${(t.match(/TOGGLE_ACTIVE/g) || []).length} · toggle=${(t.match(/toggle/gi) || []).length} · is_active=${(t.match(/is_active|isActive/g) || []).length}`);
}

// 3. rute tulis kamus/parameter/atribut: dihitung dari baris yang memuat METODE HTTP + segmen
const WRITE = /(POST|PUT|PATCH|DELETE)\s+([^\s|`]+)/g;
const segCount = (needle) => {
  let n = 0;
  for (const line of api.split(NL)) {
    if (!/(POST|PUT|PATCH|DELETE)/.test(line)) continue;
    if (line.includes(needle)) n++;
  }
  return n;
};
console.log('\n-- baris berisi metode HTTP + segmen jalur (indikasi CRUD penuh) --');
for (const seg of ['/master/kinds', '/master/items', '/master/lookups', '/settings/custom-attributes', '/custom-attributes', '/attributes', '/admin/system-parameters', '/admin/menus', '/anomaly']) {
  console.log(`  ${seg} = ${segCount(seg)}`);
}
console.log(`\nSEED_DATA: parameter=${(seed.match(/master_system_parameters/g) || []).length} · kamus=${(seed.match(/reference_items|reference_kinds/g) || []).length}`);
