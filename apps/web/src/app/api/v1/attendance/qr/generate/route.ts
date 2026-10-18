/**
 * POST /api/v1/attendance/qr/generate
 *
 * Handler pembuat Dynamic QR Code untuk Dosen Pengampu Kelas.
 * Membangkitkan token berotasi dengan Time-To-Live (TTL) 30 detik,
 * ditandatangani secara kriptografis menggunakan HMAC-SHA256 untuk mencegah pemalsuan QR (screenshot titip absen).
 *
 * Request Body: { sessionId: UUID, classId: UUID, latitude: number, longitude: number, radiusMeters?: number }
 * Response: Standard Envelope + { qrPayload, expiresAt, ttlSeconds, roomCoordinates }
 */
import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { UUIDSchema } from '@sica/contracts';
import {
  extractRequestContext,
  successResponse,
  validationFailed,
  unauthorized,
  internalError,
} from '@/lib/api-response';

const GenerateQrRequestSchema = z.object({
  sessionId: UUIDSchema,
  classId: UUIDSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(10).max(500).default(50),
});

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  try {
    // 1. Verifikasi Autentikasi
    if (!ctx.tenantId) {
      return unauthorized(ctx);
    }

    // 2. Parse & Validasi Payload
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationFailed(ctx, [
        { field: 'body', message: 'Format JSON body tidak valid.' },
      ]);
    }

    const parseResult = GenerateQrRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return validationFailed(
        ctx,
        parseResult.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }))
      );
    }

    const { sessionId, classId, latitude, longitude, radiusMeters } = parseResult.data;

    // 3. Konfigurasi Rotasi TTL 30 Detik
    const now = Math.floor(Date.now() / 1000);
    const ttlSeconds = 30;
    const expiresAt = now + ttlSeconds;
    const nonce = crypto.randomBytes(8).toString('hex');

    // 4. Buat signature HMAC-SHA256
    // Secret WAJIB disediakan via env; tanpa fallback hard-coded agar QR tidak dapat dipalsukan.
    const signingKey = process.env['ATTENDANCE_HMAC_SECRET'];
    if (!signingKey) {
      return internalError(ctx, new Error('ATTENDANCE_HMAC_SECRET belum dikonfigurasi pada server.'));
    }
    const messageToSign = `${ctx.tenantId}:${sessionId}:${classId}:${now}:${expiresAt}:${nonce}`;
    const hmacSignature = crypto
      .createHmac('sha256', signingKey)
      .update(messageToSign)
      .digest('hex');

    // 5. Payload yang dienkapsulasi ke dalam QR Code
    const qrPayload = JSON.stringify({
      tId: ctx.tenantId,
      sId: sessionId,
      cId: classId,
      iat: now,
      exp: expiresAt,
      non: nonce,
      sig: hmacSignature,
      geo: {
        lat: latitude,
        lng: longitude,
        rad: radiusMeters,
      },
    });

    return successResponse(
      {
        sessionId,
        classId,
        qrPayload,
        issuedAt: new Date(now * 1000).toISOString(),
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        ttlSeconds,
        roomGeofence: {
          latitude,
          longitude,
          radiusMeters,
        },
      },
      ctx,
      201
    );
  } catch (error) {
    return internalError(ctx, error);
  }
}
