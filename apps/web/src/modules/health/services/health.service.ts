/**
 * Health Service — agregasi status kesiapan (readiness) & liveness.
 * Logika murni (tanpa DB/network) agar mudah diuji; probe nyata di-inject dari route handler.
 * Rujukan: docs/DEPLOYMENT_DEVOPS.md §4.2.
 */

export type CheckLevel = 'required' | 'degradable';

export interface DependencyProbe {
  readonly name: string;
  readonly level: CheckLevel;
  run: () => Promise<{ ok: boolean; latencyMs?: number; detail?: string }>;
}

export interface CheckResult {
  readonly name: string;
  readonly level: CheckLevel;
  readonly ok: boolean;
  readonly latencyMs?: number;
  readonly detail?: string;
}

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthReport {
  readonly status: HealthStatus;
  readonly version: string;
  readonly uptimeSec: number;
  readonly checks: Readonly<Record<string, CheckResult>>;
}

/** Jalankan semua probe dengan timeout per-probe; kegagalan/time-out dianggap down utk check itu. */
export async function runProbes(
  probes: readonly DependencyProbe[],
  timeoutMs = 2000
): Promise<CheckResult[]> {
  const results = await Promise.all(
    probes.map(async (probe) => {
      try {
        const outcome = await withTimeout(probe.run(), timeoutMs);
        return {
          name: probe.name,
          level: probe.level,
          ok: outcome.ok,
          latencyMs: outcome.latencyMs,
          detail: outcome.detail,
        };
      } catch (error) {
        return {
          name: probe.name,
          level: probe.level,
          ok: false,
          detail: error instanceof Error ? error.message : 'probe failed',
        };
      }
    })
  );
  return results;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`probe timeout ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error('probe failed'));
      }
    );
  });
}

/**
 * Aturan agregasi:
 *  - ada check `required` gagal            → 'down'
 *  - tidak ada gagal, semua ok            → 'ok'
 *  - hanya check `degradable` yang gagal  → 'degraded'
 */
export function aggregateHealth(
  checks: readonly CheckResult[],
  version: string,
  uptimeSec: number
): HealthReport {
  const map: Record<string, CheckResult> = {};
  let anyRequiredDown = false;
  let anyDown = false;
  for (const c of checks) {
    map[c.name] = c;
    if (!c.ok) {
      anyDown = true;
      if (c.level === 'required') anyRequiredDown = true;
    }
  }
  const status: HealthStatus = anyRequiredDown ? 'down' : anyDown ? 'degraded' : 'ok';
  return { status, version, uptimeSec, checks: map };
}

/** HTTP status untuk readiness: down→503 (keluar rotasi LB), ok/degraded→200. */
export function readinessHttpStatus(status: HealthStatus): number {
  return status === 'down' ? 503 : 200;
}
