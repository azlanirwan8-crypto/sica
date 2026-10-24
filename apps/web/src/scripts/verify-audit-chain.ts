/**
 * Bukti gerbang CI (k): "baris diubah → verifier harus menghasilkan HASH_MISMATCH".
 *
 * Rantai TIDAK dapat di-UPDATE (trigger + REVOKE di 0012), jadi pemalsuan disimulasikan
 * dengan menyisipkan baris ke-4 yang hash-nya salah — persis bentuk serangan "sisip baris".
 * Tenant uji dibuat tersendiri supaya barisnya (append-only, selamanya) tidak mengotori
 * rantai tenant demo.
 *
 * Jalankan: pnpm --filter @sica/web verify:chain
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

async function main(): Promise<void> {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    const k = m?.[1];
    const v = m?.[2];
    if (k && v !== undefined && process.env[k] === undefined) process.env[k] = v.replace(/^"|"$/g, '');
  }

  const dbMod = await import('@sica/database');
  const { db, tenants, withTenantContext } = dbMod;
  const { appendAuditEntry, verifyAuditChain } = await import('../modules/audit/services/audit.service');

  const tenantId = randomUUID();
  const from = new Date(Date.now() - 60_000);
  const to = new Date(Date.now() + 60_000);
  await db.insert(tenants).values({
    id: tenantId,
    slug: `chain-proof-${tenantId.slice(0, 8)}`,
    legalName: 'Tenant Bukti Rantai Audit',
    status: 'ACTIVE',
  });

  let failures = 0;

  await withTenantContext(tenantId, async (tx) => {
    for (let i = 1; i <= 3; i += 1) {
      await appendAuditEntry(tx, {
        tenantId,
        actorUserId: null,
        targetEntity: 'chain.proof',
        action: `chain.proof.step.${i}`,
        after: { i },
      });
    }
    const good = await verifyAuditChain(tx, tenantId, from, to);
    if (good.ok && good.checked === 3) {
      console.log('PASS  rantai bersih terverifikasi (3 baris, tanpa mismatch)');
    } else {
      failures += 1;
      console.log('FAIL  rantai bersih seharusnya lolos →', JSON.stringify(good));
    }
  });

  await withTenantContext(tenantId, async (tx) => {
    const tamperedAt = new Date(Date.now() + 1000);
    await tx.execute(
      // Sisipan "rusak": hash 32 byte yang benar-benar tidak cocok dengan payload baris.
      // `occurred_at` dipakai eksplisit (bukan `now()` server) karena jam pooler bisa
      // berbeda dari jam proses — jendela verifikasi memakai basis waktu emitter.
      (await import('@sica/database')).sql`
        INSERT INTO audit_logs (id, tenant_id, target_entity, action, occurred_at, hash)
        VALUES (${randomUUID()}, ${tenantId}, 'chain.proof', 'chain.proof.tampered', ${tamperedAt.toISOString()}::timestamptz, ${Buffer.alloc(32, 9)})
      `
    );
    const bad = await verifyAuditChain(tx, tenantId, from, new Date(Date.now() + 60_000));
    if (!bad.ok && bad.reason === 'HASH_MISMATCH' && bad.firstMismatchId) {
      console.log(`PASS  sisipan palsu terdeteksi → HASH_MISMATCH pada baris ke-${bad.checked} (${bad.firstMismatchId})`);
    } else {
      failures += 1;
      console.log('FAIL  verifier tidak menandai rantai yang disusupi →', JSON.stringify(bad));
    }
  });

  console.log(`tenant bukti rantai (append-only, dibiarkan): ${tenantId}`);
  if (failures > 0) process.exit(1);
  console.log('VERIFY-CHAIN: HIJAU — bukti gerbang CI (k) nyata di PostgreSQL');
}

main().catch((error: unknown) => {
  console.error('VERIFY-CHAIN GAGAL:', (error as Error).message);
  process.exit(1);
});
