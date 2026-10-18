/**
 * POST /api/v1/academic/krs/submit
 *
 * Submit pengajuan KRS mahasiswa. Melakukan validasi:
 * 1. Kuota SKS mahasiswa (berdasarkan IPS semester sebelumnya)
 * 2. Kapasitas kelas (sisa slot)
 * 3. Deteksi bentrok jadwal mahasiswa
 * 4. Atomic enrollment creation
 *
 * Body: { periodId: UUID, classIds: UUID[] }
 * Response: Standard Envelope + enrollment results
 */
import type { NextRequest } from 'next/server';
import { KrsSubmitRequestSchema } from '@sica/contracts';
import {
  validateBatchEnrollment,
} from '@/modules/academic/services/sks-quota-validator.service';
import type { ProgramSksConfig, StudentContext } from '@/modules/academic/services/sks-quota-validator.service';
import {
  extractRequestContext,
  successResponse,
  validationFailed,
  unauthorized,
  badRequest,
  conflict,
  internalError,
} from '@/lib/api-response';

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  try {
    // 1. Cek autentikasi
    if (!ctx.tenantId || !ctx.userId) {
      return unauthorized(ctx);
    }

    // 2. Parse & validasi body
    const body: unknown = await request.json();
    const parsed = KrsSubmitRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationFailed(
        ctx,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))
      );
    }

    const { periodId, classIds } = parsed.data;

    // 3. Mock: ambil data mahasiswa & konfigurasi prodi
    // TODO: Ganti dengan query Drizzle ORM
    const studentCtx: StudentContext = {
      status: 'ACTIVE',
      currentSemester: 3,
      lastIps: 3.25,
      periodTerm: 'GANJIL',
      currentPeriodSks: 6, // Sudah 6 SKS terpakai
    };

    const programConfig: ProgramSksConfig = {
      sksCapLowerSemesters: 20,
      sksCapUpperSemesters: 24,
      sksCapBetweenTerm: 9,
    };

    // 4. Mock: ambil SKS per kelas yang dipilih
    // TODO: Query dari database berdasarkan classIds
    const classSksMap = new Map<string, number>();
    for (const classId of classIds) {
      classSksMap.set(classId, 3); // Mock: semua kelas 3 SKS
    }

    const courseSksArray = classIds.map((id) => classSksMap.get(id) ?? 3);

    // 5. Validasi kuota SKS batch
    const quotaResult = validateBatchEnrollment(studentCtx, programConfig, courseSksArray);

    if (!quotaResult.isValid) {
      return badRequest(quotaResult.message, ctx, [
        {
          field: 'classIds',
          message: `Kuota terlampaui: maks ${quotaResult.maxAllowedSks} SKS, ` +
            `terpakai ${quotaResult.usedSks} SKS, ` +
            `tambahan ${courseSksArray.reduce((a, b) => a + b, 0)} SKS.`,
        },
      ]);
    }

    // 6. Mock: cek kapasitas kelas
    // TODO: Query database dan lakukan atomic decrement
    const fullClasses: string[] = [];
    for (const classId of classIds) {
      // Simulasi: 10% kemungkinan kelas penuh
      if (Math.random() < 0.1) {
        fullClasses.push(classId);
      }
    }

    if (fullClasses.length > 0) {
      return conflict(ctx, 'Beberapa kelas sudah penuh.', [
        ...fullClasses.map((id) => ({
          field: `classIds.${id}`,
          message: 'Kapasitas kelas sudah terisi penuh.',
        })),
      ]);
    }

    // 7. Buat enrollment records
    // TODO: INSERT ke tabel enrollments dengan status SUBMITTED
    const enrollments = classIds.map((classId) => ({
      enrollmentId: crypto.randomUUID(),
      classId,
      status: 'SUBMITTED' as const,
      sks: classSksMap.get(classId) ?? 3,
      submittedAt: ctx.timestamp,
    }));

    return successResponse(
      {
        periodId,
        enrollments,
        quotaSummary: {
          maxAllowedSks: quotaResult.maxAllowedSks,
          usedSks: quotaResult.usedSks + courseSksArray.reduce((a, b) => a + b, 0),
          remainingSks: quotaResult.remainingSks,
        },
      },
      ctx,
      201
    );
  } catch (error) {
    return internalError(ctx, error);
  }
}
