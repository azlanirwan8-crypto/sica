/**
 * GET `/api/v1/admin/permintaan-hak/:id` — satu permintaan beserta jejak lengkapnya.
 *
 * Diselesaikan lewat `listAccessRequests` dengan filter id (bukan query mentah) agar
 * aturan pandangan identik dengan daftar: tanpa `identity.accessrequest.view` hanya baris
 * milik aktor yang bisa muncul — dan sisanya menjawab `404`, bukan `403`, supaya
 * keberadaan baris institusi lain tidak menjadi oracle.
 */
import type { NextRequest } from 'next/server';
import { PERM } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminReadAny } from '@/lib/admin-guard';
import { listAccessRequests } from '@/modules/identity/services/access-request.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  const guard = await requireAdminReadAny(ctx, [
    PERM.identityAccessRequestView,
    PERM.identityAssignmentGrant,
    PERM.identityAssignmentRevoke,
    PERM.identityRoleUpdate,
  ]);
  if (!guard.granted) return guard.response;

  const { rows } = await listAccessRequests(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId, access: guard.principal.access },
    { requestId: id, page: 1, limit: 1 }
  );
  const row = rows[0];
  if (!row) return errorResponse('NOT_FOUND', 'Permintaan tidak ditemukan dalam institusi ini.', ctx, 404);

  return successResponse(row, ctx);
}
