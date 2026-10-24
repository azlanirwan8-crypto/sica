import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const insertAfter = (file, needle, block, label) => {
  const lines = readFileSync(file, 'utf8').split(NL);
  const i = lines.findIndex((l) => l.includes(needle));
  if (i < 0) { console.error('ANCHOR hilang ' + label + ': ' + needle.slice(0, 40)); return; }
  lines.splice(i + 1, 0, ...block);
  writeFileSync(file, lines.join(NL), 'utf8');
  console.log('ok ' + label);
};

insertAfter('docs/AUDIT_READINESS.md', '| `RD-88` |', [
  '| `RD-90` | **Tiga mesin yang disebut brief dengan NAMA algoritma belum semuanya punya kode engine.** `node .tools/ai-params-audit.mjs` (diperbaiki, lihat catatan di berkasnya) mengukur: `Decision Tree/Logistic Regression` untuk risiko DO **sudah** ada sebagai `ALG-10 · Early Warning System / Dropout Risk Scorer` (§12.5, lengkap dengan gerbang AUC/Brier dan `psi`), `CPL OBE` sudah `ALG-13` (§12.8), tetapi **Isolation Forest/LOF tidak punya kode, tidak punya tabel hasil, dan tidak pernah disebut** di 20 berkas. Ditutup sebagai `ALG-25` ([ARCHITECTURE §12.21](file:///c:/SICA/docs/ARCHITECTURE.md)) + objeknya ([DATA_MODEL §25](file:///c:/SICA/docs/DATA_MODEL.md), `0081`) + izin usulan `§4.5.5` + rute `API_SPEC §7.34` + layar `UI_UX §19.6`. | `ARCHITECTURE §12.21`/`§12.22`, `DATA_MODEL §25`, `PRD §5.18`, `RBAC §4.5.5`, `API_SPEC §7.34`, `UI_UX §19.6`, `ROADMAP §2.24` | **ditutup sebagai spesifikasi**; tetap **design-only** sampai pustaka lokal + golden vector nyata (`AGENTS §3.9`) |',
  '| `RD-91` | **`TOGGLE_ACTIVE` tidak punya bentuk di kosakata aksi mana pun** (terukur 0 kemunculan di 20 berkas sebelum siklus ini) sementara brief menuntutnya sebagai aksi kelima CRUD penuh. Menambah verba ketujuh akan membelah `permission_verb` yang sudah dijaga CI. Vonis: **`TOGGLE_ACTIVE` = `UPDATE` pada `is_active`** dengan riwayat + empat-mata untuk kelas `REGULATORY`/`SECURITY` + teks dampak di layar; bukti jalurnya memang sudah ada (`PUT /admin/master/custom-attributes/{id}/activate` dan `/retire`). Normanya ditulis di `DATA_MODEL §25.3` + `RBAC §4.5.5` + `UI_UX §19.6`. | `DATA_MODEL §25.3`, `RBAC §4.5.5`, `UI_UX §19.6`, `PRD §5.18 (FR-AI-06)` | **ditutup** — dan dua "lubang" yang tadinya saya tuduhkan ternyata **cacat alat saya**: rute kamus memakai `/admin/master/lookups` (bukan `/master/kinds`), dan menu memakai `/admin/platform/menus`; keduanya punya POST/PUT/PATCH/DELETE. Alat yang salah sudah dibetulkan, bukan dokumennya yang dijebluskan |',
], 'rd90-91');

insertAfter('docs/AUDIT_READINESS.md', '| 1.9 | 2026-10-21 |', [
  '| 1.10 | 2026-10-21 | **Siklus kelima — dashboard analitik lokal (ALG-25), vonis penempatan WASM, dan norma `TOGGLE_ACTIVE`.** Gap `RD-90`–`RD-91`. Cascade penuh: `PRD §5.18` (FR-AI-01…07, BR-AI-1…4, AC-AI-1…6, NFR-AI-1…3) · `ARCHITECTURE §12.21` (ALG-25: dua detektor, tingkat kesepakatan, harness, budget, enam mode turun, explain, fair-share, larangan lintas-tenant) dan `§12.22` (vonis WASM: preview di perangkat, vonis di worker, paritas numerik) · `DATA_MODEL §25` (`0081_anomaly_detection.sql`: 3 enum + `anomaly_findings` + `anomaly_feedback_labels` insert-only + `anomaly_domain_settings` dengan `is_active` baku `false`, §21.3 baris 34–36, CI 8 butir) · `RBAC §4.5.5` (6 nama usulan tanpa nomor) · `API_SPEC §7.34` (6 rute + 6 uji penolakan) · `UI_UX §19.6` · `MIGRATION_SOP §6.2b` (maksimum nomor `0081`) · `ROADMAP §2.24` (`AI-1…3`, `TOG-1`) · `INDEX`. Ralat alat: `ai-params-audit` versi pertama salah atribusi engine (jendela teks) dan salah cek rute (substring), sehingga menuduh dua hal yang sebenarnya sudah ada — keduanya diperbaiki sebelum angkanya dikutip. |',
], 'riwayat-1.10');

// PROGRESS §5.44
{
  const f = 'docs/PROGRESS_REPORT.md';
  const lines = readFileSync(f, 'utf8').split(NL);
  if (lines.some((l) => l.startsWith('### 5.44 '))) { console.log('§5.44 sudah ada'); }
  else {
    const a = lines.findIndex((l) => l.startsWith('## 11. Riwayat laporan (bagian 3)'));
    const sec = [
      '### 5.44 Siklus 2026-10-21 (bagian 5) — ALG-25, vonis WASM, dan `TOGGLE_ACTIVE`; dua tuduhan yang ternyata cacat alat saya',
      '',
      '**Yang diukur lebih dulu.** Brief kini menyebut mesin dengan **nama algoritma**: Isolation Forest/LOF, Decision Tree/Logistic Regression, EWS BKD/CPL. `node .tools/ai-params-audit.mjs` menjawab: `ALG-1…ALG-24` terdaftar; retensi/DO **sudah** punya rumah (`ALG-10 · Early Warning System / Dropout Risk Scorer`, §12.5, dengan gerbang AUC ≥ 0,70 / Brier ≤ 0,18 dan `psi` drift), capaian CPL **sudah** `ALG-13`; tetapi **anomaly multivariat tidak punya kode, tidak punya tabel hasil, dan tidak pernah disebut di 20 berkas**. Dua hal lain juga nol: `WASM` di DATA_MODEL/PRD (0→kini dinyatakan) dan **`TOGGLE_ACTIVE` 0 kemunculan di seluruh berkas**.',
      '',
      '**Yang ditulis (cascade `AGENTS §3.11`, urutan tidak dibalik).** `PRD §5.18` → `ARCHITECTURE §12.21` (ALG-25: IF + LOF atas snapshot yang sama, `agreement` BOTH/IF_ONLY/LOF_ONLY, harness lengkap, `budget` 180 s / 250.000 sampel / `contamination_bp` 10–200, enam mode turun, `explain` terbaca manusia, fair-share per tenant, larangan model lintas-tenant) dan `§12.22` (vonis WASM: **preview di perangkat, vonis di worker**, server mengirim fitur+bukan model mentah, perangkat tidak pernah mengirim skor) → `DATA_MODEL §25` + `0081_anomaly_detection.sql` (3 enum, `anomaly_findings`, `anomaly_feedback_labels` insert-only, `anomaly_domain_settings` dengan `is_active` baku `false` dan `approved_by <> requested_by` sebagai CHECK) + §21.3 baris 34–36 → `RBAC §4.5.5` (6 nama usulan **tanpa nomor**) → `API_SPEC §7.34` (6 rute + 6 uji penolakan, nol nomor error baru) → `UI_UX §19.6` (toggle berdampak, aturan empat badge kartu analitik) → `MIGRATION_SOP §6.2b` + `INDEX` + `ROADMAP §2.24` (`AI-1…3`, `TOG-1`).',
      '',
      '**`TOGGLE_ACTIVE` diputus tanpa menambah verba.** Aksi kelima pemilik brief itu adalah **`UPDATE` pada `is_active`**, dengan tiga syarat menempel: selalu menulis riwayat, empat-mata + MFA untuk kelas `REGULATORY`/`SECURITY` (ditegakkan CHECK DB), dan tidak boleh dirender sebagai switch tanpa teks dampak. Bukti jalurnya memang sudah ada: `PUT /api/v1/admin/master/custom-attributes/{id}/activate` dan `/retire` — jadi vonis ini menutup kosakata, bukan memaksa rute baru.',
      '',
      '**Dua tuduhan yang saya tarik kembali (ini bagian terpenting siklus ini).** Alat versi pertama menuduh kamus dan menu "tidak punya CRUD" karena saya mencari `/master/kinds` dan `/admin/menus`, padahal jalur kanoniknya `/admin/master/lookups` (POST/PUT/DELETE ada) dan `/admin/platform/menus` (POST/PATCH/DELETE/PUT ada). Ia juga salah mengaitkan `retention` ke `ALG-6` karena pencocokan jendela teks, padahal §12.5 (`ALG-10`) yang memilikinya. `ai-params-audit.mjs` saya tulis ulang **sebelum** angkanya dikutip di mana pun. Ini `RD-62`/`RD-76`/`RD-81`/`RD-86` keempat kalinya untuk kelas yang sama: yang paling sering salah adalah alat yang baru saya buat, dan koreksi yang benar adalah memperbaiki alat, bukan menjustifikasi tuduhan.',
      '',
      '**Status penjaga.** `heading-dup` 0/0/0 · `ref-audit` hijau (seluruh rujukan `§12.21`, `§25`, `§19.6`, `§6.2b`, `§2.24` yang baru dibuat punya sasaran) · `fk-audit` HIJAU · `ddl-owner` tidak ada nama tabel kembar · `rbac-count` tetap **301 tanpa lubang** (§4.5.5 sengaja tidak ber-nomor) · `rbac-module-union` HIJAU · `env-drift` HIJAU yatim · `perm-phantom` tetap MERAH oleh desain dengan angka yang naik lagi (enam nama usulan baru) · `cjk-check` 1 SUSPECT (kutipan yang sudah berpemindai).',
      '',
      '**Vonis.** Pilar 3 (analitik lokal) dan pilar 7 (`TOGGLE_ACTIVE` sebagai CRUD penuh) kini punya rumah dokumen dan cara ukur. Yang belum — dan tidak boleh ditulis sebagai sudah: ALG-25 adalah **design-only** sampai pustaka IF/LOF lokal masuk manifest + golden vector diuji, `0081` belum berberkas (`G-02`), dan enam nama izin `§4.5.5` belum ber-nomor (`CRD-5`).',
      '',
    ];
    lines.splice(a, 0, ...sec);
    const i543 = lines.findIndex((l) => l.startsWith('| 5.43 | 2026-10-21 |'));
    if (i543 >= 0) lines.splice(i543 + 1, 0, '| 5.44 | 2026-10-21 | **Siklus kelima — ALG-25 anomaly multivariat, vonis WASM, norma `TOGGLE_ACTIVE`.** `ai-params-audit` (diperbaiki) mengukur: ALG-10/ALG-13 sudah ada, anomaly **TANPA KODE**, `TOGGLE_ACTIVE` 0. Cascade: `PRD §5.18`, `ARCHITECTURE §12.21`–`§12.22`, `DATA_MODEL §25` + `0081` (3 enum, `anomaly_findings`, `anomaly_feedback_labels` insert-only, `anomaly_domain_settings` `is_active` baku false), §21.3 baris 34–36, `RBAC §4.5.5` (6 nama tanpa nomor), `API_SPEC §7.34` (6 rute), `UI_UX §19.6`, `MIGRATION_SOP §6.2b`, `ROADMAP §2.24` (`AI-1…3`, `TOG-1`). Vonis `TOGGLE_ACTIVE` = `UPDATE is_active` + riwayat + empat-mata, tanpa verba ketujuh (bukti rute `/activate` `/retire` sudah ada). **Dua tuduhan ditarik kembali** karena cacat alat (kamus memakai `/admin/master/lookups`, menu `/admin/platform/menus`; `retention` milik `ALG-10`): alat ditulis ulang sebelum angkanya dikutip — `RD-62`/`RD-76` keempat kalinya. Penjaga: `heading-dup` 0/0/0, `ref-audit` hijau, `fk-audit` HIJAU, `rbac-count` 301 tanpa lubang, `perm-phantom` tetap MERAH by design. |');
    writeFileSync(f, lines.join(NL), 'utf8');
    console.log('PROGRESS §5.44 + riwayat 5.44 ditulis');
  }
}
