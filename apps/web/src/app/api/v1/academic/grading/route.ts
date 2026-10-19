/**
 * POST /api/v1/academic/grading
 *
 * Input / draft / finalisasi nilai oleh dosen pengampu — kini DB-backed
 * (lihat `grading.service.ts`): otorisasi assignment, validasi enrollment milik kelas,
 * konversi skor↔huruf dari skala penilaian, dan UPSERT `grades` idempoten.
 *
 * Body: GradingSubmitRequest { classId, periodId, entries, action }
 * Action: 'SAVE_DRAFT' | 'SUBMIT_FINAL'
 */
import type { NextRequest } from 'next/server';
import { GradingSubmitRequestSchema } from '@sica/contracts';
import {
  extractRequestContext,
  successResponse,
  errorResponse,
  validationFailed,
  unauthorized,
  forbidden,
  notFound,
  internalError,
} from '@/lib/api-response';
import { submitGrading } from '@/modules/academic/services/grading.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  const ctx = extractRequestContext(request);

  try {
    if (!ctx.tenantId || !ctx.userId) {
      return unauthorized(ctx);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationFailed(ctx, [{ field: 'body', message: 'Format request body harus berupa JSON valid.' }]);
    }

    const parseResult = GradingSubmitRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return validationFailed(
        ctx,
        parseResult.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      );
    }

    const { classId, periodId, entries, action } = parseResult.data;

    // Finalisasi menuntut seluruh entry memiliki skor atau huruf mutu.
    if (action === 'SUBMIT_FINAL') {
      const incomplete = entries.filter((e) => e.rawScore === undefined && !e.letterCode);
      if (incomplete.length > 0) {
        return validationFailed(ctx, [
          {
            field: 'entries',
            message: `Terdapat ${incomplete.length} mahasiswa tanpa nilai. Semua nilai wajib diisi untuk finalisasi.`,
          },
        ]);
      }
    }

    const result = await submitGrading(ctx.tenantId, ctx.userId, { classId, periodId, entries, action });

    if (!result.ok) {
      switch (result.kind) {
        case 'FORBIDDEN_NOT_ASSIGNED':
          return forbidden(ctx, 'Hanya dosen pengampu kelas ini atau administrator yang dapat menyimpan nilai.');
        case 'CLASS_NOT_FOUND':
          return notFound(ctx, 'Kelas tidak ditemukan pada institusi ini.');
        case 'ENROLLMENT_MISMATCH':
          return errorResponse('VALIDATION_FAILED', 'Validasi gagal.', ctx, 422, result.invalidEnrollmentIds.map((id) => ({
            field: 'entries.enrollmentId',
            message: `Enrollment ${id} bukan bagian dari kelas ini.`,
          })));
      }
    }

    return successResponse(
      {
        classId,
        periodId,
        action,
        status: result.status,
        processedCount: result.processedCount,
        submittedAt: ctx.timestamp,
        message:
          action === 'SUBMIT_FINAL'
            ? 'Nilai kelas berhasil difinalisasi dan diajukan ke Bagian Akademik.'
            : 'Draft nilai kelas berhasil disimpan.',
      },
      ctx,
      200,
    );
  } catch (error) {
    return internalError(ctx, error);
  }
}
