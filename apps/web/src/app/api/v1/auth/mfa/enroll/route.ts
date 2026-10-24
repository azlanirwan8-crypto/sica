/**
 * POST /api/v1/auth/mfa/enroll — daftarkan faktor TOTP untuk DIRI SENDIRI.
 *
 * Gerbang: sesi terautentikasi (subjek dari token terverifikasi, bukan body). Tidak ada
 * kode izin khusus: faktor milik sendiri bukan kewenangan lintas orang; admin memakai
 * `identity.mfa.manage` untuk operasi faktor orang lain (RBAC §4.2). Secret hanya keluar
 * pada respons ini — setelah konfirmasi tidak ada jalur baca (SERVER_ONLY di §14.9).
 * Faktor baru belum terbukti (`verified_at` kosong) → `mfa_required` belum dipasang.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  MfaEnrollRequestSchema,
  StandardErrorResponseSchema,
  createSuccessEnvelope,
  MfaEnrollResponseDataSchema,
} from '@sica/contracts';
import { extractRequestContext } from '@/lib/api-response';
import { loadPrincipalById } from '@/modules/auth/services/auth.service';
import { enrollTotpFactor } from '@/modules/auth/services/mfa.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Envelope = createSuccessEnvelope(MfaEnrollResponseDataSchema);

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);
  const timestamp = new Date().toISOString();

  if (!ctx.authenticated || !ctx.userId || !ctx.tenantId) {
    return NextResponse.json(
      StandardErrorResponseSchema.parse({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Autentikasi diperlukan untuk mendaftarkan MFA.', details: [] },
        meta: { timestamp, requestId: ctx.requestId },
      }),
      { status: 401 }
    );
  }

  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = MfaEnrollRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        StandardErrorResponseSchema.parse({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Format permintaan pendaftaran MFA tidak valid.',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
          meta: { timestamp, requestId: ctx.requestId },
        }),
        { status: 422 }
      );
    }

    const principal = await loadPrincipalById(ctx.tenantId, ctx.userId);
    if (!principal) {
      return NextResponse.json(
        StandardErrorResponseSchema.parse({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Keanggotaan tidak ditemukan untuk sesi ini.', details: [] },
          meta: { timestamp, requestId: ctx.requestId },
        }),
        { status: 401 }
      );
    }

    const issuer = process.env['MFA_ISSUER'] ?? `SICA (${principal.tenantSlug})`;
    const enrollment = await enrollTotpFactor(ctx.tenantId, ctx.userId, issuer, principal.email);

    return NextResponse.json(
      Envelope.parse({ success: true, data: enrollment, meta: { timestamp, requestId: ctx.requestId } }),
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      StandardErrorResponseSchema.parse({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Terjadi kesalahan sistem saat mendaftarkan MFA.',
          details: [{ message: (error as Error).message }],
        },
        meta: { timestamp, requestId: ctx.requestId },
      }),
      { status: 500 }
    );
  }
}
