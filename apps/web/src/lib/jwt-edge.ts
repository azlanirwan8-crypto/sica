/**
 * Edge JWT Verifier (RS256 via WebCrypto) — untuk Next.js Edge middleware.
 *
 * Middleware Edge TIDAK punya `node:crypto`; verifikasi akses token dilakukan di sini
 * memakai `crypto.subtle` + Public Key berformat JWK (bukan PEM). Menutup AUD-02 penuh
 * (verifikasi tanda tangan di edge, bukan sekadar cek keberadaan cookie).
 * Rujukan: docs/SECURITY_COMPLIANCE.md §2.2, docs/ARCHITECTURE.md.
 */

export interface EdgeJwtClaims {
  readonly sub: string;
  readonly tid: string;
  readonly sid: string;
  readonly role: string;
  readonly iss: string;
  readonly aud: string;
  readonly iat: number;
  readonly exp: number;
  readonly nbf?: number;
  readonly jti: string;
}

export type EdgeJwtErrorCode =
  | 'MALFORMED'
  | 'SIGNATURE_INVALID'
  | 'EXPIRED'
  | 'NOT_YET_VALID'
  | 'ISSUER_MISMATCH'
  | 'AUDIENCE_MISMATCH';

export class EdgeJwtError extends Error {
  readonly code: EdgeJwtErrorCode;
  constructor(code: EdgeJwtErrorCode, message: string) {
    super(message);
    this.name = 'EdgeJwtError';
    this.code = code;
  }
}

export interface JwkPublicKey {
  readonly kty: string;
  readonly n: string;
  readonly e: string;
  readonly alg?: string;
  readonly ext?: boolean;
  readonly key_ops?: string[];
  readonly [key: string]: unknown;
}

export interface VerifyEdgeOptions {
  readonly issuer: string;
  readonly audience: string;
  readonly clockToleranceSec?: number;
}

function base64urlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeUtf8Json<T>(bytes: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export async function verifyJwtEdge(
  token: string,
  jwkPublicKey: JwkPublicKey,
  opts: VerifyEdgeOptions
): Promise<EdgeJwtClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new EdgeJwtError('MALFORMED', 'Token JWT tidak memiliki 3 segmen.');
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];

  let headerAlg: string | undefined;
  try {
    const header = decodeUtf8Json<{ alg?: string }>(base64urlToBytes(encodedHeader));
    headerAlg = header.alg;
  } catch {
    throw new EdgeJwtError('MALFORMED', 'Header JWT tidak valid.');
  }
  if (headerAlg !== 'RS256') {
    throw new EdgeJwtError('SIGNATURE_INVALID', 'Algoritma JWT harus RS256.');
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new EdgeJwtError('SIGNATURE_INVALID', 'WebCrypto subtle tidak tersedia.');
  }

  const key = await subtle.importKey(
    'jwk',
    jwkPublicKey as JsonWebKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = base64urlToBytes(encodedSignature);

  const valid = await subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature as BufferSource,
    signingInput as BufferSource
  );
  if (!valid) {
    throw new EdgeJwtError('SIGNATURE_INVALID', 'Tanda tangan JWT tidak valid.');
  }

  let claims: EdgeJwtClaims;
  try {
    claims = decodeUtf8Json<EdgeJwtClaims>(base64urlToBytes(encodedPayload));
  } catch {
    throw new EdgeJwtError('MALFORMED', 'Payload JWT bukan JSON valid.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const tol = opts.clockToleranceSec ?? 0;
  if (typeof claims.exp === 'number' && nowSec > claims.exp + tol) {
    throw new EdgeJwtError('EXPIRED', 'Token telah kedaluwarsa.');
  }
  if (typeof claims.nbf === 'number' && nowSec + tol < claims.nbf) {
    throw new EdgeJwtError('NOT_YET_VALID', 'Token belum berlaku.');
  }
  if (claims.iss !== opts.issuer) {
    throw new EdgeJwtError('ISSUER_MISMATCH', 'Penerbit token tidak cocok.');
  }
  if (claims.aud !== opts.audience) {
    throw new EdgeJwtError('AUDIENCE_MISMATCH', 'Audiens token tidak cocok.');
  }

  return claims;
}
