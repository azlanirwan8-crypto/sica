import { z } from 'zod';

/**
 * Kontrak rute `/api/v1/admin/**` untuk inti identitas (API_SPEC §4.6.9, pemegang M-03).
 *
 * Aturan yang melekat pada seluruh berkas ini:
 *  - `tenantId`/`userId` pengeksekusi TIDAK PERNAH dibaca dari body — hanya dari token
 *    terverifikasi (`SEC-07`).
 *  - Tidak ada satu pun rute yang menulis `user_role_assignments` atau `role_permissions`
 *    langsung. Semua perubahan hak lahir sebagai baris `access_change_requests`
 *    berstatus `PENDING` (`202 { requestId }`) dan baru berlaku setelah ORANG KEDUA
 *    menyetujui (`chk_acr_approver_not_target`, `0082`).
 *  - Kolom `SERVER_ONLY` tidak diterima dari body; karena itu setiap skema `.strict()` —
 *    kunci asing menjadi `422`, bukan kolom yang diam-diam diabaikan.
 */

export const AdminMemberRoleSchema = z.enum(['super_admin', 'tenant_admin', 'dosen', 'mahasiswa', 'staff']);
export type AdminMemberRole = z.infer<typeof AdminMemberRoleSchema>;

/**
 * Carrier yang boleh DITULIS lewat `/api/v1/admin/**`. `super_admin` sengaja tidak ada:
 * ia bukan hak (peran efektif selalu dari `user_role_assignments`), tetapi carrier menentukan
 * arah login & routeset dan perluasan menu lewat `rolesForCarrier` — membiarkan Admin kampus
 * mencetak akun ber-carrier `super_admin` di tenantnya sendiri menghasilkan akun yang
 * terlihat seperti operator platform. Akun platform lahir di jalur R-1, bukan di sini.
 */
export const CampusMemberRoleSchema = z.enum(['tenant_admin', 'dosen', 'mahasiswa', 'staff']);
export type CampusMemberRole = z.infer<typeof CampusMemberRoleSchema>;

/** Alasan sensitif: ≥ 10 karakter, sama seperti register platform (`PlatformReasonSchema`). */
export const AdminReasonSchema = z.string().min(10).max(500);

/** Lingkup penugasan — kunci identik `AssignmentScope` di resolver (`rbac-resolver.ts`). */
export const AssignmentScopeSchema = z
  .object({
    orgId: z.string().uuid().nullable().optional(),
    programId: z.string().uuid().nullable().optional(),
    classId: z.string().uuid().nullable().optional(),
    periodId: z.string().uuid().nullable().optional(),
    studentId: z.string().uuid().nullable().optional(),
  })
  .strict();
export type AssignmentScopeInput = z.infer<typeof AssignmentScopeSchema>;

// ── Daftar pengguna (list §2.4) ───────────────────────────────────────────────
export const AdminUserListQuerySchema = z.object({
  q: z.string().min(1).max(120).optional(),
  /** Status akun global (`users.status`), bukan status keanggotaan tenant. */
  status: z.enum(['ACTIVE', 'LOCKED', 'DISABLED', 'all']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;

export const AdminUserRowSchema = z.object({
  userId: z.string().uuid(),
  membershipId: z.string().uuid(),
  memberCode: z.string(),
  email: z.string(),
  fullName: z.string(),
  memberRole: AdminMemberRoleSchema,
  membershipStatus: z.string(),
  accountStatus: z.string(),
  /** Peran efektif dari `user_role_assignments`, bukan label carrier. */
  roleCodes: z.array(z.string()),
  activeAssignments: z.number().int().min(0),
});
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>;

// ── Pembuatan & perubahan pengguna ────────────────────────────────────────────
export const CreateAdminUserRequestSchema = z
  .object({
    fullName: z.string().min(3).max(120),
    email: z.string().email(),
    memberCode: z.string().min(3).max(64),
    memberRole: CampusMemberRoleSchema,
    initialPassword: z.string().min(12).max(200),
    reason: AdminReasonSchema,
  })
  .strict();
export type CreateAdminUserRequest = z.infer<typeof CreateAdminUserRequestSchema>;

export const CreateAdminUserResponseSchema = z.object({
  userId: z.string().uuid(),
  membershipId: z.string().uuid(),
  /** Sandi awal hanya sekali-tampil; tidak pernah masuk log maupun respons kedua. */
  initialPasswordShownOnce: z.boolean(),
});

export const UpdateAdminUserRequestSchema = z
  .object({
    fullName: z.string().min(3).max(120).optional(),
    email: z.string().email().optional(),
    memberCode: z.string().min(3).max(64).optional(),
    memberRole: CampusMemberRoleSchema.optional(),
    reason: AdminReasonSchema,
  })
  .strict()
  .refine((v) => v.fullName || v.email || v.memberCode || v.memberRole, {
    message: 'Tidak ada field yang diubah.',
    path: ['reason'],
  });
export type UpdateAdminUserRequest = z.infer<typeof UpdateAdminUserRequestSchema>;

export const DeactivateAdminUserRequestSchema = z.object({ reason: AdminReasonSchema }).strict();

// ── Permintaan perubahan hak (satu jalan untuk satu perubahan) ────────────────
export const AccessRequestKindSchema = z.enum(['GRANT', 'REVOKE', 'SCOPE_CHANGE', 'ROLE_PERMISSION_CHANGE']);
export type AccessRequestKind = z.infer<typeof AccessRequestKindSchema>;

export const CreateAccessRequestSchema = z
  .object({
    requestKind: AccessRequestKindSchema,
    targetUserId: z.string().uuid().nullable().optional(),
    roleId: z.string().uuid(),
    scope: AssignmentScopeSchema.default({}),
    /** Penunjuk penugasan yang dicabut/diubah scope-nya — wajib untuk REVOKE/SCOPE_CHANGE. */
    assignmentId: z.string().uuid().optional(),
    /** Hanya untuk ROLE_PERMISSION_CHANGE — delta, bukan daftar penuh. */
    permissionDelta: z
      .object({
        grant: z.array(z.string().uuid()).max(200).default([]),
        revoke: z.array(z.string().uuid()).max(200).default([]),
      })
      .strict()
      .optional(),
    validTo: z.string().datetime().nullable().optional(),
    reason: AdminReasonSchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.requestKind === 'ROLE_PERMISSION_CHANGE') {
      if (v.targetUserId != null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetUserId'], message: 'Harus kosong untuk ROLE_PERMISSION_CHANGE.' });
      }
      if (!v.permissionDelta || (v.permissionDelta.grant.length === 0 && v.permissionDelta.revoke.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['permissionDelta'], message: 'Delta grant/revoke wajib terisi.' });
      }
      if (v.assignmentId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assignmentId'], message: 'Tidak berlaku untuk ROLE_PERMISSION_CHANGE.' });
      }
    } else {
      if (v.targetUserId == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetUserId'], message: 'Wajib untuk GRANT/REVOKE/SCOPE_CHANGE.' });
      }
      const needsPointer = v.requestKind === 'REVOKE' || v.requestKind === 'SCOPE_CHANGE';
      if (needsPointer && !v.assignmentId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assignmentId'], message: 'Wajib menunjuk penugasan yang ada.' });
      }
      if (!needsPointer && v.assignmentId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assignmentId'], message: 'Tidak berlaku untuk GRANT.' });
      }
    }
    if (v.permissionDelta && v.requestKind !== 'ROLE_PERMISSION_CHANGE') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['permissionDelta'], message: 'Hanya untuk ROLE_PERMISSION_CHANGE.' });
    }
  });
export type CreateAccessRequest = z.infer<typeof CreateAccessRequestSchema>;

/** Isi kolom `scope jsonb` — satu bentuk untuk dua kelas permintaan (DATA_MODEL §14.3.3). */
export type AccessRequestPayload =
  | {
      readonly kind: 'ASSIGNMENT';
      readonly scope: AssignmentScopeInput;
      readonly assignmentId?: string;
      readonly validTo?: string | null;
    }
  | { readonly kind: 'ROLE_PERMISSION'; readonly grant: readonly string[]; readonly revoke: readonly string[] };

export const AccessRequestViewSchema = z.object({
  requestId: z.string().uuid(),
  requestKind: z.string(),
  targetUserId: z.string().uuid().nullable(),
  roleId: z.string().uuid(),
  roleCode: z.string(),
  scope: z.record(z.unknown()),
  status: z.string(),
  reason: z.string(),
  requesterId: z.string().uuid(),
  approverId: z.string().uuid().nullable(),
  decisionReason: z.string().nullable(),
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
});
export type AccessRequestView = z.infer<typeof AccessRequestViewSchema>;

export const RejectAccessRequestSchema = z.object({ reason: AdminReasonSchema }).strict();

/** Menyetujui boleh tanpa catatan; bila ada, panjangnya mengikuti norma alasan. */
export const ApproveAccessRequestSchema = z
  .object({ reason: z.string().min(10).max(500).optional() })
  .strict();

/**
 * Body `PUT /admin/hak-akses/peran/:id/izin` — delta, BUKAN daftar penuh.
 * Ini hanya mengajukan; `role_permissions` tidak berubah sampai orang kedua menyetujui
 * (`identity.accessrequest.approve`, empat-mata).
 */
export const RolePermissionDeltaRequestSchema = z
  .object({
    grant: z.array(z.string().uuid()).max(200).default([]),
    revoke: z.array(z.string().uuid()).max(200).default([]),
    reason: AdminReasonSchema,
  })
  .strict()
  .refine((v) => v.grant.length > 0 || v.revoke.length > 0, {
    message: 'Delta kosong: tidak ada yang diubah.',
    path: ['grant'],
  })
  .refine((v) => v.grant.every((id) => !v.revoke.includes(id)), {
    message: 'Satu izin tidak dapat di-grant dan di-revoke sekaligus.',
    path: ['revoke'],
  });
export type RolePermissionDeltaRequest = z.infer<typeof RolePermissionDeltaRequestSchema>;

/** Keputusan empat-mata: body hanya `reason` (untuk penolakan) — status TIDAK diterima dari klien. */
export const DecideAccessRequestResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['APPROVED', 'REJECTED']),
  decidedAt: z.string(),
  /** Ringkasan efek yang baru saja lahir — kosong pada penolakan. */
  effect: z.string(),
});

export const AccessRequestListQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'all']).optional(),
  requestKind: AccessRequestKindSchema.optional(),
  /** `MINE` = hanya baris yang diajukan aktor; default = seluruh tenant bagi pemegang VIEW. */
  perspective: z.enum(['MINE', 'TENANT']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AccessRequestListQuery = z.infer<typeof AccessRequestListQuerySchema>;

// ── Penugasan & peran (tulis & baca) ─────────────────────────────────────────
/**
 * Body `POST /admin/hak-akses/penugasan` — mengajukan GRANT (bukan memberi).
 * Bentuknya sengaja mengikuti §4.6.9 (`userId`, `roleId`, `scope`, `validTo?`, `reason`);
 * `request_kind` disimpulkan rute, supaya klien tidak bisa memilih jenis lain di sini.
 */
export const GrantAssignmentRequestSchema = z
  .object({
    userId: z.string().uuid(),
    roleId: z.string().uuid(),
    scope: AssignmentScopeSchema.default({}),
    validTo: z.string().datetime().nullable().optional(),
    reason: AdminReasonSchema,
  })
  .strict();
export type GrantAssignmentRequest = z.infer<typeof GrantAssignmentRequestSchema>;

/** Query `DELETE` yang beralasan (penugasan, peran) — alasan wajib ≥ 10 karakter. */
export const ReasonQuerySchema = z.object({ reason: AdminReasonSchema });

export const AdminAssignmentListQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  includeExpired: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminAssignmentListQuery = z.infer<typeof AdminAssignmentListQuerySchema>;

// ── Peran (tulis) ────────────────────────────────────────────────────────────
/**
 * `POST /admin/hak-akses/peran` — membuat peran KOSTUM. `is_system` tidak dapat
 * diminta: selalu `false`. Izin TIDAK ikut di sini; komposisi peran hanya berubah
 * lewat `PUT …/izin` yang menghasilkan permintaan empat-mata.
 */
export const CreateRoleRequestSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(48)
      .regex(/^[A-Z][A-Z0-9_]*$/, 'Kode peran harus UPPER_SNAKE inggris'),
    displayName: z.string().min(3).max(120),
    scopeKind: z.enum(['TENANT', 'ORG', 'PROGRAM', 'CLASS', 'PERIOD', 'SELF']),
    reason: AdminReasonSchema,
  })
  .strict();
export type CreateRoleRequest = z.infer<typeof CreateRoleRequestSchema>;

/** `PATCH /admin/hak-akses/peran/:id` — HANYA nama tampil; kode & lingkup bersifat tetap. */
export const UpdateRoleRequestSchema = z
  .object({ displayName: z.string().min(3).max(120), reason: AdminReasonSchema })
  .strict();
export type UpdateRoleRequest = z.infer<typeof UpdateRoleRequestSchema>;

// ── Peran & penugasan (baca) ──────────────────────────────────────────────────
export const AdminRoleRowSchema = z.object({
  roleId: z.string().uuid(),
  code: z.string(),
  displayName: z.string(),
  scopeKind: z.string(),
  isSystem: z.boolean(),
  holderCount: z.number().int().min(0),
  permissionCount: z.number().int().min(0),
});
export type AdminRoleRow = z.infer<typeof AdminRoleRowSchema>;

export const AdminAssignmentRowSchema = z.object({
  assignmentId: z.string().uuid(),
  userId: z.string().uuid(),
  fullName: z.string(),
  roleId: z.string().uuid(),
  roleCode: z.string(),
  scopeKind: z.string(),
  scope: z.record(z.unknown()),
  origin: z.string(),
  validFrom: z.string(),
  validTo: z.string().nullable(),
  active: z.boolean(),
});
export type AdminAssignmentRow = z.infer<typeof AdminAssignmentRowSchema>;

export const AdminPermissionRowSchema = z.object({
  permissionId: z.string().uuid(),
  code: z.string(),
  module: z.string(),
  resource: z.string(),
  verb: z.string(),
  description: z.string().nullable(),
});
export type AdminPermissionRow = z.infer<typeof AdminPermissionRowSchema>;

// ── Master organisasi & program studi (Fase 1B item 4, `R-2`) ─────────────────
/**
 * Kelas organisasi tertutup — nilai ini adalah **kelas A** (AGENTS §3.10): ia
 * dicabangi kode (lingkup penugasan `ORG` menunjuk baris `organizations`), jadi
 * tetap enum PostgreSQL + enum Zod, bukan kamus yang bisa ditambah kampus.
 * Fakultas/program studi nyata adalah BARIS, bukan nama kelas baru.
 */
export const OrganizationKindSchema = z.enum(['HQ', 'FACULTY', 'DEPARTMENT', 'UNIT', 'LIBRARY']);
export type OrganizationKind = z.infer<typeof OrganizationKindSchema>;

export const AdminOrganizationRowSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  kind: OrganizationKindSchema,
  name: z.string(),
  code: z.string().nullable(),
  /** Jumlah anak + prodi: dipakai layar untuk menjelaskan mengapa hapus ditolak, bukan untuk penegakan. */
  childCount: z.number().int().min(0),
  programCount: z.number().int().min(0),
});
export type AdminOrganizationRow = z.infer<typeof AdminOrganizationRowSchema>;

/** Alasan wajib: perubahan struktur organisasi adalah objek kepatuhan, bukan edit biasa. */
export const CreateOrganizationRequestSchema = z
  .object({
    parentId: z.string().uuid().nullable().optional(),
    kind: OrganizationKindSchema,
    name: z.string().min(2).max(160),
    code: z.string().min(1).max(32).nullable().optional(),
    reason: AdminReasonSchema,
  })
  .strict();
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>;

export const UpdateOrganizationRequestSchema = z
  .object({
    parentId: z.string().uuid().nullable().optional(),
    kind: OrganizationKindSchema.optional(),
    name: z.string().min(2).max(160).optional(),
    code: z.string().min(1).max(32).nullable().optional(),
    reason: AdminReasonSchema,
  })
  .strict()
  .refine((v) => v.parentId !== undefined || v.kind !== undefined || v.name !== undefined || v.code !== undefined, {
    message: 'Tidak ada field yang diubah.',
    path: ['reason'],
  });
export type UpdateOrganizationRequest = z.infer<typeof UpdateOrganizationRequestSchema>;

/**
 * Jenjang program studi = kelas A juga: `level` menentukan aturan beban studi dan
 * kode kirim Feeder, sehingga tidak boleh menjadi data yang disunting saat runtime.
 */
export const StudyProgramLevelSchema = z.enum(['D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3', 'PROFESI', 'SPESIALIS']);
export type StudyProgramLevel = z.infer<typeof StudyProgramLevelSchema>;

export const AdminStudyProgramRowSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid().nullable(),
  orgName: z.string().nullable(),
  name: z.string(),
  code: z.string().nullable(),
  pddiktiCode: z.string().nullable(),
  level: StudyProgramLevelSchema,
  minTotalSks: z.string(),
  nominalStudySemesters: z.number().int(),
  maxStudySemesters: z.number().int(),
  graduationMinIpk: z.string(),
  accreditationStatus: z.string().nullable(),
});
export type AdminStudyProgramRow = z.infer<typeof AdminStudyProgramRowSchema>;

const SksSchema = z.coerce.number().min(1).max(300);
const SemesterSchema = z.coerce.number().int().min(1).max(24);

/**
 * Batas di bawah adalah **batas rekayasa**, bukan kutipan regulasi: nilainya dijaga
 * `CHECK` di DB hanya untuk `level`/`delivery_mode`. Angka akademik yang dapat
 * ditetapkan kampus (beban SKS, masa studi, ambang IPK) sengaja menjadi DATA —
 * itulah janji "konfigurasi > kustomisasi kode" — dan setiap perubahannya tercatat
 * beralasan di `audit_logs`.
 */
const ProgramFieldsSchema = z
  .object({
    orgId: z.string().uuid().nullable().optional(),
    name: z.string().min(2).max(160),
    code: z.string().min(1).max(32).nullable().optional(),
    pddiktiCode: z.string().min(1).max(32).nullable().optional(),
    level: StudyProgramLevelSchema,
    minTotalSks: SksSchema,
    nominalStudySemesters: SemesterSchema,
    maxStudySemesters: SemesterSchema,
    graduationMinIpk: z.coerce.number().min(0).max(4),
    accreditationStatus: z.string().max(40).nullable().optional(),
  })
  .strict();

const masaStudiSah = (v: { nominalStudySemesters: number; maxStudySemesters: number }) =>
  v.maxStudySemesters >= v.nominalStudySemesters;

/**
 * `reason` ikut di dalam objek, bukan di-`and()`kan: intersection Zod memvalidasi
 * tiap sisi secara terpisah, sehingga sisi `.strict()` yang tidak mengenal `reason`
 * menolak body yang sebenarnya sah (`Unrecognized key(s) in object: 'reason'`).
 */
export const CreateStudyProgramRequestSchema = ProgramFieldsSchema.extend({ reason: AdminReasonSchema })
  .strict()
  .refine(masaStudiSah, {
    message: 'Masa studi maksimum tidak boleh lebih kecil dari masa studi normal.',
    path: ['maxStudySemesters'],
  });
export type CreateStudyProgramRequest = z.infer<typeof CreateStudyProgramRequestSchema>;

/** PATCH: semua field opsional, tetapi penjaga masa studi tetap berlaku bila KEDUANYA dikirim. */
export const UpdateStudyProgramRequestSchema = z
  .object({
    orgId: z.string().uuid().nullable().optional(),
    name: z.string().min(2).max(160).optional(),
    code: z.string().min(1).max(32).nullable().optional(),
    pddiktiCode: z.string().min(1).max(32).nullable().optional(),
    level: StudyProgramLevelSchema.optional(),
    minTotalSks: SksSchema.optional(),
    nominalStudySemesters: SemesterSchema.optional(),
    maxStudySemesters: SemesterSchema.optional(),
    graduationMinIpk: z.coerce.number().min(0).max(4).optional(),
    accreditationStatus: z.string().max(40).nullable().optional(),
    reason: AdminReasonSchema,
  })
  .strict()
  .refine(
    (v) => Object.keys(v).some((k) => k !== 'reason'),
    { message: 'Tidak ada field yang diubah.', path: ['reason'] }
  )
  .refine(
    (v) =>
      v.nominalStudySemesters === undefined ||
      v.maxStudySemesters === undefined ||
      masaStudiSah(v as { nominalStudySemesters: number; maxStudySemesters: number }),
    { message: 'Masa studi maksimum tidak boleh lebih kecil dari masa studi normal.', path: ['maxStudySemesters'] }
  );
export type UpdateStudyProgramRequest = z.infer<typeof UpdateStudyProgramRequestSchema>;
