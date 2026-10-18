/**
 * GET /api/v1/academic/khs/[periodId]
 *
 * Mengambil Kartu Hasil Studi (KHS) mahasiswa untuk periode akademik tertentu.
 * Menghitung IPS (Indeks Prestasi Semester), total SKS, SKS lulus, dan detail per mata kuliah.
 *
 * Param: periodId (UUID)
 * Response: Standard Envelope + SemesterGpaResult
 */
import type { NextRequest } from 'next/server';
import { UUIDSchema } from '@sica/contracts';
import {
  extractRequestContext,
  successResponse,
  validationFailed,
  unauthorized,
  internalError,
} from '@/lib/api-response';
import {
  calculateIps,
  type GradeEntry,
} from '@/modules/academic/services/gpa-calculator.service';

interface RouteContext {
  params: Promise<{
    periodId: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const ctx = extractRequestContext(request);

  try {
    // 1. Validasi Autentikasi
    if (!ctx.tenantId) {
      return unauthorized(ctx);
    }

    // 2. Validasi Parameter Route
    const resolvedParams = await context.params;
    const parseResult = UUIDSchema.safeParse(resolvedParams.periodId);

    if (!parseResult.success) {
      return validationFailed(ctx, [
        {
          field: 'periodId',
          message: 'Format UUID periodId tidak valid.',
        },
      ]);
    }

    const periodId = parseResult.data;

    // 3. Mock data grade entries mahasiswa untuk periode tersebut
    // Siap digantikan dengan query Drizzle ORM ke database tabel enrollments & grades
    const entries: GradeEntry[] = [
      {
        enrollmentId: '11111111-1111-4111-8111-111111111101',
        courseId: '22222222-2222-4222-8222-222222222201',
        courseCode: 'IF-2101',
        courseName: 'Algoritma & Struktur Data',
        sks: 3,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId,
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: '11111111-1111-4111-8111-111111111102',
        courseId: '22222222-2222-4222-8222-222222222202',
        courseCode: 'IF-2102',
        courseName: 'Basis Data Terdistribusi',
        sks: 4,
        letterCode: 'B+',
        pointValue: 3.5,
        isPassing: true,
        periodId,
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: '11111111-1111-4111-8111-111111111103',
        courseId: '22222222-2222-4222-8222-222222222203',
        courseCode: 'IF-2103',
        courseName: 'Pemrograman Web Berbasis Komponen',
        sks: 3,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId,
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: '11111111-1111-4111-8111-111111111104',
        courseId: '22222222-2222-4222-8222-222222222204',
        courseCode: 'IF-2104',
        courseName: 'Probabilitas & Statistika Terapan',
        sks: 3,
        letterCode: 'B',
        pointValue: 3.0,
        isPassing: true,
        periodId,
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: '11111111-1111-4111-8111-111111111105',
        courseId: '22222222-2222-4222-8222-222222222205',
        courseCode: 'IF-2105',
        courseName: 'Arsitektur Komputer & Jaringan',
        sks: 3,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId,
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: '11111111-1111-4111-8111-111111111106',
        courseId: '22222222-2222-4222-8222-222222222206',
        courseCode: 'MKU-102',
        courseName: 'Kewarganegaraan & Etika Profesi',
        sks: 2,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId,
        enrollmentStatus: 'EFFECTIVE',
      },
    ];

    // 4. Hitung IPS menggunakan Business Rule Engine deterministik
    const gpaResult = calculateIps(entries, periodId);

    // 5. Berikan response standar
    return successResponse(
      {
        ...gpaResult,
        periodName: 'Semester Ganjil 2025/2026',
        periodId,
      },
      ctx
    );
  } catch (error) {
    return internalError(ctx, error);
  }
}
