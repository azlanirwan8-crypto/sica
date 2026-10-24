/**
 * POST /api/v1/auth/mfa/confirm — buktikan faktor TOTP dengan kode pertama, lalu pasang
 * `users.mfa_required`. Urutan sengaja dua langkah: memasang wajib-MFA sebelum faktor
 * terbukti akan mengunci akun dari sesi yang tidak pernah bisa ia selesaikan.
 * Perpindahan tercatat di `audit_logs` (rantai hash, 0012) — aksi keamanan wajib jejak (I-1).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  MfaConfirmRequestSchema,
  StandardErrorResponseSchema,
  createSuccessEnvelope,
  MfaConfirmResponseDataSchema,
} from '@sica/contracts';
import { eq, users, withTenantContext } from '@sica/database';
import { extractRequestContext } from '@/lib/api-response';
import { appendAuditEntry } from '@/modules/audit/services/audit.service';
import { confirmTotpFactor } from '@/modules/auth/services/mfa.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Envelope = createSuccessEnvelope(MfaConfirmResponseDataSchema);

function fail(status: number, code: string, message: string, requestId: string, details: unknown[] = []): NextResponse {
  return NextResponse.json(
    StandardErrorResponseSchema.parse({
      success: false,
      error: { code, message, details },
      meta: { timestamp: new Date().toISOString(), requestId },
    }),
    { status }
  );
}

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);
  const requestId = ctx.requestId;

  if (!ctx.authenticated || !ctx.userId || !ctx.tenantId) {
    return fail(401, 'UNAUTHORIZED', 'Autentikasi diperlukan untuk mengonfirmasi MFA.', requestId);
  }
  const userId = ctx.userId;
  const tenantId = ctx.tenantId;

  try {
    const body: unknown = await request.json();
    const parsed = MfaConfirmRequestSchema.safeParse(body);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_FAILED', 'Format permintaan konfirmasi MFA tidak valid.', requestId,
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
    }

    const verified = await confirmTotpFactor(ctx.tenantId, ctx.userId, parsed.data.code);
    if (!verified) {
      return fail(401, 'UNAUTHORIZED', 'Kode tidak cocok atau tidak ada faktor yang menunggu konfirmasi.', requestId);
    }

    await withTenantContext(tenantId, async (tx) => {
      await tx.update(users).set({ mfaRequired: true }).where(eq(users.id, userId));
      await appendAuditEntry(tx, {
        tenantId,
        actorUserId: userId,
        targetEntity: 'mfa_factors',
        action: 'identity.mfa.enrolled',
        after: { kind: 'totp', mfaRequired: true },
        requestId,
      });
    });

    return NextResponse.json(
      Envelope.parse({ success: true, data: { verified: true, mfaRequired: true }, meta: { timestamp: new Date().toISOString(), requestId } }),
      { status: 200 }
    );
  } catch (error) {
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Terjadi kesalahan sistem saat mengonfirmasi MFA.', requestId,
      [{ message: (error as Error).message }]);
  }
}
