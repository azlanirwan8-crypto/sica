/**
 * POST /api/v1/academic/krs/approve
 *
 * Verifikasi dan approval/rejection KRS mahasiswa oleh Dosen Pembimbing Akademik (DPA).
 *
 * Body: { enrollmentIds: UUID[], action: 'APPROVE' | 'REJECT', rejectionReason?: string }
 * Response: Standard Envelope + updated enrollment statuses
 */
import type { NextRequest } from 'next/server';
import { KrsApprovalRequestSchema, PERM } from '@sica/contracts';
import {
  extractRequestContext,
  successResponse,
  validationFailed,
  badRequest,
  forbidden,
  internalError,
} from '@/lib/api-response';
import { requireDataPrincipal, holdsScoped } from '@/modules/authz/rbac-repository';
import { ensureModuleActive } from '@/lib/module-gate';

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Gerbang entitlement (SEC-09): modul enrollment wajib ACTIVE/TRIAL.
  const moduleDenied = await ensureModuleActive('enrollment')(ctx);
  if (moduleDenied) return moduleDenied;

  try {
    // 1. L3 (SEC-10): hak VALIDATE dibaca dari tabel user_role_assignments.
    //    L4 (SEC-11): `holdsScoped` menyaring grant ber-izin; penugasan ber-lingkup
    //    periode yang ketat menyusul seed per-periode di R-2.
    const access = await requireDataPrincipal(ctx, PERM.enrollmentKrsApprove);
    if (!access.granted) return access.response;
    if (!holdsScoped(access.principal.access, PERM.enrollmentKrsApprove)) {
      return forbidden(ctx, 'Aksi ini berada di luar hak akses peran Anda.');
    }

    // 2. Parse & validasi body
    const body: unknown = await request.json();
    const parsed = KrsApprovalRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationFailed(
        ctx,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))
      );
    }

    const { enrollmentIds, action, rejectionReason } = parsed.data;

    // 4. Validasi: penolakan harus disertai alasan
    if (action === 'REJECT' && !rejectionReason) {
      return badRequest('Alasan penolakan wajib diisi saat menolak KRS.', ctx, [
        { field: 'rejectionReason', message: 'Field ini wajib untuk aksi REJECT.' },
      ]);
    }

    // 5. Mock: update status enrollment di database
    // TODO: UPDATE enrollments SET status = APPROVED/REJECTED
    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updatedEnrollments = enrollmentIds.map((id) => ({
      enrollmentId: id,
      previousStatus: 'SUBMITTED',
      newStatus,
      updatedAt: ctx.timestamp,
      ...(action === 'REJECT' ? { rejectionReason } : {}),
    }));

    // 6. Jika APPROVE, update enrolledCount di tabel classes
    // TODO: UPDATE classes SET enrolled_count = enrolled_count + 1
    // dan ubah status menjadi EFFECTIVE

    return successResponse(
      {
        action,
        totalProcessed: enrollmentIds.length,
        enrollments: updatedEnrollments,
        approvedBy: ctx.userId,
      },
      ctx,
      200
    );
  } catch (error) {
    return internalError(ctx, error);
  }
}
