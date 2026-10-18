import { describe, it, expect } from 'vitest';
import {
  aggregateHealth,
  runProbes,
  readinessHttpStatus,
  type CheckResult,
  type DependencyProbe,
} from '../../src/modules/health/services/health.service';

const ok = (name: string, level: 'required' | 'degradable' = 'required'): CheckResult => ({
  name,
  level,
  ok: true,
});
const bad = (name: string, level: 'required' | 'degradable' = 'required'): CheckResult => ({
  name,
  level,
  ok: false,
});

describe('aggregateHealth', () => {
  it('ok bila semua check lolos', () => {
    const r = aggregateHealth([ok('db'), ok('redis', 'degradable')], 'v1', 10);
    expect(r.status).toBe('ok');
    expect(r.checks['db']?.ok).toBe(true);
  });

  it('down bila check required gagal (mis. DB)', () => {
    const r = aggregateHealth([bad('db'), ok('redis', 'degradable')], 'v1', 10);
    expect(r.status).toBe('down');
  });

  it('degraded bila hanya check degradable yang gagal', () => {
    const r = aggregateHealth([ok('db'), bad('redis', 'degradable')], 'v1', 10);
    expect(r.status).toBe('degraded');
  });
});

describe('runProbes', () => {
  it('menangkap probe yang reject sebagai ok:false', async () => {
    const probes: DependencyProbe[] = [
      { name: 'db', level: 'required', run: async () => ({ ok: true, latencyMs: 1 }) },
      { name: 'boom', level: 'degradable', run: async () => { throw new Error('conn refused'); } },
    ];
    const results = await runProbes(probes);
    const boom = results.find((r) => r.name === 'boom');
    expect(boom?.ok).toBe(false);
    expect(boom?.detail).toContain('conn refused');
  });

  it('time-out probe lambat dianggap gagal', async () => {
    const slow: DependencyProbe = {
      name: 'db',
      level: 'required',
      run: () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 50)),
    };
    const results = await runProbes([slow], 5);
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.detail).toContain('timeout');
  });
});

describe('readinessHttpStatus', () => {
  it('down→503, degraded/ok→200', () => {
    expect(readinessHttpStatus('down')).toBe(503);
    expect(readinessHttpStatus('degraded')).toBe(200);
    expect(readinessHttpStatus('ok')).toBe(200);
  });
});
