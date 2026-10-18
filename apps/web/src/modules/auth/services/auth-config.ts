/**
 * Membangun AuthRuntimeConfig dari environment (lapis transport sah membaca process.env).
 * Mengembalikan null + daftar key yang hilang bila belum siap (route → 500).
 * pepper boleh kosong utk refresh/logout (verifikasi sandi tak dipakai), tetap disertakan utk login.
 */
import type { AuthRuntimeConfig } from './auth.service';

export function buildAuthConfig(): { config: AuthRuntimeConfig | null; missing: string[] } {
  const privateKeyPem = process.env['JWT_PRIVATE_KEY'] ?? '';
  if (!privateKeyPem) return { config: null, missing: ['JWT_PRIVATE_KEY'] };
  return {
    config: {
      privateKeyPem,
      pepper: process.env['PASSWORD_HASH_PEPPER'] ?? '',
      issuer: process.env['JWT_ISSUER'] ?? 'sica',
      audience: process.env['JWT_AUDIENCE'] ?? 'sica-web',
      accessTtlSec: Number(process.env['JWT_ACCESS_TOKEN_TTL_SEC'] ?? 900),
      refreshTtlSec: Number(process.env['JWT_REFRESH_TOKEN_TTL_SEC'] ?? 604800),
    },
    missing: [],
  };
}
