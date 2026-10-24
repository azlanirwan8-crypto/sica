/**
 * Kawalan rute mesin parameter (`API_SPEC §4.16.6`, L2/L3/MFA).
 *
 * Kenapa daftar izinnya di sini dan bukan di masing-masing rute: izin kelas risiko dipilih
 * dari **baris `risk_class` di DB**, bukan dari body klien. Rute hanya perlu tahu bahwa
 * pemegang SALAH SATU izin kelas boleh masuk, lalu service memilih kode yang tepat dan
 * menolak dengan `ADMIN_SCOPE_MISMATCH` bila kelas itu bukan miliknya. Menyalin daftar itu
 * ke dua belas berkas adalah cara cepat untuk membuatnya berbeda.
 */
import type { NextRequest } from 'next/server';
import { PERM, PARAM_EDIT_PERMISSION, PARAM_VIEW_PERMISSION, type PermissionCode } from '@sica/contracts';
import type { WriteMeta } from '@/modules/settings/services/system-parameters.service';

const RISK_CLASSES = ['TECHNICAL', 'OPS', 'ACADEMIC', 'FINANCIAL', 'REGULATORY', 'SECURITY'] as const;

export const ALL_PARAM_VIEW_PERMISSIONS: readonly PermissionCode[] = RISK_CLASSES.map(
  (riskClass) => PARAM_VIEW_PERMISSION[riskClass]
);

export const ALL_PARAM_EDIT_PERMISSIONS: readonly PermissionCode[] = RISK_CLASSES.map(
  (riskClass) => PARAM_EDIT_PERMISSION[riskClass]
);

/**
 * Dua kode VALIDATE kelas (RBAC §4.5.10 baris 375/376) — dipakai rute `approve`/`reject`.
 * Bukan daftar izin edit: menyetujui draf adalah aksi berbeda dari mengajukannya, dan
 * pencampuran keduanya menghapus empat-mata (itu justru isi norma `G-19`).
 */
export const ALL_PARAM_APPROVE_PERMISSIONS: readonly PermissionCode[] = [
  PERM.settingsParamApproveRegulatory,
  PERM.settingsParamApproveSecurity,
];

/**
 * Jejak penulisan untuk `master_system_parameter_history` (`ip inet NOT NULL`, `request_id`).
 * `0.0.0.0` = "tidak diketahui", disimpan apa adanya: kolomnya wajib dan riwayat yang
 * kehilangan pelapor lebih berbahaya daripada riwayat yang jujur menandai ketidaktahuan.
 */
export function parameterWriteMeta(request: NextRequest, requestId: string): WriteMeta {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const real = request.headers.get('x-real-ip');
  const candidate = forwarded ?? real ?? '';
  const looksLikeAddress = /^[0-9a-fA-F:.]{3,45}$/.test(candidate);
  return { ip: looksLikeAddress ? candidate : '0.0.0.0', requestId };
}
