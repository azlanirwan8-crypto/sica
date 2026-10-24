/**
 * Audit Role × Menu (`MENU-LOCK-1` lanjutan, permintaan pemilik 2026-10-24:
 * "yang tidak dibutuhkan harusnya tidak ada").
 *
 * Alat ini menjawab satu pertanyaan yang tidak bisa dijawab `verify:menu`: bukan apakah
 * baris menu ADA, melainkan apakah baris itu **muncul untuk peran yang berhak menurut
 * matriks**. Sumber kebenaran hak tetap `RBAC_MATRIX §4/§6`; yang dibaca di sini adalah
 * `SYSTEM_ROLE_GRANTS` (mirror katalog yang sama, dijaga `gen-rbac-seed --check`) ×
 * grant `menu_permissions` dari definisi pohon, dengan SEMUA modul diaktifkan supaya
 * yang tersisa hanya perbedaan izin — bukan perbedaan langganan.
 *
 * Kolom `lapisan = platform` untuk peran kampus adalah **kontrafaktual**: baris pohon R-1
 * tidak pernah di-seed ke tenant kampus, jadi daun itu tidak akan pernah terkirim ke
 * mereka. Isolasi itu dibuktikan `verify:menu` butir 5 terhadap basis data, bukan diasumsikan
 * di alat ini; yang diuji di sini adalah gerbang izin dan struktur pohonnya.
 *
 * Kenapa berbasis harapan eksplisit dan bukan "laporkan apa adanya": tanpa harapan,
 * matriks 22 peran hanya menjadi teks panjang. Setiap baris `EKSPETASI` di bawah menyebut
 * baris `RBAC_MATRIX §6` yang memayunginya. Alat keluar dengan kode 1 bila ada peran yang
 * melihat daun di luar matriks, ATAU tidak melihat daun yang diwajibkan matriks.
 *
 * Jalankan: `pnpm --filter @sica/web audit:menu`
 */
import { ROLE_CODES, SYSTEM_ROLE_GRANTS, MODULE_CODES, permissionModule, type PermissionCode, type RoleCode } from '@sica/contracts';
import type { MeMenuItem } from '@sica/contracts';
import { CAMPUS_MENU_TREE, PLATFORM_MENU_TREE, type MenuSeedNode } from '../modules/authz/menu-tree';
import { resolveMenu, type ResolveMenuInput } from '../modules/authz/menu-resolver';
import type { MenuGrantProjection, MenuRowProjection } from '@sica/contracts';

const ALL_MODULES = new Set<string>(MODULE_CODES);

/** Materialisasi definisi menjadi baris + grant sintetis (identik dengan yang di-seed). */
function toRows(nodes: readonly MenuSeedNode[], out: MenuRowProjection[] = [], parent: string | null = null): MenuRowProjection[] {
  for (const node of nodes) {
    const children = node.children ?? [];
    // Sama seperti `menu-seed.ts`: daun boleh ber-gate `anyOf` tanpa `permission` tunggal
    // (mis. persetujuan parameter), jadi visibilitas dihitung dari daftar grant-nya.
    const codes = node.anyOf && node.anyOf.length > 0 ? node.anyOf : node.permission ? [node.permission] : [];
    out.push({
      id: node.code,
      code: node.code,
      parentId: parent,
      label: node.label,
      labelEn: node.labelEn,
      routeKey: node.routeKey ?? null,
      moduleCode: children.length > 0 ? null : (node.module === undefined ? null : node.module),
      icon: node.icon ?? null,
      sortOrder: node.sortOrder ?? 100,
      isVisible: children.length > 0 ? true : codes.length > 0,
      requiresMfa: node.requiresMfa ?? false,
      version: 1,
    });
    if (children.length) toRows(children, out, node.code);
  }
  return out;
}

function toGrants(nodes: readonly MenuSeedNode[], out: MenuGrantProjection[] = []): MenuGrantProjection[] {
  for (const node of nodes) {
    if (node.permission) out.push({ menuId: node.code, permissionCode: node.permission, effect: 'ALLOW', scopeKind: '' });
    for (const code of node.anyOf ?? []) out.push({ menuId: node.code, permissionCode: code, effect: 'ALLOW', scopeKind: '' });
    if (node.children) toGrants(node.children, out);
  }
  return out;
}

function walkLeaves(nodes: readonly MenuSeedNode[], out: MenuSeedNode[] = []): MenuSeedNode[] {
  for (const node of nodes) {
    if (node.children && node.children.length > 0) walkLeaves(node.children, out);
    else out.push(node);
  }
  return out;
}

const CAMPUS_ROWS = toRows(CAMPUS_MENU_TREE);
const CAMPUS_GRANTS = toGrants(CAMPUS_MENU_TREE);
const PLATFORM_ROWS = toRows(PLATFORM_MENU_TREE);
const PLATFORM_GRANTS = toGrants(PLATFORM_MENU_TREE);

function leavesFor(tree: 'campus' | 'platform', role: RoleCode): string[] {
  const input: ResolveMenuInput = {
    rows: tree === 'campus' ? CAMPUS_ROWS : PLATFORM_ROWS,
    grants: tree === 'campus' ? CAMPUS_GRANTS : PLATFORM_GRANTS,
    activeModules: ALL_MODULES,
    permissions: new Set<string>(SYSTEM_ROLE_GRANTS[role]),
    assignmentScopeKinds: new Set(['TENANT', 'ORG', 'PROGRAM', 'CLASS', 'PERIOD', 'SELF']),
    depth: 4,
    blockFor: () => null,
  };
  const flat: readonly MeMenuItem[] = resolveMenu(input).tree;
  const out: string[] = [];
  const walk = (nodes: readonly MeMenuItem[]): void => {
    for (const n of nodes) {
      if (n.children.length === 0) out.push(n.code);
      else walk(n.children);
    }
  };
  walk(flat);
  return out.sort();
}

/**
 * Harapan per peran, masing-masing menunjuk baris `RBAC_MATRIX §6`.
 * `must` = daun yang HARUS terlihat; `mustNot` = daun yang DILARANG terlihat.
 *
 * Dua aturan yang membuat daftar ini tidak bisa dibaca salah:
 *  - `must` hanya memuat daun yang izin pengendalnya sudah berstatus `normatif` di §4.5. Daun
 *    yang izinnya masih `usulan` (319/320/326, 389–394) TIDAK masuk `must` — itu pekerjaan
 *    `MENU-LOCK-2/3/4`, dan menuntutnya di sini hanya akan memaksa kita mempromosikan izin.
 *  - `mustNot` diambil dari baris §6 yang TIDAK menyebut daun itu untuk peran bersangkutan,
 *    termasuk larangan eksplisit §2/§6.8 (R-2) dan §7.1 (SoD BAAK↔BAUK).
 */
interface Expectation {
  readonly role: RoleCode;
  readonly tree: 'campus' | 'platform';
  readonly must?: readonly string[];
  readonly mustNot?: readonly string[];
  readonly cite: string;
}

const EKSPETASI: readonly Expectation[] = [
  {
    role: 'TENANT_ADMIN',
    tree: 'campus',
    must: [
      'dashboard',
      'admin.identity.accounts', 'admin.identity.rbac', 'admin.identity.requests', 'admin.identity.audit',
      'admin.institution.profile', 'admin.institution.catalog',
      'admin.parameters.system', 'admin.parameters.reference',
      'admin.parameters.approvals', 'admin.parameters.customattr', 'admin.parameters.meta',
      'admin.identity.menu', 'akademik.studentstatus',
      'admin.integrations.feeder', 'admin.operations.feeder_queue',
      'admin.monitoring.login_alert', 'more.settings',
    ],
    mustNot: [
      'akademik.krs', 'akademik.khs', 'akademik.dpa', 'akademik.schedule', 'akademik.attendance',
      'more.finance', 'admin.parameters.import',
      'platform.licensing.directory',
    ],
    cite: '§6.2 baris 1509–1524 (akun/hak/organisasi/kamus/parameter/audit/menu) + §6.8 baris 1798/1800/1805 (katalog, login, binding Feeder) + §12.2 daun 1.3/2.1/2.3/3.1/3.3/4.1/4.2/4.5/5.1/6.4. Yang dilarang: §2 baris 78 "KRS/nilai/pembayaran tidak diwariskan" dan §6.8 baris 1790',
  },
  {
    role: 'PLATFORM_OPERATOR',
    tree: 'platform',
    must: ['dashboard', 'platform.licensing.directory', 'platform.licensing.addons', 'platform.licensing.quotas', 'platform.licensing.flags', 'platform.monitoring.security_log', 'platform.governance.chain', 'platform.governance.support'],
    mustNot: ['akademik.krs', 'akademik.khs', 'more.finance', 'admin.identity.accounts', 'admin.identity.rbac'],
    cite: '§6.1 baris 1491–1497: operator mengelola langganan/kuota/flag/audit lintas tenant/dukungan; dia BUKAN admin kampus satu tenant (§2 baris 60 larang data operasional harian)',
  },
  {
    role: 'ADMIN_ACADEMIC',
    tree: 'campus',
    must: ['akademik.krs', 'akademik.khs', 'akademik.schedule', 'akademik.attendance', 'akademik.studentstatus', 'admin.parameters.reference'],
    mustNot: ['platform.licensing.directory', 'admin.identity.rbac', 'admin.identity.accounts', 'more.finance'],
    cite: '§6.2 baris 1516+1525–1530 (BAAK pegang kamus, data induk, kelas/jadwal, KRS lintas prodi, rekap presensi, nilai) dan §6.2 baris 1509 (`identity.role.*`/`identity.user.*` milik R-2); `more.finance` dilarang §7.1 SoD BAAK↔BAUK + `AGENTS §3.8` (nominal tidak terbaca peran akademik)',
  },
  {
    role: 'ADMIN_FINANCE',
    tree: 'campus',
    must: ['more.finance', 'admin.parameters.system', 'admin.parameters.reference', 'akademik.studentstatus'],
    mustNot: ['akademik.krs', 'akademik.khs', 'admin.identity.rbac', 'admin.identity.accounts', 'platform.licensing.directory'],
    cite: '§6.2 baris 1544–1547 (tarif & tagihan, gerbang KRS, pembatalan sebagai pemohon) + §4.5 baris 148/152 yang memang menuliskan `ADMIN_FINANCE` sebagai pemegang `settings.param.view.ops/.financial` — baca ambang, bukan nominal. Yang dilarang: §7.1 SoD BAAK↔BAUK dan §4.5 baris 1509 (`identity.role.*`/`identity.user.*` milik R-2)',
  },
  {
    role: 'LECTURER',
    tree: 'campus',
    must: ['akademik.schedule', 'akademik.attendance', 'akademik.khs', 'more.settings'],
    mustNot: ['admin.identity.accounts', 'admin.identity.rbac', 'admin.parameters.system', 'platform.licensing.directory', 'akademik.dpa'],
    cite: '§6.3 baris 1584–1586 (kelas saya, presensi & QR, input nilai) + §4.5.5 baris 330 `identity.profile.update` = "Semua peran (SELF)" sehingga `more.settings` wajib ada; penugasan/parameter bukan hak pengajar',
  },
  {
    role: 'HEAD_OF_PROGRAM',
    tree: 'campus',
    must: ['akademik.krs', 'akademik.khs', 'akademik.dpa', 'admin.parameters.reference', 'admin.parameters.system'],
    mustNot: ['admin.identity.accounts', 'admin.identity.rbac', 'more.finance', 'platform.licensing.directory'],
    cite: '§6.2 baris 1518 + 1533–1536 (kamus prodi 129–133, kurikulum, kelas paralel, approval KRS scope prodi, `grading.unlock`) dan §4.5 baris 150 yang menuliskan kaprodi sebagai pemegang `settings.param.view.academic`. Bukan hak: akun, parameter teknis, tagihan (§7.1 SoD BAAK↔BAUK)',
  },
  {
    role: 'STUDENT',
    tree: 'campus',
    must: ['dashboard', 'akademik.krs', 'akademik.khs', 'akademik.schedule', 'akademik.attendance', 'more.finance', 'more.settings'],
    mustNot: ['admin.identity.accounts', 'admin.identity.rbac', 'admin.parameters.system', 'platform.licensing.directory', 'akademik.dpa', 'admin.parameters.reference', 'akademik.studentstatus'],
    cite: '§6.4 baris 1606–1611 (profil & keamanan, KRS, presensi QR, KHS, jadwal, tagihan & bayar); `akademik.dpa` = `enrollment.krs.approve` milik ADVISER/Kaprodi (§6.3 baris 1593)',
  },
  {
    role: 'ADVISER',
    tree: 'campus',
    must: ['dashboard', 'more.settings', 'akademik.dpa', 'akademik.krs', 'akademik.khs'],
    mustNot: ['admin.identity.accounts', 'admin.identity.rbac', 'admin.parameters.system', 'more.finance', 'platform.licensing.directory'],
    cite: '§6.3 baris 1593–1594 (approval DPA + status/transkrip bimbingan) dan §4.5 baris 329–334 "Semua peran (`SELF`)" untuk dashboard & pengaturan akun. Wali bukan pengelola akun/parameter/tagihan',
  },
  {
    role: 'GUARDIAN',
    tree: 'campus',
    must: ['dashboard', 'more.settings', 'akademik.krs', 'akademik.khs', 'akademik.attendance', 'more.finance'],
    mustNot: ['admin.identity.accounts', 'admin.identity.rbac', 'admin.parameters.system', 'admin.parameters.reference', 'platform.licensing.directory'],
    cite: '§5 baris `GUARDIAN` (enrollment/attendance/assessment/finance = B, baca milik anak) + §6.4 baris 1620–1621 portal orang tua + §4.5 baris 329–334 untuk self-service',
  },
  {
    role: 'APPLICANT',
    tree: 'campus',
    must: ['dashboard', 'more.settings', 'more.finance'],
    mustNot: ['akademik.krs', 'akademik.khs', 'admin.identity.accounts', 'admin.parameters.system', 'admin.parameters.reference', 'platform.licensing.directory'],
    cite: '§6.4 baris 1622–1625 (aplikasi, biaya seleksi, CBT, pengumuman) + §4.5 baris 329–334; pendaftar pra-NIM tidak punya KRS, nilai, atau hak administrasi',
  },
  {
    role: 'COMPLIANCE_OFFICER',
    tree: 'campus',
    must: ['dashboard', 'more.settings', 'admin.identity.audit', 'admin.identity.rbac'],
    mustNot: ['admin.identity.requests', 'admin.identity.accounts', 'akademik.krs', 'platform.licensing.directory'],
    cite: '§6.1 baris 1498–1503 (jejak audit, rantai, laporan kepatuhan) + §4.5 baris 343/347/348 yang menuliskan perannya sebagai pemegang BACA role/permission/assignment. `admin.identity.requests` dilarang baris 351–352 (pemegang: `TENANT_ADMIN`) dan vonis §9.5 "DPO tidak boleh punya hak tulis" — penutup `G-31`',
  },
  {
    role: 'LEADER',
    tree: 'campus',
    must: ['dashboard', 'more.settings', 'more.finance', 'admin.parameters.system'],
    mustNot: ['admin.identity.accounts', 'admin.identity.rbac', 'platform.licensing.directory', 'akademik.krs', 'akademik.khs', 'akademik.attendance', 'akademik.studentstatus'],
    cite: '§6.2 baris LEADER (dashboard eksekutif, keputusan strategis, SK yudisium, mutu, IKU) + §4.5 baris 148/152/154 untuk baca parameter; baris 336 TIDAK mencantumkan pimpinan sebagai pemegang `identity.user.view`',
  },
  {
    role: 'STAFF',
    tree: 'campus',
    must: ['dashboard', 'more.settings', 'akademik.krs'],
    mustNot: ['admin.identity.accounts', 'admin.identity.rbac', 'admin.parameters.system', 'admin.parameters.reference', 'more.finance', 'platform.licensing.directory'],
    cite: '§9.5 baris "TU / Operator meja": bundle `TU_OPERASIONAL` di-grant ke `STAFF` (`enrollment.krsedit.request`, `attendance.record.update`, `academic.document.print`) — baca KRS pasangan hak sunting-ber-approval itu; §4.5 baris 329–334 untuk akun dirinya',
  },
  {
    role: 'ALUMNI',
    tree: 'campus',
    must: ['dashboard', 'more.settings', 'akademik.khs'],
    mustNot: ['akademik.krs', 'akademik.attendance', 'admin.identity.accounts', 'admin.parameters.system', 'more.finance', 'platform.licensing.directory'],
    cite: '§6.4 baris 1617–1619 (ijazah & transkrip, legalisir, tracer) yang dibaca daun `akademik.khs` lewat `academic.transcript.view`; §5 baris `ALUMNI` tidak memberi enrollment/attendance',
  },
  {
    role: 'TREASURER',
    tree: 'campus',
    must: ['dashboard', 'more.settings', 'more.finance', 'admin.parameters.system'],
    mustNot: ['akademik.krs', 'akademik.khs', 'akademik.studentstatus', 'admin.identity.accounts', 'admin.identity.rbac', 'admin.parameters.reference', 'platform.licensing.directory'],
    cite: '§6.2 baris 1548–1550 + 1561 (antrean persetujuan, pembayaran, rekonsiliasi, pengesahan gaji) dan §4.5 baris 152 (`settings.param.view.financial`); kamus lokal & data akademik bukan domain bendahara',
  },
  {
    role: 'FEEDER_OPERATOR',
    tree: 'campus',
    must: ['dashboard', 'more.settings', 'admin.integrations.feeder', 'admin.operations.feeder_queue', 'admin.parameters.system'],
    mustNot: ['akademik.krs', 'akademik.khs', 'admin.identity.accounts', 'admin.identity.rbac', 'admin.parameters.reference', 'platform.licensing.directory'],
    cite: '§6.2 baris 1551–1554 (pemetaan feeder, kirim periode, koreksi terkirim, perbaikan sumber data) + §4.5 baris 337–338 (`feeder.sync.view`) dan 150/154 (baca parameter akademik/regulatori)',
  },
  {
    role: 'QUALITY_OFFICER',
    tree: 'campus',
    must: ['dashboard', 'more.settings', 'admin.parameters.reference', 'admin.parameters.system', 'akademik.khs'],
    mustNot: ['admin.identity.accounts', 'admin.identity.rbac', 'admin.identity.audit', 'admin.identity.menu', 'more.finance', 'platform.licensing.directory'],
    cite: '§5 baris `QUALITY_OFFICER` (academic/teaching/attendance/assessment/feeder = B) + §4.5 baris 127/129/136 (kamus & pemakaian) dan 150/154. §6.2 baris 1571–1573 hanya menuliskan layar mutu; `audit.log.view` milik `COMPLIANCE_OFFICER` (§6.1 baris 1498)',
  },
];

const problems: string[] = [];
const matrix: Array<{ peran: string; tree: string; daun: number; terlihat: string }> = [];

for (const tree of ['campus', 'platform'] as const) {
  for (const role of ROLE_CODES) {
    const visible = leavesFor(tree, role);
    if (visible.length === 0) continue;
    matrix.push({ peran: role, tree, daun: visible.length, terlihat: visible.join(' · ') });
  }
}

console.log('=== MATRIKS NYATA (semua modul aktif, hak dari katalog) ===');
console.table(matrix.map((m) => ({ peran: m.peran, lapisan: m.tree, daun: m.daun })));

for (const exp of EKSPETASI) {
  const visible = new Set(leavesFor(exp.tree, exp.role));
  for (const code of exp.mustNot ?? []) {
    if (visible.has(code)) problems.push(`${exp.role} MELIHAT ${code} — dilarang oleh ${exp.cite}`);
  }
  for (const code of exp.must ?? []) {
    if (!visible.has(code)) problems.push(`${exp.role} TIDAK melihat ${code} — diwajibkan oleh ${exp.cite}`);
  }
}

// Invarian struktural lintas peran.
const operatorCampus = leavesFor('platform', 'PLATFORM_OPERATOR');
if (operatorCampus.length === 0) problems.push('PLATFORM_OPERATOR tidak melihat satu pun daun di pohon platform.');
const empty = ROLE_CODES.filter((r) => leavesFor('campus', r).length === 0 && leavesFor('platform', r).length === 0);
if (empty.length > 0) problems.push(`Peran tanpa satu pun daun di kedua pohon (pasti salah daftar): ${empty.join(', ')}`);

/**
 * Atura lapisan R-1/R-2 yang kedua. Isolasi dua pohon ini di produksi dijaga tenancy
 * (pohon platform hanya di-seed pada tenant platform); di alat ini keduanya dimaterialisasi
 * untuk setiap peran, jadi yang kita buktikan adalah gerbangnya: setiap daun platform yang
 * TERLIHAT harus dipegang oleh `PLATFORM_OPERATOR`. Daun yang gate-nya hanya dipegang peran
 * kampus adalah daun R-1 palsu — persis cacat `platform.master.lookup` yang ditutup siklus ini.
 */
const operatorPermissions = new Set<string>(SYSTEM_ROLE_GRANTS.PLATFORM_OPERATOR);
let platformLeavesWithoutOperatorGate = 0;
for (const leaf of walkLeaves(PLATFORM_MENU_TREE)) {
  const gates = [leaf.permission, ...(leaf.anyOf ?? [])].filter((c): c is PermissionCode => Boolean(c));
  if (gates.length === 0) continue;
  if (!gates.some((code) => operatorPermissions.has(code))) {
    platformLeavesWithoutOperatorGate += 1;
    problems.push(
      `Daun platform ${leaf.code} digate ${gates.join('/')} — tidak satu pun dipegang PLATFORM_OPERATOR (§6.1: daun R-1 harus berada dalam jangkauan pemegangnya)`
    );
  }
}

/** Pohon kampus tidak memakai keluarga `platform.` kecuali kode tata kelola menu (baris 158). */
for (const leaf of walkLeaves(CAMPUS_MENU_TREE)) {
  for (const code of [leaf.permission, ...(leaf.anyOf ?? [])].filter((c): c is PermissionCode => Boolean(c))) {
    if (code.startsWith('platform.') && permissionModule(code) === 'platform') {
      problems.push(`Daun campus ${leaf.code} digate ${code} — modulnya \`platform\` = R-1 (§2 baris 60); pohon kampus tidak boleh memuatnya.`);
    }
  }
}

for (const m of matrix) console.log(`\n${m.peran} [${m.tree}] = ${m.daun} daun\n  ${m.terlihat}`);

const operatorSees = matrix.find((m) => m.peran === 'PLATFORM_OPERATOR' && m.tree === 'platform');
const tenantAdminSees = matrix.find((m) => m.peran === 'TENANT_ADMIN' && m.tree === 'campus');
console.log(
  `\nR-1 = ${operatorSees?.daun ?? 0} daun platform · R-2 = ${tenantAdminSees?.daun ?? 0} daun kampus · ` +
    `daun platform di luar jangkauan operator = ${platformLeavesWithoutOperatorGate}`
);

if (problems.length > 0) {
  console.log(`\n❌ AUDIT ROLE × MENU — ${problems.length} penyimpangan:`);
  for (const p of problems) console.log('  · ' + p);
  process.exit(1);
}
console.log('\n✅ AUDIT ROLE × MENU HIJAU — tiap daun punya baris matriks yang memayunginya.');
