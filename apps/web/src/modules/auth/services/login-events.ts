/**
 * Pencatatan percobaan login (DATA_MODEL §3 `login_events`; 0012).
 * IP & User-Agent tidak pernah disimpan telanjang (UU PDP) — keduanya di-hash SHA-256
 * dengan pepper server. Baris ber-tenant NULL (tenant tak terkenali) tetap tercatat.
 */
import { createHash, randomUUID } from 'node:crypto';
import { db, loginEvents, withTenantContext } from '@sica/database';

export type LoginEventOutcome =
  | 'SUCCESS'
  | 'BAD_PASSWORD'
  | 'MFA_FAIL'
  | 'MFA_MISSING'
  | 'LOCKED'
  | 'UNKNOWN_USER'
  | 'TENANT_SUSPENDED';

function pepperedHash(value: string | null | undefined): Buffer | null {
  if (!value) return null;
  const pepper = process.env['PASSWORD_HASH_PEPPER'] ?? '';
  return createHash('sha256').update(pepper).update(value).digest();
}

export async function recordLoginEvent(input: {
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly emailAttempted: string | null;
  readonly outcome: LoginEventOutcome;
  readonly ip: string | null;
  readonly userAgent: string | null;
}): Promise<void> {
  const row = {
    id: randomUUID(),
    tenantId: input.tenantId,
    userId: input.userId,
    emailAttempted: input.emailAttempted,
    outcome: input.outcome,
    ipHash: pepperedHash(input.ip),
    userAgentHash: pepperedHash(input.userAgent),
  };
  if (input.tenantId) {
    await withTenantContext(input.tenantId, async (tx) => {
      await tx.insert(loginEvents).values(row);
    });
    return;
  }
  await db.insert(loginEvents).values(row);
}
