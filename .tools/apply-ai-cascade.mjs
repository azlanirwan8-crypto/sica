import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

const raw = readFileSync('.tools/frag-ai-cascade.txt', 'utf8');
const parts = {};
let cur = null;
for (const line of raw.split(NL)) {
  const m = line.match(/^@@@BLOCK (\w+)$/);
  if (m) { cur = m[1]; parts[cur] = []; continue; }
  if (cur) parts[cur].push(line);
}
const text = (k) => parts[k].join(NL).trim();

function insertBefore(file, anchor, block, label) {
  let t = readFileSync(file, 'utf8');
  const first = block.split(NL)[0].slice(0, 46);
  if (t.includes(first)) { console.log('dilewati (sudah ada): ' + label); return; }
  const i = t.indexOf(anchor);
  if (i < 0) { console.error('ANCHOR hilang ' + label + ' di ' + file + ': ' + anchor.slice(0, 40)); return; }
  writeFileSync(file, t.slice(0, i) + block + NL + NL + t.slice(i), 'utf8');
  console.log('sisip ' + label + ' @' + file);
}
function appendTo(file, block, label) {
  let t = readFileSync(file, 'utf8');
  const first = block.split(NL)[0].slice(0, 46);
  if (t.includes(first)) { console.log('dilewati (sudah ada): ' + label); return; }
  writeFileSync(file, t.replace(/\s+$/, NL + NL) + block + NL, 'utf8');
  console.log('tempel ' + label + ' @' + file);
}

// cascade utama
appendTo('docs/DATA_MODEL.md', text('dm'), 'DATA_MODEL §25');
insertBefore('docs/PRD.md', '## 6. Acceptance Criteria (terukur)', text('prd'), 'PRD §5.18');
insertBefore('docs/RBAC_MATRIX.md', '### 4.6 Scope SITE', text('rbac'), 'RBAC §4.5.5');
appendTo('docs/API_SPEC.md', text('api'), 'API_SPEC §7.34');
insertBefore('docs/ROADMAP_TASKS.md', '## Phase 3: Mobile MVP & Dynamic QR Attendance', text('roadmap'), 'ROADMAP §2.24');

// UI_UX §19.6 (dipanggil §7.34/§4.5.5)
appendTo('docs/UI_UX_DESIGN.md', [
  '### 19.6 Toggle berdampak dan kartu analitik lokal',
  '',
  '**Toggle berdampak (`TOGGLE_ACTIVE`, lihat `DATA_MODEL §25.3`).** Semua sakelar `is_active` di SICA — kamus §4.14.2, atribut kustom §4.14.3, parameter §4.16.2, domain deteksi `§25` — dirender sebagai **konfirmasi berdampak**, bukan switch senyap. Bentuknya: (1) label keadaan sekarang; (2) satu baris "yang berubah bila ini dinyalakan/dimatikan" yang dibaca dari data (jumlah item aktif di bawahnya, jumlah layar yang memakai kamus itu, `reviewRole` yang akan menelaah); (3) tombol primer ber-ikon sesuai aksi + teks konsekuensi; (4) sesudah tulis, toast **plus** baris riwayat yang langsung terlihat di panel yang sama. Untuk kelas `REGULATORY`/`SECURITY`, dialog kedua menuntut **penyetuju berbeda + MFA** dan menampilkan `requestedBy` (bukan kolom yang bisa dikirim klien). Kalau server menolak karena empat-mata, layar **tidak** pura-pura berhasil: toggle kembali ke keadaan semula beserta sebab (`remedyHref`).',
  '',
  '**Kartu analitik lokal (ALG-25, ALG-10, ALG-13).** Setiap kartu wajib menampilkan empat hal dalam satu kesatuan visual: angka, **`degraded_mode`** bila ada (badge, bukan catatan kaki), `model_version` + `parameter_version` (teks kecil, tetap terbaca AA), dan waktu run. Aturan yang tidak bisa ditawar: angka parsial **tidak pernah** tampil sebagai angka final — `PARTIAL_BUDGET_EXHAUSTED`/`NO_PREREQ_DATA`/`NO_BASELINE`/`SINGLE_MODEL_AGREEMENT` menempel di angka, dan tombol "terima sebagai temuan" nonaktif sampai verdict manusia (`BR-AI-3`). Peran yang berbeda melihat kartu yang berbeda (`FR-AI-05`): Rektorat agregat per domain, BAAK `ATTENDANCE`, BAUK `FINANCE`, dan **tidak ada kartu temuan orang lain** untuk Dosen/Mahasiswa — penyaringannya di proyeksi server, bukan `display: none` (`AGENTS §3.8`).',
  '',
  '**Preview WASM.** Slider "apa yang terjadi bila ambang dinaikkan" boleh dihitung di perangkat (preview), dan karena itu **hanya** mengubah angka di kartu itu — tidak ada panah naik-turun yang mengirim angka ke API, dan setiap perubahan ambang yang ingin disimpan tetap lewat rute `PUT /admin/anomaly/domains/:domain` dengan `expectedVersion`. Kalau hasil perangkat dan server berbeda, server menang dan perbedaan itu **ditampilkan**, tidak ditutupi (`AC-AI-4`).',
].join(NL), 'UI_UX §19.6');

// MIGRATION_SOP §6.2b (dipanggil ROADMAP §2.24)
insertBefore('docs/MIGRATION_SOP.md', '### 6.3 Empat penjaga yang berlaku untuk kelima nomor', [
  '### 6.2b Satu migrasi analitik lokal (`0081`) — lahir di [DATA_MODEL §25](file:///c:/SICA/docs/DATA_MODEL.md)',
  '',
  '| Berkas | Isi | Tipe | Catatan penegakan |',
  '|---|---|---|---|',
  '| `0081_anomaly_detection.sql` | enum `anomaly_domain` + `anomaly_agreement` + `anomaly_verdict` + `anomaly_findings` + `anomaly_feedback_labels` (insert-only) + `anomaly_domain_settings` + 3 indeks + 3 baris parameter `ai.anomaly.*` | **Expand** | dua tabel pertama di-`REVOKE UPDATE, DELETE` + pemicu `app.reject_mutation()` sebelum policy; `is_active` **baku false** dan menyala butuh `approved_by <> requested_by` yang ditegakkan `CHECK` DB; tidak ada kolom yang menerima skor dari perangkat (`SERVER_ONLY`) |',
  '',
  'Urutan: `0036` (`engine_runs` pemilik harness) → `0049` (parameter) → `0081`. Tanpa `0036`/`0049` diterapkan, `0081` gagal dibuat — dan itu sebabnya tiket `AI-1` di `ROADMAP §2.24` berstatus tertahan `G-02` meskipun DDL-nya sudah lengkap.',
].join(NL), 'MIGRATION §6.2b');

// catatan maksimum nomor + indeks
{
  const f = 'docs/MIGRATION_SOP.md';
  let t = readFileSync(f, 'utf8');
  t = t.replace('Per 2026-10-21 maksimum adalah **`0080`**', 'Per 2026-10-21 maksimum adalah **`0081`**');
  t = t.replace('Nomor berikutnya (`0081`) wajib lewat §23.7/§24.4/§22.9 lebih dulu', 'Nomor berikutnya (`0082`) wajib lewat §23.7/§24.4/§25/§22.9 lebih dulu');
  writeFileSync(f, t, 'utf8');
  console.log('MIGRATION_SOP: maksimum nomor → 0081');
}
{
  const f = 'docs/INDEX.md';
  const block = ['| Dashboard analitik lokal (ALG-25 anomaly IF/LOF, penempatan WASM, `TOGGLE_ACTIVE`) | PRD.md + ARCHITECTURE.md + DATA_MODEL.md + API_SPEC.md + UI_UX_DESIGN.md | `PRD §5.18` · `ARCHITECTURE §12.21`–`§12.22` · `DATA_MODEL §25` (`0081`, §21.3 baris 34–36) · `RBAC §4.5.5` (usulan) · `API_SPEC §7.34` · `UI_UX §19.6` · `ROADMAP §2.24` (`AI-1…3`, `TOG-1`) | spesifikasi — design-only sampai dependensi lokal + golden vector nyata |'];
  insertBefore(f, '| Peta sebaran sesi real-time (GIS), jaminan sosial + EWMP, mutu gerak & CLS |', block.join(NL), 'INDEX baris AI');
}
