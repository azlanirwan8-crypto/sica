import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  LoginRequestSchema,
  StandardErrorResponseSchema,
  createSuccessEnvelope,
  LoginResponseDataSchema,
} from '@sica/contracts';
import { authenticate, type AuthRuntimeConfig } from '@/modules/auth/services/auth.service';
import { devMfaBypassEnabled } from '@/lib/dev-flags';

const LoginEnvelope = createSuccessEnvelope(LoginResponseDataSchema);

function buildConfig(): { config: AuthRuntimeConfig | null; missing: string[] } {
  const missing: string[] = [];
  const privateKeyPem = process.env['JWT_PRIVATE_KEY'] ?? '';
  const pepper = process.env['PASSWORD_HASH_PEPPER'] ?? '';
  if (!privateKeyPem) missing.push('JWT_PRIVATE_KEY');
  if (!pepper) missing.push('PASSWORD_HASH_PEPPER');
  if (missing.length > 0) return { config: null, missing };
  return {
    config: {
      privateKeyPem,
      pepper,
      issuer: process.env['JWT_ISSUER'] ?? 'sica',
      audience: process.env['JWT_AUDIENCE'] ?? 'sica-web',
      accessTtlSec: Number(process.env['JWT_ACCESS_TOKEN_TTL_SEC'] ?? 900),
      refreshTtlSec: Number(process.env['JWT_REFRESH_TOKEN_TTL_SEC'] ?? 604800),
      devMfaBypass: devMfaBypassEnabled(),
    },
    missing,
  };
}

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

  try {
    const body: unknown = await request.json();
    const parsed = LoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorJson(422, 'VALIDATION_FAILED', 'Format payload login tidak valid.', timestamp, requestId,
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
    }
    const { tenantIdentifier, username, password } = parsed.data;

    const { config, missing } = buildConfig();
    if (!config) {
      return errorJson(500, 'INTERNAL_SERVER_ERROR', 'Konfigurasi autentikasi belum lengkap.', timestamp, requestId,
        missing.map((f) => ({ field: f, message: 'Belum diset pada server.' })));
    }

    const result = await authenticate(tenantIdentifier, username, password, config);

    if (!result.ok) {
      switch (result.code) {
        case 'INVALID_TENANT':
          return errorJson(422, 'INVALID_TENANT', 'Institusi (subdomain) tidak dikenali.', timestamp, requestId,
            [{ field: 'tenantIdentifier', message: 'Tenant tidak ditemukan.' }]);
        case 'BAD_CREDENTIALS':
          // 401 seragam — tidak membocorkan apakah user/tenant ada (anti-enumeration).
          return errorJson(401, 'UNAUTHORIZED', 'Kombinasi kredensial salah.', timestamp, requestId);
        case 'LOCKED':
          return errorJson(423, 'ACCOUNT_LOCKED', 'Akun sementara terkunci akibat kegagalan login berulang.', timestamp, requestId);
        case 'DISABLED':
          return errorJson(403, 'ACCOUNT_DISABLED', 'Akun/tenant tidak aktif.', timestamp, requestId);
        case 'CONFIG_MISSING':
          return errorJson(500, 'INTERNAL_SERVER_ERROR', 'Konfigurasi autentikasi belum lengkap.', timestamp, requestId);
        default:
          return errorJson(500, 'INTERNAL_SERVER_ERROR', 'Gagal memproses autentikasi.', timestamp, requestId);
      }
    }

    if (result.requireMfa) {
      return NextResponse.json(
        LoginEnvelope.parse({
          success: true,
          data: { requireMfa: true, mfaToken: result.mfaToken },
          meta: { timestamp, requestId },
        }),
        { status: 200 }
      );
    }

    const responsePayload = LoginEnvelope.parse({
      success: true,
      data: {
        requireMfa: false,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresInSeconds,
        user: {
          id: result.principal.userId,
          tenantId: result.principal.tenantId,
          username: result.principal.email,
          fullName: result.principal.fullName,
          role: result.principal.role,
          avatarUrl: null,
        },
      },
      meta: { timestamp, requestId },
    });

    const response = NextResponse.json(responsePayload, { status: 200 });
    const secure = process.env['NODE_ENV'] === 'production';
    response.cookies.set('sica_access_token', result.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresInSeconds,
    });
    // Refresh token (opaque) hanya dikirim ke endpoint refresh.
    response.cookies.set('sica_refresh_token', result.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: config.refreshTtlSec,
    });
    return response;
  } catch (error) {
    return errorJson(500, 'INTERNAL_SERVER_ERROR', 'Terjadi kesalahan sistem saat memproses login.', timestamp, requestId,
      [{ message: (error as Error).message }]);
  }
}
