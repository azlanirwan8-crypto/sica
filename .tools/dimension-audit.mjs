import { readFileSync, existsSync } from 'node:fs';

/* AUDIT DIMENSI — membandingkan SEMANGAT brief dewan dengan kata yang NYATA tertulis di 20 berkas.
   Alat ini tidak menilai kualitas; ia menjawab satu pertanyaan: "dimensi ini punya rumah dokumen atau tidak".
   Nama berkas yang tidak ada di DAFTAR tidak dihitung (dinyatakan, bukan disenyapkan). */

const DAFTAR = ['INDEX.md', 'PRD.md', 'BLUEPRINT_ENTERPRISE.md', 'BLUEPRINT_ROLE_BY_ROLE.md', 'ARCHITECTURE.md', 'DATA_MODEL.md', 'API_SPEC.md', 'RBAC_MATRIX.md', 'SECURITY_COMPLIANCE.md', 'INTEGRATIONS.md', 'DEPLOYMENT_DEVOPS.md', 'ENV_CONTRACT.md', 'GIT_WORKFLOW.md', 'MIGRATION_SOP.md', 'AUDIT_READINESS.md', 'ISSUE_RESOLUTION.md', 'GLOSSARY.md', 'SEED_DATA.md', 'PROGRESS_REPORT.md', 'ROADMAP_TASKS.md'];

const teks = new Map();
const hilang = [];
for (const f of DAFTAR) {
  const p = 'docs/' + f;
  if (!existsSync(p)) { hilang.push(f); continue; }
  teks.set(f, readFileSync(p, 'utf8'));
}

const DIMENSI = [
  ['GIS sebaran login (MaxMind GeoIP2)', ['GeoIP', 'MaxMind', 'geoip']],
  ['W3C Geolocation API presisi', ['Geolocation', 'geolocation', 'accuracyMeters', 'latitude', 'longitude']],
  ['Peta sebaran di dashboard eksekutif', ['peta sebaran', 'geospatial', 'GIS', 'GIS map', 'mapbox', 'Leaflet', 'leaflet']],
  ['Redis active session store', ['active session', 'session store', 'activeSessions', 'session:']],
  ['SSE/WebSocket untuk sinyal sesi', ['Server-Sent Events', 'SSE', 'WebSocket']],
  ['Anomaly detection lokal (Isolation Forest/LOF)', ['Isolation Forest', 'isolation_forest', 'LOF', 'anomaly']],
  ['Predictive retention / risiko DO', ['retention', 'drop-out', 'dropout', 'DO risk', 'attrition', ' Logistic Regression', 'logistic_regression', 'Decision Tree', 'decision_tree']],
  ['EWS BKD & CPL OBE', ['EWS', 'early warning', 'peringatan dini']],
  ['Model ML lokal + registry (WASM/ONNX)', ['ONNX', 'WASM', 'ml_model_versions', 'model_version']],
  ['MARC21 / Dublin Core', ['MARC21', 'Dublin Core']],
  ['KOHA / SLiMS adapter + OPAC', ['KOHA', 'SLiMS', 'OPAC']],
  ['Bebas pustaka (clearance perpustakaan)', ['bebas pustaka']],
  ['PPh 21 TER 2024 progresif', ['PPh 21', 'PPh21', 'ter_effectif', 'Tarif Efektif']],
  ['BPJS Ketenagakerjaan & Kesehatan', ['BPJS']],
  ['EWMP dosen', ['EWMP']],
  ['E-Katalog / HPS / PPK / BMN', ['E-Katalog', 'ekatalog', 'HPS', 'BMN']],
  ['QR asset tagging + straight-line', ['asset tag', 'penyusutan', 'straight-line', 'Straight-Line']],
  ['Rekam medis AES-256 vault + antrean virtual', ['AES-256', 'medical vault', 'rekam medis', 'virtual queue']],
  ['Interval tree overlap O(log n)', ['interval tree', 'Interval Tree']],
  ['Tesseract OCR lokal', ['Tesseract', 'OCR']],
  ['CBT question bank', ['question bank', 'bank soal', 'cbt_item']],
  ['AST formula evaluator', ['AST', 'Abstract Syntax Tree']],
  ['CPL/CPMK matrix', ['CPL', 'CPMK']],
  ['SN-Dikti 53/2023 & SPMI', ['53/2023', 'SPMI']],
  ['IKU 1-8', ['IKU']],
  ['BAN-PT / LAM 9 kriteria borang', ['BAN-PT', 'borang']],
  ['SISTER 2.0 delta hash sync', ['SISTER', 'delta hash', 'Delta Hash']],
  ['Feeder PDDikti web services', ['Feeder', 'PDDikti', 'PDDIKTI']],
  ['PPKS zero-knowledge vault', ['PPKS', 'zero-knowledge', 'Zero-Knowledge']],
  ['UU PDP masking + hash chaining', ['UU PDP', 'masking', 'hash chain', 'chaining']],
  ['Micro-interactions / Framer Motion', ['Framer Motion', 'micro-interaction', 'Micro-interaction']],
  ['Skeleton loading', ['skeleton', 'Skeleton']],
  ['Glassmorphism', ['glassmorphism', 'Glassmorphism']],
  ['CLS 0.0 / tanpa layout shift', ['CLS', 'layout shift']],
  ['Dark/Light adaptive', ['prefers-color-scheme', 'data-bs-theme', 'mode gelap', 'tema gelap', 'Dark mode']],
  ['Teams native Graph + Azure AD tenant binding', ['Microsoft Graph', 'MS Graph', 'Azure AD', 'TEAMS_TENANT_ID']],
  ['Fallback kanal dinamis (Zoom/Meet/Jitsi/BBB)', ['fallback', 'ZOOM', 'JITSI', 'BBB', 'GOOGLE_MEET']],
  ['Ambang durasi join 75% HADIR_ONLINE + tag Feeder O', ['HADIR_ONLINE', 'online_min_join_ratio', '75']],
];

const rows = [];
for (const [nama, keys] of DIMENSI) {
  const berkasHit = [];
  for (const [f, t] of teks) {
    if (keys.some((k) => t.includes(k))) berkasHit.push(f.replace('.md', ''));
  }
  rows.push({ nama, n: berkasHit.length, berkasHit });
}
rows.sort((a, b) => a.n - b.n);
console.log(`berkas diperiksa = ${teks.size} dari 20${hilang.length ? ' · TIDAK ADA: ' + hilang.join(', ') : ''}`);
for (const r of rows) {
  const tanda = r.n === 0 ? 'X TIDAK BERROOM' : r.n <= 2 ? '~ rumah tipis' : 'ok';
  console.log(`${tanda.padEnd(14)} ${String(r.n).padStart(2)} berkas :: ${r.nama}${r.n > 0 ? '  [' + r.berkasHit.slice(0, 6).join(', ') + (r.n > 6 ? ', ...' : '') + ']' : ''}`);
}
const nol = rows.filter((r) => r.n === 0).length;
const tipis = rows.filter((r) => r.n > 0 && r.n <= 2).length;
console.log(`\ndimensi TANPA rumah dokumen = ${nol} · rumah tipis (<=2 berkas) = ${tipis} · cukup = ${rows.length - nol - tipis} · total dimensi = ${rows.length}`);
