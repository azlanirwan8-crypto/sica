/**
 * `GET /api/v1/me/menu` — pohon menu yang disaring server (`API_SPEC §4.17.1`).
 *
 * Gerbangnya **login**, bukan satu izin: rute ini hanya memproyeksikan hak peminta sendiri
 * (sudah difilter `menu_permissions` × `user_role_assignments` × entitlement), jadi tidak ada
 * data subjek lain yang bisa bocor. Persis seperti `GET /auth/me`.
 *
 * `?at=` (rekonstruksi pohon untuk peran audit) sengaja **belum** dilayani. Urutan penolakannya
 * mengikuti norma "izin mendahului bentuk": pemegang `audit.log.view` menerima `422` dengan
 * sebab, pihak tanpa izin menerima `403` datar — bentuk objek tidak pernah diajarkan kepada
 * orang yang memang tidak boleh menyentuhnya (`AGENTS §3.8`).
 */
import type { NextRequest } from 'next/server';
import { MeMenuQuerySchema, isKnownPermission, type PermissionCode } from '@sica/contracts';
import {
  extractRequestContext,
  forbidden,
  internalError,
  successResponse,
  unauthorized,
  validationFailed,
} from '@/lib/api-response';
import { requireDataPrincipal } from '@/modules/authz/rbac-repository';
import { resolveMenuForRequest } from '@/modules/authz/menu.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUDIT_RECONSTRUCTION_PERMISSION = 'audit.log.view' as PermissionCode;

export async function GET(request: NextRequest): Promise<Response> {
  const ctx = extractRequestContext(request);
  if (!ctx.authenticated || !ctx.tenantId || !ctx.userId) {
    return unauthorized(ctx, 'Autentikasi diperlukan untuk membaca menu Anda.');
  }

  const parsed = MeMenuQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return validationFailed(
      ctx,
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
    );
  }

  if (parsed.data.at !== undefined) {
    if (!isKnownPermission(AUDIT_RECONSTRUCTION_PERMISSION)) {
      return forbidden(ctx, 'Izin rekonstruksi menu tidak terdaftar pada katalog RBAC.');
    }
    const gate = await requireDataPrincipal(ctx, AUDIT_RECONSTRUCTION_PERMISSION);
    if (!gate.granted) return gate.response;
    return validationFailed(ctx, [
      {
        field: 'at',
        message: 'Rekonstruksi pohon menu per tanggal belum disediakan; tahap 3 hanya mengevaluasi hari ini.',
      },
    ]);
  }

  try {
    const data = await resolveMenuForRequest({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      layer: parsed.data.layer,
      depth: parsed.data.depth,
    });
    const response = successResponse(data, ctx, 200);
    // §4.17.1: pohon adalah turunan (izin × entitlement × keadaan) — tidak boleh basi.
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('ETag', `W/"m${data.menuVersion}"`);
    return response;
  } catch (error) {
    return internalError(ctx, error);
  }
}
