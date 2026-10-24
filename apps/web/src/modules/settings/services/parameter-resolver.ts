/**
 * Resolver keadaan efektif (`API_SPEC §4.16.5`, `DATA_MODEL §21.2`, `SPE-6`).
 *
 * Kontrak yang membuat layar Web, kartu Flutter, dan titik keputusan server membaca
 * ANGKA YANG SAMA: resolusi terjadi di sini, di server, dan tidak pernah di klien.
 * Urutannya tetap dan tidak dapat dibalik:
 *   (1) `is_active` → (2) jendela `effective_from/to` pada tanggal itu →
 *   (3) baris `applies_to` PALING SPESIFIK yang cocok dengan konteks peminta →
 *   (4) baris tenant tanpa scope → (5) `default_value`.
 *
 * Dua keadaan yang sengaja bukan kegagalan senyap:
 *  - **Dua baris ACTIVE dengan spesifisitas sama** = konfigurasi rusak → `CONFLICT` (12),
 *    bukan "yang terakhir menang" (pola yang sama dengan matriks tarif, register 105).
 *  - **Kunci tak terdaftar / modul non-aktif** → `unresolvedKeys[]` dengan sebab, HTTP tetap
 *    200. Satu layar yang meminta 12 kunci tidak boleh gugur karena satu modul belum dibeli;
 *    tetapi permintaan SATU kunci modul non-aktif dijawab `404 MODULE_NOT_AVAILABLE` —
 *    entitlement memotong lebih dulu dari role.
 *
 * Cache: in-process per `(tenant, fingerprint, set kunci)`. Redis adalah lapisan kedua yang
 * BELUM ada (`RD-11`, `P-6`) — tidak ada satu pun kata "Redis-ready" di berkas ini.
 */
import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, masterSystemParameters, sql, withTenantContext } from '@sica/database';
import {
  PARAM_VIEW_PERMISSION,
  PARAMETER_MODULE_TO_ENTITLEMENT,
  requiresSecondApprover,
  type EffectiveSetting,
  type ParameterModuleCode,
  type ParameterRiskClass,
} from '@sica/contracts';
import { holdsScoped, type EffectiveAccess } from '@/modules/authz/rbac-repository';

type ParamRow = typeof masterSystemParameters.$inferSelect;

export interface ScopeContext {
  readonly programId?: string | null;
  readonly siteId?: string | null;
  readonly periodId?: string | null;
  readonly programType?: string | null;
  /** Rekonstruksi "aturan mana yang berlaku tanggal itu" (BR-R12); baku = hari ini. */
  readonly at?: string | null;
}

export interface EffectiveResolution {
  readonly resolvedAt: string;
  readonly settings: readonly EffectiveSetting[];
  readonly unresolvedKeys: readonly { key: string; reason: 'NOT_REGISTERED' | 'MODULE_NOT_AVAILABLE' }[];
  readonly parameterVersion: string;
  readonly etag: string;
}

export type ResolveFailure = {
  readonly kind: 'AMBIGUOUS_SCOPE';
  readonly key: string;
  readonly candidates: readonly string[];
};

export type ResolveResult =
  | { readonly ok: true; readonly value: EffectiveResolution }
  | { readonly ok: false; readonly error: ResolveFailure };

const ACTIVE_MODULE_STATUSES = new Set(['ACTIVE', 'TRIAL']);

/** Cache baris per tenant,divalidasi oleh fingerprint (jumlah baris + updatedAt tertua/terbaru). */
const rowCache = new Map<string, { fingerprint: string; rows: readonly ParamRow[] }>();
const CACHE_LIMIT = 64;

async function loadTenantRows(tenantId: string): Promise<readonly ParamRow[]> {
  const stamp = await withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select({
        fingerprint: sql<string>`count(*)::text || '-' || coalesce(max(${masterSystemParameters.updatedAt})::text, 'none')`,
      })
      .from(masterSystemParameters)
      .where(eq(masterSystemParameters.tenantId, tenantId));
    return rows[0]?.fingerprint ?? 'empty';
  });

  const cached = rowCache.get(tenantId);
  if (cached && cached.fingerprint === stamp) return cached.rows;

  const rows = await withTenantContext(tenantId, async (tx) =>
    tx.select().from(masterSystemParameters).where(eq(masterSystemParameters.tenantId, tenantId))
  );

  if (rowCache.size >= CACHE_LIMIT) rowCache.clear();
  rowCache.set(tenantId, { fingerprint: stamp, rows });
  return rows;
}

function list(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Sejauh mana `applies_to` cocok dengan konteks; `-1` = tidak cocok. */
function specificityOf(row: ParamRow, context: ScopeContext): number {
  const scope = (row.appliesTo ?? {}) as Record<string, unknown>;
  let score = 0;

  const programs = list(scope['programIds']);
  if (programs.length > 0) {
    if (!context.programId || !programs.includes(context.programId)) return -1;
    score += 1;
  }
  const sites = list(scope['sites']);
  if (sites.length > 0) {
    if (!context.siteId || !sites.includes(context.siteId)) return -1;
    score += 1;
  }
  const types = list(scope['programTypes']);
  if (types.length > 0) {
    if (!context.programType || !types.includes(context.programType)) return -1;
    score += 1;
  }
  const periods = list(scope['periods']);
  if (periods.length > 0) {
    if (!context.periodId || !periods.includes(context.periodId)) return -1;
    score += 1;
  }
  return score;
}

function typedProjection(row: ParamRow): EffectiveSetting['value'] {
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

/**
 * Keadaan efektif untuk satu permintaan klien (§4.16.5). `activeModules` dibawa dari pemanggil
 * (satu bacaan `tenant_modules` per permintaan, bukan per kunci).
 */
export async function resolveEffectiveSettings(
  tenantId: string,
  keys: readonly string[],
  context: ScopeContext,
  access: EffectiveAccess | null,
  activeModules: ReadonlySet<string>
): Promise<ResolveResult> {
  const rows = await loadTenantRows(tenantId);
  const byKey = new Map<string, ParamRow[]>();
  for (const row of rows) {
    const bucket = byKey.get(row.parameterKey);
    if (bucket) bucket.push(row);
    else byKey.set(row.parameterKey, [row]);
  }

  const on = context.at ?? new Date().toISOString().slice(0, 10);
  const settings: EffectiveSetting[] = [];
  const unresolved: { key: string; reason: 'NOT_REGISTERED' | 'MODULE_NOT_AVAILABLE' }[] = [];

  for (const key of keys) {
    const candidates = byKey.get(key) ?? [];
    if (candidates.length === 0) {
      unresolved.push({ key, reason: 'NOT_REGISTERED' });
      continue;
    }

    const moduleCode = candidates[0]?.moduleCode as ParameterModuleCode;
    const entitlement = PARAMETER_MODULE_TO_ENTITLEMENT[moduleCode];
    if (entitlement && !activeModules.has(entitlement)) {
      unresolved.push({ key, reason: 'MODULE_NOT_AVAILABLE' });
      continue;
    }

    const live = candidates.filter(
      (row) =>
        row.isActive &&
        row.sourceOfTruth === 'PARAM' &&
        (row.effectiveFrom === null || row.effectiveFrom <= on) &&
        (row.effectiveTo === null || row.effectiveTo >= on)
    );
    if (live.length === 0) {
      unresolved.push({ key, reason: 'NOT_REGISTERED' });
      continue;
    }

    const scored = live
      .map((row) => ({ row, score: specificityOf(row, context) }))
      .filter((entry) => entry.score >= 0);
    if (scored.length === 0) {
      unresolved.push({ key, reason: 'NOT_REGISTERED' });
      continue;
    }
    const best = Math.max(...scored.map((entry) => entry.score));
    const winners = scored.filter((entry) => entry.score === best);
    if (winners.length > 1) {
      return {
        ok: false,
        error: {
          kind: 'AMBIGUOUS_SCOPE',
          key,
          candidates: winners.map((entry) => entry.row.id),
        },
      };
    }

    const row = winners[0]?.row as ParamRow;
    const riskClass = row.riskClass as ParameterRiskClass;
    const masked =
      requiresSecondApprover(riskClass) &&
      access !== null &&
      !holdsScoped(access, PARAM_VIEW_PERMISSION[riskClass]);

    settings.push({
      key,
      value: masked ? null : typedProjection(row),
      dataType: row.dataType,
      unit: row.unit,
      source: best > 0 ? 'SCOPE_PARAM' : 'TENANT_PARAM',
      version: row.version,
      riskClass,
      enumKind: row.enumKind,
      enumLabel: null,
      ...(masked ? { masked: true, maskedReason: 'READ_ROLE_NOT_ALLOWED' } : {}),
    });
  }

  const parameterVersion = versionOf(tenantId, settings);
  return {
    ok: true,
    value: {
      resolvedAt: new Date().toISOString(),
      settings,
      unresolvedKeys: unresolved,
      parameterVersion,
      etag: `W/"${parameterVersion}"`,
    },
  };
}

/** `<tenant8>-<h8>` atas proyeksi `(key, value, version)` dalam urutan yang diminta (§4.16.5). */
function versionOf(tenantId: string, settings: readonly EffectiveSetting[]): string {
  const digest = createHash('sha256');
  for (const setting of settings) {
    digest.update(`${setting.key}=${JSON.stringify(setting.value)}@${setting.version}\n`);
  }
  return `${tenantId.slice(0, 8)}-${digest.digest('hex').slice(0, 8)}`;
}

/**
 * Bacaan satu angka untuk titik keputusan server (dashboard, QR, gerbang KRS).
 * TIDAK bermasking: yang memanggil adalah kode server yang memang memegang ambangnya untuk
 * memutuskan — masking adalah hak TAMPIL pengguna (§4.16.5 butir "ambang keputusan").
 */
export async function readParameterRaw(
  tenantId: string,
  key: string,
  context: ScopeContext = {}
): Promise<string | null> {
  const rows = await loadTenantRows(tenantId);
  const on = context.at ?? new Date().toISOString().slice(0, 10);
  const candidates = rows
    .filter(
      (row) =>
        row.parameterKey === key &&
        row.isActive &&
        row.sourceOfTruth === 'PARAM' &&
        (row.effectiveFrom === null || row.effectiveFrom <= on) &&
        (row.effectiveTo === null || row.effectiveTo >= on)
    )
    .map((row) => ({ row, score: specificityOf(row, context) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  const winner = candidates[0];
  if (winner) return winner.row.parameterValue;

  const fallback = rows.find((row) => row.parameterKey === key && row.sourceOfTruth === 'PARAM');
  return fallback ? fallback.defaultValue : null;
}

export async function readParameterNumber(
  tenantId: string,
  key: string,
  fallback: number,
  context: ScopeContext = {}
): Promise<number> {
  const raw = await readParameterRaw(tenantId, key, context);
  const parsed = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function readParameterBool(
  tenantId: string,
  key: string,
  fallback: boolean,
  context: ScopeContext = {}
): Promise<boolean> {
  const raw = await readParameterRaw(tenantId, key, context);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

/** Daftar modul aktif tenant — dipakai resolver untuk potongan entitlement. */
export async function loadActiveModuleCodes(tenantId: string): Promise<ReadonlySet<string>> {
  return withTenantContext(tenantId, async (tx) => {
    const rows = await tx.execute(
      sql`select m.code as code, tm.status as status
            from tenant_modules tm join modules m on m.id = tm.module_id
           where tm.tenant_id = ${tenantId}`
    ) as unknown as { code: string; status: string }[];
    return new Set(rows.filter((r) => ACTIVE_MODULE_STATUSES.has(r.status)).map((r) => r.code));
  });
}

/** Urutan baca deterministik untuk daftar kunci tenant (dipakai uji & proyeksi dampak). */
export async function listTenantParameterKeys(tenantId: string): Promise<readonly string[]> {
  const rows = await withTenantContext(tenantId, async (tx) =>
    tx
      .select({ parameterKey: masterSystemParameters.parameterKey })
      .from(masterSystemParameters)
      .where(and(eq(masterSystemParameters.tenantId, tenantId)))
      .orderBy(desc(masterSystemParameters.moduleCode), masterSystemParameters.parameterKey)
  );
  return rows.map((r) => r.parameterKey);
}

/** Dipakai uji: pastikan kunci yang di-`inArray` benar-benar tertahan RLS tenant peminta. */
export async function parametersForKeys(tenantId: string, keys: readonly string[]): Promise<readonly ParamRow[]> {
  if (keys.length === 0) return [];
  return withTenantContext(tenantId, async (tx) =>
    tx
      .select()
      .from(masterSystemParameters)
      .where(and(eq(masterSystemParameters.tenantId, tenantId), inArray(masterSystemParameters.parameterKey, [...keys])))
  );
}
