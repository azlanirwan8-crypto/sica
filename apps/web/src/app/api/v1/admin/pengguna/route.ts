/**
 * GET/POST `/api/v1/admin/pengguna` (API_SPEC §4.6.9, M-03).
 *
 * GET  → daftar §2.4; peran yang tampil dibaca dari `user_role_assignments`, bukan carrier.
 * POST → membuat AKUN + keanggotaan. Hak akses sengaja TIDAK ikut di sini: grant adalah
 *        jalur empat-mata (`POST /admin/hak-akses/penugasan`), bukan efek samping pembuatan akun.
 * Sandi awal hanya sekali-tampil dan tidak pernah masuk log (FR-IDT-05).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AdminUserListQuerySchema, CreateAdminUserRequestSchema, PERM } from '@sica/contracts';
import { errorResponse, extractRequestContext, paginationFor, successResponse } from '@/lib/api-response';
import { requireAdminRead, requireAdminWrite } from '@/lib/admin-guard';
import { mapAdminIdentityError } from '@/lib/admin-errors';
import { createAdminUser, listAdminUsers } from '@/modules/identity/services/admin-identity.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): pola yang sama dengan `admin/organisasi`.
  const guard = await requireAdminRead(ctx, PERM.identityUserView);
  if (!guard.granted) return guard.response;

  const parsed = AdminUserListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Filter daftar tidak sah.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const { rows, total } = await listAdminUsers(guard.principal.tenantId, parsed.data);
  return successResponse(rows, ctx, 200, paginationFor(parsed.data.page, parsed.data.limit, total));
}

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWrite(ctx, PERM.identityUserCreate);
  if (!guard.granted) return guard.response;

  const parsed = CreateAdminUserRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body tidak sesuai kontrak pembuatan akun.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await createAdminUser(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    parsed.data
  );
  if (!result.ok) return mapAdminIdentityError(result.error, ctx);

  return NextResponse.json(
    {
      success: true,
      data: result.value,
      meta: { timestamp: ctx.timestamp, requestId: ctx.requestId },
    },
    { status: 201 }
  );
}
