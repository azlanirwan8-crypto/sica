/**
 * Unit tests — edge-auth helper (parseJwkPublicKey + verifyAccessToken).
 * Membuktikan middleware Edge memverifikasi tanda tangan & bersikap fail-secure.
 */
import { describe, it, expect } from 'vitest';
import {
  parseJwkPublicKey,
  verifyAccessToken,
  type EdgeAuthEnv,
} from '../../src/lib/edge-auth';
import type { JwkPublicKey } from '../../src/lib/jwt-edge';

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
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;
  const jwk = (await subtle.exportKey('jwk', pair.publicKey)) as JwkPublicKey;
  return { privateKey: pair.privateKey, publicJwk: jwk };
}

interface Claims {
  sub: string; tid: string; sid: string; role: string;
  iss: string; aud: string; iat: number; exp: number; jti: string;
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

describe('parseJwkPublicKey', () => {
  it('null untuk input hilang / JSON malform', () => {
    expect(parseJwkPublicKey(undefined)).toBeNull();
    expect(parseJwkPublicKey('bukan json')).toBeNull();
  });
  it('null untuk kunci non-RSA', () => {
    expect(parseJwkPublicKey(JSON.stringify({ kty: 'EC', crv: 'P-256' }))).toBeNull();
  });
  it('objek untuk JWK RSA sah', async () => {
    const { publicJwk } = await makeKeypair();
    const parsed = parseJwkPublicKey(JSON.stringify(publicJwk));
    expect(parsed?.kty).toBe('RSA');
    expect(typeof parsed?.n).toBe('string');
  });
});

describe('verifyAccessToken', () => {
  it('invalid bila token hilang', async () => {
    const env: EdgeAuthEnv = { jwk: '{}', issuer: 'sica', audience: 'sica-web' };
    expect(await verifyAccessToken(undefined, env)).toEqual({ status: 'invalid', reason: 'missing_token' });
  });

  it('unconfigured bila JWK/issuer/audience belum ada (fail-secure)', async () => {
    const { publicJwk } = await makeKeypair();
    const token = await signToken((await subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['sign', 'verify']
    ) as CryptoKeyPair).privateKey, baseClaims());
    expect(await verifyAccessToken(token, {})).toEqual({ status: 'unconfigured' });
    expect(await verifyAccessToken(token, { jwk: JSON.stringify(publicJwk) })).toEqual({ status: 'unconfigured' });
  });

  it('valid & mengembalikan klaim tid/sub untuk token sah', async () => {
    const { privateKey, publicJwk } = await makeKeypair();
    const token = await signToken(privateKey, baseClaims());
    const res = await verifyAccessToken(token, {
      jwk: JSON.stringify(publicJwk), issuer: 'sica', audience: 'sica-web',
    });
    expect(res.status).toBe('valid');
    if (res.status === 'valid') {
      expect(res.claims.tid).toBe('tenant-1');
      expect(res.claims.sub).toBe('user-1');
    }
  });

  it('invalid utk tanda tangan dirusak & token kedaluwarsa', async () => {
    const { privateKey, publicJwk } = await makeKeypair();
    const env: EdgeAuthEnv = { jwk: JSON.stringify(publicJwk), issuer: 'sica', audience: 'sica-web' };

    const token = await signToken(privateKey, baseClaims());
    const seg = token.split('.');
    const tampered = `${seg[0]}.${seg[1]}.${(seg[2] ?? '').slice(0, -3)}AAA`;
    const r1 = await verifyAccessToken(tampered, env);
    expect(r1.status).toBe('invalid');

    const expired = await signToken(privateKey, baseClaims({ exp: Math.floor(Date.now() / 1000) - 10 }));
    const r2 = await verifyAccessToken(expired, env);
    expect(r2.status).toBe('invalid');
    if (r2.status === 'invalid') expect(r2.reason).toBe('EXPIRED');
  });
});
