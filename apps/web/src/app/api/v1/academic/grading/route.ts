/**
 * POST /api/v1/academic/grading
 *
 * Handler input, penyimpanan draft, dan finalisasi nilai mahasiswa oleh Dosen Pengampu.
 *
 * Request Body: GradingSubmitRequest (classId, periodId, entries, action)
 * Action: 'SAVE_DRAFT' | 'SUBMIT_FINAL'
 * Response: Standard Envelope + status ringkasan grading
 */
import type { NextRequest } from 'next/server';
import { GradingSubmitRequestSchema } from '@sica/contracts';
import {
  extractRequestContext,
  successResponse,
  validationFailed,
  unauthorized,
  internalError,
} from '@/lib/api-response';

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  try {
    // 1. Validasi Autentikasi
    if (!ctx.tenantId) {
      return unauthorized(ctx);
    }

    // 2. Parse & Validasi Request Body menggunakan Zod Contract
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationFailed(ctx, [
        {
          field: 'body',
          message: 'Format request body harus berupa JSON valid.',
        },
      ]);
    }

    const parseResult = GradingSubmitRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return validationFailed(
        ctx,
        parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))
      );
    }

    const { classId, periodId, entries, action } = parseResult.data;

    // 3. Validasi aturan kelengkapan jika SUBMIT_FINAL
    if (action === 'SUBMIT_FINAL') {
      const incompleteEntries = entries.filter(
        (e) => e.rawScore === undefined && !e.letterCode
      );
      if (incompleteEntries.length > 0) {
        return validationFailed(ctx, [
          {
            field: 'entries',
            message: `Terdapat ${incompleteEntries.length} mahasiswa yang belum memiliki nilai. Semua nilai wajib diisi untuk finalisasi nilai kelas.`,
          },
        ]);
      }
    }

    // 4. Simulasi proses penyimpanan nilai ke database
    // Dosen menginput komponen nilai, sistem menghitung huruf mutu & bobot angka
    const processedCount = entries.length;
    const finalStatus = action === 'SUBMIT_FINAL' ? 'SUBMITTED' : 'DRAFT';

    return successResponse(
      {
        classId,
        periodId,
        action,
        status: finalStatus,
        processedCount,
        submittedAt: new Date().toISOString(),
        message:
          action === 'SUBMIT_FINAL'
            ? 'Nilai kelas berhasil difinalisasi dan diajukan ke Bagian Akademik.'
            : 'Draft nilai kelas berhasil disimpan sementara.',
      },
      ctx,
      200
    );
  } catch (error) {
    return internalError(ctx, error);
  }
}
