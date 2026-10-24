import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/edge-auth', () => ({
  verifyAccessToken: vi.fn(),
}));

import { middleware, sanitizeIdentityHeaders } from '../../src/middleware';
import { verifyAccessToken } from '../../src/lib/edge-auth';

const verifiedClaims = {
  sub: 'verified-user',
  tid: 'verified-tenant',
  sid: 'session-1',
  role: 'STUDENT',
  iss: 'sica',
  aud: 'sica-web',
  iat: 1_797_000_000,
  exp: 1_797_000_900,
  jti: 'token-1',
};

beforeEach(() => {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    status: 'valid',
    claims: verifiedClaims,
  });
});

describe('sanitizeIdentityHeaders', () => {
  it('removes client-supplied tenant and user identity headers', () => {
    const headers = new Headers({
      'x-tenant-id': 'attacker-tenant',
      'x-user-id': 'attacker-user',
      'x-tenant-slug': 'demo',
    });

    const sanitized = sanitizeIdentityHeaders(headers);

    expect(sanitized.has('x-tenant-id')).toBe(false);
    expect(sanitized.has('x-user-id')).toBe(false);
    expect(sanitized.get('x-tenant-slug')).toBe('demo');
    expect(headers.get('x-tenant-id')).toBe('attacker-tenant');
    expect(headers.get('x-user-id')).toBe('attacker-user');
  });
});

describe('middleware request identity', () => {
  it('forwards verified token identity instead of client-supplied values', async () => {
    const request = new NextRequest('https://demo.sica.test/dashboard', {
      headers: {
        cookie: 'sica_access_token=signed-token',
        'x-tenant-id': 'attacker-tenant',
        'x-user-id': 'attacker-user',
      },
    });

    const response = await middleware(request);

    expect(response.headers.get('x-middleware-request-x-tenant-id')).toBe('verified-tenant');
    expect(response.headers.get('x-middleware-request-x-user-id')).toBe('verified-user');
  });

  it('sanitizes identity headers on skipped auth routes too', async () => {
    const request = new NextRequest('https://demo.sica.test/api/v1/auth/login', {
      headers: {
        'x-tenant-id': 'attacker-tenant',
        'x-user-id': 'attacker-user',
      },
    });

    const response = await middleware(request);
    const overridden = response.headers.get('x-middleware-override-headers') ?? '';

    expect(overridden).not.toContain('x-tenant-id');
    expect(overridden).not.toContain('x-user-id');
  });
});
