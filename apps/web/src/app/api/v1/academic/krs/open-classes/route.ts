/**
 * GET /api/v1/academic/krs/open-classes
 *
 * Mengambil daftar kelas yang tersedia untuk pengisian KRS mahasiswa.
 * Menyertakan informasi jadwal, dosen, sisa kuota, dan deteksi bentrok.
 *
 * Query Params: periodId (required), search, dayOfWeek, page, limit
 * Response: Standard Envelope + paginated KrsClassItem[]
 *
 * Riwayat temuan (G-7/RD-154): rute ini pernah menjawab dari
 * `generateMockOpenClasses()` dengan TODO "ganti dengan query Drizzle", sehingga
 * layar menawarkan affordance di atas data yang tidak ada. Sejak fase 1 daftar
 * dibaca dari PostgreSQL lewat `listOpenClasses()` — read-only, di dalam
 * `withTenantContext` (RLS) dan pada Primary karena jalur ini dipakai
 * read-your-writes. Tanpa baris `students` untuk subjek ini hasilnya daftar
 * KOSONG (200), bukan 500 — kontrak daftar tidak pernah menjanjikan kelas.
 */
import type { NextRequest } from 'next/server';
import { OpenClassesQuerySchema, PERM } from '@sica/contracts';
import {
  extractRequestContext,
  successResponse,
  validationFailed,
  internalError,
} from '@/lib/api-response';
import { requireDataPrincipal } from '@/modules/authz/rbac-repository';

import { listOpenClasses } from '@/modules/academic/services/krs-open-classes.service';
import { ensureModuleActive } from '@/lib/module-gate';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Gerbang entitlement (SEC-09): modul enrollment wajib ACTIVE/TRIAL.
  const moduleDenied = await ensureModuleActive('enrollment')(ctx);
  if (moduleDenied) return moduleDenied;

  try {
    // 1. Guard izin (SEC-05/06): fail-closed, subjek dari token terverifikasi.
    const access = await requireDataPrincipal(ctx, PERM.enrollmentKrsView);
    if (!access.granted) return access.response;
    const { tenantId, userId } = access.principal;

    // 2. Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = OpenClassesQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      return validationFailed(
        ctx,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))
      );
    }

    const { periodId, search, dayOfWeek, page, limit } = parsed.data;

    // 3. Daftar kelas nyata milik mahasiswa ini (periode × prodi × status OPEN).
    const { items, totalRecords } = await listOpenClasses(tenantId, userId, {
      periodId,
      search,
      dayOfWeek,
      page,
      limit,
    });

    // 4. Pagination
    const totalPages = Math.ceil(totalRecords / limit);

    return successResponse(items, ctx, 200, {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    return internalError(ctx, error);
  }
}
