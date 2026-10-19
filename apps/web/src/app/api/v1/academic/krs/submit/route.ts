/**
 * POST /api/v1/academic/krs/submit
 *
 * Submit pengajuan KRS mahasiswa — kini DB-backed (lihat `krs.service.ts`):
 * kuota SKS nyata, kapasitas kelas atomik (advisory lock), deteksi bentrok jadwal,
 * dan idempotensi. Rute ini hanya menegakkan auth + validasi Zod lalu memetakan
 * hasil service ke HTTP baku.
 *
 * Body: { periodId: UUID, classIds: UUID[] }
 * Response: Standard Envelope + enrollment results + quotaSummary
 */
import type { NextRequest } from 'next/server';
import { KrsSubmitRequestSchema } from '@sica/contracts';
import {
  extractRequestContext,
  successResponse,
  validationFailed,
  unauthorized,
  badRequest,
  conflict,
  internalError,
} from '@/lib/api-response';
import { submitKrs } from '@/modules/academic/services/krs.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  const ctx = extractRequestContext(request);

  try {
    if (!ctx.tenantId || !ctx.userId) {
      return unauthorized(ctx);
    }

    const body: unknown = await request.json();
    const parsed = KrsSubmitRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationFailed(
        ctx,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }

    const { periodId, classIds } = parsed.data;
    const result = await submitKrs(ctx.tenantId, ctx.userId, { periodId, classIds });

    if (!result.ok) {
      switch (result.kind) {
        case 'STUDENT_NOT_FOUND':
          return badRequest('Akun ini tidak tertaut pada profil mahasiswa aktif.', ctx);
        case 'PERIOD_NOT_OPEN':
          return badRequest('Periode akademik tidak ditemukan atau tidak sedang dibuka.', ctx, [
            { field: 'periodId', message: 'Periode harus berstatus OPEN.' },
          ]);
        case 'CLASS_INVALID':
          return badRequest(result.message, ctx, [{ field: 'classIds', message: result.message }]);
        case 'QUOTA_EXCEEDED':
          return badRequest(result.message, ctx, [
            {
              field: 'classIds',
              message: `Kuota terlampaui: maks ${result.quota.maxAllowedSks} SKS, terpakai ${result.quota.usedSks} SKS.`,
            },
          ]);
        case 'SCHEDULE_CONFLICT':
          return conflict(ctx, 'Jadwal bentrok dengan kelas yang sudah diambil.', [
            { field: 'classIds', message: result.message },
          ]);
        case 'CLASS_FULL':
          return conflict(ctx, 'Beberapa kelas sudah penuh.', result.fullClassIds.map((id) => ({
            field: `classIds.${id}`,
            message: 'Kapasitas kelas sudah terisi penuh.',
          })));
      }
    }

    return successResponse(
      {
        periodId,
        enrollments: result.created,
        alreadyEnrolled: result.alreadyEnrolled,
        quotaSummary: result.quota,
      },
      ctx,
      result.created.length > 0 ? 201 : 200,
    );
  } catch (error) {
    return internalError(ctx, error);
  }
}
