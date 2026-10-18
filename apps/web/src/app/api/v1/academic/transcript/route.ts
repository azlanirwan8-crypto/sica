/**
 * GET /api/v1/academic/transcript
 *
 * Mengambil Transkrip Akademik Lengkap Mahasiswa.
 * Mengakumulasikan seluruh mata kuliah yang telah diselesaikan di semua semester,
 * menghitung IPK kumulatif, total SKS lulus, dan ringkasan per semester.
 *
 * Query Params: studentId (opsional, untuk admin/dosen pembimbing, default: current user)
 * Response: Standard Envelope + CumulativeGpaResult
 */
import type { NextRequest } from 'next/server';
import {
  extractRequestContext,
  successResponse,
  unauthorized,
  internalError,
} from '@/lib/api-response';
import {
  calculateIpk,
  type GradeEntry,
} from '@/modules/academic/services/gpa-calculator.service';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);

  try {
    // 1. Validasi Autentikasi
    if (!ctx.tenantId) {
      return unauthorized(ctx);
    }

    // 2. Data riwayat akademik komprehensif mahasiswa
    // Siap dihubungkan ke query Drizzle ORM
    const allEntries: GradeEntry[] = [
      // Semester 1 (Ganjil 2024/2025)
      {
        enrollmentId: '10000000-0000-4000-8000-000000000001',
        courseId: '20000000-0000-4000-8000-000000000001',
        courseCode: 'IF-1101',
        courseName: 'Dasar Pemrograman',
        sks: 3,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId: 'a1000000-0000-4000-8000-000000000001',
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: '10000000-0000-4000-8000-000000000002',
        courseId: '20000000-0000-4000-8000-000000000002',
        courseCode: 'IF-1102',
        courseName: 'Matematika Diskrit',
        sks: 3,
        letterCode: 'B+',
        pointValue: 3.5,
        isPassing: true,
        periodId: 'a1000000-0000-4000-8000-000000000001',
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: '10000000-0000-4000-8000-000000000003',
        courseId: '20000000-0000-4000-8000-000000000003',
        courseCode: 'MKU-101',
        courseName: 'Pancasila & Kebangsaan',
        sks: 2,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId: 'a1000000-0000-4000-8000-000000000001',
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: '10000000-0000-4000-8000-000000000004',
        courseId: '20000000-0000-4000-8000-000000000004',
        courseCode: 'IF-1103',
        courseName: 'Pengantar Sistem & Teknologi Informasi',
        sks: 3,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId: 'a1000000-0000-4000-8000-000000000001',
        enrollmentStatus: 'EFFECTIVE',
      },
      // Semester 2 (Genap 2024/2025)
      {
        enrollmentId: '10000000-0000-4000-8000-000000000005',
        courseId: '20000000-0000-4000-8000-000000000005',
        courseCode: 'IF-1201',
        courseName: 'Struktur Data & Algoritma Lanjut',
        sks: 4,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId: 'a1000000-0000-4000-8000-000000000002',
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: '10000000-0000-4000-8000-000000000006',
        courseId: '20000000-0000-4000-8000-000000000006',
        courseCode: 'IF-1202',
        courseName: 'Sistem Operasi Modern',
        sks: 3,
        letterCode: 'B',
        pointValue: 3.0,
        isPassing: true,
        periodId: 'a1000000-0000-4000-8000-000000000002',
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: '10000000-0000-4000-8000-000000000007',
        courseId: '20000000-0000-4000-8000-000000000007',
        courseCode: 'IF-1203',
        courseName: 'Basis Data Relasional',
        sks: 3,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId: 'a1000000-0000-4000-8000-000000000002',
        enrollmentStatus: 'EFFECTIVE',
      },
      // Semester 3 (Ganjil 2025/2026)
      {
        enrollmentId: '10000000-0000-4000-8000-000000000008',
        courseId: '20000000-0000-4000-8000-000000000008',
        courseCode: 'IF-2101',
        courseName: 'Rekayasa Perangkat Lunak',
        sks: 3,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId: 'a1000000-0000-4000-8000-000000000003',
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: '10000000-0000-4000-8000-000000000009',
        courseId: '20000000-0000-4000-8000-000000000009',
        courseCode: 'IF-2102',
        courseName: 'Pemrograman Berorientasi Objek',
        sks: 3,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId: 'a1000000-0000-4000-8000-000000000003',
        enrollmentStatus: 'EFFECTIVE',
      },
    ];

    // 3. Hitung IPK kumulatif dengan rule engine deterministik
    const transcriptSummary = calculateIpk(allEntries);

    // 4. Return Transkrip Lengkap
    return successResponse(
      {
        student: {
          nim: '2201010045',
          fullName: 'Ahmad Faiz Muzaki',
          studyProgram: 'Teknik Informatika (S1)',
          admissionYear: 2023,
          academicStatus: 'ACTIVE',
        },
        ...transcriptSummary,
      },
      ctx
    );
  } catch (error) {
    return internalError(ctx, error);
  }
}
