/**
 * POST /api/v1/attendance/qr/generate
 *
 * Handler pembuat Dynamic QR Code untuk Dosen Pengampu Kelas. Membangkitkan token berotasi
 * yang ditandatangani HMAC-SHA256 untuk mencegah pemalsuan QR (screenshot titip absen).
 *
 * **Periode rotasi dan radius tidak lagi konstanta** (`SPE-15` butir 2, `AC-PG-1`): keduanya
 * dibaca dari mesin parameter (`attendance.totp_rotate_seconds` 5/10/15 dengan plafon CHECK,
 * `attendance.geofence_default_radius_m` 10–500). Angka 30 detik yang lama tertulis di sini
 * bertentangan dengan norma kontrak anti-pemalsuan 5 detik, dan itu yang ditutup.
 * `rotationSeconds` ikut dikirim di respons agar Web dan Flutter TIDAK punya angka keduanya.
 *
 * Request Body: { sessionId: UUID, classId: UUID, latitude: number, longitude: number, radiusMeters?: number }
 * Response: Standard Envelope + { qrPayload, expiresAt, ttlSeconds, rotationSeconds, roomCoordinates }
 */
import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { UUIDSchema } from '@sica/contracts';
import {
  extractRequestContext,
  successResponse,
  validationFailed,
  internalError,
} from '@/lib/api-response';
import { requireDataPrincipal } from '@/modules/authz/rbac-repository';
import { ensureModuleActive } from '@/lib/module-gate';
import { PERM } from '@sica/contracts';
import { readParameterNumber } from '@/modules/settings/services/parameter-resolver';

const GenerateQrRequestSchema = z.object({
  sessionId: UUIDSchema,
  classId: UUIDSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  // Baku = radius tenant; nilai klien hanya boleh MENYEMPITKAN, tidak pernah melonggarkan
  // melewati plafon parameter (DATA_MODEL §21.1 penutup).
  radiusMeters: z.number().min(10).max(500).optional(),
});

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Gerbang entitlement (SEC-09): modul attendance wajib ACTIVE/TRIAL.
  const moduleDenied = await ensureModuleActive('attendance')(ctx);
  if (moduleDenied) return moduleDenied;

  try {
    // 1. L3 (SEC-10): hak dari tabel penugasan. Bukti pengampu + koordinat dari
    //    tabel rooms menunggu migrasi anti-pemalsuan 0041 (SEC-03 terbuka sebagian).
    const access = await requireDataPrincipal(ctx, PERM.attendanceQrGenerate);
    if (!access.granted) return access.response;

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

    // 3. Ambang dibaca dari mesin parameter — bukan konstanta, bukan angka klien.
    //    Fallback hanya dipakai bila baris parameter belum ada (tenant pra-seed); nilainya
    //    adalah norma dokumen (5 detik), bukan angka lama 30 yang bertentangan dengan §4.2.
    const rotationSeconds = await readParameterNumber(ctx.tenantId ?? '', 'attendance.totp_rotate_seconds', 5);
    const tenantRadius = await readParameterNumber(ctx.tenantId ?? '', 'attendance.geofence_default_radius_m', 50);
    const allowedRadius = Math.max(10, Math.min(radiusMeters ?? tenantRadius, tenantRadius, 500));

    const now = Math.floor(Date.now() / 1000);
    const ttlSeconds = rotationSeconds;
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
        rad: allowedRadius,
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
        // Dibaca klien dari server, tidak pernah dikarang ulang di dua platform (AGENTS §3.4).
        rotationSeconds,
        roomGeofence: {
          latitude,
          longitude,
          radiusMeters: allowedRadius,
        },
      },
      ctx,
      201
    );
  } catch (error) {
    return internalError(ctx, error);
  }
}
