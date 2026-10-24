/**
 * Bendera mode DEVELOPMENT saja (UI_UX §2.6 / SECURITY §3, didaftarkan `RD-173`).
 *
 * Semua predikat di berkas ini WAJIB gagal-tertutup (`fail-closed`): hanya aktif
 * bila kondisi tertulis terpenuhi, dan tidak pernah bergantung pada urutan baca
 * atau nilai default. Konsekuensinya dicatat di `ENV_CONTRACT.md` dan tidak boleh
 * disalin ke tempat lain (satu sumber kebenaran).
 */

/** Nama variabel environment-nya, ditulis sekali supaya guard dan pesan memakai yang sama. */
export const DEV_MFA_BYPASS_ENV = 'SICA_DEV_MFA_BYPASS';

/**
 * `NodeJS.ProcessEnv` menarif `NODE_ENV` sebagai enum sempit dan menolak objek
 * kosong, padahal predikat ini justru harus diuji dengan pasangan nilai yang
 * tidak sah. Bentuk longgar ini yang dibaca `process.env` sebenarnya.
 */
type EnvLike = Readonly<Record<string, string | undefined>>;

/**
 * Lewati LANGKAH MFA pada login — khusus `NODE_ENV=development` dan hanya bila
 * `SICA_DEV_MFA_BYPASS=1` tertulis di `apps/web/.env` (berkas yang di-gitignore).
 *
 * Yang TIDAK dilakukan bypass ini, dan itu bagian dari rancangannya:
 * - sesi tetap diterbitkan dengan `amr = ['pwd']`, BUKAN `['pwd','mfa']`. Kelas
 *   sesi tidak dinaikkan secara diam-diam, sehingga `requirePlatformWrite` dan
 *   `requireAdminWriteAny` tetap menjawab `401 MFA_REQUIRED`;
 * - `login_events.auth_method` tetap tercatat `password` (bukan `password+totp`),
 *   jadi jejak audit tidak berbohong;
 * - tantangan `mfa_challenges` tidak dibuat sama sekali (tidak ada baris sampah
 *   per percobaan login).
 *
 * Jadi bypass ini membeli satu hal: bebas mengetik kode 6 angka saat menelusuri
 * layar. Ia tidak membeli hak tulis platform/admin.
 */
export function devMfaBypassEnabled(env: EnvLike = process.env): boolean {
  return env['NODE_ENV'] === 'development' && env[DEV_MFA_BYPASS_ENV] === '1';
}

/** Kalimat penutup untuk pesan `MFA_REQUIRED` agar tidak menyuruh hal yang mustahil. */
export function devMfaBypassHint(env: EnvLike = process.env): string {
  if (!devMfaBypassEnabled(env)) return '';
  return ` (mode dev: MFA sedang dilewati saat login lewat ${DEV_MFA_BYPASS_ENV}=1, sehingga tidak ada tantangan untuk diselesaikan — hapus flag itu dan masuk ulang untuk aksi tulis)`;
}
