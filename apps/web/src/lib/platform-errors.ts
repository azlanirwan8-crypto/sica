/**
 * Pemetaan galat domain layanan platform ke envelope HTTP (kode dari register §2.3;
 * tidak ada kode baru di file ini — 150 sudah didaftarkan, sisanya kode generik 5/6/12).
 */
import type { NextResponse } from 'next/server';
import { errorResponse, type RequestContext } from '@/lib/api-response';
import type { PlatformServiceError } from '@/modules/platform/services/platform.service';

export function mapProvisionError(err: PlatformServiceError, ctx: RequestContext): NextResponse {
  switch (err.kind) {
    case 'TENANT_PROVISION_FAILED':
      return errorResponse('TENANT_PROVISION_FAILED', `Provisioning gagal: ${err.cause}`, ctx, 409);
    case 'SLUG_TAKEN':
      return errorResponse('CONFLICT', 'Slug sudah dipakai institusi lain.', ctx, 409);
    case 'ADMIN_EMAIL_TAKEN':
      return errorResponse('CONFLICT', 'Email admin pertama sudah terdaftar sebagai akun global.', ctx, 409);
    case 'NO_ROLE_TEMPLATE':
      return errorResponse('VALIDATION_FAILED', 'Tenant operator tidak memiliki template peran sistem (seed 0011 belum ada di sini).', ctx, 422);
    case 'MODULE_UNKNOWN':
      return errorResponse('VALIDATION_FAILED', `Modul "${err.code}" tidak terdaftar pada katalog (P-10: menolak aktivasi tanpa baris katalog).`, ctx, 422, [
        { field: 'moduleCodes', message: err.code },
      ]);
    default:
      return errorResponse('INTERNAL_SERVER_ERROR', 'Provisioning tenant gagal karena keadaan tak terduga.', ctx, 500);
  }
}

export function mapTransitionError(err: PlatformServiceError, ctx: RequestContext): NextResponse {
  switch (err.kind) {
    case 'TENANT_NOT_FOUND':
    case 'GRANT_NOT_FOUND':
    case 'TARGET_NOT_MEMBER':
      // 404, bukan 403 — tenant/grant milik institusi lain tidak boleh menjadi oracle (§4.17.1 butir 2).
      return errorResponse('NOT_FOUND', 'Objek target tidak ditemukan dalam institusi ini.', ctx, 404);
    case 'TENANT_ARCHIVED':
      return errorResponse('CONFLICT', 'Tenant telah ARCHIVED — keadaan terminal, tidak dapat disusuli transisi.', ctx, 409);
    case 'TRANSITION_INVALID':
      return errorResponse('CONFLICT', `Transisi ${err.from} → ${err.to} tidak sah.`, ctx, 409);
    default:
      return errorResponse('INTERNAL_SERVER_ERROR', 'Perubahan keadaan gagal karena keadaan tak terduga.', ctx, 500);
  }
}
