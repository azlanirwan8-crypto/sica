/**
 * PATCH `/api/v1/admin/organisasi/:id` (Fase 1B item 4).
 *
 * Yang boleh berubah: nama, kode, kelas, indukan. `DELETE` sengaja tidak ada —
 * organisasi adalah titik rujukan lingkup dan prodi, dan menghapusnya akan memutus
 * jejak historis laporan yang sudah terbit. Siklus indukan ditolak di service DAN
 * akan ditolak DB bila suatu saat constraint penutup siklus dipasang.
 */
import type { NextRequest } from 'next/server';
import { PERM, UpdateOrganizationRequestSchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, invalidRouteId, isUuid, successResponse } from '@/lib/api-response';
import { requireAdminWrite } from '@/lib/admin-guard';
import { mapOrganizationError } from '@/lib/admin-errors';
import { updateOrganization } from '@/modules/academic/services/admin-organization.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  // Izin lebih dulu, baru bentuk (RD-155): menjawab 422 ber-detail kepada peran yang memang
  // tidak berhak menulis membocorkan kontrak objek admin — oracle yang sama dengan yang
  // sudah ditutup untuk 401 di `admin-guard.ts`.
  const guard = await requireAdminWrite(ctx, PERM.academicOrganizationUpdate);
  if (!guard.granted) return guard.response;

  if (!isUuid(id)) return invalidRouteId(ctx);
  const parsed = UpdateOrganizationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body tidak sesuai perubahan organisasi.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await updateOrganization(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    id,
    parsed.data
  );
  if (!result.ok) return mapOrganizationError(result.error, ctx);

  return successResponse(result.value, ctx);
}
