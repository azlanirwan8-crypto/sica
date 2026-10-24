import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const authz = readFileSync('C:/SICA/packages/contracts/src/authz.ts', 'utf8');
const rbac = readFileSync('C:/SICA/docs/RBAC_MATRIX.md', 'utf8').split(NL);

/* Kolom `Modul` pada baris izin wajib anggota 13 nilai `PermissionModule` yang dideklarasikan
   `authz.ts`. Nama resource (suku pertama kode izin) BEBAS — `career`, `ppks`, `endowment`,
   `mobility` semuanya sah sebagai kode selama `Modul`-nya dijemput dari himpunan itu.
   Penjaga ini lahir karena saya sendiri pernah mengklaim "`career.*` menuntut nilai baru"
   tanpa membuka `authz.ts` lebih dulu (ralat dicatat di `API_SPEC §7.32`, 2026-10-21). */
const blockM = authz.match(/PERMISSION_MODULES\s*=\s*\[([\s\S]*?)\]/);
const legal = blockM ? [...blockM[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : [];
const aliasM = authz.match(/MODULE_PREFIX_ALIASES[^{]*\{([\s\S]*?)\}/);
const aliases = aliasM ? [...aliasM[1].matchAll(/(\w+)\s*:\s*'([a-z_]+)'/g)].map((m) => ({ pref: m[1], ke: m[2] })) : [];
if (!legal.length) { console.log("rbac-module-union: GAGAL — PERMISSION_MODULES tidak terbaca dari authz.ts"); process.exit(1); }

const bad = [];
let diperiksa = 0;
for (let i = 0; i < rbac.length; i++) {
  const m = rbac[i].match(/^\|\s*(\d{1,3})\s*\|\s*`([a-z_0-9]+)\.([a-z_0-9.]+)`\s*\|\s*`?([a-z_]+)`?\s*\|/);
  if (!m) continue;
  diperiksa++;
  const [, no, res, code, mod] = m;
  if (!legal.includes(mod)) bad.push("  baris " + no + " `" + res + "." + code + "` Modul=`" + mod + "` bukan anggota 13 nilai (" + legal.join(", ") + ")");
  const al = aliases.find((a) => a.pref === res);
  // Arti sebuah alias adalah "prefiks ini BOLEH berpindah rumah", bukan "prefiks ini WAJIB
  // di rumah itu". Terukur 2026-10-23: alat ini menuduh baris 305–309 (`platform.plan.view`,
  // `platform.quota.manage`, `platform.flag.manage`, `platform.breakglass.use` — modul
  // `platform`, sesuai `PERMISSION_SPECS` di `authz.ts:357,362,365`) karena peta prefiks
  // mencatat `platform → entitlement`. Yang benar: prefiks `platform.` memang TERBELAH dua
  // rumah — `platform.menu.*` (baris 158–161) milik `entitlement` karena yang dirawat adalah
  // pohon lintas tenant, sedangkan paket/kuota/flag/breakglass adalah permukaan operator
  // platform. Uji katalog `authz-catalog.test.ts:63-66` sudah menormalkan pembacaan ini.
  // Karena itu baris dianggap sah bila modulnya EITHER prefiks itu sendiri EITHER sasaran
  // alias; klaim modul ketiga (mis. `finance` untuk `platform.plan.view`) tetap ditolak.
  if (al && al.ke !== mod && mod !== res) {
    bad.push("  baris " + no + " prefiks warisan `" + res + ".` punya dua rumah sah (`" + res + "` / `" + al.ke + "`), tetapi baris menulis `" + mod + "`");
  }
}
console.log("nilai PermissionModule di authz.ts = " + legal.length + " :: " + legal.join(", "));
console.log("prefiks warisan terdaftar = " + aliases.map((a) => a.pref + "→" + a.ke).join(", "));
console.log("baris izin bernama diperiksa = " + diperiksa + " · penyimpangan = " + bad.length);
bad.slice(0, 30).forEach((b) => console.log(b));
console.log(bad.length === 0 ? "rbac-module-union: HIJAU" : "rbac-module-union: MERAH");
