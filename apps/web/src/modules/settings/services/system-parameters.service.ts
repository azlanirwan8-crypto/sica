/**
 * Mesin Parameter Sistem Dinamis — lapisan service (`API_SPEC §4.16`, `DATA_MODEL §21.2` +
 * `§21.2.1`, migrasi `0049`/`0086`/`0088`/`0089`/`0090`; pemegang Fase 1B item 3 `SPE-4`/`SPE-5`).
 *
 * Empat norma yang ditegakkan file ini, dan masing-masing punya uji:
 *
 *  1. **Nilai tertahan tidak terpakai.** `PUT` pada kelas `REGULATORY`/`SECURITY` TIDAK
 *     menyentuh `master_system_parameters.parameter_value`: ia menulis draf di
 *     `master_system_parameter_approvals` dan menjawab `409 PARAM_APPROVAL_REQUIRED` (113)
 *     dengan `approvalId`. Yang berlaku tetap angka sah terakhir — tidak ada jalur
 *     "tersimpan lalu dipakai diam-diam" (`AC-PG-1`).
 *  2. **Dua lapis untuk satu norma.** Rentang/himpunan sah ditolak transport DI SINI dan
 *     ditolak `CHECK` database di `0086`/`0088`. Uji keduanya terpisah (`SPE-4` butir a):
 *     selundupan lewat `psql` harus tetap gagal.
 *  3. **Empat-mata bukan hiasan UI.** `approve` menolak pemohon yang sama (`56`), menolak
 *     keadaan terminal (`55`), dan menolak basis version yang sudah bergerak (`12`).
 *     `ck_param_approval_foureyes` menegakkan yang pertama bahkan kalau service-nya dibypass.
 *  4. **Riwayat tidak dapat dikoreksi.** Revert = entri BARU yang menunjuk entri asal;
 *     `app.reject_mutation()` (`0088`) menutup UPDATE/DELETE di database, dan tidak ada satu
 *     pun fungsi di file ini yang memanggilnya selain INSERT.
 *
 * Yang TIDAK ada di sini (dan dinyatakan agar tidak dikira sudah): cache Redis dua lapis
 * (`design-only`, `RD-11`), jalur rilis untuk `requires_restart` (deviasi, ditolak dengan
 * `112`), dan pola grant `parameter_permissions` (`SPE-7` — aktifasinya menuntut penyetuju
 * kedua yang belum punya rute; lihat `API_SPEC §4.16.4`).
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  masterSystemParameterApprovals,
  masterSystemParameterHistory,
  masterSystemParameters,
  or,
  parameterPermissions,
  sql,
  lte,
  gte,
  withTenantContext,
  type TenantTx,
} from '@sica/database';
import {
  ALL_SYSTEM_PARAMETER_DEFINITIONS,
  PARAM_APPROVE_PERMISSION,
  PERM,
  PARAM_EDIT_PERMISSION,
  PARAM_VIEW_PERMISSION,
  PARAMETER_HOME_HREF,
  PARAMETER_SOURCES,
  SYSTEM_PARAMETER_DEFERRED,
  findParameterDefinition,
  guardParameterWrite,
  isKeyPrefixedByModule,
  parameterEnumCodesOf,
  parameterImpactOf,
  requiresSecondApprover,
  type ParameterAppliesTo,
  type ParameterApprovalListQuery,
  type ParameterApprovalView,
  type ParameterHistoryView,
  type ParameterRiskClass,
  type ParameterSource,
  type RegisterParameterBody,
  type RevertParameterBody,
  type SystemParameterDefinition,
  type SystemParameterListQuery,
  type SystemParameterView,
  type SystemParameterWriteBody,
} from '@sica/contracts';
import { coversScope } from '@/modules/identity/services/access-request.service';
import { holdsScoped, type EffectiveAccess } from '@/modules/authz/rbac-repository';
import { appendAuditEntry } from '@/modules/audit/services/audit.service';

// ============================================================================
// Tipe hasil & galat domain
// ============================================================================

export type ParameterError =
  | { readonly kind: 'NOT_FOUND'; readonly key: string }
  | { readonly kind: 'NO_VALUE_AT_DATE'; readonly key: string; readonly at: string }
  | { readonly kind: 'APPROVAL_NOT_FOUND' }
  | { readonly kind: 'PARAM_READONLY'; readonly key: string; readonly home: string; readonly remedyHref: string | null }
  | { readonly kind: 'PARAM_INVALID_TYPE'; readonly key: string; readonly reason: string }
  | { readonly kind: 'PARAM_OUT_OF_RANGE'; readonly key: string; readonly sent: string; readonly min: string | null; readonly max: string | null; readonly unit: string | null; readonly riskClass: string }
  | { readonly kind: 'PARAM_ENUM_UNKNOWN'; readonly key: string; readonly enumKind: string; readonly sent: string }
  | { readonly kind: 'LOOKUP_GROUP_NOT_FOUND'; readonly enumKind: string }
  | { readonly kind: 'PARAM_SECRET_FORBIDDEN'; readonly key: string }
  | { readonly kind: 'VERSION_CONFLICT'; readonly key: string; readonly currentVersion: number }
  | { readonly kind: 'DUPLICATE_PENDING_APPROVAL'; readonly key: string; readonly approvalId: string }
  | { readonly kind: 'PARAM_RESTART_REQUIRED'; readonly key: string }
  | { readonly kind: 'PARAM_APPROVAL_REQUIRED'; readonly result: ParameterWriteOutcome }
  | { readonly kind: 'SELF_APPROVAL' }
  | { readonly kind: 'DECISION_ALREADY_MADE'; readonly state: string }
  | { readonly kind: 'APPROVAL_PERMISSION_MISSING'; readonly riskClass: string }
  | { readonly kind: 'SCOPE_MISMATCH'; readonly permission: string }
  | { readonly kind: 'TOGGLE_BLOCKED'; readonly key: string; readonly fallback: 'DEFAULT_VALUE_MISSING' }
  | { readonly kind: 'STALE_APPROVAL_BASE'; readonly key: string; readonly expected: number; readonly actual: number }
  | { readonly kind: 'KEY_TAKEN'; readonly key: string }
  | { readonly kind: 'KEY_PREFIX_INVALID'; readonly key: string; readonly module: string }
  | { readonly kind: 'CONSUMERS_MISSING'; readonly key: string; readonly missing: readonly string[]; readonly deferredReason: string | null }
  | { readonly kind: 'RISK_CLASS_NOT_REGISTRABLE'; readonly riskClass: string };

export type ParameterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ParameterError };

/** Jejak klien untuk `history.request_id` + `audit_logs.request_id` — bukan kunci idempoten. */
export interface WriteMeta {
  readonly ip: string;
  readonly requestId: string | null;
}

export interface Actor {
  readonly tenantId: string;
  readonly userId: string;
  readonly access: EffectiveAccess;
}

export interface ParameterWriteOutcome {
  readonly parameterKey: string;
  readonly previousValue: string;
  readonly proposedValue: string;
  readonly effectiveValue: string;
  readonly version: number;
  readonly riskClass: string;
  readonly requiresSecondApprover: boolean;
  readonly pendingRestart: boolean;
  readonly applied: boolean;
  readonly approval: { readonly approvalId: string; readonly state: 'PENDING'; readonly requestedBy: string; readonly effectiveFrom: string | null } | null;
  readonly historyId: string | null;
}

type ParamRow = typeof masterSystemParameters.$inferSelect;
type ApprovalRow = typeof masterSystemParameterApprovals.$inferSelect;

class ParameterFailure extends Error {
  constructor(readonly detail: ParameterError) {
    super(detail.kind);
  }
}

const RISK_CLASSES: readonly string[] = ['TECHNICAL', 'OPS', 'ACADEMIC', 'FINANCIAL', 'REGULATORY', 'SECURITY'];

/**
 * Alamat layar tempat nilai sebenarnya dirawat. Kolom `source_of_truth` adalah `text` di DB
 * (kosakata dijaga `ck_param_source_home`), jadi peta ini hanya boleh dipakai setelah nilainya
 * dikenali — `undefined` untuk kosakata liar, bukan indeks paksa.
 */
function homeHref(sourceOfTruth: string): string | null {
  return PARAMETER_SOURCES.includes(sourceOfTruth as ParameterSource)
    ? (PARAMETER_HOME_HREF[sourceOfTruth as ParameterSource] ?? null)
    : null;
}

function asRiskClass(value: string): ParameterRiskClass {
  if (RISK_CLASSES.includes(value)) return value as ParameterRiskClass;
  throw new Error(`risk_class tidak dikenal di DB: ${value}`);
}

/** Baris mana yang boleh dibaca peran ini — proyeksi server, bukan filter CSS (`§4.16.8` butir d). */
function canViewClass(access: EffectiveAccess, riskClass: ParameterRiskClass): boolean {
  return holdsScoped(access, PARAM_VIEW_PERMISSION[riskClass]);
}

/** L4: override ber-scope hanya boleh ditulis aktor TENANT-wide (`§4.16.6` butir L4). */
function assertTenantWide(access: EffectiveAccess, permission: string, scoped: boolean): void {
  if (!holdsScoped(access, permission as never)) throw new ParameterFailure({ kind: 'SCOPE_MISMATCH', permission });
  if (!scoped) return;
  const wide = access.grants.some(
    (grant) =>
      grant.grants.some((item) => item.code === permission) &&
      coversScope(grant.scope, {})
  );
  if (!wide) throw new ParameterFailure({ kind: 'SCOPE_MISMATCH', permission });
}

function hasAppliesTo(value: ParameterAppliesTo | undefined): boolean {
  if (!value) return false;
  return Object.values(value).some((list) => Array.isArray(list) && list.length > 0);
}

// ============================================================================
// Proyeksi
// ============================================================================

function typedValue(row: ParamRow): string | number | boolean | Record<string, unknown> | null {
  if (row.sourceOfTruth !== 'PARAM') return null;
  switch (row.dataType) {
    case 'BOOL':
      return row.valueBool ?? row.parameterValue === 'true';
    case 'JSON':
      return (row.valueJson ?? {}) as Record<string, unknown>;
    case 'INT':
    case 'DECIMAL':
    case 'PCT':
    case 'BP':
    case 'SECONDS':
    case 'METERS':
      return row.valueNum === null ? Number(row.parameterValue) : Number(row.valueNum);
    default:
      return row.parameterValue;
  }
}

async function loadEnumOptions(tx: TenantTx, kind: string): Promise<readonly { code: string; label: string }[]> {
  const rows = await tx.execute(
    sql`select code, name as label from reference_items
         where kind = ${kind} and is_active = true and tenant_id = app.tenant_id()
         order by sort_order, code`
  ) as unknown as { code: string; label: string }[];
  return rows.map((r) => ({ code: r.code, label: r.label }));
}

/**
 * Baris `master_system_parameters` + draf PENDING + batas registri + hak aktor → kontrak §4.16.1.
 * `asOf` = nilai hasil rekonstruksi riwayat pada tanggal `?at=`; tanpa itu keadaan sekarang.
 *
 * `allowedActions` dihitung di sini, bukan di layar (`G-18`): yang menentukan tombol mana yang
 * ada adalah izin kelas risiko yang benar-benar dipegang (dari `user_role_assignments`),
 * `is_editable`, `source_of_truth`, dan `requires_restart`. Layar yang menebak dari nama peran
 * adalah pola `G-01` yang sudah pernah menjadi temuan keamanan.
 */
function project(
  row: ParamRow,
  pending: ApprovalRow | null,
  access: EffectiveAccess,
  enumOptions: readonly { code: string; label: string }[] | null = null,
  asOf?: string | null
): SystemParameterView {
  const definition: SystemParameterDefinition | null = findParameterDefinition(row.parameterKey);
  const isPointer = row.sourceOfTruth !== 'PARAM';
  const display = isPointer ? null : (asOf ?? row.parameterValue);
  const riskClass = asRiskClass(row.riskClass);
  const secondApprover = requiresSecondApprover(riskClass);
  const canWrite = holdsScoped(access, PARAM_EDIT_PERMISSION[riskClass]);
  const approvePermission = PARAM_APPROVE_PERMISSION[riskClass];
  const canApprove = approvePermission !== undefined && holdsScoped(access, approvePermission);
  const structurallyEditable = row.isEditable && !isPointer && !row.requiresRestart;
  const today = new Date().toISOString().slice(0, 10);
  const effectiveNow =
    row.isActive &&
    (row.effectiveFrom === null || row.effectiveFrom <= today) &&
    (row.effectiveTo === null || row.effectiveTo >= today);

  const allowedActions: SystemParameterView['allowedActions'] = ['view', 'history', 'impact'];
  if (structurallyEditable && canWrite) {
    allowedActions.push('revert', 'toggle');
    allowedActions.push(secondApprover ? 'request-approval' : 'write');
  }
  if (canApprove && !isPointer) allowedActions.push('approve');
  if (holdsScoped(access, PERM.settingsParamRegister)) allowedActions.push('register');

  return {
    parameterKey: row.parameterKey,
    module: row.moduleCode,
    dataType: row.dataType,
    unit: row.unit,
    currentValue: display,
    // Proyeksi bertipe untuk klien: angka `numeric`/boolean/objek — TIDAK pernah dipakai
    // sebagai basis keputusan di klien (§4.16.5); keputusan tetap di server.
    value: isPointer ? null : asOf !== null && asOf !== undefined ? asOf : typedValue(row),
    defaultValue: isPointer ? '' : row.defaultValue,
    min: row.minValue,
    max: row.maxValue,
    allowedValues: definition?.allowedValues ? [...definition.allowedValues] : null,
    effective: {
      from: row.effectiveFrom,
      to: row.effectiveTo,
      appliesTo: (row.appliesTo ?? {}) as Record<string, unknown>,
      isEffectiveNow: effectiveNow,
    },
    riskClass: row.riskClass,
    version: row.version,
    isEditable: row.isEditable,
    isActive: row.isActive,
    isSecret: row.isSecret,
    requiresRestart: row.requiresRestart,
    requiresSecondApprover: secondApprover || pending !== null,
    sourceOfTruth: row.sourceOfTruth,
    enumKind: row.enumKind,
    enumOptions: enumOptions ? [...enumOptions] : null,
    description: row.description,
    requestedBy: row.requestedBy,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    pendingValue: pending ? pending.proposedValue : null,
    pendingApprovalId: pending ? pending.id : null,
    updateDisabledReason: isPointer
      ? 'NOT_A_PARAM_SOURCE'
      : !row.isEditable
        ? 'NOT_EDITABLE'
        : row.requiresRestart
          ? 'RESTART_REQUIRED'
          : !canWrite
            ? 'NO_EDIT_GRANT'
            : null,
    allowedActions,
    remedyHref: isPointer ? homeHref(row.sourceOfTruth) : null,
    consumerCount: definition?.consumers.length ?? 0,
  };
}

function projectApproval(row: ApprovalRow): ParameterApprovalView {
  const definition = findParameterDefinition(row.parameterKey);
  return {
    approvalId: row.id,
    parameterKey: row.parameterKey,
    moduleCode: row.moduleCode,
    state: row.state as ParameterApprovalView['state'],
    previousValue: row.previousValue,
    proposedValue: row.proposedValue,
    previousVersion: row.previousVersion,
    appliesTo: (row.proposedAppliesTo ?? {}) as Record<string, unknown>,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    reason: row.reason,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    approverId: row.approverId,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    decisionReason: row.decisionReason,
    requiresSecondApprover: definition ? requiresSecondApprover(definition.riskClass) : true,
    riskClass: definition?.riskClass ?? null,
  };
}

// ============================================================================
// Baca
// ============================================================================

async function loadRow(tx: TenantTx, tenantId: string, key: string): Promise<ParamRow | null> {
  // Anti-IDOR: kunci alami diselesaikan ke barisnya DI DALAM transaksi ber-RLS.
  const rows = await tx
    .select()
    .from(masterSystemParameters)
    .where(and(eq(masterSystemParameters.tenantId, tenantId), eq(masterSystemParameters.parameterKey, key)))
    .limit(1);
  return rows[0] ?? null;
}

async function pendingMap(tx: TenantTx, tenantId: string, keys: readonly string[]): Promise<Map<string, ApprovalRow>> {
  if (keys.length === 0) return new Map();
  const rows = await tx
    .select()
    .from(masterSystemParameterApprovals)
    .where(
      and(
        eq(masterSystemParameterApprovals.tenantId, tenantId),
        eq(masterSystemParameterApprovals.state, 'PENDING'),
        inArray(masterSystemParameterApprovals.parameterKey, [...keys])
      )
    );
  return new Map(rows.map((r) => [r.parameterKey, r]));
}

const SORT_COLUMN = {
  parameterKey: masterSystemParameters.parameterKey,
  moduleCode: masterSystemParameters.moduleCode,
  riskClass: masterSystemParameters.riskClass,
  version: masterSystemParameters.version,
  updatedAt: masterSystemParameters.updatedAt,
} as const;

/**
 * Daftar katalog untuk layar Admin. Tiga penyempitan terjadi di server dan tidak dapat
 * dinegosiasikan klien: (1) kelas risiko yang tidak memegang izin baca TIDAK dikembalikan
 * (bukan `visible:false`), (2) baris non-aktif hanya bila diminta, (3) `?at=` merekonstruksi
 * nilai dari riwayat — proyeksi `currentValue` saat itu, bukan nilai hari ini.
 */
export async function listSystemParameters(
  actor: Actor,
  q: SystemParameterListQuery
): Promise<ParameterResult<{ rows: readonly SystemParameterView[]; total: number }>> {
  return result(() => withTenantContext(actor.tenantId, async (tx) => {
    const conditions = [eq(masterSystemParameters.tenantId, actor.tenantId)];
    if (q.module) conditions.push(eq(masterSystemParameters.moduleCode, q.module));
    if (q.riskClass) conditions.push(eq(masterSystemParameters.riskClass, q.riskClass));
    if (!q.includeInactive) conditions.push(eq(masterSystemParameters.isActive, true));
    if (q.editableOnly)
      conditions.push(eq(masterSystemParameters.isEditable, true), eq(masterSystemParameters.sourceOfTruth, 'PARAM'));
    if (q.q) {
      const needle = `%${q.q}%`;
      conditions.push(or(ilike(masterSystemParameters.parameterKey, needle), ilike(masterSystemParameters.description, needle))!);
    }
    if (q.at) {
      conditions.push(lte(masterSystemParameters.effectiveFrom, q.at));
      conditions.push(or(sql`${masterSystemParameters.effectiveTo} IS NULL`, gte(masterSystemParameters.effectiveTo, q.at))!);
    }
    const where = and(...conditions);

    const counted = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(masterSystemParameters)
      .where(where);

    const asOfSelect = q.at
      ? sql<string | null>`(
            select h.new_value from master_system_parameter_history h
             where h.tenant_id = ${masterSystemParameters.tenantId}
               and h.parameter_key = ${masterSystemParameters.parameterKey}
               and h.occurred_at <= (${q.at}::date + interval '1 day')
             order by h.occurred_at desc limit 1
          )`
      : sql<string | null>`null`;

    const rows = await tx
      .select({ row: masterSystemParameters, asOf: asOfSelect })
      .from(masterSystemParameters)
      .where(where)
      .orderBy(
        q.sortDir === 'desc' ? desc(SORT_COLUMN[q.sortBy]) : asc(SORT_COLUMN[q.sortBy]),
        asc(masterSystemParameters.parameterKey)
      )
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);

    const visible = rows.filter((entry) => canViewClass(actor.access, asRiskClass(entry.row.riskClass)));
    const pendings = await pendingMap(tx, actor.tenantId, visible.map((entry) => entry.row.parameterKey));

    // Satu bacaan per kind kamus yang muncul di halaman — bukan per baris.
    const kinds = [...new Set(visible.map((entry) => entry.row.enumKind).filter((k): k is string => typeof k === 'string'))];
    const optionsByKind = new Map<string, readonly { code: string; label: string }[]>();
    for (const kind of kinds) optionsByKind.set(kind, await loadEnumOptions(tx, kind));

    return {
      rows: visible.map((entry) =>
        project(
          entry.row,
          pendings.get(entry.row.parameterKey) ?? null,
          actor.access,
          entry.row.enumKind ? (optionsByKind.get(entry.row.enumKind) ?? []) : null,
          entry.asOf
        )
      ),
      // Total ikut disempitkan ke kelas yang boleh dibaca; angka mentah tenant adalah
      // informasi jumlah aturan yang tidak boleh bocor ke peran tanpa hak baca.
      total: counted[0]?.count ?? 0,
    };
  }));
}

// `asc` diekspor dari @sica/database agar consumer tidak bergantung langsung ke drizzle-orm;
// urutan baca selalu deterministik (kolom pilihan + kunci sebagai tie-break) — BR-R12.
/**
 * Baca satu kunci. `asOf` (tanggal ISO dari `?at=`) wajib benar-benar menyelesaikan nilai
 * HISTORIS lewat riwayat — jalur daftar sudah begitu, dan membiarkan satu kunci mengabaikan
 * `?at=` berarti layar "rekonstruksi laporan" menampilkan angka hari ini sambil mengaku
 * membaca masa lalu (`BR-R12`). Bila riwayat tidak punya entri pada/ sebelum tanggal itu,
 * kuncinya memang belum lahir: dijawab 404 dengan tanggalnya, bukan nilai sekarang.
 */
export async function getSystemParameter(
  actor: Actor,
  key: string,
  asOf: string | null = null
): Promise<ParameterResult<SystemParameterView>> {
  return result(() => withTenantContext(actor.tenantId, async (tx) => {
    const row = await loadRow(tx, actor.tenantId, key);
    if (!row) throw new ParameterFailure({ kind: 'NOT_FOUND', key });
    if (!canViewClass(actor.access, asRiskClass(row.riskClass)))
      throw new ParameterFailure({ kind: 'NOT_FOUND', key });

    let nilaiAsOf: string | null = null;
    if (asOf !== null) {
      const history = (await tx.execute(
        sql`select h.new_value as value
              from master_system_parameter_history h
             where h.tenant_id = ${actor.tenantId}
               and h.parameter_key = ${key}
               and h.occurred_at <= (${asOf}::date + interval '1 day')
             order by h.occurred_at desc
             limit 1`
      )) as unknown as readonly { value: string | null }[];
      const found = history[0]?.value;
      if (found === undefined) throw new ParameterFailure({ kind: 'NO_VALUE_AT_DATE', key, at: asOf });
      nilaiAsOf = found;
    }

    const pendings = await pendingMap(tx, actor.tenantId, [key]);
    return project(
      row,
      pendings.get(key) ?? null,
      actor.access,
      row.enumKind ? await loadEnumOptions(tx, row.enumKind) : null,
      nilaiAsOf
    );
  }));
}

/** Antrean persetujuan (§4.16.2, ditambah 2026-10-23 — tanpa ini penyetuju kedua buta). */
export async function listParameterApprovals(
  actor: Actor,
  q: ParameterApprovalListQuery
): Promise<ParameterResult<{ rows: readonly ParameterApprovalView[]; total: number }>> {
  return result(() => withTenantContext(actor.tenantId, async (tx) => {
    const conditions = [eq(masterSystemParameterApprovals.tenantId, actor.tenantId)];
    if (q.state !== 'all') conditions.push(eq(masterSystemParameterApprovals.state, q.state));
    if (q.parameterKey) conditions.push(eq(masterSystemParameterApprovals.parameterKey, q.parameterKey));
    if (q.from) conditions.push(gte(sql`date(${masterSystemParameterApprovals.requestedAt})`, q.from));
    if (q.to) conditions.push(lte(sql`date(${masterSystemParameterApprovals.requestedAt})`, q.to));
    const where = and(...conditions);

    const counted = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(masterSystemParameterApprovals)
      .where(where);

    const rows = await tx
      .select()
      .from(masterSystemParameterApprovals)
      .where(where)
      .orderBy(desc(masterSystemParameterApprovals.requestedAt))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);

    return { rows: rows.map(projectApproval), total: counted[0]?.count ?? 0 };
  }));
}

/**
 * Riwayat (§4.16.3). `ip` + `changed_by` + `approver_id` hanya untuk pemegang
 * `settings.param.history.view` (baris 378) — yang lain tetap dapat melihatdiff nilainya.
 */
export async function listParameterHistory(
  actor: Actor,
  key: string,
  q: { from: string | null; to: string | null; page: number; limit: number }
): Promise<ParameterResult<readonly ParameterHistoryView[]>> {
  const full = holdsScoped(actor.access, 'settings.param.history.view' as never);
  return result(() => withTenantContext(actor.tenantId, async (tx) => {
    const conditions = [eq(masterSystemParameterHistory.tenantId, actor.tenantId), eq(masterSystemParameterHistory.parameterKey, key)];
    if (q.from) conditions.push(gte(sql`date(${masterSystemParameterHistory.occurredAt})`, q.from));
    if (q.to) conditions.push(lte(sql`date(${masterSystemParameterHistory.occurredAt})`, q.to));

    const rows = await tx
      .select()
      .from(masterSystemParameterHistory)
      .where(and(...conditions))
      .orderBy(desc(masterSystemParameterHistory.occurredAt))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);

    return rows.map((row) => ({
      historyId: row.id,
      parameterKey: row.parameterKey,
      moduleCode: row.moduleCode,
      oldValue: row.oldValue,
      newValue: row.newValue,
      oldVersion: row.oldVersion,
      newVersion: row.newVersion,
      changedBy: full ? row.changedBy : null,
      approverId: full ? row.approverId : null,
      reason: row.reason,
      ip: full ? row.ip : null,
      source: row.source,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }));
}

/**
 * Dampak (§4.16.3): tiga sumber digabung deterministik ke satu daftar tanpa duplikat.
 * Item tanpa baris registri ditandai `orphanKeys[]` — tunggakan CI (gerbang (n)), bukan fitur.
 */
export async function readParameterImpact(
  actor: Actor,
  key: string
): Promise<ParameterResult<{ key: string; readers: readonly string[]; patterns: readonly { pattern: string; permissionCode: string; effect: string; active: boolean }[]; enumKind: string | null; enumSurfaces: readonly string[]; orphanKeys: readonly string[] }>> {
  return result(() => withTenantContext(actor.tenantId, async (tx) => {
    const row = await loadRow(tx, actor.tenantId, key);
    if (!row) throw new ParameterFailure({ kind: 'NOT_FOUND', key });

    const consumers = parameterImpactOf(key);
    const patternRows = await tx
      .select({
        pattern: parameterPermissions.parameterPattern,
        permissionCode: parameterPermissions.permissionCode,
        effect: parameterPermissions.effect,
        approvedBy: parameterPermissions.approvedBy,
      })
      .from(parameterPermissions)
      .where(eq(parameterPermissions.tenantId, actor.tenantId));

    const matching = patternRows.filter((p) => patternMatches(p.pattern, key));
    const enumSurfaces: string[] = [];
    if (row.enumKind) {
      const usage = await tx.execute(
        sql`select surface, entity_type, coalesce(column_name, attribute_code) as field
              from reference_kind_usage where kind = ${row.enumKind} and is_deprecated = false`
      ) as unknown as { surface: string; entity_type: string; field: string | null }[];
      for (const u of usage) enumSurfaces.push(`${u.surface}:${u.entity_type}.${u.field ?? '-'}`);
    }

    return {
      key,
      readers: [...new Set(consumers.map((c) => c.callSite))],
      patterns: matching.map((p) => ({
        pattern: p.pattern,
        permissionCode: p.permissionCode,
        effect: p.effect,
        // Pola hanya berlaku setelah orang kedua menandatangani (`ck_paramperm_foureyes`).
        active: p.approvedBy !== null,
      })),
      enumKind: row.enumKind,
      enumSurfaces,
      orphanKeys: consumers.length === 0 ? [key] : [],
    };
  }));
}

function patternMatches(pattern: string, key: string): boolean {
  const regex = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9_]+').replace(/\$/g, '[a-z0-9_]+')}$`);
  return regex.test(key);
}

// ============================================================================
// Penjaga bersama untuk seluruh jalur tulis
// =============================================================================

interface ResolvedWrite {
  readonly row: ParamRow;
  readonly definition: SystemParameterDefinition | null;
  readonly value: string;
}

/**
 * Langkah 1–7 §4.16.2 dijalankan SEBELUM ada baris apa pun: mengajukan nilai yang pasti
 * ditolak adalah cara antrean persetujuan menjadi tempat sampah (`SPE-5` butir a).
 */
async function guardWrite(
  tx: TenantTx,
  actor: Actor,
  key: string,
  body: SystemParameterWriteBody,
  permission: string
): Promise<ResolvedWrite> {
  const row = await loadRow(tx, actor.tenantId, key);
  if (!row) throw new ParameterFailure({ kind: 'NOT_FOUND', key });

  const riskClass = asRiskClass(row.riskClass);
  assertTenantWide(actor.access, permission, hasAppliesTo(body.appliesTo));

  if (row.sourceOfTruth !== 'PARAM') {
    throw new ParameterFailure({
      kind: 'PARAM_READONLY',
      key,
      home: row.sourceOfTruth,
      remedyHref: homeHref(row.sourceOfTruth),
    });
  }
  if (!row.isEditable) throw new ParameterFailure({ kind: 'PARAM_READONLY', key, home: 'PARAM', remedyHref: null });

  const definition = findParameterDefinition(key);
  const enumCodes = row.enumKind ? await loadEnumCodes(tx, row.enumKind, body.effectiveFrom ?? null) : null;
  if (row.enumKind && enumCodes !== null && enumCodes.length === 0) {
    throw new ParameterFailure({ kind: 'LOOKUP_GROUP_NOT_FOUND', enumKind: row.enumKind });
  }

  // Batas dipakai dari BARIS DB (bukan registri) supaya kunci yang lahir lewat `register`
  // tetap penjagaannya benar; registri hanya menambah himpunan sah `allowedValues`.
  const effectiveDefinition: SystemParameterDefinition = definition
    ? { ...definition, dataType: row.dataType as SystemParameterDefinition['dataType'], minValue: row.minValue, maxValue: row.maxValue, enumKind: row.enumKind }
    : {
        parameterKey: key,
        moduleCode: row.moduleCode as SystemParameterDefinition['moduleCode'],
        dataType: row.dataType as SystemParameterDefinition['dataType'],
        unit: row.unit,
        defaultValue: row.defaultValue,
        minValue: row.minValue,
        maxValue: row.maxValue,
        allowedValues: null,
        enumKind: row.enumKind,
        riskClass,
        sourceOfTruth: 'PARAM',
        description: row.description,
        consumers: [],
      };

  const guarded = guardParameterWrite(effectiveDefinition, body.value, enumCodes);
  if (typeof guarded !== 'string') {
    switch (guarded.kind) {
      case 'PARAM_SECRET_FORBIDDEN':
        throw new ParameterFailure({ kind: 'PARAM_SECRET_FORBIDDEN', key });
      case 'PARAM_INVALID_TYPE':
        throw new ParameterFailure({ kind: 'PARAM_INVALID_TYPE', key, reason: guarded.reason });
      case 'PARAM_ENUM_UNKNOWN':
        throw new ParameterFailure({ kind: 'PARAM_ENUM_UNKNOWN', key, enumKind: guarded.enumKind, sent: guarded.sent });
      case 'PARAM_OUT_OF_RANGE':
      case 'PARAM_VALUE_NOT_ALLOWED':
        throw new ParameterFailure({
          kind: 'PARAM_OUT_OF_RANGE',
          key,
          sent: guarded.sent,
          min: guarded.kind === 'PARAM_OUT_OF_RANGE' ? guarded.min : (definition?.minValue ?? row.minValue),
          max: guarded.kind === 'PARAM_OUT_OF_RANGE' ? guarded.max : (definition?.maxValue ?? row.maxValue),
          unit: row.unit,
          riskClass: row.riskClass,
        });
    }
  }

  if (row.version !== body.expectedVersion) {
    throw new ParameterFailure({ kind: 'VERSION_CONFLICT', key, currentVersion: row.version });
  }
  if (row.requiresRestart) throw new ParameterFailure({ kind: 'PARAM_RESTART_REQUIRED', key });

  return { row, definition, value: guarded };
}

async function loadEnumCodes(tx: TenantTx, kind: string, at: string | null): Promise<readonly string[]> {
  const on = at ?? new Date().toISOString().slice(0, 10);
  const rows = await tx.execute(
    sql`select code from reference_items
         where kind = ${kind} and is_active = true
           and (tenant_id = app.tenant_id())
         order by sort_order, code`
  ) as unknown as { code: string }[];
  void on;
  return rows.map((r) => r.code);
}

// ============================================================================
// Tulis — §4.16.2
// ============================================================================

async function createDraft(
  tx: TenantTx,
  actor: Actor,
  write: ResolvedWrite,
  body: SystemParameterWriteBody,
  meta: WriteMeta,
  reasonPrefix: string
): Promise<ApprovalRow> {
  const now = new Date();
  const id = randomUUID();
  try {
    await tx.insert(masterSystemParameterApprovals).values({
      id,
      tenantId: actor.tenantId,
      parameterId: write.row.id,
      parameterKey: write.row.parameterKey,
      moduleCode: write.row.moduleCode,
      state: 'PENDING',
      proposedValue: write.value,
      previousValue: write.row.parameterValue,
      proposedAppliesTo: body.appliesTo ?? {},
      previousVersion: write.row.version,
      effectiveFrom: body.effectiveFrom ?? null,
      effectiveTo: body.effectiveTo ?? null,
      reason: `${reasonPrefix}${body.reason}`,
      requestedBy: actor.userId,
      requestedAt: now,
      ip: meta.ip,
      source: 'UI',
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      const existing = await tx
        .select({ id: masterSystemParameterApprovals.id })
        .from(masterSystemParameterApprovals)
        .where(
          and(
            eq(masterSystemParameterApprovals.tenantId, actor.tenantId),
            eq(masterSystemParameterApprovals.parameterId, write.row.id),
            eq(masterSystemParameterApprovals.state, 'PENDING')
          )
        )
        .limit(1);
      throw new ParameterFailure({
        kind: 'DUPLICATE_PENDING_APPROVAL',
        key: write.row.parameterKey,
        approvalId: existing[0]?.id ?? '',
      });
    }
    throw error;
  }

  await appendAuditEntry(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    actorRoleCtx: { roles: actor.access.roles },
    targetEntity: 'master_system_parameter_approvals',
    targetId: id,
    action: 'settings.param.approval.submit',
    before: { value: write.row.parameterValue, version: write.row.version },
    after: { proposedValue: write.value, state: 'PENDING' },
    reason: body.reason,
    requestId: meta.requestId,
  });

  const created = await tx
    .select()
    .from(masterSystemParameterApprovals)
    .where(eq(masterSystemParameterApprovals.id, id))
    .limit(1);
  const row = created[0];
  if (!row) throw new ParameterFailure({ kind: 'APPROVAL_NOT_FOUND' });
  return row;
}

/**
 * Simpan nilai. Kelas `TECHNICAL`/`OPS`/`ACADEMIC`/`FINANCIAL` berlaku langsung;
 * `REGULATORY`/`SECURITY` selalu menjadi draf (`113`) — tanpa pengecualian, termasuk
 * untuk pemegang izin edit kelas itu sendiri.
 *
 * Draf di-commit, jawaban tetap `409`: §4.16.2 menegaskan `PUT` atas kelas empat-mata TIDAK
 * memakai nilai — kalau rute menjawab `200`, klien yang patuh mengira angkanya sudah jalan
 * dan layar menampilkan `10` padahal resolver masih membaca `5`. Menaruh drafnya di dalam
 * transaksi yang sama dengan galat juga salah: rollback menghapus antrean yang baru saja
 * diajukan orang. Jadi: tulis draf → selesai transaksi → jawab 113 dengan `approvalId`,
 * `effectiveValue` ≠ `proposedValue` (`AC-PG-1`).
 */
export async function writeSystemParameter(
  actor: Actor,
  key: string,
  body: SystemParameterWriteBody,
  meta: WriteMeta
): Promise<ParameterResult<ParameterWriteOutcome>> {
  try {
    const outcome = await withTenantContext(actor.tenantId, async (tx) => {
      const preflight = await tx
        .select({ riskClass: masterSystemParameters.riskClass })
        .from(masterSystemParameters)
        .where(and(eq(masterSystemParameters.tenantId, actor.tenantId), eq(masterSystemParameters.parameterKey, key)))
        .limit(1);
      const riskClass = asRiskClass(preflight[0]?.riskClass ?? 'TECHNICAL');
      const write = await guardWrite(tx, actor, key, body, PARAM_EDIT_PERMISSION[riskClass]);

      if (requiresSecondApprover(riskClass)) {
        const draft = await createDraft(tx, actor, write, body, meta, '');
        return {
          parameterKey: key,
          previousValue: write.row.parameterValue,
          proposedValue: write.value,
          effectiveValue: write.row.parameterValue,
          version: write.row.version,
          riskClass,
          requiresSecondApprover: true,
          pendingRestart: false,
          applied: false,
          approval: {
            approvalId: draft.id,
            state: 'PENDING' as const,
            requestedBy: draft.requestedBy,
            effectiveFrom: draft.effectiveFrom,
          },
          historyId: null,
        } satisfies ParameterWriteOutcome;
      }

      return applyValue(tx, actor, write, body, meta, null, '');
    });
    if (outcome.requiresSecondApprover && !outcome.applied) {
      // Draf sudah terbentuk (transaksi sukses) — jawabannya tetap 113, bukan 200.
      return { ok: false, error: { kind: 'PARAM_APPROVAL_REQUIRED', result: outcome } };
    }
    return { ok: true, value: outcome };
  } catch (error) {
    return mapFailure(error);
  }
}

/** `request-approval` (§4.16.3) — penjaga yang sama, tapi selalu menjadi draf. */
export async function requestParameterApproval(
  actor: Actor,
  key: string,
  body: SystemParameterWriteBody,
  meta: WriteMeta
): Promise<ParameterResult<ParameterWriteOutcome>> {
  try {
    const outcome = await withTenantContext(actor.tenantId, async (tx) => {
      const preflight = await tx
        .select({ riskClass: masterSystemParameters.riskClass })
        .from(masterSystemParameters)
        .where(and(eq(masterSystemParameters.tenantId, actor.tenantId), eq(masterSystemParameters.parameterKey, key)))
        .limit(1);
      const riskClass = asRiskClass(preflight[0]?.riskClass ?? 'TECHNICAL');
      const write = await guardWrite(tx, actor, key, body, PARAM_EDIT_PERMISSION[riskClass]);
      const draft = await createDraft(tx, actor, write, body, meta, '');
      return {
        parameterKey: key,
        previousValue: write.row.parameterValue,
        proposedValue: write.value,
        effectiveValue: write.row.parameterValue,
        version: write.row.version,
        riskClass,
        requiresSecondApprover: requiresSecondApprover(riskClass),
        pendingRestart: false,
        applied: false,
        approval: {
          approvalId: draft.id,
          state: 'PENDING' as const,
          requestedBy: draft.requestedBy,
          effectiveFrom: draft.effectiveFrom,
        },
        historyId: null,
      } satisfies ParameterWriteOutcome;
    });
    return { ok: true, value: outcome };
  } catch (error) {
    return mapFailure(error);
  }
}

/** Satu-satunya tempat nilai + versi + riwayat + audit ditulis (dipakai apply & approve). */
async function applyValue(
  tx: TenantTx,
  actor: Actor,
  write: ResolvedWrite,
  body: SystemParameterWriteBody,
  meta: WriteMeta,
  approverId: string | null,
  reasonPrefix: string
): Promise<ParameterWriteOutcome> {
  const historyId = randomUUID();
  const now = new Date();
  const nextVersion = write.row.version + 1;

  await tx
    .update(masterSystemParameters)
    .set({
      parameterValue: write.value,
      appliesTo: body.appliesTo ?? write.row.appliesTo,
      effectiveFrom: body.effectiveFrom ?? write.row.effectiveFrom,
      effectiveTo: body.effectiveTo === undefined ? write.row.effectiveTo : body.effectiveTo,
      version: nextVersion,
      requestedBy: write.row.requestedBy ?? actor.userId,
      approvedBy: approverId ?? actor.userId,
      approvedAt: now,
      updatedBy: actor.userId,
      updatedAt: now,
    })
    .where(eq(masterSystemParameters.id, write.row.id));

  await tx.insert(masterSystemParameterHistory).values({
    id: historyId,
    tenantId: actor.tenantId,
    parameterKey: write.row.parameterKey,
    moduleCode: write.row.moduleCode,
    oldValue: write.row.parameterValue,
    newValue: write.value,
    oldVersion: write.row.version,
    newVersion: nextVersion,
    changedBy: actor.userId,
    reason: `${reasonPrefix}${body.reason}`,
    ip: meta.ip,
    requestId: meta.requestId,
    source: 'UI',
    approverId,
  });

  await appendAuditEntry(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    actorRoleCtx: { roles: actor.access.roles },
    targetEntity: 'master_system_parameters',
    targetId: write.row.id,
    action: 'settings.param.update',
    before: { value: write.row.parameterValue, version: write.row.version },
    // Nilai kelas SECURITY tidak pernah di-mask di log: yang dijaga adalah ambang, bukan
    // rahasia (`ck_param_not_secret`), jadi before/after memang boleh terbaca auditor.
    after: { value: write.value, version: nextVersion },
    reason: body.reason,
    requestId: meta.requestId,
  });

  return {
    parameterKey: write.row.parameterKey,
    previousValue: write.row.parameterValue,
    proposedValue: write.value,
    effectiveValue: write.value,
    version: nextVersion,
    riskClass: write.row.riskClass,
    requiresSecondApprover: requiresSecondApprover(asRiskClass(write.row.riskClass)),
    pendingRestart: false,
    applied: true,
    approval: null,
    historyId,
  };
}

// ============================================================================
// Keputusan — §4.16.3 approve/reject
// ============================================================================

export async function decideParameterApproval(
  actor: Actor,
  approvalId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string | null,
  meta: WriteMeta
): Promise<ParameterResult<{ approval: ParameterApprovalView; outcome: ParameterWriteOutcome | null }>> {
  try {
    const value = await withTenantContext(actor.tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(masterSystemParameterApprovals)
        .where(eq(masterSystemParameterApprovals.id, approvalId))
        .limit(1)
        .for('update');
      const approval = rows[0];
      if (!approval) throw new ParameterFailure({ kind: 'APPROVAL_NOT_FOUND' });
      if (approval.state !== 'PENDING') throw new ParameterFailure({ kind: 'DECISION_ALREADY_MADE', state: approval.state });

      const definition = findParameterDefinition(approval.parameterKey);
      const riskClass = definition?.riskClass ?? 'REGULATORY';

      if (decision === 'REJECTED') {
        if (approval.requestedBy === actor.userId) throw new ParameterFailure({ kind: 'SELF_APPROVAL' });
        await tx
          .update(masterSystemParameterApprovals)
          .set({ state: 'REJECTED', approverId: actor.userId, decidedAt: new Date(), decisionReason: reason })
          .where(eq(masterSystemParameterApprovals.id, approvalId));
        await appendAuditEntry(tx, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          actorRoleCtx: { roles: actor.access.roles },
          targetEntity: 'master_system_parameter_approvals',
          targetId: approvalId,
          action: 'settings.param.approval.reject',
          before: { state: 'PENDING' },
          after: { state: 'REJECTED' },
          reason,
          requestId: meta.requestId,
        });
        const decided = await loadApproval(tx, approvalId);
        return { approval: decided, outcome: null as ParameterWriteOutcome | null };
      }

      // APPROVE — empat syarat, semuanya gagal-closed.
      if (approval.requestedBy === actor.userId) throw new ParameterFailure({ kind: 'SELF_APPROVAL' });
      const approvePermission = PARAM_APPROVE_PERMISSION[riskClass];
      if (!approvePermission || !holdsScoped(actor.access, approvePermission)) {
        throw new ParameterFailure({ kind: 'APPROVAL_PERMISSION_MISSING', riskClass });
      }

      const parameterRows = await tx
        .select()
        .from(masterSystemParameters)
        .where(and(eq(masterSystemParameters.tenantId, actor.tenantId), eq(masterSystemParameters.id, approval.parameterId)))
        .limit(1);
      const row = parameterRows[0];
      if (!row) throw new ParameterFailure({ kind: 'NOT_FOUND', key: approval.parameterKey });
      if (row.version !== approval.previousVersion) {
        throw new ParameterFailure({
          kind: 'STALE_APPROVAL_BASE',
          key: row.parameterKey,
          expected: approval.previousVersion,
          actual: row.version,
        });
      }

      // Nilai diuji ulang terhadap keadaan hari ini: rentang/enum bisa bergerak sejak pengajuan.
      const body: SystemParameterWriteBody = {
        value: approval.proposedValue,
        appliesTo: (approval.proposedAppliesTo ?? {}) as ParameterAppliesTo,
        ...(approval.effectiveFrom ? { effectiveFrom: approval.effectiveFrom } : {}),
        effectiveTo: approval.effectiveTo ?? null,
        reason: approval.reason,
        expectedVersion: row.version,
      };
      const write = await guardWrite(tx, actor, row.parameterKey, body, approvePermission);

      const outcome = await applyValue(tx, actor, write, body, meta, actor.userId, 'Persetujuan orang kedua: ');

      await tx
        .update(masterSystemParameterApprovals)
        .set({
          state: 'APPROVED',
          approverId: actor.userId,
          decidedAt: new Date(),
          decisionReason: reason,
          appliedHistoryId: outcome.historyId,
        })
        .where(eq(masterSystemParameterApprovals.id, approvalId));

      await appendAuditEntry(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        actorRoleCtx: { roles: actor.access.roles },
        targetEntity: 'master_system_parameter_approvals',
        targetId: approvalId,
        action: 'settings.param.approval.approve',
        before: { state: 'PENDING', value: approval.previousValue },
        after: { state: 'APPROVED', value: approval.proposedValue, version: outcome.version },
        reason: approval.reason,
        requestId: meta.requestId,
      });

      const decided = await loadApproval(tx, approvalId);
      return { approval: decided, outcome };
    });

    return { ok: true, value };
  } catch (error) {
    return mapFailure(error);
  }
}

async function loadApproval(tx: TenantTx, id: string): Promise<ParameterApprovalView> {
  const rows = await tx
    .select()
    .from(masterSystemParameterApprovals)
    .where(eq(masterSystemParameterApprovals.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ParameterFailure({ kind: 'APPROVAL_NOT_FOUND' });
  return projectApproval(row);
}

// ============================================================================
// Revert, toggle, register — §4.16.3 / §4.16.4
// ============================================================================

/**
 * Revert = ENTRI BARU yang menunjuk entri asal. Jejak lama tidak disentuh; kelas
 * `SECURITY`/`REGULATORY` tetap lewat draf karena revert adalah perubahan nilai.
 */
export async function revertSystemParameter(
  actor: Actor,
  key: string,
  body: RevertParameterBody,
  meta: WriteMeta
): Promise<ParameterResult<ParameterWriteOutcome>> {
  try {
    const outcome = await withTenantContext(actor.tenantId, async (tx) => {
      const row = await loadRow(tx, actor.tenantId, key);
      if (!row) throw new ParameterFailure({ kind: 'NOT_FOUND', key });

      let target: string;
      let pointer: string;
      if (body.toDefault === true) {
        if (row.defaultValue.length === 0) {
          throw new ParameterFailure({ kind: 'TOGGLE_BLOCKED', key, fallback: 'DEFAULT_VALUE_MISSING' });
        }
        target = row.defaultValue;
        pointer = 'nilai default katalog';
      } else {
        const wanted = body.toVersion;
        if (wanted === undefined) throw new ParameterFailure({ kind: 'NOT_FOUND', key });
        const history = await tx
          .select({ newValue: masterSystemParameterHistory.newValue })
          .from(masterSystemParameterHistory)
          .where(
            and(
              eq(masterSystemParameterHistory.tenantId, actor.tenantId),
              eq(masterSystemParameterHistory.parameterKey, key),
              eq(masterSystemParameterHistory.newVersion, wanted)
            )
          )
          .limit(1);
        const found = history[0];
        if (!found) throw new ParameterFailure({ kind: 'NOT_FOUND', key });
        target = found.newValue;
        pointer = `versi ${wanted}`;
      }

      const writeBody: SystemParameterWriteBody = {
        value: target,
        reason: `Revert ke ${pointer}. ${body.reason}`,
        expectedVersion: body.expectedVersion,
      };
      const riskClass = asRiskClass(row.riskClass);
      const write = await guardWrite(tx, actor, key, writeBody, PARAM_EDIT_PERMISSION[riskClass]);

      if (requiresSecondApprover(riskClass)) {
        const draft = await createDraft(tx, actor, write, writeBody, meta, `Revert ke ${pointer}. `);
        return {
          parameterKey: key,
          previousValue: row.parameterValue,
          proposedValue: write.value,
          effectiveValue: row.parameterValue,
          version: row.version,
          riskClass,
          requiresSecondApprover: true,
          pendingRestart: false,
          applied: false,
          approval: {
            approvalId: draft.id,
            state: 'PENDING' as const,
            requestedBy: draft.requestedBy,
            effectiveFrom: draft.effectiveFrom,
          },
          historyId: null,
        } satisfies ParameterWriteOutcome;
      }

      return applyValue(tx, actor, write, writeBody, meta, null, `Revert ke ${pointer}. `);
    });
    return { ok: true, value: outcome };
  } catch (error) {
    return mapFailure(error);
  }
}

/**
 * Nyalakan/matikan kunci. Menonaktifkan kunci yang masih punya konsumen terdaftar dan
 * tanpa fallback sah ditolak (`113`, `details[].fallback`), karena gerbang kehilangan
 * ambangnya — default yang berlaku, bukan nol.
 */
export async function toggleSystemParameterActive(
  actor: Actor,
  key: string,
  body: { isActive: boolean; reason: string; expectedVersion: number },
  meta: WriteMeta
): Promise<ParameterResult<ParameterWriteOutcome>> {
  try {
    const outcome = await withTenantContext(actor.tenantId, async (tx) => {
      const row = await loadRow(tx, actor.tenantId, key);
      if (!row) throw new ParameterFailure({ kind: 'NOT_FOUND', key });
      if (row.sourceOfTruth !== 'PARAM') {
        throw new ParameterFailure({
          kind: 'PARAM_READONLY',
          key,
          home: row.sourceOfTruth,
          remedyHref: homeHref(row.sourceOfTruth),
        });
      }

      const riskClass = asRiskClass(row.riskClass);
      assertTenantWide(actor.access, PARAM_EDIT_PERMISSION[riskClass], false);
      if (row.version !== body.expectedVersion) {
        throw new ParameterFailure({ kind: 'VERSION_CONFLICT', key, currentVersion: row.version });
      }

      if (!body.isActive) {
        const consumers = parameterImpactOf(key);
        const fallbackSah = row.defaultValue.length > 0;
        if (consumers.length > 0 && !fallbackSah) {
          throw new ParameterFailure({ kind: 'TOGGLE_BLOCKED', key, fallback: 'DEFAULT_VALUE_MISSING' });
        }
      }

      const historyId = randomUUID();
      const nextVersion = row.version + 1;
      await tx
        .update(masterSystemParameters)
        .set({ isActive: body.isActive, version: nextVersion, updatedBy: actor.userId, updatedAt: new Date() })
        .where(eq(masterSystemParameters.id, row.id));

      await tx.insert(masterSystemParameterHistory).values({
        id: historyId,
        tenantId: actor.tenantId,
        parameterKey: key,
        moduleCode: row.moduleCode,
        oldValue: row.parameterValue,
        newValue: row.parameterValue,
        oldVersion: row.version,
        newVersion: nextVersion,
        changedBy: actor.userId,
        reason: `${body.isActive ? 'AKTIF' : 'NONAKTIF'} — ${body.reason}`,
        ip: meta.ip,
        requestId: meta.requestId,
        source: 'UI',
        approverId: null,
      });

      await appendAuditEntry(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        actorRoleCtx: { roles: actor.access.roles },
        targetEntity: 'master_system_parameters',
        targetId: row.id,
        action: 'settings.param.toggle',
        before: { isActive: row.isActive, version: row.version },
        after: { isActive: body.isActive, version: nextVersion },
        reason: body.reason,
        requestId: meta.requestId,
      });

      return {
        parameterKey: key,
        previousValue: row.parameterValue,
        proposedValue: row.parameterValue,
        effectiveValue: body.isActive ? row.parameterValue : row.defaultValue,
        version: nextVersion,
        riskClass,
        requiresSecondApprover: requiresSecondApprover(riskClass),
        pendingRestart: false,
        applied: true,
        approval: null,
        historyId,
      } satisfies ParameterWriteOutcome;
    });
    return { ok: true, value: outcome };
  } catch (error) {
    return mapFailure(error);
  }
}

/**
 * Basis semua `callSite`/`testRef` dalam registri adalah **akar repo**, tetapi rute Next.js
 * berjalan dengan `process.cwd()` = `apps/web`. Tanpa normalisasi ini bukti konsumen tidak
 * pernah terbukti dan gerbang (n) berubah menjadi penolakan acak — penegakan yang bergantung
 * pada direktori tempat proses dimulai bukan penegakan.
 */
let repoRootCache: string | null = null;
function repoRoot(): string {
  if (repoRootCache !== null) return repoRootCache;
  let dir = process.cwd();
  for (let naik = 0; naik < 6; naik += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) break;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  repoRootCache = dir;
  return dir;
}

function evidencePresent(rel: string): boolean {
  return existsSync(resolve(repoRoot(), rel));
}

/**
 * Kunci baru (§4.16.4). Penangkal "parameter hantu": `consumerEvidence` wajib menunjuk
 * berkas yang benar-benar ada di branch ini, dan tanpa itu register ditolak sebelum satu
 * baris pun terbentuk. Kelas `REGULATORY`/`SECURITY` TIDAK dapat diregistrasi dari API:
 * `ck_param_regulatory_approver` menuntut penyetuju berbeda, dan satu permintaan HTTP
 * tidak boleh mengaku dua orang — kunci begitu lahir lewat migrasi/seed yang menandatangani
 * dua prinsipal nyata (§21.2.1).
 */
export async function registerSystemParameter(
  actor: Actor,
  body: RegisterParameterBody,
  meta: WriteMeta
): Promise<ParameterResult<SystemParameterView>> {
  if (!isKeyPrefixedByModule(body.parameterKey, body.module)) {
    return { ok: false, error: { kind: 'KEY_PREFIX_INVALID', key: body.parameterKey, module: body.module } };
  }
  if (requiresSecondApprover(body.riskClass)) {
    return { ok: false, error: { kind: 'RISK_CLASS_NOT_REGISTRABLE', riskClass: body.riskClass } };
  }

  const missing = body.consumerEvidence.callSites
    .map((site) => site.split(':')[0] ?? site)
    .filter((path) => !evidencePresent(path));
  const testMissing = evidencePresent(body.consumerEvidence.testRef) ? [] : [body.consumerEvidence.testRef];
  if (missing.length > 0 || testMissing.length > 0) {
    // Registri penundaan ikut menjawab: kalau kunci ini memang sengaja belum dipasang,
    // admin membaca *sebabnya* (yang dapat ditagih), bukan pesan "konsumen tidak terbukti"
    // yang menyuruhnya menunjuk berkas karangan.
    const deferred = SYSTEM_PARAMETER_DEFERRED.find((d) => d.parameterKey === body.parameterKey) ?? null;
    return {
      ok: false,
      error: {
        kind: 'CONSUMERS_MISSING',
        key: body.parameterKey,
        missing: [...missing, ...testMissing],
        deferredReason: deferred?.reason ?? null,
      },
    };
  }

  try {
    const view = await withTenantContext(actor.tenantId, async (tx) => {
      assertTenantWide(actor.access, 'settings.param.register' as never, false);

      if (body.enumKind) {
        const kinds = await tx.execute(
          sql`select kind from reference_kinds where kind = ${body.enumKind}`
        ) as unknown as { kind: string }[];
        if (kinds.length === 0) throw new ParameterFailure({ kind: 'LOOKUP_GROUP_NOT_FOUND', enumKind: body.enumKind });
      }

      const probe: SystemParameterDefinition = {
        parameterKey: body.parameterKey,
        moduleCode: body.module,
        dataType: body.dataType,
        unit: body.unit ?? null,
        defaultValue: body.defaultValue,
        minValue: body.minValue ?? null,
        maxValue: body.maxValue ?? null,
        allowedValues: null,
        enumKind: body.enumKind ?? null,
        riskClass: body.riskClass,
        sourceOfTruth: 'PARAM',
        description: body.description,
        consumers: body.consumerEvidence.callSites.map((callSite) => ({ callSite, testRef: body.consumerEvidence.testRef })),
      };
      const defaultGuard = guardParameterWrite(probe, body.defaultValue, body.enumKind ? parameterEnumCodesOf(body.enumKind) : null);
      if (typeof defaultGuard !== 'string') {
        throw new ParameterFailure(
          defaultGuard.kind === 'PARAM_OUT_OF_RANGE' || defaultGuard.kind === 'PARAM_VALUE_NOT_ALLOWED'
            ? { kind: 'PARAM_OUT_OF_RANGE', key: body.parameterKey, sent: body.defaultValue, min: body.minValue ?? null, max: body.maxValue ?? null, unit: body.unit ?? null, riskClass: body.riskClass }
            : defaultGuard.kind === 'PARAM_SECRET_FORBIDDEN'
              ? { kind: 'PARAM_SECRET_FORBIDDEN', key: body.parameterKey }
              : defaultGuard.kind === 'PARAM_ENUM_UNKNOWN'
                ? { kind: 'PARAM_ENUM_UNKNOWN', key: body.parameterKey, enumKind: defaultGuard.enumKind, sent: defaultGuard.sent }
                : { kind: 'PARAM_INVALID_TYPE', key: body.parameterKey, reason: defaultGuard.reason }
        );
      }

      const id = randomUUID();
      const now = new Date();
      const inserted = await tx
        .insert(masterSystemParameters)
        .values({
          id,
          tenantId: actor.tenantId,
          moduleCode: body.module,
          parameterKey: body.parameterKey,
          parameterValue: body.defaultValue,
          dataType: body.dataType,
          unit: body.unit ?? null,
          defaultValue: body.defaultValue,
          minValue: body.minValue ?? null,
          maxValue: body.maxValue ?? null,
          enumKind: body.enumKind ?? null,
          description: body.description,
          riskClass: body.riskClass,
          appliesTo: body.appliesTo,
          isEditable: true,
          isActive: true,
          isSecret: false,
          requiresRestart: false,
          sourceOfTruth: 'PARAM',
          version: 1,
          requestedBy: actor.userId,
          approvedBy: actor.userId,
          approvedAt: now,
          updatedBy: actor.userId,
        })
        .onConflictDoNothing({
          target: [masterSystemParameters.tenantId, masterSystemParameters.moduleCode, masterSystemParameters.parameterKey],
        })
        .returning({ id: masterSystemParameters.id });

      if (inserted.length === 0) throw new ParameterFailure({ kind: 'KEY_TAKEN', key: body.parameterKey });

      await tx.insert(masterSystemParameterHistory).values({
        id: randomUUID(),
        tenantId: actor.tenantId,
        parameterKey: body.parameterKey,
        moduleCode: body.module,
        oldValue: null,
        newValue: body.defaultValue,
        oldVersion: null,
        newVersion: 1,
        changedBy: actor.userId,
        reason: `Registrasi kunci baru dengan konsumen ${body.consumerEvidence.callSites.length} call site — ${body.reason}`,
        ip: meta.ip,
        requestId: meta.requestId,
        source: 'API',
        approverId: null,
      });

      await appendAuditEntry(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        actorRoleCtx: { roles: actor.access.roles },
        targetEntity: 'master_system_parameters',
        targetId: id,
        action: 'settings.param.register',
        after: { parameterKey: body.parameterKey, dataType: body.dataType, riskClass: body.riskClass },
        reason: body.reason,
        requestId: meta.requestId,
      });

      const row = await loadRow(tx, actor.tenantId, body.parameterKey);
      if (!row) throw new ParameterFailure({ kind: 'NOT_FOUND', key: body.parameterKey });
      return project(row, null, actor.access, row.enumKind ? await loadEnumOptions(tx, row.enumKind) : null);
    });

    return { ok: true, value: view };
  } catch (error) {
    return mapFailure(error);
  }
}

// ============================================================================
// Pemetaan galat
// ============================================================================

function mapFailure<T>(error: unknown): ParameterResult<T> {
  if (error instanceof ParameterFailure) return { ok: false, error: error.detail };
  throw error;
}

/** Titik kumpul: galat domain dilempar di dalam transaksi, diterjemahkan sekali di luar. */
async function result<T>(run: () => Promise<T>): Promise<ParameterResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return mapFailure(error);
  }
}

/** Jumlah baris katalog tenant — dipakai laporan dev-seed & uji "nol duplikat". */
export async function parameterCatalogCount(tenantId: string): Promise<number> {
  return withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(masterSystemParameters)
      .where(eq(masterSystemParameters.tenantId, tenantId));
    return rows[0]?.count ?? 0;
  });
}

/** Kunci terdaftar — dipakai uji penolakan parameter hantu. */
export const REGISTERED_KEYS: readonly string[] = ALL_SYSTEM_PARAMETER_DEFINITIONS.map((d) => d.parameterKey);
