/**
 * Kontrak Mesin Parameter Sistem Dinamis (`API_SPEC §4.16`, `DATA_MODEL §21.2/§21.2.1`,
 * pemegang M-02 / Fase 1B item 3).
 *
 * Dua hal yang dibuat berkas ini, dan keduanya murni (tanpa I/O) supaya penjaga transport
 * dapat diuji tanpa database:
 *  1. Skema Zod `.strict()` — kunci asing menjadi `422`, bukan kolom yang diabaikan diam-diam
 *     (`AGENTS §3.3`, `§4.16.6` L1). Semua kolom `SERVER_ONLY` gugus ini ditolak di sini.
 *  2. Penjaga nilai (§4.16.2 sembilan langkah, sebagian) — kanonisasi tipe, rentang, himpunan
 *     sah, dan deteksi bentuk kredensial. Sisi "DAN DB" dari `AC-PG-4` ditegakkan `CHECK`
 *     pada `0049`/`0086`/`0088`, bukan oleh fungsi ini; keduanya diuji TERPISAH.
 *
 * Yang tidak ada di sini: daftar nilai yang dapat disunting. Sumber daftar adalah kamus
 * (`enum_kind` → `reference_items`) atau `CHECK` kolom (`DATA_MODEL §21.1` penutup) —
 * mengirim `allowedValues`/`values` dari klien ditolak, karena itu berarti klien yang
 * menentukan batasnya sendiri.
 */
import { z } from 'zod';
import { PERM, type PermissionCode } from './authz';
import {
  PARAMETER_DATA_TYPES,
  PARAMETER_MODULE_CODES,
  PARAMETER_RISK_CLASSES,
  requiresSecondApprover,
  type ParameterDataType,
  type ParameterModuleCode,
  type ParameterRiskClass,
  type SystemParameterDefinition,
} from './parameter-keys';

const ReasonSchema = z.string().min(10).max(500);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ParameterModuleCodeSchema = z.enum(PARAMETER_MODULE_CODES);
export const ParameterDataTypeSchema = z.enum(PARAMETER_DATA_TYPES);
export const ParameterRiskClassSchema = z.enum(PARAMETER_RISK_CLASSES);

/**
 * Peta kelas risiko → kode izin (`RBAC_MATRIX §4.5` baris 146–157 + 375–379).
 *
 * Ditulis di sini (bukan di service, bukan di layar) karena READ dan WRITE harus memakai
 * sumber yang sama: layar yang menebak namanya sendiri adalah cara tercepat memproduksi
 * tombol yang servernya tolak — dan sebaliknya.
 */
export const PARAM_VIEW_PERMISSION: Readonly<Record<ParameterRiskClass, PermissionCode>> = {
  TECHNICAL: PERM.settingsParamViewTechnical,
  OPS: PERM.settingsParamViewOps,
  ACADEMIC: PERM.settingsParamViewAcademic,
  FINANCIAL: PERM.settingsParamViewFinancial,
  REGULATORY: PERM.settingsParamViewRegulatory,
  SECURITY: PERM.settingsParamViewSecurity,
};

export const PARAM_EDIT_PERMISSION: Readonly<Record<ParameterRiskClass, PermissionCode>> = {
  TECHNICAL: PERM.settingsParamEditTechnical,
  OPS: PERM.settingsParamEditOps,
  ACADEMIC: PERM.settingsParamEditAcademic,
  FINANCIAL: PERM.settingsParamEditFinancial,
  REGULATORY: PERM.settingsParamEditRegulatory,
  SECURITY: PERM.settingsParamEditSecurity,
};

/** Hanya dua kelas yang punya penyetuju; kelas lain berlaku langsung (`§4.16.2`). */
export const PARAM_APPROVE_PERMISSION: Readonly<Partial<Record<ParameterRiskClass, PermissionCode>>> = {
  REGULATORY: PERM.settingsParamApproveRegulatory,
  SECURITY: PERM.settingsParamApproveSecurity,
};

/** `applies_to` (§4.16.2) — id selalu UUID dan selalu diselesaikan di dalam transaksi (anti-IDOR). */
export const ParameterAppliesToSchema = z
  .object({
    programIds: z.array(z.string().uuid()).max(50).optional(),
    sites: z.array(z.string().uuid()).max(50).optional(),
    programTypes: z.array(z.string().max(32)).max(20).optional(),
    periods: z.array(z.string().uuid()).max(20).optional(),
  })
  .strict();
export type ParameterAppliesTo = z.infer<typeof ParameterAppliesToSchema>;

/** Body tulis nilai — satu skema untuk `PUT` dan `request-approval` (satu jalur, tidak ada jalur kedua). */
export const SystemParameterWriteBodySchema = z
  .object({
    value: z.union([z.string().max(4000), z.number(), z.boolean()]),
    appliesTo: ParameterAppliesToSchema.optional(),
    effectiveFrom: IsoDate.optional(),
    effectiveTo: IsoDate.nullable().optional(),
    reason: ReasonSchema,
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export type SystemParameterWriteBody = z.infer<typeof SystemParameterWriteBodySchema>;

export const SystemParameterListQuerySchema = z
  .object({
    module: ParameterModuleCodeSchema.optional(),
    riskClass: ParameterRiskClassSchema.optional(),
    q: z.string().min(1).max(80).optional(),
    at: IsoDate.optional(),
    includeInactive: z.coerce.boolean().default(false),
    editableOnly: z.coerce.boolean().default(false),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    sortBy: z.enum(['parameterKey', 'moduleCode', 'riskClass', 'version', 'updatedAt']).default('parameterKey'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();
export type SystemParameterListQuery = z.infer<typeof SystemParameterListQuerySchema>;

export const ParameterApprovalListQuerySchema = z
  .object({
    state: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'all']).default('PENDING'),
    parameterKey: z.string().min(1).max(128).optional(),
    from: IsoDate.optional(),
    to: IsoDate.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
  .refine((q) => !(q.from && q.to && q.to < q.from), { message: 'to < from', path: ['to'] });
export type ParameterApprovalListQuery = z.infer<typeof ParameterApprovalListQuerySchema>;

export const ApproveParameterSchema = z.object({ reason: ReasonSchema.optional() }).strict();
export const RejectParameterSchema = z.object({ reason: ReasonSchema }).strict();

/** §4.16.3 `history` — filter ISO wajib, `to < from` = `422 VALIDATION_FAILED` (6). */
export const ParameterHistoryQuerySchema = z
  .object({
    from: IsoDate.optional(),
    to: IsoDate.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict()
  .refine((q) => !(q.from && q.to && q.to < q.from), { message: 'to < from', path: ['to'] });
export type ParameterHistoryQuery = z.infer<typeof ParameterHistoryQuerySchema>;

/**
 * §4.16.3 `GET /admin/system-parameters/{key}` — hanya `?at=` yang mengubah bacaan.
 * Didaftarkan sebagai skema sendiri karena mengabaikan tanggal yang tidak sah (mis.
 * `31-12-2020`) berarti menjawab nilai HARI INI atas pertanyaan yang bertanya tentang
 * masa lalu; `BR-R12` menuntut jawaban yang jujur, jadi transport yang menolak.
 */
export const SystemParameterReadQuerySchema = z
  .object({ at: IsoDate.optional() })
  .strict();
export type SystemParameterReadQuery = z.infer<typeof SystemParameterReadQuerySchema>;

/** Toggle wajib `expectedVersion`: tanpa itu dua klik "matikan" dapat bertukar keadaan. */
export const ToggleActiveBodySchema = z
  .object({ isActive: z.boolean(), reason: ReasonSchema, expectedVersion: z.number().int().positive() })
  .strict();
export type ToggleActiveBody = z.infer<typeof ToggleActiveBodySchema>;

export const RevertParameterBodySchema = z
  .object({
    toVersion: z.number().int().positive().optional(),
    toDefault: z.boolean().optional(),
    reason: ReasonSchema,
    expectedVersion: z.number().int().positive(),
  })
  .strict()
  .refine((b) => (b.toVersion === undefined) !== (b.toDefault === undefined), {
    message: 'toVersion ATAU toDefault (salah satu, bukan keduanya)',
  });
export type RevertParameterBody = z.infer<typeof RevertParameterBodySchema>;

/** §4.16.4 — kunci baru lahir di sini (VALIDATE + empat-mata), bukan lewat `POST` bebas. */
export const RegisterParameterBodySchema = z
  .object({
    module: ParameterModuleCodeSchema,
    parameterKey: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_*]+)+$/).max(128),
    dataType: ParameterDataTypeSchema,
    unit: z.string().max(16).nullable().optional(),
    defaultValue: z.string().max(4000),
    minValue: z.string().max(32).nullable().optional(),
    maxValue: z.string().max(32).nullable().optional(),
    enumKind: z.string().max(64).nullable().optional(),
    description: z.string().min(20).max(1000),
    riskClass: ParameterRiskClassSchema,
    appliesTo: z.record(z.string(), z.unknown()).default({}),
    requiresRestart: z.literal(false).default(false),
    consumerEvidence: z
      .object({
        callSites: z.array(z.string().max(200)).min(1).max(20),
        testRef: z.string().max(200),
      })
      .strict(),
    reason: ReasonSchema,
  })
  .strict();
export type RegisterParameterBody = z.infer<typeof RegisterParameterBodySchema>;

/** §4.16.5 — kontrak baca klien. Tanpa body, tanpa `tenantId`. */
export const EffectiveSettingsQuerySchema = z
  .object({
    keys: z
      .string()
      .min(1)
      .max(2000)
      .transform((s) => s.split(',').map((k) => k.trim()).filter(Boolean))
      .refine((a) => a.length >= 1 && a.length <= 40, '1..40 kunci per permintaan'),
    module: ParameterModuleCodeSchema.optional(),
    scopeHint: z.enum(['SELF', 'CLASS', 'PROGRAM']).optional(),
  })
  .strict();
export type EffectiveSettingsQuery = z.infer<typeof EffectiveSettingsQuerySchema>;

/** Pola grant parameter (§4.16.4) — mengikat kode ke kunci, tidak pernah menciptakannya. */
export const ParameterPatternBodySchema = z
  .object({
    patterns: z
      .array(
        z
          .object({
            parameterPattern: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_*]+)+$/).max(128),
            permissionCode: z.string().min(3).max(128),
            effect: z.enum(['ALLOW', 'DENY']),
            minScope: z.enum(['TENANT', 'ORG', 'SITE', 'PROGRAM']),
            requiresMfa: z.boolean().default(false),
            requiresSecondApprover: z.boolean().default(false),
            note: z.string().min(10).max(500),
            validFrom: IsoDate.optional(),
            validTo: IsoDate.nullable().optional(),
          })
          .strict()
      )
      .max(100),
    reason: ReasonSchema,
  })
  .strict();
export type ParameterPatternBody = z.infer<typeof ParameterPatternBodySchema>;

// ── Proyeksi baca ────────────────────────────────────────────────────────────
export const SystemParameterViewSchema = z.object({
  parameterKey: z.string(),
  module: z.string(),
  dataType: z.string(),
  unit: z.string().nullable(),
  currentValue: z.string().nullable(),
  /** Proyeksi bertipe: `numeric`/boolean/objek JSON untuk klien; keputusan tetap di server (§4.16.5). */
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.string(), z.unknown())]),
  defaultValue: z.string(),
  min: z.string().nullable(),
  max: z.string().nullable(),
  allowedValues: z.array(z.string()).nullable(),
  effective: z.object({
    from: z.string().nullable(),
    to: z.string().nullable(),
    appliesTo: z.record(z.string(), z.unknown()),
    isEffectiveNow: z.boolean(),
  }),
  riskClass: z.string(),
  version: z.number().int(),
  isEditable: z.boolean(),
  isActive: z.boolean(),
  isSecret: z.boolean(),
  requiresRestart: z.boolean(),
  requiresSecondApprover: z.boolean(),
  sourceOfTruth: z.string(),
  enumKind: z.string().nullable(),
  /**
   * Item kamus untuk `enumKind`, dibaca server dari `reference_items` pada tanggal itu.
   * Diralat 2026-10-23: `UI_UX §14.2` mewajibkan opsi editor datang dari kamus, dan rute
   * kamus umum (`GET /master/lookups`) belum dibangun (gugus `MDE-*`). Ini BUKAN sumber
   * kedua — ia proyeksi baris `reference_items` yang sama; klien tidak pernah mengarang
   * daftar, dan tidak pernah mengirimnya di body (`§4.16.2`).
   */
  enumOptions: z.array(z.object({ code: z.string(), label: z.string() })).nullable(),
  description: z.string(),
  requestedBy: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  updatedAt: z.string(),
  pendingValue: z.string().nullable(),
  pendingApprovalId: z.string().nullable(),
  updateDisabledReason: z.string().nullable(),
  /**
   * Proyeksi aksi yang boleh dilakukan AKTOR INI pada baris ini (`G-18`). Ditulis server dari
   * izin kelas + `is_editable` + `source_of_truth`; layar tidak pernah menebak dari nama peran,
   * dan tombol yang tidak ada di daftar ini TIDAK dirender (bukan disembunyikan CSS).
   */
  allowedActions: z.array(
    z.enum(['view', 'write', 'request-approval', 'revert', 'toggle', 'approve', 'history', 'impact', 'register'])
  ),
  remedyHref: z.string().nullable(),
  consumerCount: z.number().int(),
});
export type SystemParameterView = z.infer<typeof SystemParameterViewSchema>;

export const ParameterApprovalViewSchema = z.object({
  approvalId: z.string(),
  parameterKey: z.string(),
  moduleCode: z.string(),
  state: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']),
  previousValue: z.string(),
  proposedValue: z.string(),
  previousVersion: z.number().int(),
  appliesTo: z.record(z.string(), z.unknown()),
  effectiveFrom: z.string().nullable(),
  effectiveTo: z.string().nullable(),
  reason: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string(),
  approverId: z.string().nullable(),
  decidedAt: z.string().nullable(),
  decisionReason: z.string().nullable(),
  requiresSecondApprover: z.boolean(),
  riskClass: z.string().nullable(),
});
export type ParameterApprovalView = z.infer<typeof ParameterApprovalViewSchema>;

export const ParameterHistoryViewSchema = z.object({
  historyId: z.string(),
  parameterKey: z.string(),
  moduleCode: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string(),
  oldVersion: z.number().int().nullable(),
  newVersion: z.number().int(),
  changedBy: z.string().nullable(),
  approverId: z.string().nullable(),
  reason: z.string(),
  ip: z.string().nullable(),
  source: z.string(),
  occurredAt: z.string(),
});
export type ParameterHistoryView = z.infer<typeof ParameterHistoryViewSchema>;

export const EffectiveSettingSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.string(), z.unknown())]),
  dataType: z.string(),
  unit: z.string().nullable(),
  source: z.enum(['TENANT_PARAM', 'SCOPE_PARAM', 'DEFAULT', 'DERIVED']),
  version: z.number().int(),
  riskClass: z.string(),
  enumKind: z.string().nullable(),
  enumLabel: z.string().nullable(),
  masked: z.boolean().optional(),
  maskedReason: z.string().nullable().optional(),
  pendingValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  pendingRestart: z.boolean().optional(),
});
export type EffectiveSetting = z.infer<typeof EffectiveSettingSchema>;

// =============================================================================
// Penjaga transport murni (§4.16.2 langkah 2–4, 7)
// =============================================================================

export type ParameterGuardFailure =
  | { readonly kind: 'PARAM_INVALID_TYPE'; readonly reason: string }
  | { readonly kind: 'PARAM_OUT_OF_RANGE'; readonly sent: string; readonly min: string | null; readonly max: string | null }
  | { readonly kind: 'PARAM_VALUE_NOT_ALLOWED'; readonly allowed: readonly string[]; readonly sent: string }
  | { readonly kind: 'PARAM_ENUM_UNKNOWN'; readonly enumKind: string; readonly sent: string }
  | { readonly kind: 'PARAM_SECRET_FORBIDDEN' };

const NUMERIC_TYPES: ReadonlySet<ParameterDataType> = new Set(['INT', 'DECIMAL', 'PCT', 'BP', 'SECONDS', 'METERS']);
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;
const BOOL_CANONIC: Readonly<Record<string, 'true' | 'false'>> = {
  true: 'true', false: 'false', 1: 'true', 0: 'false',
};

/** Bentuk kredensial — nilai yang lolos dianggap rahasia bila salah satu pola cocok (§4.16.2 langkah 7). */
const CREDENTIAL_SHAPES: readonly RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._\-]{8,}/i,
  /^-----BEGIN [A-Z ]*PRIVATE KEY/,
  /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis|amqp):\/\/[^\s/]*:[^\s/]*@/i,
  /\b(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{20,})\b/,
  /\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{5,}\.[A-Za-z0-9_\-]{5,}\b/,
  /["']?(password|passwd|client_secret|api_?key|secret_?key|private_?key|hmac_secret)["']?\s*[:=]/i,
];

export function looksLikeCredential(value: string): boolean {
  return CREDENTIAL_SHAPES.some((shape) => shape.test(value));
}

/** Kawatkan nilai klien (`number`/`boolean`/`string`) menjadi teks kolom `parameter_value`. */
export function canonicalize(raw: string | number | boolean): string {
  if (typeof raw === 'boolean') return raw ? 'true' : 'false';
  if (typeof raw === 'number') return Number.isInteger(raw) ? String(raw) : raw.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return raw.trim();
}

/**
 * Kanonisasi + validasi tipe. `numeric`/basis-poin sebagai teks desimal — `float` JS tidak
 * pernah menjadi bentuk kanonik yang disimpan (`AGENTS §3.4` paritas Web↔Flutter).
 */
export function coerceByType(dataType: ParameterDataType, sent: string): ParameterGuardFailure | string {
  if (/[\u0000-\u001F\u007F]/.test(sent)) {
    return { kind: 'PARAM_INVALID_TYPE', reason: 'nilai tidak boleh mengandung karakter kontrol' };
  }
  if (sent.length > 4000) {
    return { kind: 'PARAM_INVALID_TYPE', reason: 'nilai melebihi 4000 karakter' };
  }

  switch (dataType) {
    case 'STRING':
    case 'REGEX':
    case 'DATE':
    case 'TIME':
    case 'CRON':
    case 'SECONDS':
    case 'METERS':
    case 'INT':
    case 'DECIMAL':
    case 'PCT':
    case 'BP': {
      if (!NUMERIC_TYPES.has(dataType)) {
        if (dataType === 'DATE' && !/^\d{4}-\d{2}-\d{2}$/.test(sent)) {
          return { kind: 'PARAM_INVALID_TYPE', reason: 'DATE wajib YYYY-MM-DD' };
        }
        if (dataType === 'TIME' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(sent)) {
          return { kind: 'PARAM_INVALID_TYPE', reason: 'TIME wajib HH:MM' };
        }
        if (dataType === 'CRON' && sent.split(/\s+/).length !== 5) {
          return { kind: 'PARAM_INVALID_TYPE', reason: 'CRON wajib 5 field' };
        }
        if (dataType === 'REGEX') {
          if (sent.length > 128) return { kind: 'PARAM_INVALID_TYPE', reason: 'REGEX dibatasi 128 karakter' };
          try {
            void new RegExp(sent);
          } catch {
            return { kind: 'PARAM_INVALID_TYPE', reason: 'REGEX tidak dapat dikompilasi' };
          }
        }
        if (sent.length === 0) return { kind: 'PARAM_INVALID_TYPE', reason: 'nilai wajib terisi' };
        return sent;
      }
      if (!DECIMAL_RE.test(sent)) {
        return { kind: 'PARAM_INVALID_TYPE', reason: `${dataType} wajib angka desimal` };
      }
      if (dataType === 'INT' && !/^-?\d+$/.test(sent)) {
        return { kind: 'PARAM_INVALID_TYPE', reason: 'INT wajib bilangan bulat' };
      }
      const numeric = Number(sent);
      // Batas 0..100 / 0..10.000 adalah milik TIPE, tetapi bentuk kegagalannya tetap
      // "nilai di luar rentang" — operator butuh membaca `107 PARAM_OUT_OF_RANGE` beserta
      // min/max, bukan `109 PARAM_INVALID_TYPE` yang terdengar seperti salah ketik format.
      if (dataType === 'PCT' && (numeric < 0 || numeric > 100)) {
        return { kind: 'PARAM_OUT_OF_RANGE', sent, min: '0', max: '100' };
      }
      if (dataType === 'BP' && (numeric < 0 || numeric > 10000)) {
        return { kind: 'PARAM_OUT_OF_RANGE', sent, min: '0', max: '10000' };
      }
      return sent;
    }
    case 'BOOL': {
      const canon = BOOL_CANONIC[sent.toLowerCase()];
      return canon ?? { kind: 'PARAM_INVALID_TYPE', reason: 'BOOL wajib true/false' };
    }
    case 'JSON': {
      try {
        const parsed: unknown = JSON.parse(sent);
        if (parsed === null) return { kind: 'PARAM_INVALID_TYPE', reason: 'JSON wajib terisi' };
        return JSON.stringify(parsed);
      } catch {
        return { kind: 'PARAM_INVALID_TYPE', reason: 'JSON tidak sah' };
      }
    }
  }
}

/** Perbandingan rentang sebagai angka (bukan string) — §4.16.2 langkah 3. */
export function checkRange(
  dataType: ParameterDataType,
  sent: string,
  min: string | null,
  max: string | null
): ParameterGuardFailure | null {
  if (min === null && max === null) return null;
  if (NUMERIC_TYPES.has(dataType)) {
    const value = Number(sent);
    if (min !== null && value < Number(min)) return { kind: 'PARAM_OUT_OF_RANGE', sent, min, max };
    if (max !== null && value > Number(max)) return { kind: 'PARAM_OUT_OF_RANGE', sent, min, max };
    return null;
  }
  // DATE/TIME/TIME-like: ISO dapat dibandingkan sebagai teks; tipe lain tidak punya rentang bermakna.
  const isoLike = dataType === 'DATE' || dataType === 'TIME';
  if (isoLike) {
    if (min !== null && sent < min) return { kind: 'PARAM_OUT_OF_RANGE', sent, min, max };
    if (max !== null && sent > max) return { kind: 'PARAM_OUT_OF_RANGE', sent, min, max };
  }
  return null;
}

/** Himpunan sah yang juga ditegakkan CHECK DB (`§21.1` penutup). */
export function checkAllowedValues(
  allowed: readonly string[] | null,
  sent: string
): ParameterGuardFailure | null {
  if (!allowed) return null;
  return allowed.includes(sent)
    ? null
    : { kind: 'PARAM_VALUE_NOT_ALLOWED', allowed, sent };
}

/** Nilai `enum_kind` wajib anggota kamus — `codes` dibaca service dari `reference_items`. */
export function checkEnumMember(
  enumKind: string | null,
  codes: readonly string[],
  sent: string
): ParameterGuardFailure | null {
  if (!enumKind) return null;
  return codes.includes(sent) ? null : { kind: 'PARAM_ENUM_UNKNOWN', enumKind, sent };
}

/** Penjaga JSON per kunci yang menuntut struktur, bukan sekadar "bisa di-parse" (§21.3 butir 14/33/36). */
const CHAIN_TOKENS: readonly string[] = ['BUILTIN_LMS', 'BBB', 'JITSI', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'ZOOM'];
const GEO_SOURCES: readonly string[] = ['CLIENT_GEO', 'GEOIP_DB', 'SITE_GEO'];
const ANOMALY_DOMAINS: readonly string[] = ['ATTENDANCE', 'FINANCE', 'TRAFFIC'];

export function checkJsonShape(key: string, sent: string): ParameterGuardFailure | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(sent);
  } catch {
    return { kind: 'PARAM_INVALID_TYPE', reason: 'JSON tidak sah' };
  }
  const uniqueStrings = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((i) => typeof i === 'string') && new Set(v).size === v.length;

  if (key === 'conference.fallback_chain') {
    if (!uniqueStrings(parsed) || parsed.length < 1 || parsed.length > 6 || !parsed.every((t) => CHAIN_TOKENS.includes(t))) {
      return { kind: 'PARAM_VALUE_NOT_ALLOWED', allowed: CHAIN_TOKENS, sent };
    }
    return null;
  }
  if (key === 'analytics.map.geo_source_priority') {
    if (!uniqueStrings(parsed) || parsed.length !== GEO_SOURCES.length || !parsed.every((s) => GEO_SOURCES.includes(s))) {
      return { kind: 'PARAM_VALUE_NOT_ALLOWED', allowed: GEO_SOURCES, sent };
    }
    return null;
  }
  if (key === 'ai.anomaly.enabled_domains') {
    if (!uniqueStrings(parsed) || !parsed.every((d) => ANOMALY_DOMAINS.includes(d))) {
      return { kind: 'PARAM_VALUE_NOT_ALLOWED', allowed: ANOMALY_DOMAINS, sent };
    }
    return null;
  }
  return null;
}

/**
 * Rangkaian penjaga nilai (§4.16.2 langkah 2–5 + 7) untuk satu definisi kunci.
 * `enumCodes` dilewatkan dari service karena sumbernya `reference_items` pada tanggal itu —
 * server tidak pernah menambah item kamus agar nilai "lulus" (`§4.16.2` langkah 5).
 */
export function guardParameterWrite(
  definition: SystemParameterDefinition,
  rawValue: string | number | boolean,
  enumCodes: readonly string[] | null
): ParameterGuardFailure | string {
  const sent = canonicalize(rawValue);
  if (looksLikeCredential(sent)) return { kind: 'PARAM_SECRET_FORBIDDEN' };

  const typed = coerceByType(definition.dataType, sent);
  if (typeof typed !== 'string') return typed;

  const shape = checkJsonShape(definition.parameterKey, typed);
  if (shape) return shape;

  const range = checkRange(definition.dataType, typed, definition.minValue, definition.maxValue);
  if (range) return range;

  const allowed = checkAllowedValues(definition.allowedValues, typed);
  if (allowed) return allowed;

  if (definition.enumKind) {
    const enumFailure = checkEnumMember(definition.enumKind, enumCodes ?? [], typed);
    if (enumFailure) return enumFailure;
  }

  return typed;
}

/** Kunci wajib berawalan modulnya (`§4.16.4`) — ditegakkan saat register, bukan saat baca. */
export function isKeyPrefixedByModule(key: string, moduleCode: ParameterModuleCode): boolean {
  return key.startsWith(`${moduleCode}.`);
}

/** Kelas risiko mana yang menuntut orang kedua — dibaca UI untuk memilih tombol "Simpan"/"Ajukan". */
export function riskRequiresApproval(riskClass: ParameterRiskClass): boolean {
  return requiresSecondApprover(riskClass);
}
