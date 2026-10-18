/**
 * API Response Helpers — SICA Web
 *
 * Utilitas pembuatan Standard Response Envelope untuk API Route Handlers.
 * Menghilangkan duplikasi kode pembuatan response di setiap endpoint.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { StandardErrorResponseSchema } from '@sica/contracts';
import { verifyJwt } from '@/modules/auth/services/jwt.service';

// =============================================================================
// Request Context
// =============================================================================

/** Konteks request yang diekstrak dari header & cookie, dengan identitas dari JWT terverifikasi. */
export interface RequestContext {
  readonly requestId: string;
  readonly timestamp: string;
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly role?: string | null;
  readonly sessionId?: string | null;
  readonly authenticated?: boolean;
}

interface AuthConfig {
  readonly publicKeyPem: string;
  readonly issuer: string;
  readonly audience: string;
}

function getAuthConfig(): AuthConfig | null {
  const publicKeyPem = process.env['JWT_PUBLIC_KEY'];
  if (!publicKeyPem) return null;
  return {
    publicKeyPem,
    issuer: process.env['JWT_ISSUER'] ?? 'sica',
    audience: process.env['JWT_AUDIENCE'] ?? 'sica-web',
  };
}

/**
 * Ekstrak konteks request dari NextRequest.
 * `userId`/`tenantId`/`role`/`sessionId` diambil DARI klaim JWT yang diverifikasi
 * (RSA-SHA256), bukan dari cookie mentah — cookie tanpa tanda tangan valid diabaikan
 * (fail-closed). Menutup AUD-02 (middleware) & AUD-03 (autentikasi).
 */
export function extractRequestContext(request: NextRequest): RequestContext {
  const base: RequestContext = {
    requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    tenantId: null,
    userId: null,
    role: null,
    sessionId: null,
    authenticated: false,
  };

  const authConfig = getAuthConfig();
  const accessToken = request.cookies.get('sica_access_token')?.value;
  if (!authConfig || !accessToken) {
    return base;
  }

  try {
    const claims = verifyJwt(accessToken, authConfig);
    return {
      ...base,
      userId: claims.sub,
      tenantId: claims.tid,
      role: claims.role,
      sessionId: claims.sid,
      authenticated: true,
    };
  } catch {
    // Token invalid/kedaluwarsa → anggap tidak terautentikasi.
    return base;
  }
}

// =============================================================================
// Success Response
// =============================================================================

/**
 * Buat Standard Success Envelope.
 */
export function successResponse<T>(
  data: T,
  ctx: RequestContext,
  status: number = 200,
  pagination?: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  }
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: ctx.timestamp,
        requestId: ctx.requestId,
        ...(pagination ? { pagination } : {}),
      },
    },
    { status }
  );
}

// =============================================================================
// Error Responses
// =============================================================================

/**
 * Buat Standard Error Envelope.
 */
export function errorResponse(
  code: string,
  message: string,
  ctx: RequestContext,
  status: number,
  details?: Array<{ field?: string; message: string }>
): NextResponse {
  const errorPayload = StandardErrorResponseSchema.parse({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: ctx.timestamp,
      requestId: ctx.requestId,
    },
  });

  return NextResponse.json(errorPayload, { status });
}

/** 400 Bad Request */
export function badRequest(message: string, ctx: RequestContext, details?: Array<{ field?: string; message: string }>): NextResponse {
  return errorResponse('BAD_REQUEST', message, ctx, 400, details);
}

/** 401 Unauthorized */
export function unauthorized(ctx: RequestContext, message: string = 'Autentikasi diperlukan.'): NextResponse {
  return errorResponse('UNAUTHORIZED', message, ctx, 401);
}

/** 403 Forbidden */
export function forbidden(ctx: RequestContext, message: string = 'Akses ditolak.'): NextResponse {
  return errorResponse('FORBIDDEN', message, ctx, 403);
}

/** 404 Not Found */
export function notFound(ctx: RequestContext, message: string = 'Resource tidak ditemukan.'): NextResponse {
  return errorResponse('NOT_FOUND', message, ctx, 404);
}

/** 409 Conflict */
export function conflict(ctx: RequestContext, message: string, details?: Array<{ field?: string; message: string }>): NextResponse {
  return errorResponse('CONFLICT', message, ctx, 409, details);
}

/** 422 Validation Failed */
export function validationFailed(ctx: RequestContext, details: Array<{ field?: string; message: string }>): NextResponse {
  return errorResponse('VALIDATION_FAILED', 'Validasi gagal.', ctx, 422, details);
}

/** 500 Internal Server Error */
export function internalError(ctx: RequestContext, error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Kesalahan internal server.';
  return errorResponse('INTERNAL_SERVER_ERROR', message, ctx, 500);
}
