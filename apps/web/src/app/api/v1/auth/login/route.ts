import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signJwt } from '@/modules/auth/services/jwt.service';
import {
  LoginRequestSchema,
  StandardErrorResponseSchema,
  createSuccessEnvelope,
  LoginResponseDataSchema,
} from '@sica/contracts';

const LoginEnvelope = createSuccessEnvelope(LoginResponseDataSchema);

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    const body: unknown = await request.json();

    // 1. Validasi Zod
    const parsed = LoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      const errorResponse = StandardErrorResponseSchema.parse({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Format payload login tidak valid.',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        meta: {
          timestamp,
          requestId,
        },
      });

      return NextResponse.json(errorResponse, { status: 422 });
    }

    const { username, password } = parsed.data;

    // 2. Mock verifikasi akun (Stub untuk baseline Phase 1)
    if (password === 'wrongpassword') {
      const errorResponse = StandardErrorResponseSchema.parse({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Username atau kata sandi tidak valid.',
          details: [{ field: 'password', message: 'Kombinasi akun salah.' }],
        },
        meta: {
          timestamp,
          requestId,
        },
      });

      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Simulasi jika user mengaktifkan MFA
    if (username.toLowerCase().includes('mfa')) {
      const responsePayload = LoginEnvelope.parse({
        success: true,
        data: {
          requireMfa: true,
          mfaToken: `mfa_${crypto.randomUUID().replace(/-/g, '')}`,
        },
        meta: {
          timestamp,
          requestId,
        },
      });

      return NextResponse.json(responsePayload, { status: 200 });
    }

    // Login Sukses
    // ⚠️ User lookup masih STUB (AUD-03): belum query `users`/`tenant_memberships` &
    //    verifikasi Argon2id terhadap DB. Namun access token kini RSA-SHA256 SESUNGGUHNYA,
    //    sehingga `extractRequestContext` dapat memverifikasi identitas (menutup AUD-02/03
    //    pada jalur verifikasi). Prasyarat: JWT_PRIVATE_KEY diset.
    const privateKeyPem = process.env['JWT_PRIVATE_KEY'];
    if (!privateKeyPem) {
      const errorResponse = StandardErrorResponseSchema.parse({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Konfigurasi penandatanganan token belum lengkap.',
          details: [{ field: 'JWT_PRIVATE_KEY', message: 'Signing key belum diset pada server.' }],
        },
        meta: { timestamp, requestId },
      });
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const principal = {
      id: crypto.randomUUID(),
      tenantId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      role: 'mahasiswa',
    };
    const issuer = process.env['JWT_ISSUER'] ?? 'sica';
    const audience = process.env['JWT_AUDIENCE'] ?? 'sica-web';
    const ttlSeconds = Number(process.env['JWT_ACCESS_TOKEN_TTL_SEC'] ?? 900);

    const accessToken = signJwt(
      { sub: principal.id, tid: principal.tenantId, sid: principal.sessionId, role: principal.role },
      { privateKeyPem, issuer, audience, ttlSeconds }
    );
    const refreshToken = `rt_${crypto.randomUUID()}`;

    const responsePayload = LoginEnvelope.parse({
      success: true,
      data: {
        requireMfa: false,
        accessToken,
        refreshToken,
        expiresIn: ttlSeconds,
        user: {
          id: principal.id,
          tenantId: principal.tenantId,
          username,
          fullName: 'SICA Student / Lecturer',
          role: principal.role,
          avatarUrl: null,
        },
      },
      meta: {
        timestamp,
        requestId,
      },
    });

    const response = NextResponse.json(responsePayload, { status: 200 });

    // Access token JWT (HTTP-Only) — identitas & tenant kini terbawa di klaim terverifikasi.
    response.cookies.set('sica_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ttlSeconds,
    });

    return response;
  } catch (error) {
    const errorResponse = StandardErrorResponseSchema.parse({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan sistem saat memproses login.',
        details: [{ message: (error as Error).message }],
      },
      meta: {
        timestamp,
        requestId,
      },
    });

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
