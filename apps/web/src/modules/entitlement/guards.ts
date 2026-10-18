/**
 * Otorisasi sederhana utk operasi entitlement (activate/deactivate).
 * Aktivasi modul adalah aksi administratif tenant — bukan mahasiswa/dosen.
 * Peran dideteksi dari klaim `role` JWT (bukan input klien).
 */
const ADMIN_TOKENS = ['admin', 'operator', 'super', 'leader', 'platform'] as const;

export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return ADMIN_TOKENS.some((token) => normalized.includes(token));
}
