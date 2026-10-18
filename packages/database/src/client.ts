import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ??
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
    // Jalankan session variable GUC lokal pada transaksi
    await tx.execute(sql`SET LOCAL app.current_tenant = ${tenantId};`);
    return callback(tx);
  });
}
