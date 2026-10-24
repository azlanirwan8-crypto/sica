/**
 * Pemetaan galat domain `/api/v1/admin/**` ke envelope HTTP.
 * Semua kode diambil dari register `API_SPEC §2.3` — tidak ada kode baru di file ini:
 * 5 `NOT_FOUND` · 6 `VALIDATION_FAILED` · 12 `CONFLICT` · 16 `ADMIN_SCOPE_MISMATCH` ·
 * 55 `DECISION_ALREADY_MADE` · 56 `SELF_APPROVAL_FORBIDDEN`.
 */
import type { NextResponse } from 'next/server';
import { errorResponse, type RequestContext } from '@/lib/api-response';
import type { AccessRequestError } from '@/modules/identity/services/access-request.service';
import type { AdminIdentityError } from '@/modules/identity/services/admin-identity.service';
import type { OrganizationError } from '@/modules/academic/services/admin-organization.service';

export function mapAccessRequestError(err: AccessRequestError, ctx: RequestContext): NextResponse {
  switch (err.kind) {
    case 'REQUEST_NOT_FOUND':
    case 'ROLE_NOT_FOUND':
    case 'TARGET_NOT_MEMBER':
    case 'ASSIGNMENT_NOT_FOUND':
      // 404, bukan 403: keberadaan baris institusi lain tidak boleh menjadi oracle.
      return errorResponse('NOT_FOUND', 'Objek target tidak ditemukan dalam institusi ini.', ctx, 404);
    case 'SCOPE_MISMATCH':
      return errorResponse(
        'ADMIN_SCOPE_MISMATCH',
        `Lingkup yang diminta berada di luar penugasan Anda (${err.permission}).`,
        ctx,
        403,
        [{ field: 'scope', message: err.permission }]
      );
    case 'SELF_APPROVAL':
      return errorResponse('SELF_APPROVAL_FORBIDDEN', 'Empat-mata: Anda tidak dapat memutuskan permintaan sendiri.', ctx, 403, [
        { field: 'approverId', message: err.reason },
      ]);
    case 'DECISION_ALREADY_MADE':
      return errorResponse('DECISION_ALREADY_MADE', `Permintaan sudah berada pada state terminal ${err.status}.`, ctx, 409);
    case 'SoD_VIOLATION':
      return errorResponse(
        'CONFLICT',
        `Penugasan melanggar pemisahan tugas (BR-K2): ${err.pair.join(' × ')} tidak boleh dipegang satu orang.`,
        ctx,
        409,
        [{ field: 'roleId', message: err.pair.join(',') }]
      );
    case 'SYSTEM_ROLE_LOCKED':
      return errorResponse('CONFLICT', 'Peran sistem (is_system) terkunci — komposisinya tidak dapat disunting.', ctx, 409);
    case 'SCOPE_CHANGE_BLOCKED':
      return errorResponse(
        'CONFLICT',
        'Perubahan scope membutuhkan izin kanonik `identity.assignment.scope` (baris 112) yang belum dipromosikan — rute diblokir (G-15).',
        ctx,
        409
      );
    case 'TARGET_NOT_ACTIVE':
      return errorResponse('CONFLICT', 'Target bukan anggota aktif — grant tidak dapat diberikan.', ctx, 409);
    case 'ASSIGNMENT_ALREADY_ACTIVE':
      return errorResponse('CONFLICT', 'Penugasan yang sama sudah aktif pada lingkup itu.', ctx, 409);
    case 'DUPLICATE_PENDING_REQUEST':
      return errorResponse('CONFLICT', 'Permintaan identik sudah menunggu keputusan (`uq_acr_pending_scope`).', ctx, 409);
    case 'PERMISSION_NOT_IN_CATALOG':
      return errorResponse('VALIDATION_FAILED', 'Id izin tidak ada di katalog `permissions`.', ctx, 422,
        err.ids.map((id) => ({ field: 'permissionDelta', message: id })));
  }
}

export function mapAdminIdentityError(err: AdminIdentityError, ctx: RequestContext): NextResponse {
  switch (err.kind) {
    case 'USER_NOT_FOUND':
      return errorResponse('NOT_FOUND', 'Pengguna tidak ditemukan dalam institusi ini.', ctx, 404);
    case 'EMAIL_TAKEN':
      return errorResponse('CONFLICT', 'Email sudah terdaftar sebagai akun global.', ctx, 409, [
        { field: 'email', message: 'uq_users_email' },
      ]);
    case 'MEMBER_CODE_TAKEN':
      return errorResponse('CONFLICT', 'Kode anggota sudah dipakai di institusi ini.', ctx, 409, [
        { field: 'memberCode', message: 'uq_memberships_tenant_code' },
      ]);
    case 'CANNOT_DEACTIVATE_SELF':
      return errorResponse('SELF_APPROVAL_FORBIDDEN', 'Anda tidak dapat menonaktifkan akun sendiri.', ctx, 403);
    case 'ROLE_NOT_FOUND':
      return errorResponse('NOT_FOUND', 'Peran tidak ditemukan dalam institusi ini.', ctx, 404);
    case 'ROLE_CODE_TAKEN':
      return errorResponse('CONFLICT', 'Kode peran sudah dipakai di institusi ini (`uq_roles_tenant_code`).', ctx, 409, [
        { field: 'code', message: 'uq_roles_tenant_code' },
      ]);
    case 'ROLE_IN_USE':
      // 19 `REFERENCE_IN_USE`: menolak hapus paksa, bukan menghapus lalu menyesal.
      return errorResponse('CONFLICT', 'Peran masih memegang penugasan — cabut lewat permintaan REVOKE lebih dulu.', ctx, 409, [
        { field: 'roleId', message: 'REFERENCE_IN_USE' },
      ]);
    case 'SYSTEM_ROLE_LOCKED':
      return errorResponse('CONFLICT', 'Peran sistem (is_system) terkunci: tidak dapat diubah atau dihapus.', ctx, 409);
  }
}

/**
 * Galat master organisasi & prodi (Fase 1B item 4). Semua kode dari register
 * `API_SPEC §2.3`: 5 `NOT_FOUND` · 12 `CONFLICT` · 6 `VALIDATION_FAILED`.
 * Tidak ada kode error baru — keadaan yang sama memakai baris yang sama.
 */
export function mapOrganizationError(err: OrganizationError, ctx: RequestContext): NextResponse {
  switch (err.kind) {
    case 'ORG_NOT_FOUND':
    case 'PROGRAM_NOT_FOUND':
      return errorResponse('NOT_FOUND', 'Objek master tidak ditemukan dalam institusi ini.', ctx, 404);
    case 'PARENT_NOT_FOUND':
      return errorResponse('NOT_FOUND', 'Indukan yang dipilih tidak ditemukan dalam institusi ini.', ctx, 404, [
        { field: 'orgId', message: 'organizations.id' },
      ]);
    case 'PARENT_CYCLE':
      return errorResponse(
        'CONFLICT',
        'Perubahan indukan ditolak: hierarki organisasi tidak boleh melingkar.',
        ctx,
        409,
        [{ field: 'parentId', message: 'ORG_PARENT_CYCLE' }]
      );
    case 'ORG_CODE_TAKEN':
      return errorResponse('CONFLICT', 'Kode organisasi sudah dipakai di institusi ini (`uq_orgs_tenant_code`).', ctx, 409, [
        { field: 'code', message: 'uq_orgs_tenant_code' },
      ]);
    case 'PROGRAM_CODE_TAKEN':
      return errorResponse('CONFLICT', 'Kode program studi sudah dipakai di institusi ini.', ctx, 409, [
        { field: 'code', message: 'uq_study_programs_tenant_code' },
      ]);
  }
}
