/**
 * Seed katalog parameter sistem (`SPE-2`, `DATA_MODEL §21.3`, `0049`+`0088`).
 *
 * Yang dijamin fungsi ini, dan hanya itu:
 *  - **Idempoten.** `UNIQUE (tenant_id, module_code, parameter_key)` + `onConflictDoNothing`:
 *    dijalankan dua kali = nol duplikat DAN nol penimpaan. Seed yang menimpa nilai membuat
 *    layar Admin kehilangan alasan untuk percaya angka yang ada di DB.
 *  - **Dua prinsipal nyata.** Baris kelas `REGULATORY`/`SECURITY` tidak dapat lahir tanpa
 *    `approved_by IS NOT NULL AND approved_by <> requested_by` (`ck_param_regulatory_approver`).
 *    Itu bukan formalitas: yang "mengajukan" adalah admin tenant (pemilik konfigurasi),
 *    yang "menyetujui" adalah operator provisioning. Keduanya orang sungguhan dari token
 *    — tidak ada UUID karangan untuk memenuhi CHECK.
 *  - **Baris penemuan tanpa nilai.** `source_of_truth <> 'PARAM'` disimpan dengan
 *    `parameter_value = ''` dan `is_editable = false`; nilainya tidak pernah dibaca dari sini
 *    (`§21.2`), dan `PUT` dijawab `403 PARAM_READONLY` + `remedyHref` (`AC-PG-9`).
 */
import { randomUUID } from 'node:crypto';
import {
  and,
  eq,
  masterSystemParameterHistory,
  masterSystemParameters,
  sql,
  sqlClient,
  withTenantContext,
} from '@sica/database';
import {
  ALL_SYSTEM_PARAMETER_DEFINITIONS,
  PARAMETER_ENUM_SEEDS,
  SYSTEM_PARAMETER_CATALOG,
  SYSTEM_PARAMETER_POINTERS,
  findParameterDefinition,
  type SystemParameterDefinition
} from '@sica/contracts';

export interface ParameterSeedPrincipals {
  /** Admin tenant pemilik konfigurasi (pengajuan). */
  readonly requestedBy: string;
  /** Principal yang menerapkan katalog (penyetuju) — wajib orang berbeda. */
  readonly approvedBy: string;
}

export interface ParameterSeedOutcome {
  readonly inserted: number;
  readonly alreadyPresent: number;
  readonly enumKinds: number;
  readonly enumItems: number;
}

function pointerReason(def: SystemParameterDefinition): string {
  return `Kunci ${def.parameterKey} dirawat di ${def.sourceOfTruth}; baris parameter ini hanya indeks penemuan (DATA_MODEL §21.2).`;
}

function toRow(tenantId: string, def: SystemParameterDefinition, principals: ParameterSeedPrincipals) {
  const isPointer = def.sourceOfTruth !== 'PARAM';
  return {
    id: randomUUID(),
    tenantId,
    moduleCode: def.moduleCode,
    parameterKey: def.parameterKey,
    parameterValue: isPointer ? '' : def.defaultValue,
    // Baris penemuan tidak punya nilai di rumah ini, jadi tidak boleh mengklaim tipe numerik:
    // kolom *generated* `value_num` melakukan `parameter_value::numeric` dan akan gagal pada
    // string kosong. Tipe target sebenarnya tetap tercatat di registri (§21.3) dan ditampilkan
    // layar lewat proyeksi, bukan dari kolom ini.
    dataType: isPointer ? 'STRING' : def.dataType,
    unit: def.unit,
    defaultValue: isPointer ? '' : def.defaultValue,
    minValue: def.minValue,
    maxValue: def.maxValue,
    enumKind: def.enumKind,
    description: def.description,
    riskClass: def.riskClass,
    appliesTo: {} as Record<string, unknown>,
    isEditable: !isPointer,
    isActive: true,
    isSecret: false,
    requiresRestart: false,
    sourceOfTruth: def.sourceOfTruth,
    version: 1,
    requestedBy: principals.requestedBy,
    approvedBy: principals.approvedBy,
    approvedAt: new Date(),
    updatedBy: principals.requestedBy,
  };
}

/**
 * Daftarkan kind + item kamus yang dibutuhkan `enum_kind` katalog ini.
 * Sebagian dari `MDE-11`: nilainya didaftarkan supaya FK `0049` dan penjaga
 * `PARAM_ENUM_UNKNOWN` (§4.16.2 langkah 5) punya sasaran; layar perawatan kamus
 * tetap milik gugus `MDE-*`.
 *
 * Yang didaftarkan HANYA kind yang benar-benar dirujuk sebuah definisi terpasang. Kind yang
 * tidak dirujuk apa pun adalah kamus mati — `AGENTS §3.10` gerbang (n) menuntut setiap kind
 * yang dibaca punya pemakai, dan `kebijakan_rekonsiliasi` untuk sementara tidak punya:
 * konsumennya (rekonsiliasi dua sumber, §21.5) ikut ditunda bersama kuncinya.
 */
async function ensureEnumVocabulary(tenantId: string): Promise<{ kinds: number; items: number }> {
  const referenced = new Set(
    ALL_SYSTEM_PARAMETER_DEFINITIONS.map((d) => d.enumKind).filter((k): k is string => k !== null)
  );
  let kinds = 0;
  let items = 0;

  for (const [kind, spec] of Object.entries(PARAMETER_ENUM_SEEDS)) {
    if (!referenced.has(kind)) continue;

    // `reference_kinds` global (tanpa tenant_id, tanpa RLS — pengecualian §6.2), jadi ditulis
    // lewat klien mentah: `withTenantContext` tidak menambah apa pun di sini.
    await sqlClient`INSERT INTO reference_kinds (kind, label, domain, is_system)
      VALUES (${kind}, ${kind}, ${spec.domain}, true)
      ON CONFLICT (kind) DO NOTHING`;
    kinds += 1;

    await withTenantContext(tenantId, async (tx) => {
      for (const entry of spec.entries) {
        const result = (await tx.execute(
          sql`INSERT INTO reference_items (id, tenant_id, kind, code, name, name_en, sort_order, is_active)
              VALUES (gen_random_uuid(), ${tenantId}, ${kind}, ${entry.code}, ${entry.label}, ${entry.labelEn}, ${entry.order}, true)
              ON CONFLICT (tenant_id, kind, code) DO NOTHING`
        )) as unknown as { count?: number };
        items += Number(result.count ?? 0);
      }
    });
  }

  return { kinds, items };
}

export async function seedSystemParameters(
  tenantId: string,
  principals: ParameterSeedPrincipals
): Promise<ParameterSeedOutcome> {
  if (principals.requestedBy === principals.approvedBy) {
    throw new Error('Seed parameter menuntut dua prinsipal berbeda (ck_param_regulatory_approver, DATA_MODEL §21.2).');
  }

  const vocabulary = await ensureEnumVocabulary(tenantId);

  let inserted = 0;

  await withTenantContext(tenantId, async (tx) => {
    for (const def of ALL_SYSTEM_PARAMETER_DEFINITIONS) {
      const row = toRow(tenantId, def, principals);
      const written = await tx
        .insert(masterSystemParameters)
        .values(row)
        .onConflictDoNothing({
          target: [masterSystemParameters.tenantId, masterSystemParameters.moduleCode, masterSystemParameters.parameterKey],
        })
        .returning({ id: masterSystemParameters.id });

      if (written.length === 0) continue;
      inserted += 1;

      // Jejak awal: riwayat pertama harus ada supaya "aturan mana yang berlaku saat itu"
      // dapat direkonstruksi mundur sampai hari tenant ini diprovisioning (BR-R12).
      await tx.insert(masterSystemParameterHistory).values({
        id: randomUUID(),
        tenantId,
        parameterKey: def.parameterKey,
        moduleCode: def.moduleCode,
        oldValue: null,
        newValue: row.parameterValue,
        oldVersion: null,
        newVersion: 1,
        changedBy: principals.requestedBy,
        reason:
          def.sourceOfTruth === 'PARAM'
            ? `Katalog §21.3 dipasang saat provisioning (nilai awal ${def.defaultValue}).`
            : pointerReason(def),
        ip: '0.0.0.0',
        source: 'SEED',
        approverId: principals.approvedBy,
      });
    }
  });

  return {
    inserted,
    alreadyPresent: ALL_SYSTEM_PARAMETER_DEFINITIONS.length - inserted,
    enumKinds: vocabulary.kinds,
    enumItems: vocabulary.items,
  };
}

/** Jumlah baris katalog yang dikenal registri — dipakai laporan seed & uji "nol duplikat". */
export function catalogSize(): { param: number; pointer: number; total: number } {
  return {
    param: SYSTEM_PARAMETER_CATALOG.length,
    pointer: SYSTEM_PARAMETER_POINTERS.length,
    total: ALL_SYSTEM_PARAMETER_DEFINITIONS.length,
  };
}

/** Semua kunci terdaftar — dipakai uji penolakan "parameter hantu". */
export function isRegisteredKey(key: string): boolean {
  return findParameterDefinition(key) !== null;
}

/** Proyeksi `applies_to` kosong untuk baris baru (selalu objek, tidak pernah null). */
export const EMPTY_APPLIES_TO: Record<string, unknown> = {};

/** Dipakai uji: jumlah baris parameter milik satu tenant. */
export async function countSeededParameters(tenantId: string): Promise<number> {
  const rows = await withTenantContext(tenantId, async (tx) =>
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(masterSystemParameters)
      .where(and(eq(masterSystemParameters.tenantId, tenantId)))
  );
  return rows[0]?.count ?? 0;
}
