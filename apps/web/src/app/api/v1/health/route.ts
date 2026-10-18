/**
 * GET /api/v1/health — Liveness probe (murah, tanpa cek dependensi).
 * Dipakai LB/K8s liveness: hanya memastikan proses hidup → selalu 200.
 * Rujukan: docs/DEPLOYMENT_DEVOPS.md §4.2.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  return NextResponse.json(
    {
      status: 'ok',
      version: process.env['APP_VERSION'] ?? 'dev',
      uptimeSec: Math.floor(process.uptime()),
    },
    { status: 200 }
  );
}
