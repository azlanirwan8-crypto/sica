import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

// ---------- MIGRATION_SOP: daftarkan 0078-0080 + maksimum nomor ----------
{
  const f = 'docs/MIGRATION_SOP.md';
  const lines = readFileSync(f, 'utf8').split(NL);
  const i = lines.findIndex((l) => l.startsWith('### 6.2 Dua migrasi siklus hidup'));
  if (i < 0) { console.error('anchor 6.2 tidak ada'); }
  else {
    const block = [
      '### 6.2a Tiga migrasi geografi sesi & jaminan sosial (`0078`–`0080`) — lahir di [DATA_MODEL §24](file:///c:/SICA/docs/DATA_MODEL.md)',
      '',
      '| Berkas | Isi | Tipe | Catatan penegakan |',
      '|---|---|---|---|',
      '| `0078_session_geography.sql` | enum `geo_source` + `geo_surface` + `session_geo_facts` (insert-only) + view `session_geo_live_buckets` + 2 indeks | **Expand** | `REVOKE UPDATE, DELETE` + `app.reject_mutation()` sebelum policy; view WAJIB `security_invoker = true` (dibuktikan query CI §24.4 butir 6, bukan dipercaya); tidak ada kolom IP mentah di mana pun; peta tidak boleh dibuka sebelum `GEOIP_DB_PATH` sah dan `analytics.map.enabled` boleh bernilai `false` dengan layar degradasi |',
      '| `0079_social_insurance.sql` | enum `remittance_state` + `social_insurance_participations` + `social_insurance_contributions` + 3 indeks | **Expand** | tarif disimpan sebagai **basis poin + masa berlaku**, bukan angka yang ditetapkan dokumen ini dan bukan CHECK daftar string; nomor peserta = PII spesifik (blind index + terenkripsi, `SECURITY §7`); ketergantungan ke `reference_dictionary_entries` (`0028`) dinyatakan sebagai penahan `CRD-6`, bukan disembunyikan |',
      '| `0080_ewmp_sync.sql` | enum `ewmp_sync_state` + `ewmp_sync_batches` + 2 indeks | **Expand** | muatan ditandai `[VERIFIKASI-VENDOR]`: hanya digest, state, empat-mata, dan idempotensi yang dibuat; field EWMP naik sebagai migrasi Expand tersendiri (`0081`) setelah spesifikasi SISTER terverifikasi — bukan `ALTER` diam-diam |',
      '',
      'Ketiganya **tidak** mengubah kolom yang sudah ada, jadi reversibel dengan `DROP TABLE`/`DROP VIEW`/`DROP TYPE` selama belum ada pemakai. Urutan: `0020` (lampiran) → `0054` (gaji) → `0079` → `0078` → `0080`; `0079` mendahului `0078` hanya bila peta dipakai di layar payroll, yang hari ini tidak demikian.',
      '',
    ];
    lines.splice(i, 0, ...block);
    writeFileSync(f, lines.join(NL), 'utf8');
    console.log('MIGRATION_SOP: 0078-0080 didaftarkan');
  }
  let t = readFileSync(f, 'utf8');
  t = t.replace('Per 2026-10-21 maksimum adalah **`0077`**', 'Per 2026-10-21 maksimum adalah **`0080`** (`0078` geografi sesi, `0079` jaminan sosial, `0080` EWMP lahir di [DATA_MODEL §24](file:///c:/SICA/docs/DATA_MODEL.md); `0076`/`0077` lahir di §23.6)');
  t = t.replace('Nomor berikutnya (`0078`) wajib lewat §23.7/§22.9 lebih dulu', 'Nomor berikutnya (`0081`) wajib lewat §23.7/§24.4/§22.9 lebih dulu');
  t = t.replace('sementara `0076`/`0077` baru saja naik ke register.', 'sementara `0076`/`0077` baru saja naik ke register, dan `0078`–`0080` menyusul pada jam yang sama.');
  writeFileSync(f, t, 'utf8');
}

// ---------- ENV_CONTRACT: §8 kunci peta sesi + jaminan sosial, dan catatan penomoran §5 ----------
{
  const f = 'docs/ENV_CONTRACT.md';
  let t = readFileSync(f, 'utf8');
  const sec8 = [
    '## 8. Kunci peta sebaran sesi, GeoIP, dan jaminan sosial (baru 2026-10-21 — `RD-88`) — dirujuk `DATA_MODEL §24`, `PRD §5.17`, `ARCHITECTURE §13.8`, `SECURITY_COMPLIANCE §14.2`',
    '',
    'Sebelum bagian ini ada, `node .tools/dimension-audit.mjs` mencetak **`GeoIP` = 0** dan **`active session store` = 0** kemunculan di seluruh 20 berkas, sementara brief dewan menuntut peta login real-time yang "100% riil, tanpa dummy". Itu lubang kontrak yang sama dengan §7: tanpa tempat sah untuk membaca kunci, kode akan menaruhnya di baris parameter — yang ditolak `DATA_MODEL §21.2` lewat `CHECK (is_secret = false)`.',
    '',
    '| Variabel | Pemakaian | Dev | Staging | Prod | Wajib bila | Catatan |',
    '|---|---|---|---|---|---|---|',
    '| `GEOIP_DB_PATH` | basis GeoIP2 **offline** (City) yang dibaca worker resolusi | path lokal | path mount | path mount/KMS | `analytics.map.enabled = true` | berkas berlisensi, bukan rahasia API; **tidak ada panggilan jaringan ke MaxMind dari rute HTTP** (`AGENTS §3.9` nol-egress juga berlaku untuk data pribadi) |',
    '| `GEOIP_LICENSE_REF` | pointer berkas lisensi/akun MaxMind | ref | ref | vault | sama | yang disimpan adalah **pointer**, bukan kunci; rotasi tercatat di riwayat parameter |',
    '| `REDIS_SESSION_URL` | store sesi aktif (ZSET `session:active:{tenant}`) untuk jendela "online sekarang" | isi | isi | vault | peta sesi aktif dibuka | **masih design-only**: `redis`/`ioredis` belum ada di `package.json` (lihat `RD-11`/`P-6`); tanpa dependensi nyata, layar wajib menampilkan degradasi, bukan angka nol yang tampak benar |',
    '| `SESSION_ACTIVE_WINDOW_S` | bootstrap jendela aktif (fallback bila parameter tenant tidak terbaca) | 300 | 300 | 300 | sama | ambang kanoniknya ada di `master_system_parameters` (`analytics.session.active_window_s`, §21.3); ENV hanya batas bawah proteksi saat DB belum terbaca — nilai ENV **tidak boleh** menang atas parameter |',
    '| `SSE_MAP_MAX_STREAMS_PER_USER` | plafon stream peta per-user (pola §10.6.3) | 2 | 2 | 2 | peta dibuka | mengikuti plafon stream yang sudah divonis `ARCHITECTURE §13.2`; melebihi plafon → `429` dengan `Retry-After`, bukan stream ketiga diam-diam |',
    '| `SOCIAL_INSURANCE_ENDPOINT`, `SOCIAL_INSURANCE_CREDENTIAL_REF` | layanan verifikasi/voucher BPJS (SIPP/EDBU) milik kampus | ref | ref | vault | modul M-06 aktif + iuran elektronik | kredensial lembaga, bukan rahasia pusat; `credential_ref` menunjuk vault (`DATA_MODEL §21.2`) |',
    '| `EWMP_ENDPOINT`, `EWMP_CREDENTIAL_REF` | tukar profil EWMP dosen (SISTER) | ref | ref | vault | M-08 aktif | muatan `[VERIFIKASI-VENDOR]` (`DATA_MODEL §24.3`): endpoint dan kredensial boleh didaftarkan, **skema muatannya belum** |',
    '',
    '**Aturan pakai.** (1) Semua baris di atas **server-only**; tidak ada yang boleh di-prefiks `NEXT_PUBLIC_` — koordinat dan jendela sesi adalah data pribadi, bukan hiasan klien. (2) Koordinat presisi hanya boleh diterima dari izin eksplisit pengguna (W3C Geolocation) dan selalu membawa `accuracy_meters`; hasil GeoIP berbasis-IP adalah **perkiraan**, dan label sumbernya wajib tampil di UI (`DATA_MODEL §24.1` vonis 2). (3) Nilai kosong = gagal-closed: `analytics.map.enabled` paksa `false` dan widget menampilkan **sebabnya**, bukan peta kosong. (4) Cara ukur drift: `node .tools/env-drift.mjs` (baris baru hari ini keluar sebagai `~ design-only`, itu benar — dokumen mendahului kode), dan `node .tools/dimension-audit.mjs` untuk memastikan dimensi tidak lagi tanpa rumah.',
    '',
  ].join(NL);
  if (!t.includes('## 8. Kunci peta sebaran sesi')) {
    // Ditempel di UJUNG berkas: nomor bagian di dokumen ini hanya bertambah di ujung (lihat catatan §5),
    // dan menyisipnya sebelum §6 akan membuat urutan heading mundur.
    t = t.replace(/\s+$/, NL + NL) + sec8 + NL;
  }
  t = t.replace('Terukur: heading yang ada adalah `## 1`, `## 2`, `## 3`, `## 4`, `## 6`, `## 7`.', 'Terukur: heading yang ada adalah `## 1`, `## 2`, `## 3`, `## 4`, `## 6`, `## 7`, `## 8` (`## 8` terbit 2026-10-21 bersama kunci peta sesi & jaminan sosial; `## 5` tetap lubang yang dinyatakan).');
  writeFileSync(f, t, 'utf8');
  console.log('ENV_CONTRACT §8 ditulis');
}
