/**
 * Unit tests — Invarian katalog izin & peran (RBAC_MATRIX §2/§4, FR-IDT-04).
 * Murni, tanpa DB. Tujuannya menjaga kontrak: tidak ada kode liar, tidak ada
 * peran yang memegang hak yang dilarang aturan SoD.
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_PERMISSION_CODES,
  CARRIER_ROLES,
  MODULE_PREFIX_ALIASES,
  PERMISSION_MODULES,
  ROLE_CODES,
  SYSTEM_ROLE_GRANTS,
  PERMISSION_VERBS,
  MUTUALLY_EXCLUSIVE_ROLES,
  PERM,
  isKnownPermission,
  permissionModule,
  permissionVerb,
  permissionResource,
  rolesForCarrier,
  violatesSoD,
  type PermissionCode,
  type RoleCode,
} from '@sica/contracts';

/**
 * Prefiks warisan dibaca dari kontrak, tidak ditulis ulang di sini: alias ini dipakai
 * `permissionModule()` dan seeder migrasi, sehingga salinan kedua di test justru akan
 * melegalkan penyimpangan (pola dua-sumber-kebenaran `RD-03`).
 */

const LOCKED_CODES: readonly string[] = [
  'grading.value.write',
  'grading.unlock',
  'enrollment.krs.submit',
  'enrollment.krs.approve',
  'finance.invoice.void',
  'finance.payment.confirm',
  'student.status.change',
];

describe('Katalog izin — integritas kode', () => {
  it('semua kode ASCII & sesuai pola modul.sumber.aksi', () => {
    const pattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
    for (const code of ALL_PERMISSION_CODES) {
      expect(code, `kode non-ASCII/pola salah: ${code}`).toMatch(pattern);
    }
  });

  it('tidak ada kode duplikat', () => {
    expect(new Set(ALL_PERMISSION_CODES).size).toBe(ALL_PERMISSION_CODES.length);
  });

  it('tiap kode bisa diselesaikan ke modulnya dan prefiks konsisten', () => {
    for (const code of ALL_PERMISSION_CODES) {
      const first = code.split('.')[0] as string;
      const resolved = permissionModule(code);
      // Dua invarian yang menangkap regresi, bukan tautologi:
      //  (a) prefiks wajib modul kanonik ATAU tercatat sebagai prefiks warisan;
      //  (b) bila prefiks BEDA dari modul hasil resolusi, perpindahan itu wajib
      //      dinyatakan `MODULE_PREFIX_ALIASES`. Ini membolehkan satu prefiks punya dua
      //      rumah yang sah — `platform.plan.*` milik modul `platform`, sedangkan
      //      `platform.menu.*` milik `entitlement` (baris 158–161) — tetapi menolak
      //      kode baru yang pindah modul tanpa dicatat di peta prefiks.
      if (first !== resolved) {
        expect(MODULE_PREFIX_ALIASES[first], `prefiks liar / alias tidak terdaftar: ${code}`).toBe(resolved);
      }
      expect(PERMISSION_MODULES, `modul hasil resolusi tidak kanonik: ${code}`).toContain(resolved);
    }
  });

  it('aksi selalu salah satu dari 6 aksi kanonik', () => {
    for (const code of ALL_PERMISSION_CODES) {
      expect(PERMISSION_VERBS).toContain(permissionVerb(code));
    }
  });

  it('tiap kode punya resource menu yang tidak kosong', () => {
    for (const code of ALL_PERMISSION_CODES) {
      expect(permissionResource(code).length).toBeGreaterThan(0);
    }
  });

  it('7 kode terkunci tetap utuh (tidak boleh diganti)', () => {
    for (const code of LOCKED_CODES) {
      expect(isKnownPermission(code), `kode terkunci hilang: ${code}`).toBe(true);
    }
  });

  it('string di luar katalog ditolak', () => {
    expect(isKnownPermission('academic.course.drop')).toBe(false);
    expect(isKnownPermission('admin')).toBe(false);
  });
});

describe('Peta grant per peran', () => {
  it('setiap peran punya grant dan seluruhnya terdaftar di katalog', () => {
    for (const role of ROLE_CODES) {
      const grants = SYSTEM_ROLE_GRANTS[role];
      expect(grants.length, `peran tanpa grant: ${role}`).toBeGreaterThan(0);
      for (const code of grants) {
        expect(isKnownPermission(code), `${role} memegang izin tak terdaftar: ${code}`).toBe(true);
      }
    }
  });

  it('mahasiswa tidak bisa menyetujui KRS sendiri', () => {
    const grants = SYSTEM_ROLE_GRANTS.STUDENT;
    expect(grants).not.toContain(PERM.enrollmentKrsApprove);
    expect(grants).toContain(PERM.enrollmentKrsSubmit);
  });

  it('dosen pengampu tidak bisa membuka kunci nilai (khusus kaprodi)', () => {
    expect(SYSTEM_ROLE_GRANTS.LECTURER).not.toContain(PERM.gradingUnlock);
    expect(SYSTEM_ROLE_GRANTS.LECTURER).not.toContain(PERM.assessmentCorrectionApprove);
    expect(SYSTEM_ROLE_GRANTS.HEAD_OF_PROGRAM).toContain(PERM.gradingUnlock);
    expect(SYSTEM_ROLE_GRANTS.HEAD_OF_PROGRAM).toContain(PERM.assessmentCorrectionApprove);
  });

  it('SoD keuangan: pemohon void bukan penyetuju', () => {
    expect(SYSTEM_ROLE_GRANTS.ADMIN_FINANCE).toContain(PERM.financeInvoiceVoidRequest);
    expect(SYSTEM_ROLE_GRANTS.ADMIN_FINANCE).not.toContain(PERM.financeInvoiceVoid);
    expect(SYSTEM_ROLE_GRANTS.TREASURER).toContain(PERM.financeInvoiceVoid);
    expect(SYSTEM_ROLE_GRANTS.TREASURER).not.toContain(PERM.financeInvoiceVoidRequest);
  });

  it('auditor kepatuhan tidak memegang izin tulis data bisnis', () => {
    const BUSINESS_MODULES = ['academic', 'finance', 'assessment', 'teaching', 'enrollment', 'attendance'];
    const writes = SYSTEM_ROLE_GRANTS.COMPLIANCE_OFFICER.filter((code) => {
      const verb = permissionVerb(code as PermissionCode);
      return (
        BUSINESS_MODULES.includes(permissionModule(code as PermissionCode)) &&
        verb !== 'READ'
      );
    });
    expect(writes).toEqual([]);
    // §6.1 + §4.5 baris 351–352 + vonis §9.5: DPO membaca jejak dan rantainya, tetapi TIDAK
    // memegang antrean perubahan hak. Memegang `.approve` di sana = jalur eskalasi `G-31`:
    // yang mengaudit bisa menaikkan hak miliknya sendiri. Keputusan DSAR (`audit.dsar.decide`)
    // masih `usulan`, jadi juga tidak boleh muncul sebagai grant.
    expect(SYSTEM_ROLE_GRANTS.COMPLIANCE_OFFICER).toContain(PERM.auditChainVerify);
    expect(SYSTEM_ROLE_GRANTS.COMPLIANCE_OFFICER).not.toContain(PERM.identityAccessRequestApprove);
    expect(SYSTEM_ROLE_GRANTS.COMPLIANCE_OFFICER).not.toContain(PERM.identityAccessRequestView);
    expect(SYSTEM_ROLE_GRANTS.COMPLIANCE_OFFICER).toContain(PERM.identityRoleView);
    expect(SYSTEM_ROLE_GRANTS.COMPLIANCE_OFFICER).toContain(PERM.identityAssignmentView);
  });

  it('R-2 Admin IT tidak mewarisi keputusan bisnis pemilik domain (§2 baris 78, §6.8)', () => {
    const it = SYSTEM_ROLE_GRANTS.TENANT_ADMIN;
    for (const code of [
      PERM.enrollmentKrsView, PERM.enrollmentKrsEditApprove, PERM.assessmentGradeView,
      PERM.assessmentRecompute, PERM.attendanceSummaryView, PERM.attendanceRecordUpdate,
      PERM.teachingClassCreate, PERM.teachingSessionView, PERM.academicStudentCreate,
      PERM.academicTranscriptIssue, PERM.entitlementSeatManage, PERM.feederPeriodSend,
      PERM.identityImpersonationGrant, PERM.documentNumberingManage,
    ]) {
      expect(it).not.toContain(code);
    }
    // Yang tetap wajib ada: baris §6.2 1509–1524 + target §6.8 1798/1800/1805.
    for (const code of [
      PERM.identityUserView, PERM.identityRoleView, PERM.identityAssignmentGrant,
      PERM.identityImpersonationRevoke, PERM.identityLoginStatsView,
      PERM.academicOrganizationView, PERM.academicRuleUpdate, PERM.academicGateConfigure,
      PERM.academicStudentStatusView, PERM.studentStatusChange,
      PERM.entitlementCatalogView, PERM.entitlementModuleActivate,
      PERM.auditLogView, PERM.auditExport, PERM.feederCredentialManage, PERM.feederSyncView,
      PERM.settingsParamEditTechnical, PERM.masterItemReorder, PERM.platformMenuGrant,
    ]) {
      expect(it).toContain(code);
    }
  });

  it('setiap peran memegang self-service penuh (§4.5 baris 329–334 "Semua peran")', () => {
    for (const role of ROLE_CODES) {
      const grants = SYSTEM_ROLE_GRANTS[role];
      for (const code of [
        PERM.identityProfileView, PERM.identityProfileUpdate, PERM.identitySessionRevoke,
        PERM.identityMfaManage, PERM.entitlementModuleView,
      ]) {
        const label = `${role} kehilangan ${code}`;
        expect(grants, label).toContain(code);
      }
    }
  });

  it('dosen biasa tidak naik jadi kaprodi hanya karena carrier (BR-G4)', () => {
    const dosenRoles = rolesForCarrier('dosen');
    expect(dosenRoles).not.toContain('HEAD_OF_PROGRAM');
    expect(dosenRoles.some((role) => SYSTEM_ROLE_GRANTS[role].includes(PERM.gradingUnlock))).toBe(false);
  });

  it('penyetuju akses (VALIDATE) tidak bisa dipakai sebagai UPDATE sembarangan', () => {
    expect(permissionVerb(PERM.enrollmentKrsApprove)).toBe('VALIDATE');
    expect(permissionVerb(PERM.academicPeriodClose)).toBe('UPDATE');
    expect(permissionVerb(PERM.academicDocumentPrint)).toBe('OTHER');
  });
});

describe('Perluasan carrier → peran (penutup celah G-01)', () => {
  it('nilai enum dikenal diperluas sesuai peta', () => {
    expect(rolesForCarrier('mahasiswa')).toEqual(['STUDENT']);
    expect(rolesForCarrier('dosen')).toContain('ADVISER');
    expect(rolesForCarrier('super_admin')).toEqual(['PLATFORM_OPERATOR']);
  });

  it('peran kustom yang mengandung kata admin/operator TIDAK dapat hak admin', () => {
    for (const sneaky of ['operator_magang_readonly', 'admin_keuangan_baca', 'leaderboard_bot', 'superhero']) {
      expect(rolesForCarrier(sneaky), `peran ${sneaky} seharusnya tanpa perluasan`).toEqual([]);
    }
    expect(CARRIER_ROLES).not.toContain('operator_magang_readonly');
  });

  it('null/kosong diperlakukan sebagai tanpa peran', () => {
    expect(rolesForCarrier(null)).toEqual([]);
    expect(rolesForCarrier(undefined)).toEqual([]);
    expect(rolesForCarrier('')).toEqual([]);
  });

  it('carrier tenant_admin tidak memegang pasangan SoD keuangan', () => {
    const roles = rolesForCarrier('tenant_admin');
    expect(violatesSoD(roles)).toBeNull();
    expect(roles).not.toContain('TREASURER');
    expect(roles).not.toContain('ADMIN_FINANCE');
  });

  it('violatesSoD menangkap kombinasi terlarang bila keduanya dipegang', () => {
    const pair = MUTUALLY_EXCLUSIVE_ROLES[0] as readonly RoleCode[];
    expect(violatesSoD(pair)).toEqual(pair);
  });
});
