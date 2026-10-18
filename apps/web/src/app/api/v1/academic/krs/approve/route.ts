/**
 * POST /api/v1/academic/krs/approve
 *
 * Verifikasi dan approval/rejection KRS mahasiswa oleh Dosen Pembimbing Akademik (DPA).
 *
 * Body: { enrollmentIds: UUID[], action: 'APPROVE' | 'REJECT', rejectionReason?: string }
 * Response: Standard Envelope + updated enrollment statuses
 */
import type { NextRequest } from 'next/server';
import { KrsApprovalRequestSchema } from '@sica/contracts';
import {
  extractRequestContext,
  successResponse,
  validationFailed,
  unauthorized,
  forbidden,
  badRequest,
  internalError,
} from '@/lib/api-response';

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  try {
    // 1. Cek autentikasi
    if (!ctx.tenantId || !ctx.userId) {
      return unauthorized(ctx);
    }

    // 2. Cek role DPA
    // TODO: Verifikasi bahwa userId memiliki role ADVISER atau COORDINATOR
    // Mock: selalu dianggap DPA
    const isDpa = true;
    if (!isDpa) {
      return forbidden(ctx, 'Hanya Dosen Pembimbing Akademik yang dapat menyetujui KRS.');
    }

    // 3. Parse & validasi body
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
