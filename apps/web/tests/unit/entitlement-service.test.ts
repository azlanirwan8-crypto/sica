/**
 * Unit test — orkestrasi entitlement (activate/deactivate) dengan resolver graf dependensi.
 * Memakai InMemoryEntitlementRepository agar dapat diuji tanpa DB.
 */
import { describe, it, expect } from 'vitest';
import type { ModuleCode } from '@sica/contracts';
import { InMemoryEntitlementRepository } from '../../src/modules/entitlement/entitlement.repository';
import {
  activateModule,
  deactivateModule,
} from '../../src/modules/entitlement/entitlement.service';
import type { ModuleEdge } from '../../src/lib/entitlement';

const TENANT = 'tenant-uuid-1';
const edges: ModuleEdge[] = [
  { module: 'lms', dependsOn: 'teaching', required: true },
  { module: 'thesis', dependsOn: 'teaching', required: true },
  { module: 'pmb', dependsOn: 'identity', required: true },
];

const act = (trial = false) => ({ trial, ...(trial ? {} : {}) });
const repo = () => new InMemoryEntitlementRepository(edges);

describe('activateModule', () => {
  it('sukses bila dependensi required sudah aktif', async () => {
    const r = repo();
    r.seed(TENANT, ['teaching']);
    const res = await activateModule(TENANT, 'admin-1', 'lms', act(), r);
    expect(res).toEqual({ ok: true, activated: 'lms' });
    const active = await r.getActiveModuleCodes(TENANT);
    expect(active.has('lms')).toBe(true);
  });

  it('DEPENDENCY_UNMET saat prasyarat belum aktif (422)', async () => {
    const r = repo();
    r.seed(TENANT, []);
    const res = await activateModule(TENANT, 'admin-1', 'lms', act(), r);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('DEPENDENCY_UNMET');
      expect(res.missing).toEqual(['teaching']);
    }
  });

  it('mengizinkan aktivasi bertahap: prasyarat dulu, baru dependent', async () => {
    const r = repo();
    const first = await activateModule(TENANT, null, 'teaching' as ModuleCode, act(), r);
    expect(first.ok).toBe(true);
    const second = await activateModule(TENANT, null, 'thesis' as ModuleCode, act(), r);
    expect(second.ok).toBe(true);
  });
});

describe('deactivateModule', () => {
  it('IN_USE (409) bila modul masih dibutuhkan addon aktif lain', async () => {
    const r = repo();
    r.seed(TENANT, ['teaching', 'lms']);
    const res = await deactivateModule(TENANT, 'teaching', { force: false }, r);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('IN_USE');
      expect(res.blockedBy).toContain('lms');
    }
  });

  it('force=true → cascade mematikan dependents transitif', async () => {
    const r = repo();
    r.seed(TENANT, ['teaching', 'lms', 'thesis']);
    const res = await deactivateModule(TENANT, 'teaching', { force: true }, r);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.deactivated).toBe('teaching');
      expect(res.cascaded.sort()).toEqual(['lms', 'thesis']);
    }
    const active = await r.getActiveModuleCodes(TENANT);
    expect(active.has('teaching')).toBe(false);
    expect(active.has('lms')).toBe(false);
  });

  it('sukses tanpa cascade bila tidak ada dependents aktif', async () => {
    const r = repo();
    r.seed(TENANT, ['identity', 'pmb']);
    const res = await deactivateModule(TENANT, 'pmb', { force: false }, r);
    expect(res).toEqual({ ok: true, deactivated: 'pmb', cascaded: [] });
  });
});
