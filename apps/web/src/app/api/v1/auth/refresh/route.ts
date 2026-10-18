import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  RefreshTokenRequestSchema,
  StandardErrorResponseSchema,
  createSuccessEnvelope,
  RefreshTokenResponseDataSchema,
} from '@sica/contracts';

const RefreshTokenEnvelope = createSuccessEnvelope(RefreshTokenResponseDataSchema);

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    const body: unknown = await request.json();

    const parsed = RefreshTokenRequestSchema.safeParse(body);
    if (!parsed.success) {
      const errorResponse = StandardErrorResponseSchema.parse({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Format permintaan refresh token tidak valid.',
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

    const newAccessToken = `jwt_access_refreshed_${crypto.randomUUID()}`;
    const newRefreshToken = `jwt_refresh_rotated_${crypto.randomUUID()}`;

    const responsePayload = RefreshTokenEnvelope.parse({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900,
      },
      meta: {
        timestamp,
        requestId,
      },
    });

    const response = NextResponse.json(responsePayload, { status: 200 });

    response.cookies.set('sica_access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 900,
    });

    return response;
  } catch (error) {
    const errorResponse = StandardErrorResponseSchema.parse({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Gagal memperbarui access token.',
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
