/**
 * GET /api/v1/auth/me
 *
 * Mengembalikan identitas pengguna terautentikasi untuk tenant aktif.
 * Identitas diambil dari klaim JWT yang diverifikasi (bukan cookie mentah),
 * lalu profil dibaca lewat transaksi ber-RLS sehingga hanya baris tenant sendiri
 * yang dapat dikembalikan.
 */
import type { NextRequest } from 'next/server';
import {
  extractRequestContext,
  successResponse,
  unauthorized,
  internalError,
} from '@/lib/api-response';
import { getCurrentIdentity } from '@/modules/auth/services/me.service';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);

  if (!ctx.authenticated || !ctx.tenantId || !ctx.userId) {
    return unauthorized(ctx, 'Sesi tidak valid atau telah kedaluwarsa.');
  }

  try {
    const identity = await getCurrentIdentity(ctx.tenantId, ctx.userId);
    if (!identity) {
      return unauthorized(ctx, 'Akun tidak lagi terdaftar pada institusi ini.');
    }
    return successResponse(identity, ctx, 200);
  } catch (error) {
    return internalError(ctx, error);
  }
}
