/**
 * POST /api/v1/attendance/qr/scan
 *
 * Handler verifikasi scan presensi QR mahasiswa.
 * Menegakkan multi-layer security:
 * 1. Deteksi Fake GPS / Mock Location (`isMockLocation = true` langsung ditolak)
 * 2. Kriptografi HMAC-SHA256 signature verification (anti-manipulasi)
 * 3. Validasi TTL kedaluwarsa 30 detik (anti-screenshot)
 * 4. Formula Haversine Geofencing GPS (jarak mahasiswa ke ruang kelas wajib <= radius maks, mis. 50 meter)
 *
 * Request Body: { qrPayload: string, studentLatitude: number, studentLongitude: number, accuracyMeters: number, isMockLocation: boolean }
 * Response: Standard Envelope + { attendanceId, status, distanceMeters, recordedAt }
 */
import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import {
  extractRequestContext,
  successResponse,
  validationFailed,
  internalError,
} from '@/lib/api-response';
import { requireDataPrincipal } from '@/modules/authz/rbac-repository';
import { ensureModuleActive } from '@/lib/module-gate';
import { PERM } from '@sica/contracts';
import { recordAttendance } from '@/modules/academic/services/attendance.service';
import { readParameterNumber } from '@/modules/settings/services/parameter-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ScanAttendanceRequestSchema = z.object({
  qrPayload: z.string().min(10, 'QR Payload tidak valid.'),
  studentLatitude: z.number().min(-90).max(90),
  studentLongitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(500),
  isMockLocation: z.boolean().default(false),
});

/**
 * Formula Haversine untuk menghitung jarak akurat antara dua titik koordinat GPS di bumi (meter)
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Radius bumi dalam meter
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Mengembalikan jarak dalam meter
}

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Gerbang entitlement (SEC-09): modul attendance wajib ACTIVE/TRIAL.
  const moduleDenied = await ensureModuleActive('attendance')(ctx);
  if (moduleDenied) return moduleDenied;

  try {
    // 1. L3 (SEC-10): hak dari tabel penugasan; scan adalah aksi mahasiswa atas
    //    dirinya sendiri — userId dari token terverifikasi, bukan body.
    const access = await requireDataPrincipal(ctx, PERM.attendanceQrScan);
    if (!access.granted) return access.response;
    const { tenantId, userId: studentId } = access.principal;

    // 2. Parse & Validasi Request Body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationFailed(ctx, [
        { field: 'body', message: 'Format JSON body tidak valid.' },
      ]);
    }

    const parseResult = ScanAttendanceRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return validationFailed(
        ctx,
        parseResult.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }))
      );
    }

    const { qrPayload, studentLatitude, studentLongitude, accuracyMeters, isMockLocation } = parseResult.data;

    // 3. LAYER 1: Deteksi Anti-Mock GPS
    if (isMockLocation) {
      return validationFailed(ctx, [
        {
          field: 'isMockLocation',
          message:
            'Aplikasi Fake GPS atau Mock Location terdeteksi. Harap nonaktifkan Fake GPS untuk melakukan presensi resmi.',
        },
      ]);
    }

    // 4. LAYER 2: Parsing dan Validasi Struktur QR Payload
    interface QrDecoded {
      tId: string;
      sId: string;
      cId: string;
      iat: number;
      exp: number;
      non: string;
      sig: string;
      geo: {
        lat: number;
        lng: number;
        rad: number;
      };
    }

    let decoded: QrDecoded;
    try {
      decoded = JSON.parse(qrPayload) as QrDecoded;
    } catch {
      return validationFailed(ctx, [
        { field: 'qrPayload', message: 'QR Code rusak atau tidak dikenali oleh SICA.' },
      ]);
    }

    // Cek kecocokan Tenant
    if (decoded.tId !== tenantId) {
      return validationFailed(ctx, [
        { field: 'qrPayload', message: 'QR Code ini diterbitkan untuk institusi kampus lain.' },
      ]);
    }

    // 5. LAYER 3: Validasi Kriptografi HMAC Signature
    // Secret WAJIB dari env; tanpa fallback hard-coded agar QR tidak dapat dipalsukan.
    const signingKey = process.env['ATTENDANCE_HMAC_SECRET'];
    if (!signingKey) {
      return internalError(ctx, new Error('ATTENDANCE_HMAC_SECRET belum dikonfigurasi pada server.'));
    }
    const messageToVerify = `${decoded.tId}:${decoded.sId}:${decoded.cId}:${decoded.iat}:${decoded.exp}:${decoded.non}`;
    const expectedSignature = crypto
      .createHmac('sha256', signingKey)
      .update(messageToVerify)
      .digest('hex');

    // Perbandingan waktu-konstan dengan cek panjang (`SC-G2-09`, primitif yang sama dengan
    // `password.service.ts`/`token.service.ts`): `!==` membocorkan posisi byte pertama yang
    // beda lewat selisih waktu respons.
    const signatureMatches =
      decoded.sig.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(decoded.sig), Buffer.from(expectedSignature));
    if (!signatureMatches) {
      return validationFailed(ctx, [
        {
          field: 'qrPayload',
          message: 'Tanda tangan kriptografi QR tidak valid. QR Code diduga telah dimanipulasi.',
        },
      ]);
    }

    // 6. LAYER 4: Validasi masa berlaku. Periode rotasi dibaca DARI QR (`exp − iat`) dan
    //    toleransinya = `attendance.totp_window_steps` × periode — tidak ada lagi angka 30/5
    //    yang hidup sendiri di dua platform (`SPE-15` butir 2, `AC-PG-4`).
    const rotationSeconds = Math.max(1, decoded.exp - decoded.iat);
    const windowSteps = await readParameterNumber(tenantId, 'attendance.totp_window_steps', 1);
    const graceSeconds = windowSteps * rotationSeconds;
    const now = Math.floor(Date.now() / 1000);
    if (now > decoded.exp + graceSeconds) {
      return validationFailed(ctx, [
        {
          field: 'qrPayload',
          message: `QR Code telah kedaluwarsa (berotasi setiap ${rotationSeconds} detik). Harap scan QR terbaru di layar dosen.`,
        },
      ]);
    }

    // 7. LAYER 5: Validasi geofencing. Akurasi GPS ikut memotong vonis (`SC-G2-11`):
    //    `jarak − akurasi ≤ radius`, bukan `jarak ≤ radius` — lokasi dengan akurasi 150 m
    //    pada jarak 40 m bukan bukti kehadiran. Akurasi di atas plafon tenant ditolak.
    const distanceMeters = calculateHaversineDistance(
      studentLatitude,
      studentLongitude,
      decoded.geo.lat,
      decoded.geo.lng
    );

    const maxAccuracy = await readParameterNumber(tenantId, 'attendance.gps_max_accuracy_m', 100);
    if (accuracyMeters > maxAccuracy) {
      return validationFailed(ctx, [
        {
          field: 'accuracyMeters',
          message: `Akurasi lokasi Anda ${accuracyMeters} meter melebihi plafon ${maxAccuracy} meter institusi, sehingga tidak dapat menjadi bukti kehadiran.`,
        },
      ]);
    }

    const tenantRadius = await readParameterNumber(tenantId, 'attendance.geofence_default_radius_m', 50);
    const allowedRadius = Math.min(decoded.geo.rad || tenantRadius, tenantRadius);
    if (distanceMeters - accuracyMeters > allowedRadius) {
      return validationFailed(ctx, [
        {
          field: 'studentCoordinates',
          message: `Jarak Anda (${distanceMeters} meter, akurasi ${accuracyMeters} meter) berada di luar radius presensi ${allowedRadius} meter yang diizinkan.`,
        },
      ]);
    }

    // 8. Catat Kehadiran Mahasiswa ke DB (idempoten; cek sesi terbuka + enrollment)
    const result = await recordAttendance(tenantId, studentId, {
      sessionId: decoded.sId,
      classId: decoded.cId,
      distanceMeters,
      latitude: studentLatitude,
      longitude: studentLongitude,
    });

    if (!result.ok) {
      switch (result.kind) {
        case 'STUDENT_NOT_FOUND':
          return validationFailed(ctx, [{ field: 'student', message: 'Akun ini tidak tertaut pada profil mahasiswa.' }]);
        case 'SESSION_INVALID':
          return validationFailed(ctx, [{ field: 'qrPayload', message: 'Sesi tidak ditemukan atau presensi sudah ditutup.' }]);
        case 'NOT_ENROLLED':
          return validationFailed(ctx, [{ field: 'qrPayload', message: 'Anda tidak terdaftar pada kelas sesi ini.' }]);
      }
    }

    return successResponse(
      {
        attendanceId: result.attendanceId,
        studentId,
        status: 'PRESENT',
        sessionId: decoded.sId,
        classId: decoded.cId,
        distanceMeters,
        accuracyVerified: true,
        alreadyPresent: result.alreadyPresent,
        recordedAt: ctx.timestamp,
        message: result.alreadyPresent
          ? 'Kehadiran Anda sudah tercatat untuk sesi ini (scan ulang diabaikan).'
          : 'Presensi perkuliahan berhasil diverifikasi. Kehadiran Anda telah dicatat resmi.',
      },
      ctx,
      200
    );
  } catch (error) {
    return internalError(ctx, error);
  }
}
