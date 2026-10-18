/**
 * GET /api/v1/health/ready — Readiness probe (cek dependensi, fail-soft).
 * DB (required) di-ping nyata; Redis/Storage (degradable) cek konfigurasi.
 * down → 503 (keluar rotasi LB), degraded/ok → 200. Rujukan DEPLOYMENT_DEVOPS §4.2.
 */
import { NextResponse } from 'next/server';
import { db, sql } from '@sica/database';
import {
  runProbes,
  aggregateHealth,
  readinessHttpStatus,
  type DependencyProbe,
} from '@/modules/health/services/health.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const probes: DependencyProbe[] = [
  {
    name: 'db',
    level: 'required',
    run: async () => {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      return { ok: true, latencyMs: Date.now() - start };
    },
  },
  {
    name: 'redis',
    level: 'degradable',
    run: async () => {
      const url = process.env['REDIS_URL'];
      return url
        ? { ok: true, detail: 'configured' }
        : { ok: false, detail: 'REDIS_URL belum dikonfigurasi' };
    },
  },
  {
    name: 'storage',
    level: 'degradable',
    run: async () => {
      const bucket = process.env['STORAGE_BUCKET_NAME'];
      return bucket
        ? { ok: true, detail: 'configured' }
        : { ok: false, detail: 'STORAGE_BUCKET_NAME belum dikonfigurasi' };
    },
  },
];

export async function GET(): Promise<NextResponse> {
  const results = await runProbes(probes);
  const report = aggregateHealth(
    results,
    process.env['APP_VERSION'] ?? 'dev',
    Math.floor(process.uptime())
  );
  return NextResponse.json(report, { status: readinessHttpStatus(report.status) });
}
