/**
 * JWT RS256 Service — SICA Auth (dependency-free, Node built-in crypto)
 *
 * Sign/verify akses token dengan RSA-SHA256 (PEM key). Dipakai route handler
 * Node runtime untuk memvalidasi identitas & tenant dari token, bukan cookie mentah
 * (menutup AUD-02/03). Verifikasi di Edge middleware memakai WebCrypto/JWK (terpisah).
 */
import { createSign, createVerify, randomUUID } from 'crypto';

export type JwtAlgorithm = 'RS256';

export interface JwtClaims {
  readonly sub: string; // user id global
  readonly tid: string; // tenant id
  readonly sid: string; // session id
  readonly role: string; // role context (scoped)
  readonly iss: string;
  readonly aud: string;
  readonly iat: number;
  readonly exp: number;
  readonly nbf?: number;
  readonly jti: string;
}

interface JwtPayloadInput {
  readonly sub: string;
  readonly tid: string;
  readonly sid: string;
  readonly role: string;
}

interface JwtHeader {
  readonly alg: JwtAlgorithm;
  readonly typ: 'JWT';
  readonly kid?: string;
}

export type JwtErrorCode =
  | 'MALFORMED'
  | 'SIGNATURE_INVALID'
  | 'EXPIRED'
  | 'NOT_YET_VALID'
  | 'ISSUER_MISMATCH'
  | 'AUDIENCE_MISMATCH';

export class JwtError extends Error {
  readonly code: JwtErrorCode;
  constructor(code: JwtErrorCode, message: string) {
    super(message);
    this.name = 'JwtError';
    this.code = code;
  }
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input as never).toString('base64url');
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export interface SignOptions {
  readonly privateKeyPem: string;
  readonly issuer: string;
  readonly audience: string;
  readonly ttlSeconds: number;
  readonly kid?: string;
}

export function signJwt(
  payload: JwtPayloadInput,
  opts: SignOptions
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = {
    ...payload,
    iss: opts.issuer,
    aud: opts.audience,
    iat: nowSec,
    exp: nowSec + opts.ttlSeconds,
    jti: randomUUID(),
  };

  const header: JwtHeader = { alg: 'RS256', typ: 'JWT', kid: opts.kid };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(opts.privateKeyPem).toString('base64url');

  return `${signingInput}.${signature}`;
}

export interface VerifyOptions {
  readonly publicKeyPem: string;
  readonly issuer: string;
  readonly audience: string;
  readonly clockToleranceSec?: number;
}

export function verifyJwt(token: string, opts: VerifyOptions): JwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new JwtError('MALFORMED', 'Token JWT tidak memiliki 3 segmen.');
  }
  const [encodedHeader, encodedPayload, encodedSig] = [parts[0], parts[1], parts[2]];
  if (!encodedHeader || !encodedPayload || !encodedSig) {
    throw new JwtError('MALFORMED', 'Segmen JWT kosong.');
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = fromBase64url(encodedSig);

  const verifier = createVerify('RSA-SHA256');
  verifier.update(signingInput);
  verifier.end();
  const validSignature = verifier.verify(opts.publicKeyPem, signature);
  if (!validSignature) {
    throw new JwtError('SIGNATURE_INVALID', 'Tanda tangan JWT tidak valid.');
  }

  let header: JwtHeader;
  let claims: JwtClaims;
  try {
    header = JSON.parse(fromBase64url(encodedHeader).toString('utf8')) as JwtHeader;
    claims = JSON.parse(fromBase64url(encodedPayload).toString('utf8')) as JwtClaims;
  } catch {
    throw new JwtError('MALFORMED', 'Payload JWT bukan JSON valid.');
  }

  if (header.alg !== 'RS256') {
    throw new JwtError('SIGNATURE_INVALID', 'Algoritma JWT tidak diizinkan.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const tolerance = opts.clockToleranceSec ?? 0;
  if (typeof claims.exp === 'number' && nowSec > claims.exp + tolerance) {
    throw new JwtError('EXPIRED', 'Token telah kedaluwarsa.');
  }
  if (typeof claims.nbf === 'number' && nowSec + tolerance < claims.nbf) {
    throw new JwtError('NOT_YET_VALID', 'Token belum berlaku.');
  }
  if (claims.iss !== opts.issuer) {
    throw new JwtError('ISSUER_MISMATCH', 'Penerbit token tidak cocok.');
  }
  if (claims.aud !== opts.audience) {
    throw new JwtError('AUDIENCE_MISMATCH', 'Audiens token tidak cocok.');
  }

  return claims;
}
