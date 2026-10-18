/**
 * Security & Validation Guard Tests — SICA Web API
 *
 * Menguji kepatuhan Standard Response Envelope dan guardrails keamanan:
 * 401 Unauthorized, 403 Forbidden, dan 422 Unprocessable Entity (Zod).
 */
import { describe, it, expect } from 'vitest';
import {
  successResponse,
  unauthorized,
  forbidden,
  validationFailed,
  type RequestContext,
} from '../../src/lib/api-response';

describe('API Security Guards & Standard Response Envelope', () => {
  const dummyContext: RequestContext = {
    requestId: 'trace-test-uuid',
    timestamp: '2026-10-18T10:00:00.000Z',
    tenantId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
  };

  it('harus menghasilkan Standard Response Envelope sukses dengan status 200/201', async () => {
    const payload = { id: 'rec-1', name: 'Algoritma' };
    const response = successResponse(payload, dummyContext, 200);

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      success: boolean;
      data: typeof payload;
      meta: { requestId: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('Algoritma');
    expect(json.meta.requestId).toBe('trace-test-uuid');
  });

  it('harus menghasilkan HTTP 401 Unauthorized dengan kode UNAUTHORIZED jika kredensial tidak ada', async () => {
    const unauthContext: RequestContext = {
      requestId: 'trace-401',
      timestamp: '2026-10-18T10:00:00.000Z',
      tenantId: null,
      userId: null,
    };
    const response = unauthorized(unauthContext);

    expect(response.status).toBe(401);
    const json = (await response.json()) as { success: boolean; error: { code: string; message: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('harus menghasilkan HTTP 403 Forbidden dengan kode FORBIDDEN jika otorisasi role gagal', async () => {
    const response = forbidden(dummyContext, 'Hanya Dosen Wali (DPA) yang diizinkan melakukan approval KRS.');

    expect(response.status).toBe(403);
    const json = (await response.json()) as { success: boolean; error: { code: string; message: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN');
    expect(json.error.message).toContain('Dosen Wali');
  });

  it('harus menghasilkan HTTP 422 Unprocessable Entity saat validasi Zod gagal', async () => {
    const validationIssues = [
      { field: 'periodId', message: 'Format UUID tidak valid.' },
      { field: 'classIds', message: 'Minimal satu kelas harus dipilih.' },
    ];
    const response = validationFailed(dummyContext, validationIssues);

    expect(response.status).toBe(422);
    const json = (await response.json()) as {
      success: boolean;
      error: { code: string; details: typeof validationIssues };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_FAILED');
    expect(json.error.details.length).toBe(2);
    expect(json.error.details[0]?.field).toBe('periodId');
  });
});
