// perm-phantom.mjs — mengukur setiap kode izin yang dikutip API_SPEC terhadap register yang menamainya.
// Cara pakai: node .tools/perm-phantom.mjs
// Definisi tinggal satu tempat: .tools/lib-perm.mjs (dipakai juga oleh perm-normalize dan perm-usulan),
// supaya dua alat tidak bisa menuduh hal berbeda atas berkas yang sama (kelas RD-95).
//  · BERNOMOR  = baris `| N | \`kode\` |` di RBAC §4.5 — titik aksi yang bisa diagran dan di-seed.
//  · USULAN    = baris §4.5.4/4.5.5/4.5.6: nama SENGAJA tanpa nomor dan tanpa peran. Terdaftar, belum diputus.
//  · DIKENAL   = muncul di RBAC/authz mana pun, setelah shorthand sel (`identity.user.view` / `.create`) dikembangkan.
//  · HANTU     = dikutip API_SPEC tetapi tidak pernah dinamai di mana pun. Ini temuan, bukan gaya penulisan.
// Verdict sengaja TIGA tingkat: `HANTU = 0` bukan "selesai". Sebuah kode yang baru dinamai oleh generator
// masih owes satu keputusan manusia (peran + nomor), dan melaporkan keadaan itu sebagai HIJAU adalah
// kegagalan RD-93 (alat yang menilai pekerjaannya sendiri) dengan baju baru.
import { loadRbac, loadCited } from './lib-perm.mjs';

const { numbered, named, usulan } = loadRbac();
const cited = loadCited();

const ghosts = [...cited.entries()].filter(([c]) => !named.has(c) && c.split('.').length >= 3);
const shorthand = [...cited.entries()].filter(([c]) => !named.has(c) && c.split('.').length === 2);
const usulanCited = [...cited.entries()].filter(([c]) => usulan.has(c));
const namedOnly = [...cited.entries()].filter(([c]) => named.has(c) && !numbered.has(c) && !usulan.has(c));
const withNumber = cited.size - ghosts.length - shorthand.length - namedOnly.length - usulanCited.length;

console.log(`RBAC: kode BERNOMOR = ${numbered.size} · kode USULAN tanpa nomor = ${usulan.size} · DIKENAL = ${named.size}`);
console.log(`API_SPEC: kandidat kode izin dikutip (termasuk shorthand rute) = ${cited.size}`);
console.log(`  punya baris bernomor                  = ${withNumber}`);
console.log(`  terdaftar sebagai USULAN (§4.5.4+)   = ${usulanCited.length}`);
console.log(`  dikenal tapi tidak ber-nomor/usulan   = ${namedOnly.length}`);
console.log(`  singkat 2 segmen (bukan kode penuh)   = ${shorthand.length}`);
console.log(`  HANTU (tak pernah dinamai)            = ${ghosts.length}`);

const bySection = new Map();
for (const [code, info] of ghosts) {
  if (!bySection.has(info.section)) bySection.set(info.section, []);
  bySection.get(info.section).push(code);
}
for (const [sec, codes] of bySection) {
  console.log(`  ! ${sec} (${codes.length}): ${codes.slice(0, 6).join(', ')}${codes.length > 6 ? ', …' : ''}`);
}
const byModule = new Map();
for (const [code] of usulanCited) {
  const p = code.split('.')[0];
  byModule.set(p, (byModule.get(p) || 0) + 1);
}
if (usulanCited.length) {
  console.log('  ~ USULAN per prefiks: ' + [...byModule.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' '));
  console.log('  ~ peran sudah diputus pada usulan  = ' + [...usulanCited].filter(([c]) => !/BELUM DIPUTUS/.test(usulan.get(c).roles)).length);
}
if (shorthand.length) console.log('  ~ singkat dibaca sebagai: ' + shorthand.map(([c]) => c).join(', '));

if (ghosts.length) console.log(`perm-phantom: MERAH — ${ghosts.length} kode izin dikutip tanpa pernah dinamai RBAC_MATRIX/authz.ts`);
else if (usulanCited.length) console.log(`perm-phantom: KUNING — tidak ada hantu, tetapi ${usulanCited.length} kode yang dikutip rute masih berstatus USULAN: tanpa nomor katalog dan tanpa grant peran (CRD-5 belum tertutup; pemilik keputusan = lead arsitek, bukan alat)`);
else console.log('perm-phantom: HIJAU — setiap kode yang dikutip rute punya baris bernomor');
