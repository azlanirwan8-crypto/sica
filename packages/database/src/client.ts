import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

// Re-export `sql` agar konsumen (apps/web) tak perlu bergantung langsung ke `drizzle-orm`.
export { sql };

const connectionString =
  process.env['DATABASE_URL'] ??
  'postgresql://sica_user:sica_password@localhost:6432/sica_db?sslmode=disable';

// Pool koneksi utama via PgBouncer untuk operasional runtime aplikasi
export const sqlClient = postgres(connectionString, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: false, // PgBouncer transaction pooling mode kompatibilitas
});

export const db = drizzle(sqlClient, { schema });

export type DatabaseClient = typeof db;

/** Tipe transaksi RLS yang diteruskan callback `withTenantContext` (untuk lapisan akses data consumer). */
export type TenantTx = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];

/**
 * Eksekutor Transaksi dengan Isolasi Tenant RLS
 * Memastikan perintah SET LOCAL app.current_tenant dijalankan di awal transaksi
 * untuk mengaktifkan Row-Level Security PostgreSQL per-tenant.
 */
export async function withTenantContext<T>(
  tenantId: string,
  callback: (tx: Parameters<Parameters<DatabaseClient['transaction']>[0]>[0]) => Promise<T>
): Promise<T> {
  // Validasi format UUID sederhana untuk mencegah SQL injection pada session GUC
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId)) {
    throw new Error(`Invalid tenantId format: ${tenantId}. Tenant ID wajib berformat UUID.`);
  }

  return db.transaction(async (tx) => {
    // Set GUC tenant lokal transaksi. `SET LOCAL ... = $1` TIDAK valid (SET tak menerima
    // bind parameter); pakai set_config(...) yang bisa diparameterkan & aman utk PgBouncer.
    await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true);`);
    return callback(tx);
  });
}
