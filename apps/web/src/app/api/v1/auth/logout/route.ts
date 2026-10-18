import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSuccessEnvelope, LogoutResponseDataSchema } from '@sica/contracts';
import { extractRequestContext } from '@/lib/api-response';
import { revokeSession, revokeByRefreshToken } from '@/modules/auth/services/auth.service';

const LogoutEnvelope = createSuccessEnvelope(LogoutResponseDataSchema);

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    const ctx = extractRequestContext(request);
    const refreshCookie = request.cookies.get('sica_refresh_token')?.value;

    if (ctx.authenticated && ctx.tenantId && ctx.sessionId) {
      await revokeSession(ctx.tenantId, ctx.sessionId);
    } else if (refreshCookie) {
      await revokeByRefreshToken(refreshCookie);
    }
    // Idempoten: tanpa sesi valid pun, cookie tetap dibersihkan & tetap 200.
  } catch {
    /* pencabutan best-effort; tetap clear cookie */
  }

  const response = NextResponse.json(
    LogoutEnvelope.parse({ success: true, data: { loggedOut: true }, meta: { timestamp, requestId } }),
    { status: 200 }
  );
  const secure = process.env['NODE_ENV'] === 'production';
  for (const name of ['sica_access_token', 'sica_refresh_token']) {
    response.cookies.set(name, '', { httpOnly: true, secure, sameSite: 'lax', path: name === 'sica_refresh_token' ? '/api/v1/auth' : '/', maxAge: 0 });
  }
  return response;
}
