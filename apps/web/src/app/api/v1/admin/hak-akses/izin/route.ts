/**
 * GET `/api/v1/admin/hak-akses/izin` (API_SPEC §4.6.9).
 * Katalog izin GLOBAL `resource × verb × module` — bahan layar matriks izin (`G-09`).
 * Tabel ini terbaca lewat policy `global_read` (`0087`) dan tidak pernah ditulis dari
 * rute tenant: kosakata izin adalah kelas A (protokol), bukan data yang dirawat kampus.
 */
import type { NextRequest } from 'next/server';
import { PERM } from '@sica/contracts';
import { extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminRead } from '@/lib/admin-guard';
import { listPermissionCatalog } from '@/modules/identity/services/admin-identity.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);
  const guard = await requireAdminRead(ctx, PERM.identityPermissionView);
  if (!guard.granted) return guard.response;

  const rows = await listPermissionCatalog();
  return successResponse(rows, ctx);
}
