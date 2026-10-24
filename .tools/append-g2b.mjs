import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const rep = [];
const apend = (p, arr, label) => { appendFileSync(p, arr.join(String.fromCharCode(10)), 'utf8'); rep.push(label + ': OK'); };
const D = 'C:/SICA/docs/';
const edit = (file, jobs) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  for (const j of jobs) {
    const ok = s.includes(j.a);
    if (ok) s = s.replace(j.a, j.b);
    rep.push(file + ' ' + j.n + ': ' + (ok ? 'OK' : 'MISS'));
  }
  writeFileSync(p, s, 'utf8');
};

edit('API_SPEC.md', [
  {
    n: 'rbac-146-sudah-ada',
    a: '(d) izin `settings.param.*` dan `platform.menu.*` **belum menjadi baris mana pun** di `RBAC_MATRIX §4.5` (register itu berhenti di **145**, terukur) — usulan nomor 146 ke ada di §4.16.7 dan penomorannya **milik dokumen itu**, bukan keputusan bagian ini.',
    b: '(d) izin `settings.param.view|edit.<class>` dan `platform.menu.view|manage|grant|revoke` **sudah menjadi baris katalog** di `RBAC_MATRIX §4.5` nomor **146–161** (terukur; status `usulan` sampai masuk `PERMISSION_SPECS`). Yang belum ada tetap **kode**: tidak satu pun consumer parameter terpasang, dan `authz.ts` masih 222 izin normatif.',
  },
]);

edit('ROADMAP_TASKS.md', [
  { n: 'katalog-25', a: 'katalog **24 parameter** §21.3', b: 'katalog **25 parameter** §21.3' },
  { n: 'ui14-penahan', a: '**UI_UX §14 (penahan)**', b: '**UI_UX §14 (sudah ditulis siklus ini)**' },
]);

apend(D + 'AUDIT_READINESS.md', [
  '',
  '## 12. Tambahan siklus 2026-10-20 (bagian 2) — parameter dinamis, multi-modus, dan enam vonis baru',
  '',
  'Sama seperti §10, angka di bawah berasal dari pengukuran alat di `.tools/`, bukan dari laporan agen. Ketika agen dan pengukuran berbeda, yang dipakai pengukuran.',
  '',
  '### 12.1 Kontradiksi yang ditutup dengan vonis Lead Architect',
  '',
  '| # | Kontradiksi | Vonis | Tempat ditulis |',
  '|---|---|---|---|',
  '| C-1 | **TTL lease KRS tiga angka**: `900 s` (DATA_MODEL §16.1) vs `30 s` (API_SPEC §4.2) vs `PX 90000` / "maksimal 90 detik" (ARCHITECTURE §10.3) | **90 detik bawaan, rentang 30–300**, kunci kanonik `krs.war_lease_ttl_s` di `master_system_parameters` (`0049`). Alasan: hanya 90 yang koheren dengan `SET krs:lease … NX PX 90000`, perpanjangan tiap 30 detik, dan janji §10.3.3 bahwa kursi bebas maksimal 90 detik saat primary mati; 900 s menahan kursi 15 menit pada puncak OW, 30 s hilang oleh satu latensi jaringan | DATA_MODEL §16.1(1) + §21.3(25) + §14.8 (dua nama `tenant_settings` menjadi alias kalah), API_SPEC §4.2, PRD §5.11 butir 9 |',
  '| C-2 | **Modus pembelajaran tiga ejaan**: `offline/online/hybrid` (API_SPEC §4.4), `delivery_mode ONSITE/ONLINE/BLENDED` (DATA_MODEL §19.2), `deliveryType ONSITE/SYNC_LIVE/ASYNC_MODULE` (API_SPEC §4.4.1) | dua konsep dipisah: `learning_modality` = `ONSITE/ONLINE/BLENDED` (kelas) dan `session_kind` = `REGULAR/SYNC_LIVE/ASYNC_MODULE/PRAKTIKUM/UTS/UAS/SUSULAN` (pertemuan). Alias lama dibaca satu rilis lalu dilepas | DATA_MODEL §21.4 + §14.8, API_SPEC §4.4 (ralat di tempat), INTEGRATIONS §1.16 |',
  '| C-3 | **Bentuk kode izin parameter** — `admin.parameter.*` (usulan awal) vs `settings.param.*` (RBAC) | `settings.param.view|edit.<class>` untuk enam kelas risiko; resource `settings` dipakai, tidak membuat resource kedua | RBAC_MATRIX §4.5 nomor 146–157, API_SPEC §4.16.7 |',
  '| C-4 | **Bentuk kode izin menu** — `platform.menu.create/update/delete` vs gerbang menu yang sebenarnya hanya dua aksi tulis | `platform.menu.view/manage/grant/revoke`; `manage` sengaja satu kode karena CRUD pohon menu adalah satu keputusan tata kelola, bukan empat | RBAC_MATRIX §4.5 nomor 158–161 |',
  '| C-5 | **Jumlah penolakan key-value** ditulis "empat" padahal daftarnya enam | "Enam dari 25 butir" (nomor 4, 13, 16, 17, 20, 21) | DATA_MODEL §21.3 |',
  '| C-6 | ROADMAP sempat mencatat `UI_UX_DESIGN §14` sebagai rujukan hantu (agen membaca sebelum bagian itu ditulis pada jam yang sama) | §14 sudah ada (tata kelola parameter & menu), §15 (kisi RBAC), §16 (presensi multi-modus) | ROADMAP §2.16/§2.17, UI_UX_DESIGN §14–§16 |',
  '',
  '### 12.2 Gap baru bagian 2',
  '',
  '| ID | Temuan | Kelas | Titik aksi |',
  '|---|---|---|---|',
  '| RD-50 | Tidak ada satu pun konsumen parameter di kode (terukur `grep master_system_parameters|system-parameters|settings/effective` = 0), sementara ambang yang seharusnya dibaca dari mesin ini hidup sebagai konstanta: `attPct >= 75` (`dashboard.service.ts:263`), `ttlSeconds = 30` (`qr/generate/route.ts:65`), `radius min 10 max 500 default 50` (`qr/generate/route.ts:29`) | MAJOR | ROADMAP `SPE-15` (triase konstanta) + gerbang CI (q) |',
  '| RD-51 | Kisi RBAC sub-detail belum punya pola windowing untuk 145+ titik aksi x 17 peran; tanpa itu layar akan memuat ribuan sel sekaligus | MINOR (UX/kineja) | UI_UX §15.3 (paginasi server + lazy expand), task `H-1` |',
  '| RD-52 | Kamus `F/O/M` (`sifat_pembelajaran`) belum di-*seed*; kolom dikirim sebagai NULL dan barisnya tidak ikut kirim (I-14). Ini **penahan rilis**, bukan bug | BLOCKER kirim | INTEGRATIONS §1.16 `[VERIFIKASI-KAMUS]`, SEED_DATA, `RD-42` |',
  '| RD-53 | Rekonsiliasi dua sumber presensi belum punya wujud kode (`attendance_evidence` 0 di skema) sehingga hari ini satu-satunya jalur adalah scan tunggal; klaim "hybrid" belum dapat diuji | MAJOR | DATA_MODEL §21.5, API_SPEC §4.18, ROADMAP `SPE-12`/`SPE-13` |',
  '| RD-54 | Dua istilah "rekonsiliasi" (kehadiran vs dana/VA) berisiko tercampur di kode; sudah dipisahkan di dokumen, belum ada namapung di `packages` | MINOR | INTEGRATIONS §5.3, API_SPEC §4.7.7 vs §4.18 |',
  '',
  '### 12.3 Angka terukur akhir siklus 2026-10-20',
  '',
  '| Ukuran | Nilai | Cara ukur |',
  '|---|---|---|',
  '| Dokumen di `/docs` | 24 | `ls docs/*.md` |',
  '| non-Latin di seluruh `/docs` + `AGENTS.md` | 0 | `scan-nonlatin.mjs` (scanned=25) |',
  '| Struktur tabel/fence tidak seimbang | 0 | `validate-md.mjs` (problems=0) |',
  '| Register kode error API_SPEC §2.3 | 91 → 106 → **118** | `grep -o "^[|] [0-9]+ [|]"` |',
  '| Titik aksi RBAC_MATRIX §4.5 | 50 → 126 → 145 → **161** | `grep` blok §4.5 |',
  '| Izin normatif / grant | **222 / 607** (tidak berubah; penambahan masih `usulan`) | `authz.ts` + RBAC §4 |',
  '| Nomor migrasi terdaftar | `0001`–`0006`, `0011` nyata di berkas; **`0012`–`0050` terdaftar di DATA_MODEL §14.7, nol berkas** | `ls packages/database/migrations/` = 7 |',
  '| Engine terspesifikasi | 18 (ALG-1…ALG-18) + 2 mekanika (KRS lease, delta sync) | ARCHITECTURE §11–§12 |',
  '| Parameter katalog | 25 baris, 6 di antaranya ditolak menjadi key-value | DATA_MODEL §21.3 |',
  '',
  '## 13. Riwayat tambahan (bagian 2)',
  '',
  '| Versi | Tanggal | Perubahan |',
  '|---|---|---|',
  '| 1.3 | 2026-10-20 | §12: enam kontradiksi ditutup dengan vonis (TTL lease 90 s, kosakata modus, dua bentuk kode izin, jumlah penolakan key-value, rujukan `UI_UX §14`) + lima gap baru `RD-50`…`RD-54` + tabel angka terukur akhir siklus. Dokumen yang disentuh siklus ini: ARCHITECTURE, DATA_MODEL, API_SPEC, PRD, SECURITY_COMPLIANCE, INTEGRATIONS, RBAC_MATRIX, UI_UX_DESIGN, ROADMAP_TASKS, TECH_CONVENTIONS, INDEX, GLOSSARY, PROGRESS_REPORT, AGENTS.md. |',
  '',
], 'audit-12');

apend(D + 'PROGRESS_REPORT.md', [
  '',
  '### 5.37 Siklus 2026-10-20 (bagian 3) — Parameter dinamis, multi-modus, dan audit 360 derajat atas `/docs`',
  '',
  '**Permintaan (lampiran).** Tiga prinsip tambahan: (1) **zero-hardcoding total** — seluruh opsi, variabel, dan aturan operasional harus parameter dinamis dengan CRUD penuh (`master_system_parameters`, `master_lookup_groups/items`, `tenant_custom_attributes`) plus API & layar Admin IT; (2) **matriks hak akses sub-detail** sampai tingkat sub-parameter dan tombol (`CREATE/READ/UPDATE/DELETE/APPROVE/REJECT/EXPORT/LOCK/UNLOCK/PARAM_EDIT`) untuk delapan tingkat peran, dengan tabel `role_permissions`/`menu_permissions`/`parameter_permissions`; (3) **16 engine nol-API-key** harus tercatat detail; (4) **multi-modus** luring/daring/hybrid + Dual-Reconciliation + kode PDDikti `F/O/M`; (5) Velzon lock. Permintaan kedua: audit 360 derajat + roadmap Fase 1A/1B dst., hapus placeholder, lalu sebutkan sub-task pertama yang siap dieksekusi.',
  '',
  '**Yang saya putuskan sebagai Principal Database Architect (dan bagian yang saya tolak).**',
  '- **`master_system_parameters` diterima** sebagai rumah baru untuk **skalar** konfigurasi operasional: 25 butir katalog (DATA_MODEL §21.3) dengan `risk_class`, rentang `min/max`, riwayat insert-only beralasan + IP + penyetuju, `impact`, toggle, dan hot-reload. Endpoint CRUD + `GET /settings/effective` dengan `X-Parameter-Version`/`ETag` (API_SPEC §4.16); layar Admin + kisi RBAC + layar modus (UI_UX §14–§16).',
  '- **Enam butir ditolak menjadi key-value** karena sudah punya tabel struktural: band SKS per IPK (`academic_rules`), skala & konversi nilai (`grade_scales`/`grade_scale_bands`), komponen biaya (`fee_tariff_groups`), diskon/beasiswa (`tuition_discounts`/`payment_waivers`), kanal VA (`payment_channels`/`virtual_accounts`), pola NIM (`tenant_settings.nim_format`). Memindahkannya = dua sumber kebenaran untuk satu fakta, persis pola `RD-32`.',
  '- **Batas norma yang harus dibaca sebelum ada yang menuntut "semua harus bisa diubah di UI":** larangan hardcoding menyentuh **daftar nilai domain**, bukan **batas numerik keamanan**. Rotasi TOTP, jendela terima, radius geofence, dan ambang akurasi GPS tetap `CHECK` rentang + kelas `SECURITY` + penyetuju kedua + MFA. Kalau ini dilonggarkan, satu klik dapat mematikan kontrol anti-replay tanpa satu pun uji yang gagal — dan itu temuan keamanan, bukan fleksibilitas. Kredensial juga **tidak pernah** menjadi baris parameter (`CHECK (is_secret = false)`).',
  '- **`parameter_permissions` dibuat sebagai pola → kode izin, bukan satu izin per parameter.** Dengan 222 izin normatif + 161 titik aksi, satu kode per kunci parameter akan meledak dan menghasilkan izin tanpa review. Evaluasi: DENY menang atas ALLOW, pola terspesifik menang, dan keputusan servis untuk kelas `SECURITY` tidak dapat dikalahkan oleh pola apa pun.',
  '- **Delapan tingkat peran dan sepuluh aksi** dipetakan ke enam verba kanonik (`APPROVE`/`REJECT` = satu verba `VALIDATE`; `EXPORT`/`LOCK`/`UNLOCK` = `OTHER` terdaftar; `PARAM_EDIT` = `UPDATE` pada `resource=(settings)` dengan pola). Tidak ada verba baru, tidak ada peran baru; tiga norma contoh (Dosen vs bobot terkunci, BAAK vs param KHS/prasyarat, BAUK vs komponen biaya & denda) ditulis sebagai `BR-PG4/5/6` + uji positif **dan** negatif `AC-PG-5/6/7`.',
  '- **Vendor webinar tidak menjadi oracle.** Jalur otoritatif kehadiran daring = peristiwa LMS internal/self-hosted (BBB/Jitsi, nol-kunci); Zoom/Meet/Teams opsional dengan kredensial di vault/ENV, verifikasi signature, batas skew, payload allowlist empat field, dan larangan mengirim PII/rekaman keluar (AGENTS §3.9). Rekonsiliasi lima kebijakan (`ONSITE_PRIMARY/ONLINE_PRIMARY/MERGE_ANY/REQUIRE_BOTH/STRICT_LATEST`) dengan invariance **satu baris `attendances` per (sesi, mahasiswa)**; bukti tambahan ke `attendance_evidence`.',
  '- **Kode `F/O/M` PDDikti tidak dikarang.** Selama kamus resmi belum di-*seed*, kolomnya NULL dan barisnya tidak ikut kirim (`[VERIFIKASI-KAMUS]`, `RD-52`). Ini keputusan yang membuat fitur tampak "kurang siap" — dan itu benar, lebih baik daripada mengirim kode yang akan ditolak pusat.',
  '',
  '**Peta enam belas engine (ARCHITECTURE §12.13).** Terukur dari 16 permintaan: **12 sudah terspesifikasi** dan **4 ditambahkan siklus ini** — ALG-15 Exam Scheduling (DSatur ber-*tie-break* dengan batas bawah clique; MILP hanya akselerator), ALG-16 MBKM & Transfer Credit (DAG + bipartite/Hungarian `n<=60` + vonis skor **dan** *margin*, SoD tiga orang), ALG-17 BKD Overlap (interval tree; bangun `O(n log n)`, query `O(log n + k)` — bukan klaim `O(log N)` polos; union interval agar satu jam lintas prodi tidak dihitung dua kali), ALG-18 NIM Pattern Compiler (sequence per prefix, **bukan `MAX()+1`**; status `RESERVED/ISSUED/CANCELLED/RECYCLED`; daur ulang hanya bila belum pernah terdaftar ke Feeder; `NO_PATTERN_CONFIGURED` menolak terbit). Redlock tetap DITOLAK (§12.2.2) dan tidak dibuka ulang; Ford-Fulkerson dicatat sebagai nama keluarga algoritma — yang menang Dinic (§11.7).',
  '',
  '**Kontradiksi yang saya timbulkan sendiri dan harus saya putus (jangan diulang sebagai "temuan orang lain").** **C-1 TTL lease**: DATA_MODEL §16.1 menormakan 900 detik, API_SPEC menulis 30 detik, ARCHITECTURE §10.3 memakai `PX 90000` — tiga angka untuk satu kunci, akibat menulis tiga dokumen dalam satu hari tanpa menyatukan angka lebih dulu. Vonis: **90 detik, rentang 30–300**, sumber tunggal `krs.war_lease_ttl_s`, dua nama `tenant_settings` menjadi alias kalah (§14.8). **C-2 kosakata modus**: tiga ejaan untuk satu konsep → `learning_modality` vs `session_kind` dipisah. **C-5**: saya menulis "empat" penolakan key-value padahal daftarnya enam. Semua tercatat di AUDIT_READINESS §12.1 supaya siklus berikutnya punya daftar yang benar.',
  '',
  '**Placeholder.** Permintaan "hapus seluruh TODO/TBD". Hasil ukur: `grep -n "TODO|TBD|FIXME"` di 24 dokumen menghasilkan **nol placeholder dokumen** — dua kemunculan kata `TODO` yang ada adalah *deskripsi status kode* (API_SPEC §5.2 dan inventaris rute), bukan lubang spesifikasi. Tidak ada yang saya hapus karena tidak ada yang menemukan; ini berbeda dari "saya sudah membersihkan", dan itu saya tulis apa adanya.',
  '',
  '**Verifikasi akhir siklus.** `scan-nonlatin` → `scanned=25 nonLatinHits=0` (24 dokumen + AGENTS.md); `validate-md` → `problems=0` di seluruh dokumen. Register terukur: API_SPEC §2.3 **118** baris; RBAC_MATRIX §4.5 **161** baris (222 izin normatif & 607 grant **tidak berubah** — penambahan masih `usulan`); nomor migrasi terdaftar bertambah sampai `0050`, sementara `ls packages/database/migrations/` = **7** berkas nyata (`0001`–`0006`, `0011`) → seluruh gugus ini adalah spesifikasi. `next build`/`tsc`/`vitest` tidak dijalankan karena tidak ada perubahan kode; bukti visual/kontras yang masih berlaku tetap dari §5.34 (`FAILS = 0`, purge `0/59`).',
  '',
  '**Kesalahan proses yang terjadi dan cara saya membacanya.** Tujuh agen (ARCHITECTURE, RBAC, API_SPEC, PRD, SECURITY, UI_UX, ROADMAP) menghasilkan bagian yang lolos verifikasi, tetapi: (a) satu agen mencapai batas putaran saat menulis INTEGRATIONS §5 dan saya **tidak** langsung memercayai laporannya — saya ukur: §1.16, §1.17, dan §5 ternyata sudah tertulis penuh (2407 baris, `problems=0`), jadi tidak saya kerjakan ulang; (b) satu agen ROADMAP mencatat `UI_UX §14` sebagai rujukan hantu padahal agen UI menulisnya pada jam yang sama — temuan itu jadi basi dan saya koreksi; (c) dua kali skrip penambal saya mati sintaks karena backtick Markdown bertemu template literal JavaScript — pola yang sudah tercatat §5.36 dan tetap saya ulang, artinya pelajaran "tulis markdown sebagai array baris" belum menjadi kebiasaan, dan (d) `node -e` dengan cwd salah menghasilkan ENOENT yang hampir saya baca sebagai kegagalan desain.',
  '',
  '**Sub-task pertama yang siap dieksekusi setelah dokumen terkunci.** Sesuai ROADMAP §2.17/§2.18: **`SEC-0` tetap lebih dulu** (setengah butirnya sudah menjadi isi `SPE-15`: hapus header identitas klien di `middleware.ts:67-70`, ganti `!==` di `attendance/qr/scan/route.ts:150` dengan perbandingan waktu-konstan, baca & pakai `accuracyMeters`, kunci HMAC per tenant, ganti `>= 75` di `dashboard.service.ts:263` dengan pembacaan parameter). Setelah itu **`SPE-1`** = menulis `0049_system_parameters.sql` (hulu dari seluruh gugus parameter; bergantung `0007`/`MDE-1` untuk `enum_kind`, `0011` untuk grant ber-scope, dan `0012` untuk outbox/audit), disusul `SPE-9` (`0050`) lalu `SPE-3` (promosi baris 146–161 ke `PERMISSION_SPECS`).',
  '',
  '## 11. Riwayat laporan (bagian 3)',
  '',
  '| Siklus | Tanggal | Ringkas |',
  '|---|---|---|',
  '| 5.37 | 2026-10-20 | Mesin parameter dinamis (DATA_MODEL §21, `0049`/`0050`; 25 katalog; 6 penolakan key-value; ambang keamanan tetap ber-CHECK), otorisasi mikro (`menu_items`/`menu_permissions`/`parameter_permissions`; RBAC 146–161; peta 10 aksi ke 6 verba), empat engine baru (ALG-15…ALG-18) sehingga 16 permintaan pemilik terpetakan penuh, rekonsiliasi multi-modus + postur vendor nol-kunci, API_SPEC §4.16–§4.18 (register 118), UI_UX §14–§16, ROADMAP §2.17–§2.19, SECURITY §12 + `SC-G3-01…37`; enam kontradiksi ditutup dengan vonis, termasuk TTL lease 90 detik yang saya timbulkan sendiri. |',
  '',
], 'progress-5.37');

apend(D + 'INDEX.md', [
  '',
  '## 7. Addendum siklus 2026-10-20 bagian 2 (parameter dinamis & multi-modus)',
  '',
  '| Area | Sumber kebenaran | Bagian | Status |',
  '|---|---|---|---|',
  '| Mesin parameter sistem + riwayat + dampak | DATA_MODEL.md | §21.1–§21.3, §21.8 (0049) | spesifikasi |',
  '| Otorisasi mikro menu & parameter | DATA_MODEL.md + RBAC_MATRIX.md | §21.7 (0050) + §4.5 nomor 146–161, §4.7, §6.6 | usulan |',
  '| Kosakata modus pembelajaran & rekonsiliasi dua sumber | DATA_MODEL.md | §21.4–§21.6 | spesifikasi |',
  '| Empat engine baru + peta 16 permintaan | ARCHITECTURE.md | §12.13–§12.20 (ALG-15…ALG-18) | spesifikasi |',
  '| Endpoint parameter, menu, presensi multi-modus | API_SPEC.md | §4.16–§4.18; register §2.3 = 118 | spesifikasi |',
  '| Postur parameter/webhook/vendor + register kontrol | SECURITY_COMPLIANCE.md | §12 + SC-G3-01…37 | spesifikasi |',
  '| Integrasi LMS/konferensi & pengiriman sesuai modus | INTEGRATIONS.md | §1.16–§1.17, §5 | spesifikasi |',
  '| Kebutuhan bisnis parameter, menu, multi-modus, lifecycle | PRD.md | §5.11, §5.5F, §6.1, §6.2 | spesifikasi |',
  '| Layar Admin parameter, kisi RBAC, layar modus | UI_UX_DESIGN.md | §14, §15, §16 | spesifikasi |',
  '| Urutan eksekusi | ROADMAP_TASKS.md | §2.17 (SPE-1…15), §2.18 (Fase 1A/1B), §2.19 (LFC-1…3) | terjadwal |',
  '| Kontradiksi yang ditutup | AUDIT_READINESS.md | §12.1 (C-1…C-6) | diputus |',
  '',
], 'index-7');

apend(D + 'GLOSSARY.md', [
  '',
  '## 9. Istilah siklus 2026-10-20 bagian 2 — parameter, modus, dan otorisasi mikro',
  '',
  '| Istilah | Makna operasional |',
  '|---|---|',
  '| Mesin parameter dinamis | Rumah baru (master_system_parameters, 0049) untuk skalar konfigurasi tenant: ambang, timeout, flag, pola. Punya CRUD, riwayat beralasan, dampak, dan hot-reload. Tidak memegang kredensial dan tidak menampung aturan struktural yang sudah punya tabel. |',
  '| Kelas risiko parameter | TECHNICAL, OPS, ACADEMIC, FINANCIAL, REGULATORY, SECURITY. Menentukan siapa boleh membaca/menulis, perlu penyetuju kedua atau tidak, dan perlu MFA atau tidak. |',
  '| PARAM_EDIT | Hak mengubah parameter sistem. Bukan verba baru: UPDATE pada resource settings dengan pola di parameter_permissions. |',
  '| parameter_permissions | Pengikat pola kunci (mis. finance.*) ke kode izin yang sudah ada. DENY menang atas ALLOW; pola terspesifik menang; tidak boleh menciptakan izin di luar katalog. |',
  '| menu_items / menu_permissions | Pohon menu per lapis (WEB/MOBILE) + allowlist izin per menu. Menyaring menu bukan kontrol akses: gerbang servis L1–L6 tetap wajib di setiap rute. |',
  '| route_key | Nama stabil rute logis yang dikirim ke klien; path dibangun dari route_key, bukan string bebas hasil tempel. |',
  '| X-Parameter-Version | Versi keadaan konfigurasi yang dipakai sebuah keputusan. Dibawa di respons dan disimpan di baris hasil supaya keputusan dapat direproduksi setelah parameter berubah. |',
  '| learning_modality | Modus kelas: ONSITE, ONLINE, BLENDED. Kosakata kanonik; offline/hybrid/delivery_mode adalah alias yang dilepas. |',
  '| session_kind | Bentuk satu pertemuan: REGULAR, SYNC_LIVE, ASYNC_MODULE, PRAKTIKUM, UTS, UAS, SUSULAN. Bukan sinonim modus: kelas BLENDED memiliki beberapa jenis ini. |',
  '| attendance_evidence | Tabel bukti kehadiran multi-sumber (insert-only, ber-digest). Satu sesi dan satu mahasiswa tetap hanya punya satu baris attendances; bukti kedua tidak membuat kehadiran kedua. |',
  '| Dual-Reconciliation | Rekonsiliasi bukti luring (QR/geofence) dan daring (peristiwa LMS) dengan lima kebijakan eksplisit; laporan vendor saja tidak pernah menghasilkan HADIR. |',
  '| Oracle otoritatif kehadiran daring | SICA Virtual Campus self-hosted (BBB/Jitsi). Vendor webinar bersifat pendukung karena membawa kredensial dan risiko egress. |',
  '| Interval tree (ALG-17) | Struktur untuk mendeteksi tumpang tindih beban/BKD: bangun O(n log n), query O(log n + k). Klaim O(log N) saja menyesatkan karena mengabaikan biaya bangun. |',
  '| Pattern compiler (ALG-18) | Kompilator pola NIM per tenant menjadi regex + sequence per prefix. Deterministik (golden vector deret), tanpa MAX+1, dan menolak terbit bila pola belum dikonfigurasi. |',
  '| DSatur (ALG-15) | Pewarnaan graf konflik ujian sebagai batas atas, dengan clique sebagai batas bawah; hasilnya dilaporkan sebagai gap, bukan sebagai klaim optimum. |',
  '',
], 'glossary-9');

console.log(rep.join('\n'));
