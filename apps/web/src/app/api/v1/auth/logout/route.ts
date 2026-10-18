import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSuccessEnvelope, LogoutResponseDataSchema } from '@sica/contracts';

const LogoutEnvelope = createSuccessEnvelope(LogoutResponseDataSchema);

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const responsePayload = LogoutEnvelope.parse({
    success: true,
    data: {
      loggedOut: true,
    },
    meta: {
      timestamp,
      requestId,
    },
  });

  const response = NextResponse.json(responsePayload, { status: 200 });

  // Bersihkan auth cookie
  response.cookies.delete('sica_access_token');

  return response;
}
