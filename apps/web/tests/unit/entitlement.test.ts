/**
 * Unit tests — Entitlement resolver (graf dependensi) + guard withModule.
 * Murni (tanpa DB): memverifikasi aturan aktivasi/deaktivasi & penegakan gerbang.
 */
import { describe, it, expect } from 'vitest';
import {
  missingDependencies,
  evaluateActivation,
  evaluateDeactivation,
  hasDependencyCycle,
  withModule,
  type ModuleEdge,
} from '../../src/lib/entitlement';
import type { ModuleCode } from '@sica/contracts';
import type { RequestContext } from '../../src/lib/api-response';

const edges: ModuleEdge[] = [
  { module: 'pmb', dependsOn: 'identity', required: true },
  { module: 'pmb', dependsOn: 'academic', required: true },
  { module: 'lms', dependsOn: 'teaching', required: true },
  { module: 'lms', dependsOn: 'enrollment', required: true },
  { module: 'thesis', dependsOn: 'enrollment', required: true },
  { module: 'thesis', dependsOn: 'assessment', required: true },
  // dependensi opsional (tidak memblokir)
  { module: 'parent_portal', dependsOn: 'finance', required: false },
];

const ctx = (tenantId: string | null): RequestContext => ({
  requestId: 'r-1',
  timestamp: '2026-10-18T00:00:00.000Z',
  tenantId,
  userId: null,
});

describe('Entitlement resolver — aktivasi', () => {
  it('memberi tahu dependensi yang belum aktif', () => {
    const active = new Set<ModuleCode>(['identity', 'teaching']);
    expect(missingDependencies('pmb', active, edges)).toEqual(['academic']);
    expect(missingDependencies('lms', active, edges)).toEqual(['enrollment']);
  });

  it('mengizinkan aktivasi saat semua prasyarat terpenuhi', () => {
    const active = new Set<ModuleCode>(['identity', 'academic']);
    const d = evaluateActivation('pmb', active, edges);
    expect(d.canActivate).toBe(true);
    expect(d.missing).toHaveLength(0);
  });

  it('menolak aktivasi saat prasyarat kurang', () => {
    const active = new Set<ModuleCode>(['identity']);
    const d = evaluateActivation('pmb', active, edges);
    expect(d.canActivate).toBe(false);
    expect(d.missing).toContain('academic');
  });

  it('mengabaikan dependensi opsional (required=false)', () => {
    const active = new Set<ModuleCode>([]);
    const d = evaluateActivation('parent_portal', active, edges);
    expect(d.canActivate).toBe(true); // finance bersifat opsional
  });
});

describe('Entitlement resolver — deaktivasi & siklus', () => {
  it('menolak menonaktifkan modul yang jadi prasyarat addon aktif', () => {
    const active = new Set<ModuleCode>(['enrollment', 'lms', 'thesis']);
    const d = evaluateDeactivation('enrollment', active, edges);
    expect(d.canDeactivate).toBe(false);
    expect(d.blockedBy).toEqual(expect.arrayContaining(['lms', 'thesis']));
  });

  it('memungkinkan menonaktifkan modul tanpa dependan aktif', () => {
    const active = new Set<ModuleCode>(['enrollment']);
    const d = evaluateDeactivation('academic', active, edges);
    expect(d.canDeactivate).toBe(true);
  });

  it('menolak menonaktifkan modul yang dipakai addon aktif lain', () => {
    const active = new Set<ModuleCode>(['pmb']);
    const d = evaluateDeactivation('academic', active, edges);
    expect(d.canDeactivate).toBe(false);
    expect(d.blockedBy).toContain('pmb');
  });

  it('mendeteksi siklus dependensi', () => {
    expect(hasDependencyCycle(edges)).toBe(false);
    const cyclic: ModuleEdge[] = [
      { module: 'a' as ModuleCode, dependsOn: 'b' as ModuleCode, required: true },
      { module: 'b' as ModuleCode, dependsOn: 'a' as ModuleCode, required: true },
    ];
    expect(hasDependencyCycle(cyclic)).toBe(true);
  });
});

describe('withModule guard', () => {
  it('menjalankan handler saat modul entitled', async () => {
    const check = async (t: string | null, c: ModuleCode) => t === 'tenant-1' && c === 'lms';
    const handler = async (c: RequestContext) => `ok:${c.tenantId}`;
    const guard = withModule({ moduleCode: 'lms', check, handler, onDenied: () => 'denied' });
    expect(await guard(ctx('tenant-1'))).toBe('ok:tenant-1');
  });

  it('menolak (onDenied) saat modul tidak aktif / tanpa tenant', async () => {
    const check = async (t: string | null, c: ModuleCode) => t === 'tenant-1' && c === 'lms';
    const handler = async () => 'ran';
    const guard = withModule({ moduleCode: 'lms', check, handler, onDenied: (_c, code) => `denied:${code}` });
    expect(await guard(ctx('tenant-2'))).toBe('denied:lms');
    expect(await guard(ctx(null))).toBe('denied:lms');
  });

  it('meneruskan argumen tambahan ke handler', async () => {
    const check = async () => true;
    const handler = async (_c: RequestContext, a: number, b: number) => a + b;
    const guard = withModule<[number, number], number>({
      moduleCode: 'enrollment', check, handler, onDenied: () => -1,
    });
    expect(await guard(ctx('tenant-1'), 2, 5)).toBe(7);
  });
});
