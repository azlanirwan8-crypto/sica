import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Migration Runner Script SICA
 * Menjalankan skrip SQL migrasi dengan:
 * 1. Koneksi langsung (DIRECT_DATABASE_URL) tanpa PgBouncer
 * 2. Transaksi atomic per file migrasi
 * 3. Lock timeout 5 detik untuk mencegah table deadlock
 */
async function runMigrations() {
  const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DIRECT_DATABASE_URL atau DATABASE_URL wajib diisi sebelum migrasi dijalankan.'
    );
  }

  console.info('🚀 Memulai eksekusi migrasi database SICA...');
  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 10,
    onnotice: () => {}, // Abaikan notice PostgreSQL umum
  });

  try {
    // 1. Buat tabel pelacak riwayat migrasi jika belum ada
    await sql`
      CREATE TABLE IF NOT EXISTS public._sica_migrations (
        id serial PRIMARY KEY,
        name text NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `;

    // 2. Baca daftar file migrasi di folder migrations
    const migrationsDir = join(__dirname, '../migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.info(`Ditemukan ${migrationFiles.length} file migrasi.`);

    for (const file of migrationFiles) {
      const alreadyApplied = await sql`
        SELECT id FROM public._sica_migrations WHERE name = ${file};
      `;

      if (alreadyApplied.length > 0) {
        console.info(`⏩ Dilewati (sudah diterapkan): ${file}`);
        continue;
      }

      console.info(`▶️ Menerapkan migrasi: ${file}...`);
      const filePath = join(migrationsDir, file);
      const sqlContent = readFileSync(filePath, 'utf-8');

      // Eksekusi migrasi dalam transaksi atomic dengan lock_timeout ketat
      await sql.begin(async (tx) => {
        // Cegah deadlock tabel
        await tx`SET LOCAL lock_timeout = '5s';`;
        await tx.unsafe(sqlContent);
        await tx`INSERT INTO public._sica_migrations (name) VALUES (${file});`;
      });

      console.info(`✅ Sukses menerapkan: ${file}`);
    }

    console.info('🎉 Seluruh migrasi database selesai diaplikasikan dengan sukses!');
  } finally {
    await sql.end();
  }
}

// Jalankan runner
runMigrations().catch((error: unknown) => {
  console.error('❌ Terjadi kesalahan fatal saat mengeksekusi migrasi:', error);
  process.exitCode = 1;
});
