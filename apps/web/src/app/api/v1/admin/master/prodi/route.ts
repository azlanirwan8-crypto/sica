/**
 * GET/POST `/api/v1/admin/master/prodi` (Fase 1B item 4, API_SPEC §4.6.9, M-17/M-03).
 *
 * `study_programs` adalah rumah angka akademik yang ditetapkan kampus — beban SKS
 * minimum, masa studi normal/maksimum, ambang IPK — dan itulah bentuk nyata dari
 * "konfigurasi > kustomisasi kode" (AGENTS §3.10). Angka-angka ini TIDAK dibuat
 * konstanta di kode dan TIDAK dipindah ke key-value: tabelnya sudah ada, dan
 * memindahkannya akan menciptakan dua sumber kebenaran.
 */
import type { NextRequest } from 'next/server';
import { CreateStudyProgramRequestSchema, PERM } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminRead, requireAdminWrite } from '@/lib/admin-guard';
import { mapOrganizationError } from '@/lib/admin-errors';
import { createStudyProgram, listStudyPrograms } from '@/modules/academic/services/admin-organization.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);
  const guard = await requireAdminRead(ctx, PERM.academicProgramView);
  if (!guard.granted) return guard.response;

  const rows = await listStudyPrograms(guard.principal.tenantId);
  return successResponse(rows, ctx);
}

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155) — lihat alasan yang sama di `organisasi/route.ts`.
  const guard = await requireAdminWrite(ctx, PERM.academicProgramCreate);
  if (!guard.granted) return guard.response;

  const parsed = CreateStudyProgramRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body tidak sesuai kontrak program studi.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await createStudyProgram(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    parsed.data
  );
  if (!result.ok) return mapOrganizationError(result.error, ctx);

  return successResponse(result.value, ctx, 201);
}
