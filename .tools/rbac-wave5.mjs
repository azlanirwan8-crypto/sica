import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const rep = [];
const sub = (file, label, a, b) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  const i = s.indexOf(a);
  if (i === -1) { rep.push(file + ' ' + label + ': MISS'); return; }
  if (s.lastIndexOf(a) !== i) { rep.push(file + ' ' + label + ': AMBIG'); return; }
  writeFileSync(p, s.slice(0, i) + b + s.slice(i + a.length), 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

/* A — DATA_MODEL: CHECK yang baru dibanned harus berhenti ditulis (dua kemunculan identik) */
const subAll = (file, label, a, b) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  const n = s.split(a).length - 1;
  if (!n) { rep.push(file + ' ' + label + ': MISS'); return; }
  s = s.split(a).join(b);
  writeFileSync(p, s, 'utf8');
  rep.push(file + ' ' + label + ': OK x' + n);
};
subAll('DATA_MODEL.md', 'delivery-mode-hybrid',
  "  delivery_mode text NOT NULL DEFAULT 'ONSITE' CHECK (delivery_mode IN ('ONSITE','ONLINE','HYBRID')),",
  "  delivery_mode text NOT NULL DEFAULT 'ONSITE' CHECK (delivery_mode IN ('ONSITE','ONLINE','BLENDED')),   -- 'HYBRID' alias kalah (§21.10.2, 0075); kelas A-prime: keadaan tetap, label kampus");
sub('DATA_MODEL.md', 'career-work-mode',
  "  work_mode text NOT NULL CHECK (work_mode IN ('ONSITE','ONLINE','HYBRID')),",
  "  work_mode text NOT NULL CHECK (work_mode IN ('ONSITE','ONLINE','BLENDED')),");

/* B — RBAC §4.5.2 gelombang 5 (kanal vicon), tepat sebelum ### 4.6 */
const sec452 = [
  '#### 4.5.2 Katalog izin gelombang 5 — kanal vicon terkelola ([PRD §5.15](file:///c:/SICA/docs/PRD.md), `API_SPEC §4.19`, `DATA_MODEL §21.10`) — 2026-10-21',
  '',
  '**Nomor dilanjutkan dari 291.** Gelombang 4 (162–291) dibiarkan utuh supaya 21 rujukan ke rentang itu tidak menjadi basi — pelajaran langsung dari `RD-55`/`RD-62`. Agregat registri **tidak ditulis tangan** di bagian ini; hitung dengan `node .tools/rbac-count.mjs`.',
  '',
  '**Status: NON-NORMATIF / `usulan`** — sama seperti 51–161 dan 162–291. Dilarang dipakai di kode sebelum dipromosikan ke `PERMISSION_SPECS` (`AGENTS §3.8`, pola `G-15`/`G-23`). Kolom `Modul` memakai kosakata `PermissionModule` yang 13 nilai itu **dan karena itu bukan gerbang jual** (`RD-61`).',
  '',
  '| # | Permission | Modul | `resource` | `verb` | FR/acuan | Pemegang · scope | Gerbang (MFA · SoD) | Status |',
  '|---|---|---|---|---|---|---|---|---|',
  '| 292 | `settings.conference.view` | `settings` | `admin.kanal-vicon` | `READ` | FR-VIC-01 · M-02 · §5.15.1 | `TENANT_ADMIN` `TENANT`, `STAFF` `ORG` hanya keadaan kanal (bukan `credential_ref`) | MFA tidak · `credential_ref` dan nilai rahasia tidak pernah ikut proyeksi | usulan |',
  '| 293 | `settings.conference.manage` | `settings` | `admin.kanal-vicon` | `INSERT` | FR-VIC-01 · FR-VIC-06 · `0073` | `TENANT_ADMIN` `TENANT` | **MFA ya** · body hanya `provider`, `api_region`, `external_tenant_ref` | usulan |',
  '| 294 | `settings.conference.validate` | `settings` | `admin.kanal-vicon` | `VALIDATE` | FR-VIC-06 · AC-VIC-4 | `TENANT_ADMIN` `TENANT` + penyetuju kedua untuk kelas `SECURITY` | **MFA ya** · SoD: yang meminta probe ≠ yang menyetujui perubahan rantai | usulan |',
  '| 295 | `teaching.meeting.provision` | `teaching` | `teaching.sesi` | `OTHER` | FR-VIC-02 · M-15 · M-16 | `LECTURER` `SELF` sebagai pengampu sesi, `HEAD_OF_PROGRAM` `PROGRAM` | MFA tidak · kanal diambil dari server (`conference.fallback_chain`), bukan dari body | usulan |',
  '| 296 | `attendance.evidence.pull` | `attendance` | `presensi.kanal` | `OTHER` | FR-VIC-04 · `0074` | `LECTURER` `SELF` sesi ampilannya, `STAFF` `ORG` (BAAK) | MFA tidak · hasil selalu `202 { runId }`; vonis tetap dihitung server | usulan |',
  '| 297 | `attendance.reconciliation.view` | `attendance` | `presensi.rekonsiliasi` | `READ` | FR-VIC-05 · §21.5 | `LECTURER` `SELF`, `HEAD_OF_PROGRAM` `PROGRAM`, `STUDENT` `SELF` hanya barisnya sendiri | MFA tidak · `degraded` dan `reviewState` wajib terlihat, tidak disembunyikan | usulan |',
  '',
  '**Tiga larangan yang berlaku di gelombang 5.** (1) Tidak ada izin per **kanal**: `settings.conference.manage.zoom` dilarang, yang ada satu kode + nilai provider sebagai data (`PRD §5.15.2`). (2) Tidak ada izin yang membaca **rahasia**: `credential_ref` adalah pointer, dan `SERVER_ONLY` menolaknya dari proyeksi apa pun (`FIELD_RULES`). (3) Tidak ada izin tulis untuk `conference_channel_events` — ia insert-only dari worker; peran apa pun yang mencoba `UPDATE` akan menolak lebih dulu di policy (`DATA_MODEL §21.10.4`).',
  '',
  '##### Catatan',
  '',
  'Sel sub-detail untuk enam baris ini ada di §6.7.6; gerbang angka registri: `node .tools/rbac-count.mjs`.',
  '',
  '',
].join(NL);

sub('RBAC_MATRIX.md', 'sec-452',
  NL + '### 4.6 ',
  NL + sec452 + '### 4.6 ');

/* C — rujukan agregat jadi tool-derived, bukan angka tangan */
sub('RBAC_MATRIX.md', 'preamble-45',
  'Registri §4.5 + §4.5.1 kini **291 titik aksi** dan gelombang 4 menambahkan **130 baris** (162–291).',
  'Registri §4.5 + §4.5.1 = **291 titik aksi** (gelombang 4 = 130 baris, 162–291), dan **§4.5.2 menambah gelombang 5 = 6 baris (292–297)**. Agregat tidak ditulis tangan di bagian lain: jalankan `node .tools/rbac-count.mjs`.');

/* D — §6.7.6 sel sub-detail kanal vicon */
sub('RBAC_MATRIX.md', 'sec-676',
  NL + '## 7. Aturan Lintas-Role yang Menentukan Desain',
  [
    '### 6.7.6 Sel sub-detail kanal vicon (perluasan §6.7 untuk baris 292–297) — 2026-10-21',
    '',
    'Konvensi kolom sama persis dengan §6.6.2 dan §6.7.1–§6.7.5: lapisan menu `T-*`, sepuluh nama aksi di kolom tombol, dan kolom izin **hanya** menunjuk nomor baris §4.5.2.',
    '',
    '| Lapisan | Menu atau layar | Aksi tombol (10 nama) | Izin (baris §4.5.2) | Siapa secara eksplisit TIDAK boleh |',
    '|---|---|---|---|---|',
    '| T-2 tata kelola | `/admin/kanal-vicon` | READ, EXPORT | 292 | peran akademik tanpa scope tenant; `ADMIN_FINANCE` (kanal bukan objek tagihan) |',
    '| T-3 tata kelola | modal "Daftarkan / aktifkan kanal" | CREATE, UPDATE, PARAM_EDIT | 293 · 294 | pemegang 293 tanpa MFA; penyetuju = pemohon (SoD, pola `BR-K2`) |',
    '| T-4 perkuliahan | `/perkuliahan/sesi/:id` tombol "Buka kanal" | CREATE | 295 | pengampu kelas lain — id sesi wajib diselesaikan ke barisnya di dalam transaksi (`SEC-02`) |',
    '| T-5 presensi | `/presensi/rekonsiliasi/:sesi` | READ, EXPORT | 297 | `STUDENT` hanya barisnya sendiri; `LECTURER` hanya sesi ampilannya; `degraded` tidak boleh disembunyikan |',
    '| T-6 banding | `/presensi/banding/:attendanceId` | CREATE, APPROVE, REJECT | 296 · 297 + `attendance.appeal.*` (§4.3) | pemohon banding ≠ penyetuju; vonis `LOCKED` menolak (`409 ATTENDANCE_REVIEW_STATE_CONFLICT`) |',
    '',
    '**Angka registri tidak ditulis di sini.** Jalankan `node .tools/rbac-count.mjs` untuk jumlah baris per gelombang, distribusi `verb`, dan uji tidak ada lubang nomor.',
    '',
    '',
  ].join(NL) + NL + '## 7. Aturan Lintas-Role yang Menentukan Desain');

console.log(rep.join(NL));
