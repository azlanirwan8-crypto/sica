import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  MfaVerifyRequestSchema,
  StandardErrorResponseSchema,
  createSuccessEnvelope,
  MfaVerifyResponseDataSchema,
} from '@sica/contracts';

const MfaVerifyEnvelope = createSuccessEnvelope(MfaVerifyResponseDataSchema);

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    const body: unknown = await request.json();

    const parsed = MfaVerifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      const errorResponse = StandardErrorResponseSchema.parse({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Format permintaan verifikasi OTP tidak valid.',
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

    const { totpCode } = parsed.data;

    // Verifikasi mock OTP (000000 atau format salah)
    if (totpCode === '123456' || totpCode.length === 6) {
      const mockUserId = crypto.randomUUID();
      const mockTenantId = crypto.randomUUID();
      const mockAccessToken = `jwt_access_mfa_${crypto.randomUUID()}`;
      const mockRefreshToken = `jwt_refresh_mfa_${crypto.randomUUID()}`;

      const responsePayload = MfaVerifyEnvelope.parse({
        success: true,
        data: {
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
          expiresIn: 900,
          user: {
            id: mockUserId,
            tenantId: mockTenantId,
            username: 'verified_user',
            fullName: 'Pengguna Terverifikasi MFA',
            role: 'mahasiswa',
            avatarUrl: null,
          },
        },
        meta: {
          timestamp,
          requestId,
        },
      });

      const response = NextResponse.json(responsePayload, { status: 200 });

      response.cookies.set('sica_access_token', mockAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 900,
      });

      return response;
    }

    const errorResponse = StandardErrorResponseSchema.parse({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Kode OTP tidak valid atau telah kadaluarsa.',
        details: [{ field: 'totpCode', message: 'Kode OTP salah.' }],
      },
      meta: {
        timestamp,
        requestId,
      },
    });

    return NextResponse.json(errorResponse, { status: 401 });
  } catch (error) {
    const errorResponse = StandardErrorResponseSchema.parse({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan sistem saat memproses verifikasi MFA.',
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
