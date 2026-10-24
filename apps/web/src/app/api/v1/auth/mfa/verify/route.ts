/**
 * POST /api/v1/auth/mfa/verify — verifikasi tantangan MFA NYATA (SEC-01 ditutup 2026-10-23).
 *
 * `501 MFA_NOT_IMPLEMENTED` (API_SPEC §2.3 baris 144) dicabut setelah empat syaratnya lulus:
 * (1) objek tantangan ber-DDL → `mfa_challenges` (DATA_MODEL §3, migrasi `0084`);
 * (2) `mfa_factors` ber-`tenant_id` + RLS ENABLE/FORCE + secret `bytea` (penutup `SEC-14`;
 *     catatan jujur: payload masih base32 mentah sampai KMS/`0035` mendarat);
 * (3) TOTP RFC 6238 dihitung server dengan jendela + perbandingan waktu-konstan (`totp.service`);
 * (4) tantangan sekali-pakai (`consumed_at`) + `attempts ≤ 5` + percobaan terekam `login_events`.
 *
 * Keberhasilan = sesi penuh dengan klaim `amr=['pwd','mfa']` — satu-satunya jalur yang
 * memenuhi gerbang MFA aksi tulis platform (`R-1`).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  MfaVerifyRequestSchema,
  StandardErrorResponseSchema,
  createSuccessEnvelope,
  MfaVerifyResponseDataSchema,
} from '@sica/contracts';
import { establishSession, loadPrincipalById } from '@/modules/auth/services/auth.service';
import { buildAuthConfig } from '@/modules/auth/services/auth-config';
import { verifyMfaChallenge } from '@/modules/auth/services/mfa.service';
import { recordLoginEvent } from '@/modules/auth/services/login-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MfaVerifyEnvelope = createSuccessEnvelope(MfaVerifyResponseDataSchema);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorJson(
  status: number,
  code: string,
  message: string,
  timestamp: string,
  requestId: string,
  details?: Array<{ field?: string; message: string }>
): NextResponse {
  return NextResponse.json(
    StandardErrorResponseSchema.parse({
      success: false,
      error: { code, message, details },
      meta: { timestamp, requestId },
    }),
    { status }
  );
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = request.headers.get('user-agent');

  try {
    const body: unknown = await request.json();
    const parsed = MfaVerifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorJson(
        422,
        'VALIDATION_FAILED',
        'Format permintaan verifikasi OTP tidak valid.',
        timestamp,
        requestId,
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
      );
    }
    const { mfaToken, totpCode } = parsed.data;

    const { config } = buildAuthConfig();
    if (!config) {
      return errorJson(500, 'INTERNAL_SERVER_ERROR', 'Konfigurasi autentikasi belum lengkap.', timestamp, requestId);
    }

    // Tenant terikat dalam token tantangan; bukti sesungguhnya adalah kecocokan hash
    // tantangan di dalam konteks tenant itu. Tanpa tantangan sah, tidak ada jalur sukses.
    const tenantId = mfaToken.split('.')[0] ?? '';
    if (!UUID_RE.test(tenantId)) {
      return errorJson(401, 'UNAUTHORIZED', 'Kode OTP tidak valid atau tantangan telah kadaluarsa.', timestamp, requestId);
    }

    const result = await verifyMfaChallenge(tenantId, mfaToken, totpCode);
    if (!result.ok) {
      await recordLoginEvent({
        tenantId,
        userId: null,
        emailAttempted: null,
        outcome: 'MFA_FAIL',
        ip,
        userAgent,
      }).catch(() => undefined);

      // Tantangan yang sudah mati tidak bisa dihidupkan oleh kode yang benar.
      // Tanpa pembeda ini, layar hanya berkata "kode tidak cocok" dan pengguna
      // terus mengirim ke token yang sudah habis percobaannya (baris §2.3 159).
      // Habis-percobaan dan kedaluwarsa digabung dalam satu pesan supaya penerka
      // token tidak belajar status baris tantangannya.
      if (result.reason === 'TOO_MANY_ATTEMPTS' || result.reason === 'CHALLENGE_EXPIRED') {
        return errorJson(
          401,
          'MFA_CHALLENGE_STALE',
          'Masa berlaku verifikasi ini sudah selesai. Masuk ulang untuk memulai verifikasi baru.',
          timestamp,
          requestId
        );
      }
      return errorJson(401, 'UNAUTHORIZED', 'Kode OTP tidak valid atau tantangan telah kadaluarsa.', timestamp, requestId);
    }

    const principal = await loadPrincipalById(tenantId, result.userId);
    if (!principal) {
      return errorJson(401, 'UNAUTHORIZED', 'Sesi tidak dapat diterbitkan.', timestamp, requestId);
    }

    const issued = await establishSession(config, principal, ['pwd', 'mfa']);

    await recordLoginEvent({
      tenantId,
      userId: result.userId,
      emailAttempted: principal.email,
      outcome: 'SUCCESS',
      ip,
      userAgent,
    }).catch(() => undefined);

    const response = NextResponse.json(
      MfaVerifyEnvelope.parse({
        success: true,
        data: {
          accessToken: issued.accessToken,
          refreshToken: issued.refreshToken,
          expiresIn: issued.expiresInSeconds,
          user: {
            id: issued.principal.userId,
            tenantId: issued.principal.tenantId,
            username: issued.principal.email,
            fullName: issued.principal.fullName,
            role: issued.principal.role,
            avatarUrl: null,
          },
        },
        meta: { timestamp, requestId },
      }),
      { status: 200 }
    );

    const secure = process.env['NODE_ENV'] === 'production';
    response.cookies.set('sica_access_token', issued.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: issued.expiresInSeconds,
    });
    response.cookies.set('sica_refresh_token', issued.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: config.refreshTtlSec,
    });
    return response;
  } catch (error) {
    return errorJson(
      500,
      'INTERNAL_SERVER_ERROR',
      'Terjadi kesalahan sistem saat memproses verifikasi MFA.',
      timestamp,
      requestId,
      [{ message: (error as Error).message }]
    );
  }
}
