/**
 * Unit tests — Edge JWT verifier (WebCrypto RS256 + JWK).
 * Membuktikan middleware Edge dapat memverifikasi tanda tangan, bukan sekadar cookie.
 */
import { describe, it, expect } from 'vitest';
import { verifyJwtEdge, EdgeJwtError, type JwkPublicKey } from '../../src/lib/jwt-edge';

function b64urlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromString(s: string): string {
  return b64urlFromBytes(new TextEncoder().encode(s));
}

const subtle = globalThis.crypto.subtle;

async function makeKeypair() {
  const pair = (await subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;
  const jwk = (await subtle.exportKey('jwk', pair.publicKey)) as JwkPublicKey;
  return { privateKey: pair.privateKey, publicJwk: jwk };
}

interface Claims {
  sub: string; tid: string; sid: string; role: string;
  iss: string; aud: string; iat: number; exp: number; jti: string; nbf?: number;
}

async function signToken(privateKey: CryptoKey, claims: Claims): Promise<string> {
  const header = b64urlFromString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64urlFromString(JSON.stringify(claims));
  const signingInput = new TextEncoder().encode(`${header}.${payload}`);
  const sig = await subtle.sign('RSASSA-PKCS1-v1_5', privateKey, signingInput);
  return `${header}.${payload}.${b64urlFromBytes(new Uint8Array(sig))}`;
}

function baseClaims(overrides: Partial<Claims> = {}): Claims {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: 'user-1', tid: 'tenant-1', sid: 'session-1', role: 'STUDENT',
    iss: 'sica', aud: 'sica-web', iat: now, exp: now + 900, jti: 'jti-1', ...overrides,
  };
}

describe('verifyJwtEdge (WebCrypto RS256)', () => {
  it('memverifikasi token sah & mengembalikan klaim', async () => {
    const { privateKey, publicJwk } = await makeKeypair();
    const token = await signToken(privateKey, baseClaims());
    const claims = await verifyJwtEdge(token, publicJwk, { issuer: 'sica', audience: 'sica-web' });
    expect(claims.sub).toBe('user-1');
    expect(claims.tid).toBe('tenant-1');
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it('menolak tanda tangan yang dirusak', async () => {
    const { privateKey, publicJwk } = await makeKeypair();
    const token = await signToken(privateKey, baseClaims());
    const seg = token.split('.');
    const tampered = `${seg[0]}.${seg[1]}.${(seg[2] ?? '').slice(0, -3)}AAA`;
    await expect(verifyJwtEdge(tampered, publicJwk, { issuer: 'sica', audience: 'sica-web' }))
      .rejects.toThrowError(EdgeJwtError);
  });

  it('menolak token kedaluwarsa', async () => {
    const { privateKey, publicJwk } = await makeKeypair();
    const token = await signToken(privateKey, baseClaims({ exp: Math.floor(Date.now() / 1000) - 10 }));
    await expect(verifyJwtEdge(token, publicJwk, { issuer: 'sica', audience: 'sica-web' }))
      .rejects.toThrowError(/kedaluwarsa/);
  });

  it('menolak issuer/audience tidak cocok', async () => {
    const { privateKey, publicJwk } = await makeKeypair();
    const token = await signToken(privateKey, baseClaims());
    await expect(verifyJwtEdge(token, publicJwk, { issuer: 'other', audience: 'sica-web' }))
      .rejects.toThrowError(EdgeJwtError);
  });

  it('menolak format malform', async () => {
    const { publicJwk } = await makeKeypair();
    await expect(verifyJwtEdge('a.b', publicJwk, { issuer: 'sica', audience: 'sica-web' }))
      .rejects.toThrowError(/segmen/);
  });
});
