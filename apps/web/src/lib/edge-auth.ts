/**
 * Edge auth helper — murni & dapat diuji, dipakai Next.js Edge middleware.
 *
 * Memverifikasi akses token (RS256/WebCrypto) pada edge, bukan sekadar mengecek
 * keberadaan cookie. Menutup penuh AUD-02 (SECURITY_COMPLIANCE §2.2).
 * Env dibaca dari pemanggil (middleware) agar fungsi ini tidak bergantung runtime.
 */
import {
  verifyJwtEdge,
  EdgeJwtError,
  type EdgeJwtClaims,
  type JwkPublicKey,
} from './jwt-edge';

export interface EdgeAuthEnv {
  readonly jwk?: string;
  readonly issuer?: string;
  readonly audience?: string;
}

export type AuthOutcome =
  | { readonly status: 'valid'; readonly claims: EdgeJwtClaims }
  | { readonly status: 'invalid'; readonly reason: string }
  | { readonly status: 'unconfigured' };

/** Parse JWK publik RSA dari string JSON; null bila hilang/malform/bukan RSA. */
export function parseJwkPublicKey(raw: string | undefined): JwkPublicKey | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<JwkPublicKey>;
    if (obj.kty === 'RSA' && typeof obj.n === 'string' && typeof obj.e === 'string') {
      return obj as JwkPublicKey;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verifikasi token akses. Fail-secure: tanpa kunci/issuer/audience → 'unconfigured'
 * (pemanggil WAJIB memperlakukan ini sebagai belum terautentikasi).
 */
export async function verifyAccessToken(
  token: string | undefined,
  env: EdgeAuthEnv
): Promise<AuthOutcome> {
  if (!token) return { status: 'invalid', reason: 'missing_token' };
  const key = parseJwkPublicKey(env.jwk);
  if (!key || !env.issuer || !env.audience) return { status: 'unconfigured' };
  try {
    const claims = await verifyJwtEdge(token, key, {
      issuer: env.issuer,
      audience: env.audience,
    });
    return { status: 'valid', claims };
  } catch (error) {
    const reason = error instanceof EdgeJwtError ? error.code : 'verification_failed';
    return { status: 'invalid', reason };
  }
}
