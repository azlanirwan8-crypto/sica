/**
 * GET /api/v1/academic/krs/open-classes
 *
 * Mengambil daftar kelas yang tersedia untuk pengisian KRS mahasiswa.
 * Menyertakan informasi jadwal, dosen, sisa kuota, dan deteksi bentrok.
 *
 * Query Params: periodId (required), search, dayOfWeek, page, limit
 * Response: Standard Envelope + paginated KrsClassItem[]
 */
import type { NextRequest } from 'next/server';
import { OpenClassesQuerySchema } from '@sica/contracts';
import {
  extractRequestContext,
  successResponse,
  validationFailed,
  unauthorized,
  internalError,
} from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);

  try {
    // 1. Cek autentikasi
    if (!ctx.tenantId) {
      return unauthorized(ctx);
    }

    // 2. Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = OpenClassesQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      return validationFailed(
        ctx,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))
      );
    }

    const { periodId, search, dayOfWeek, page, limit } = parsed.data;

    // 3. Mock data kelas yang tersedia
    // TODO: Ganti dengan query Drizzle ORM ke database
    const mockClasses = generateMockOpenClasses(periodId, search, dayOfWeek);

    // 4. Pagination
    const totalRecords = mockClasses.length;
    const totalPages = Math.ceil(totalRecords / limit);
    const startIdx = (page - 1) * limit;
    const paginatedData = mockClasses.slice(startIdx, startIdx + limit);

    return successResponse(paginatedData, ctx, 200, {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    return internalError(ctx, error);
  }
}

// =============================================================================
// Mock Data Generator (akan diganti query DB di integrasi)
// =============================================================================
interface MockClassItem {
  classId: string;
  courseCode: string;
  courseName: string;
  className: string;
  sks: number;
  capacity: number;
  enrolledCount: number;
  lecturerNames: string[];
  schedules: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    roomCode: string | null;
  }>;
  hasConflict: boolean;
  conflictDescription: string | null;
}

function generateMockOpenClasses(
  _periodId: string,
  search?: string,
  dayOfWeek?: number
): MockClassItem[] {
  const courses = [
    { code: 'IF-101', name: 'Algoritma & Pemrograman', sks: 3 },
    { code: 'IF-102', name: 'Struktur Data', sks: 3 },
    { code: 'IF-201', name: 'Basis Data', sks: 3 },
    { code: 'IF-202', name: 'Jaringan Komputer', sks: 3 },
    { code: 'IF-301', name: 'Rekayasa Perangkat Lunak', sks: 4 },
    { code: 'IF-302', name: 'Kecerdasan Buatan', sks: 3 },
    { code: 'MK-101', name: 'Kalkulus I', sks: 3 },
    { code: 'MK-102', name: 'Fisika Dasar', sks: 2 },
    { code: 'MK-201', name: 'Statistika', sks: 3 },
    { code: 'UM-101', name: 'Pancasila & Kewarganegaraan', sks: 2 },
  ];

  const lecturers = [
    'Dr. Budi Santoso, M.Kom.',
    'Prof. Ani Wijaya, Ph.D.',
    'Ir. Candra Pratama, M.T.',
    'Dra. Dewi Lestari, M.Si.',
    'Dr. Eko Prasetyo, S.T., M.Eng.',
  ];

  const classes: MockClassItem[] = [];
  let idx = 0;

  for (const course of courses) {
    for (const kelas of ['Kelas A', 'Kelas B']) {
      idx++;
      const dayNum = ((idx % 5) + 1); // 1-5 (Senin-Jumat)
      const startHour = 7 + (idx % 5) * 2;

      classes.push({
        classId: crypto.randomUUID(),
        courseCode: course.code,
        courseName: course.name,
        className: kelas,
        sks: course.sks,
        capacity: 40,
        enrolledCount: Math.floor(Math.random() * 35),
        lecturerNames: [lecturers[idx % lecturers.length] ?? 'Dosen TBA'],
        schedules: [
          {
            dayOfWeek: dayNum,
            startTime: `${String(startHour).padStart(2, '0')}:00`,
            endTime: `${String(startHour + 2).padStart(2, '0')}:40`,
            roomCode: `R.${300 + (idx % 10)}`,
          },
        ],
        hasConflict: false,
        conflictDescription: null,
      });
    }
  }

  // Filter berdasarkan search
  let filtered = classes;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.courseName.toLowerCase().includes(q) ||
        c.courseCode.toLowerCase().includes(q) ||
        c.className.toLowerCase().includes(q)
    );
  }

  // Filter berdasarkan hari
  if (dayOfWeek) {
    filtered = filtered.filter((c) =>
      c.schedules.some((s) => s.dayOfWeek === dayOfWeek)
    );
  }

  return filtered;
}
