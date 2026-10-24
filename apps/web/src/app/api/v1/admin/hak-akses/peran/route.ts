/**
 * GET/POST `/api/v1/admin/hak-akses/peran` (API_SPEC §4.6.9).
 *
 * GET  → daftar peran tenant beserta jumlah pemegang & jumlah izin. Peran sistem tetap
 *        TAMPIL tapi terkunci: UI menandainya, bukan menyembunyikannya — "hilang" akan
 *        membuat layar matriks izin tidak lengkap (celah `G-09`).
 * POST → membuat peran KOSTUM dengan `is_system = false`. Pembuatan peran BUKAN perubahan
 *        hak: peran tanpa grant belum memberi apa pun kepada siapa pun, sehingga ia sah
 *        ditulis langsung; yang wajib empat-mata adalah komposisi izinnya (`PUT …/izin`).
 */
import type { NextRequest } from 'next/server';
import { CreateRoleRequestSchema, PERM } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminRead, requireAdminWrite } from '@/lib/admin-guard';
import { mapAdminIdentityError } from '@/lib/admin-errors';
import { createTenantRole, listTenantRoles } from '@/modules/identity/services/admin-identity.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);
  const guard = await requireAdminRead(ctx, PERM.identityRoleView);
  if (!guard.granted) return guard.response;

  const rows = await listTenantRoles(guard.principal.tenantId);
  return successResponse(rows, ctx);
}

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);
  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWrite(ctx, PERM.identityRoleCreate);
  if (!guard.granted) return guard.response;

  const parsed = CreateRoleRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body harus `{code, displayName, scopeKind, reason}`.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await createTenantRole(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    parsed.data
  );
  if (!result.ok) return mapAdminIdentityError(result.error, ctx);

  return successResponse(result.value, ctx, 201);
}
