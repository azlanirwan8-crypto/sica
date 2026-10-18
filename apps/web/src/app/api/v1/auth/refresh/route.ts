import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  RefreshTokenRequestSchema,
  StandardErrorResponseSchema,
  createSuccessEnvelope,
  RefreshTokenResponseDataSchema,
} from '@sica/contracts';
import { buildAuthConfig } from '@/modules/auth/services/auth-config';
import { rotateRefreshToken } from '@/modules/auth/services/auth.service';

const RefreshTokenEnvelope = createSuccessEnvelope(RefreshTokenResponseDataSchema);

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const fail = (status: number, code: string, message: string): NextResponse =>
    NextResponse.json(
      StandardErrorResponseSchema.parse({
        success: false,
        error: { code, message },
        meta: { timestamp, requestId },
      }),
      { status }
    );

  try {
    // Sumber token: body (mobile/explicit) atau cookie httpOnly (web).
    let refreshToken = request.cookies.get('sica_refresh_token')?.value ?? '';
    try {
      const body: unknown = await request.json();
      const parsed = RefreshTokenRequestSchema.safeParse(body);
      if (parsed.success) refreshToken = parsed.data.refreshToken;
    } catch {
      /* body kosong — pakai cookie */
    }
    if (!refreshToken) return fail(401, 'UNAUTHORIZED', 'Refresh token tidak tersedia.');

    const { config } = buildAuthConfig();
    if (!config) return fail(500, 'INTERNAL_SERVER_ERROR', 'Konfigurasi token belum lengkap.');

    const result = await rotateRefreshToken(refreshToken, config);
    if (!result.ok) {
      // Pesan seragam — jangan bocorkan apakah token invalid/reuse/expired ke klien.
      return fail(401, 'UNAUTHORIZED', 'Sesi tidak valid atau telah dicabut.');
    }

    const responsePayload = RefreshTokenEnvelope.parse({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresInSeconds,
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
    response.cookies.set('sica_refresh_token', result.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: config.refreshTtlSec,
    });
    return response;
  } catch (error) {
    return fail(500, 'INTERNAL_SERVER_ERROR', `Gagal memperbarui access token. ${(error as Error).message}`);
  }
}
