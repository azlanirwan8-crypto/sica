/**
 * PATCH `/api/v1/admin/master/prodi/:id` (Fase 1B item 4).
 *
 * Perubahan ambang kelulusan = perubahan syarat hak atas gelar, sehingga setiap
 * tulis membawa `reason` dan berakhir di `audit_logs` dengan `before`/`after`.
 * Empat-mata penuh untuk angka prodi **belum** dipasang: kelas `REGULATORY` pada
 * mesin parameter sudah menuntut penyetuju kedua, tetapi `study_programs` bukan
 * baris parameter — itu keputusan produk yang masih terbuka (lihat `P-*`).
 */
import type { NextRequest } from 'next/server';
import { PERM, UpdateStudyProgramRequestSchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, invalidRouteId, isUuid, successResponse } from '@/lib/api-response';
import { requireAdminWrite } from '@/lib/admin-guard';
import { mapOrganizationError } from '@/lib/admin-errors';
import { updateStudyProgram } from '@/modules/academic/services/admin-organization.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  // Izin lebih dulu, baru bentuk (RD-155) — lihat alasan yang sama di `organisasi/[id]`.
  const guard = await requireAdminWrite(ctx, PERM.academicProgramUpdate);
  if (!guard.granted) return guard.response;

  if (!isUuid(id)) return invalidRouteId(ctx);
  const parsed = UpdateStudyProgramRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body tidak sesuai perubahan program studi.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await updateStudyProgram(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    id,
    parsed.data
  );
  if (!result.ok) return mapOrganizationError(result.error, ctx);

  return successResponse(result.value, ctx);
}
