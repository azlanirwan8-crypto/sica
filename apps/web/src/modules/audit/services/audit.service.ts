/**
 * Emitter & verifier rantai audit (M-05, FR-AUD; DATA_MODEL §4.1, AC-AUD-1/2).
 *
 * Rantai hash TIDAK dibuat oleh trigger naif: satu baris `audit_chain_head` per
 * (tenant, bulan partisi) di-lock `SELECT ... FOR UPDATE`, sehingga penulisan
 * berurut dan setiap `hash = SHA-256(prev_hash || canonical(payload))`.
 * Urutan replay verifier = urutan emitter: `occurred_at, id` (transaksi head-lock
 * menjamin both monotone; seri timestamp mikrodetik yang identik praktis mustahil).
 * Nol dependensi eksternal, nol egress (AGENTS §3.9).
 */
import { createHash, randomUUID } from 'node:crypto';
import { and, asc, auditChainHead, auditLogs, eq, gte, lt, type TenantTx } from '@sica/database';

const GENESIS_HASH = Buffer.alloc(32, 0);
const HASH_BYTES = 32;

export interface AuditEntryInput {
  readonly tenantId: string;
  readonly actorUserId: string | null;
  readonly actorRoleCtx?: unknown;
  readonly targetEntity: string;
  readonly targetId?: string | null;
  readonly action: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly reason?: string | null;
  readonly requestId?: string | null;
  readonly ipHash?: Buffer | null;
  readonly userAgentHash?: Buffer | null;
}

/** JSON kanonik: kunci disortir rekursif — byte-identik di Web & Flutter (ADR-5 parity). */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Buffer.isBuffer(value)) return JSON.stringify(value.toString('hex'));
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter((k) => record[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}

function chainPayload(row: {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  targetEntity: string;
  targetId: string | null;
  action: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  requestId: string | null;
  occurredAt: Date;
}): string {
  return canonicalJson({
    id: row.id,
    tenant_id: row.tenantId,
    actor_user_id: row.actorUserId,
    target_entity: row.targetEntity,
    target_id: row.targetId,
    action: row.action,
    before: row.before,
    after: row.after,
    reason: row.reason,
    request_id: row.requestId,
    occurred_at: row.occurredAt.toISOString(),
  });
}

function digest(prevHash: Buffer, payload: string): Buffer {
  return createHash('sha256').update(prevHash).update(payload, 'utf8').digest();
}

/** Awal bulan partisi tempat `occurredAt` jatuh — kunci rantai §4.1 (kolom `date` ↔ string ISO). */
function partitionStart(occurredAt: Date): string {
  const y = occurredAt.getUTCFullYear();
  const m = occurredAt.getUTCMonth() + 1;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
}

/**
 * Sisipkan satu baris audit dan majukan kepala rantai. WAJIB dipanggil di dalam
 * transaksi yang sama dengan perubahan domain yang dicatat (I-1) — pemanggil
 * menyuplai `tx`; tabel ini append-only (trigger + REVOKE di 0012 menolaknya
 * dari jalur lain).
 */
export async function appendAuditEntry(tx: TenantTx, input: AuditEntryInput): Promise<string> {
  const id = randomUUID();
  const occurredAt = new Date();
  const start = partitionStart(occurredAt);

  const heads = await tx
    .select()
    .from(auditChainHead)
    .where(and(eq(auditChainHead.tenantId, input.tenantId), eq(auditChainHead.partitionStart, start)))
    .for('update');

  const prevHash = heads[0] ? Buffer.from(heads[0].lastHash) : GENESIS_HASH;

  const row = {
    id,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorRoleCtx: input.actorRoleCtx ?? null,
    targetEntity: input.targetEntity,
    targetId: input.targetId ?? null,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
    requestId: input.requestId ?? null,
    ipHash: input.ipHash ?? null,
    userAgentHash: input.userAgentHash ?? null,
    occurredAt,
    prevHash,
    hash: digest(
      prevHash,
      chainPayload({
        id,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        targetEntity: input.targetEntity,
        targetId: input.targetId ?? null,
        action: input.action,
        before: input.before ?? null,
        after: input.after ?? null,
        reason: input.reason ?? null,
        requestId: input.requestId ?? null,
        occurredAt,
      })
    ),
  };

  await tx.insert(auditLogs).values(row);

  await tx
    .insert(auditChainHead)
    .values({ tenantId: input.tenantId, partitionStart: start, lastHash: row.hash, lastAuditId: id })
    .onConflictDoUpdate({
      target: [auditChainHead.tenantId, auditChainHead.partitionStart],
      set: { lastHash: row.hash, lastAuditId: id, updatedAt: new Date() },
    });

  return id;
}

export interface ChainVerifyResult {
  readonly ok: boolean;
  readonly checked: number;
  readonly firstMismatchId: string | null;
  readonly reason: string | null;
}

/**
 * Verifikasi ulang rantai satu tenant pada jendela waktu. `HASH_MISMATCH` = ada baris
 * diubah/dihapus/disisipkan ulang di luar emitter (bukti tamper). Dipakai rute
 * `POST /platform/audit/verify-chain` dan uji CI (k: baris diubah → verifier menolak).
 */
export async function verifyAuditChain(
  tx: TenantTx,
  tenantId: string,
  from: Date,
  to: Date
): Promise<ChainVerifyResult> {
  const rows = await tx
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, tenantId),
        gte(auditLogs.occurredAt, from),
        lt(auditLogs.occurredAt, to)
      )
    )
    .orderBy(asc(auditLogs.occurredAt), asc(auditLogs.id));

  let prevHash = GENESIS_HASH;
  for (const row of rows) {
    const expected = digest(prevHash, chainPayload(row));
    const actual = Buffer.from(row.hash);
    if (actual.length !== HASH_BYTES || !actual.equals(expected)) {
      return {
        ok: false,
        checked: rows.indexOf(row) + 1,
        firstMismatchId: row.id,
        reason: 'HASH_MISMATCH',
      };
    }
    prevHash = actual;
  }
  return { ok: true, checked: rows.length, firstMismatchId: null, reason: null };
}

/** Hash identitas IP/UA untuk kolom `*_hash` (UU PDP: jejak tanpa alamat telanjang). */
export function identityHash(value: string | null | undefined, pepper: string): Buffer | null {
  if (!value) return null;
  return createHash('sha256').update(pepper).update(value).digest();
}
