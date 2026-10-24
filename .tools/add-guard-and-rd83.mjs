import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';

/* 1 — penjaga yang dijanjikan CRD-4 dan teks §4.5.3: kolom `Modul` harus anggota 13 nilai
      `PermissionModule` di authz.ts. Membuat rujukan alat tanpa alatnya adalah pola `RD-55`. */
const TOOL = 'C:/SICA/.tools/rbac-module-union.mjs';
if (!existsSync(TOOL)) {
  writeFileSync(TOOL, [
    "import { readFileSync } from 'node:fs';",
    'const NL = String.fromCharCode(10);',
    "const authz = readFileSync('C:/SICA/packages/contracts/src/authz.ts', 'utf8');",
    "const rbac = readFileSync('C:/SICA/docs/RBAC_MATRIX.md', 'utf8').split(NL);",
    '',
    '/* Kolom `Modul` pada baris izin wajib anggota 13 nilai `PermissionModule` yang dideklarasikan',
    '   `authz.ts`. Nama resource (suku pertama kode izin) BEBAS — `career`, `ppks`, `endowment`,',
    '   `mobility` semuanya sah sebagai kode selama `Modul`-nya dijemput dari himpunan itu.',
    '   Penjaga ini lahir karena saya sendiri pernah mengklaim "`career.*` menuntut nilai baru"',
    '   tanpa membuka `authz.ts` lebih dulu (ralat dicatat di `API_SPEC §7.32`, 2026-10-21). */',
    "const blockM = authz.match(/PERMISSION_MODULES\\s*=\\s*\\[([\\s\\S]*?)\\]/);",
    "const legal = blockM ? [...blockM[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : [];",
    "const aliasM = authz.match(/MODULE_PREFIX_ALIASES[^{]*\\{([\\s\\S]*?)\\}/);",
    "const aliases = aliasM ? [...aliasM[1].matchAll(/(\\w+)\\s*:\\s*'([a-z_]+)'/g)].map((m) => ({ pref: m[1], ke: m[2] })) : [];",
    'if (!legal.length) { console.log("rbac-module-union: GAGAL — PERMISSION_MODULES tidak terbaca dari authz.ts"); process.exit(1); }',
    '',
    'const bad = [];',
    'let diperiksa = 0;',
    'for (let i = 0; i < rbac.length; i++) {',
    '  const m = rbac[i].match(/^\\|\\s*(\\d{1,3})\\s*\\|\\s*`([a-z_0-9]+)\\.([a-z_0-9.]+)`\\s*\\|\\s*`?([a-z_]+)`?\\s*\\|/);',
    '  if (!m) continue;',
    '  diperiksa++;',
    '  const [, no, res, code, mod] = m;',
    '  if (!legal.includes(mod)) bad.push("  baris " + no + " `" + res + "." + code + "` Modul=`" + mod + "` bukan anggota 13 nilai (" + legal.join(", ") + ")");',
    '  const al = aliases.find((a) => a.pref === res);',
    '  if (al && al.ke !== mod) bad.push("  baris " + no + " prefiks warisan `" + res + ".` dipetakan ke `" + al.ke + "` di kode, tetapi baris menulis `" + mod + "`");',
    '}',
    'console.log("nilai PermissionModule di authz.ts = " + legal.length + " :: " + legal.join(", "));',
    'console.log("prefiks warisan terdaftar = " + aliases.map((a) => a.pref + "→" + a.ke).join(", "));',
    'console.log("baris izin bernama diperiksa = " + diperiksa + " · penyimpangan = " + bad.length);',
    'bad.slice(0, 30).forEach((b) => console.log(b));',
    'console.log(bad.length === 0 ? "rbac-module-union: HIJAU" : "rbac-module-union: MERAH");',
    '',
  ].join(NL), 'utf8');
  console.log('rbac-module-union.mjs dibuat');
} else console.log('rbac-module-union.mjs sudah ada');

/* 2 — RD-83 wajib ada di registri karena dua berkas merujuk nomornya itu */
const AP = D + 'AUDIT_READINESS.md';
let a = readFileSync(AP, 'utf8');
if (a.includes('| `RD-83` |')) { console.log('RD-83 sudah terdaftar'); }
else {
  const i = a.indexOf('| `RD-82` |');
  const end = a.indexOf(NL, i);
  const row = NL + '| `RD-83` | **Saya nyaris menerbitkan spesifikasi palsu karena angka generator.** `.tools/crud-completer.mjs` mencetak "321 baris rute + 204 izin" dalam satu detik — angka yang terlihat menuntaskan §15.7. Dibaca satu per satu: `helpdesk.impact.update` ditempel ke `/helpdesk/sla-policies/:id`, `hr.payroll.update` ke `/admin/engine/pph21-bracket/runs/:id`, satu baris `DELETE /helpdesk/tickets/:id` dobel, `enrollment.krs.view` dinomori ulang menjadi izin "baru" padahal sudah dimiliki `§4.2`, dan 13 kode `career.*` saya klaim menuntut nilai `PermissionModule` baru — padahal `authz.ts` sudah benar dan baris 257–260 sudah memakai `career` sebagai resource dengan `Modul=academic`. | `API_SPEC §7.25–§7.32`, `RBAC_MATRIX §4.5.3`, `ROADMAP §2.22` | **ditutup dalam siklus yang sama**: keluaran generator dihapus seluruhnya; tujuh keluarga rute ditulis tangan (§7.25–§7.31) memakai izin yang sudah ada (hasil periksa: **nol izin baru yang sah**), sisanya menjadi tiket `CRD-1…CRD-4`; penjaga baru `.tools/rbac-module-union.mjs` dipasang supaya klaim `Modul` tidak lagi bergantung ingatan |';
  a = a.slice(0, end) + row + a.slice(end);
  writeFileSync(AP, a, 'utf8');
  console.log('RD-83 didaftarkan sesudah RD-82');
}
