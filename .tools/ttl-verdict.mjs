import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const rep = [];
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

// ── 1) DATA_MODEL: TTL lease kanonik + koreksi jumlah penolakan ──────────────
edit('DATA_MODEL.md', [
  {
    n: 'ttl-col',
    a: '-- TTL; default 900 s (lihat aturan TTL di bawah)',
    b: '-- TTL; default 90 s (VONIS 2026-10-20; lihat aturan TTL di bawah)',
  },
  {
    n: 'ttl-rule',
    a: "1. **TTL** dibaca dari `tenant_settings.feature_flags->>'krsLeaseSeconds'` (§14.3), default **900 detik**, batas aman **120–1800** dilayani di service.",
    b: '1. **TTL — VONIS 2026-10-20, satu angka untuk tiga dokumen.** Kunci kanonik **`krs.war_lease_ttl_s`** di `master_system_parameters` (§21.2, `0049`), bawaan **90 detik**, rentang aman **30–300**, kelas risiko `TECHNICAL`. Angka 90 adalah satu-satunya yang konsisten dengan model kegagalan tertutup §10.3: `SET krs:lease … NX PX 90000`, perpanjangan tiap 30 detik (tiga perpanjangan per umur lease), dan janji §10.3.3 bahwa kursi kembali bebas **maksimal 90 detik** ketika primary mati. Bawaan lama 900 detik ditolak karena pada puncak Open Wiring ia menahan kursi selama 15 menit tanpa pemilik (underbooking); 30 detik juga ditolak karena satu latensi jaringan akan menghapus pegangan sebelum finalisasi. Sumber lama `tenant_settings.feature_flags->>\'krsLeaseSeconds\'` menjadi **alias yang kalah** (§14.8) dan hanya dibaca sebagai compat satu rilis.',
  },
  {
    n: 'ttl-prd-placeholder',
    a: '__unused__',
    b: '__unused__',
  },
  {
    n: 'jumlah-penolakan',
    a: 'Empat dari 24 butir di atas **ditolak menjadi key-value** (nomor 4, 13, 16, 17, 20, 21)',
    b: 'Enam dari 25 butir di bawah **ditolak menjadi key-value** (nomor 4, 13, 16, 17, 20, 21)',
  },
]);

// ── 2) API_SPEC: tabel TTL lease ─────────────────────────────────────────────
edit('API_SPEC.md', [
  {
    n: 'ttl-api',
    a: '| Lease TTL | 30 detik default tenant, konfigurabel 15–120 detik lewat `tenant_settings.krs_lease_ttl_seconds` (nama milik `DATA_MODEL.md` §14).',
    b: '| Lease TTL | **90 detik** bawaan (VONIS 2026-10-20), rentang aman **30–300** lewat kunci **`krs.war_lease_ttl_s`** (`DATA_MODEL §21.2`, `0049`); `tenant_settings.krs_lease_ttl_seconds` dan `feature_flags->>\'krsLeaseSeconds\'` adalah **alias yang kalah** (`§14.8`) dan hanya dibaca sebagai compat satu rilis.',
  },
]);

// ── 3) PRD: butir 9 yang sebelumnya belum diputus ────────────────────────────
edit('PRD.md', [
  {
    n: 'ttl-prd',
    a: '**satu angka belum sah dipilih — temuan tulis-tersua:**',
    b: '**DIPUTUSKAN 2026-10-20 oleh Lead Architect: bawaan 90 detik, rentang aman 30–300, kunci `krs.war_lease_ttl_s`.** Alasan: hanya 90 detik yang konsisten dengan `SET krs:lease … NX PX 90000` + perpanjangan 30 detik + janji "kursi bebas maksimal 90 detik saat primary mati" (ARCHITECTURE §10.3.3); 900 detik menahan kursi 15 menit pada puncak OW (underbooking) dan 30 detik kehilangan pegangan karena satu latensi jaringan. (Temuan lama yang dicatat sebelum diputus:',
  },
]);

console.log(rep.join('\n'));
