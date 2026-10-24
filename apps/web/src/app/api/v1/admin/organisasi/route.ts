/**
 * GET/POST `/api/v1/admin/organisasi` (Fase 1B item 4, API_SPEC §4.6.9, pemegang M-03).
 *
 * Hierarki `organizations` adalah tanah tempat lingkup penugasan `ORG` berpijak:
 * tanpa layar ini, "hak hanya di fakultas X" tidak bisa diucapkan siapa pun selain
 * pembuat seed. Tulis selalu membawa `reason` dan berakhir di `audit_logs`.
 */
import type { NextRequest } from 'next/server';
import { CreateOrganizationRequestSchema, PERM } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminRead, requireAdminWrite } from '@/lib/admin-guard';
import { mapOrganizationError } from '@/lib/admin-errors';
import { createOrganization, listOrganizations } from '@/modules/academic/services/admin-organization.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);
  const guard = await requireAdminRead(ctx, PERM.academicOrganizationView);
  if (!guard.granted) return guard.response;

  const rows = await listOrganizations(guard.principal.tenantId);
  return successResponse(rows, ctx);
}

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWrite(ctx, PERM.academicOrganizationCreate);
  if (!guard.granted) return guard.response;

  const parsed = CreateOrganizationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body tidak sesuai kontrak organisasi.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await createOrganization(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    parsed.data
  );
  if (!result.ok) return mapOrganizationError(result.error, ctx);

  return successResponse(result.value, ctx, 201);
}
