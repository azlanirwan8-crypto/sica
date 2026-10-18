# SICA Database Migration SOP & DDL Safety Standard
**Status:** Mandatory Engineering Standard  
**Role:** Lead Database Administrator & Infrastructure Lead  
**Target Engine:** PostgreSQL 16 dengan Row-Level Security (RLS)  
**ORM Tool:** Drizzle ORM (`drizzle-kit`)  

---

## 1. Aturan Mutlak & Larangan Keras (Strict Prohibitions)

Seluruh developer, DevOps, dan AI Coding Agent **DILARANG KERAS** menjalankan tindakan-tindakan berikut di seluruh environment (Development, Staging, dan Production):

1. **Dilarang menggunakan perintah destruktif:**
   - `drizzle-kit push --force` (Dilarang tanpa review migrasi SQL).
   - `prisma migrate reset --force` / `db:drop` (Dilarang keras karena menghapus seluruh data dan kebijakan keamanan RLS).
   - `DROP DATABASE` atau `DROP SCHEMA public CASCADE`.
2. **Dilarang melakukan modifikasi skema ad-hoc tanpa file `.sql`:**
   - Mengubah tipe kolom atau menambah tabel langsung via GUI (DBeaver, pgAdmin) tanpa file versi migrasi tercatat di git.
3. **Dilarang membuat tabel baru tanpa Row-Level Security (RLS):**
   - Setiap tabel baru yang menyimpan data bisnis institusi wajib mengaktifkan RLS dan memasang kebijakan isolasi tenant.

---

## 2. Alur Kerja Standar Penambahan / Perubahan Skema (SOP)

Setiap perubahan struktur tabel harus mengikuti siklus 4 tahap yang aman (*deterministic and backward-compatible*):

```
[1. Modifikasi TypeScript Schema] ──> [2. Generate File SQL Terpisah] ──> [3. Review RLS & Lock Timeout] ──> [4. Eksekusi Migrasi]
  (packages/database/src/schema)        (packages/database/migrations/*.sql)    (Set lock_timeout = 3000ms)     (pnpm db:migrate)
```

### 2.1 Tahap 1: Modifikasi Skema TypeScript
Lakukan perubahan pada file skema yang relevan di `packages/database/src/schema/*`.
- Gunakan tipe data eksplisit (contoh: `bigint` untuk mata uang rupiah, `timestamp with time zone` untuk waktu).
- Selalu sertakan kolom `tenant_id` pada setiap tabel relasional.

### 2.2 Tahap 2: Generate File Migrasi `.sql` Terpisah
AI Agent dan developer **wajib mengekstrak perubahan menjadi file `.sql` independen** menggunakan CLI:

```bash
cd packages/database
pnpm drizzle-kit generate
```

Perintah di atas akan menghasilkan file baru di direktori `packages/database/migrations/YYYYMMDDHHMMSS_nama_perubahan.sql`.

### 2.3 Tahap 3: Review Checklist File SQL
Buka file `.sql` yang baru dibuat dan pastikan memenuhi standar keamanan database:

```sql
-- ====================================================================
-- TEMPLATE STANDAR FILE MIGRASI SICA
-- ====================================================================

-- 1. Pasang proteksi Lock Timeout (Mencegah blocking transaksi runtime)
SET lock_timeout = '3000ms';
SET statement_timeout = '15000ms';

-- 2. DDL Pembuatan / Perubahan Tabel
ALTER TABLE "students" ADD COLUMN "guardian_phone" varchar(32);

-- 3. JIKA MENAMBAH TABEL BARU, WAJIB PASANG RLS & POLICIES:
-- ALTER TABLE "new_table" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "new_table" FORCE ROW LEVEL SECURITY;
-- CREATE POLICY "tenant_isolation_policy" ON "new_table"
--   AS RESTRICTIVE
--   USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 4. JIKA MENAMBAH INDEKS BARU, WAJIB MENGGUNAKAN CONCURRENTLY:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_students_guardian_phone" 
--   ON "students" ("guardian_phone");
```

### 2.4 Tahap 4: Eksekusi Migrasi Terkendali
Jalankan migrasi menggunakan migration runner terprogram:

```bash
pnpm db:migrate
```

*Catatan: Migration runner berjalan menggunakan variabel `DIRECT_DATABASE_URL` (port 5432) guna menghindari batasan session mode pada PgBouncer.*

### 2.5 Database Terkelola (Supabase / Neon) — Peran & Privilege
Platform managed tidak memberi role superuser; `postgres` umumnya tidak bisa `CREATE ROLE`/`ALTER DEFAULT PRIVILEGES` → SQLSTATE `42501 insufficient_privilege` (BUKAN `duplicate_object`). Agar migrasi tetap jalan di kedua dunia:

1. **DDL role/grand dibuat toleran** — `0001`/`0004` membungkus `CREATE ROLE`/`GRANT`/`REVOKE` dalam `DO $$ ... EXCEPTION WHEN others THEN RAISE NOTICE ... END $$;`. Kegagalan dilewati, bukan membatalkan transaksi.
2. **Policy RLS memakai `TO public`** (bukan `TO sica_app`) — konsisten dgn generator 0001; `FORCE ROW LEVEL SECURITY` tetap mengikat **pemilik tabel**, sehingga isolasi tenant tidak bergantung pada keberadaan role terpisah.
3. **Mode dev:** `DATABASE_URL` menunjuk role `postgres` (pemilik objek). Keamanan setara karena RLS di-`FORCE` + tiap transaksi `SET LOCAL app.current_tenant`.
4. **Mode self-hosted/produksi:** jalankan sebagai superuser → `sica_app` (`NOBYPASSRLS`) & `sica_owner` (`BYPASSRLS`) benar-benar dibuat; aplikasi runtime memakai `sica_app`.
5. **Alternatif keras:** buat role `sica_app` via Dashboard Supabase (Database → Roles) lalu biarkan blok GRANT berjalan (tidak kena `others`). Jangan menaruh rahasia di repo; `.env` di-gitignore.

---

## 3. Strategi Perubahan Kolom Non-Destruktif (Expand & Contract)

Jika Anda perlu mengubah tipe kolom yang sudah memiliki jutaan data produksi (misalnya mengubah `varchar` ke `enum` atau memisahkan nama kolom):

### Fase 1: Expand (Rilis V1.1)
1. Tambahkan kolom baru (bersifat nullable) berdampingan dengan kolom lama.
2. Buat database trigger untuk menduplikasi penulisan data baru ke kedua kolom (*dual-writing*).
3. Buat script migrasi background untuk mem-backfill data historis dari kolom lama ke kolom baru.

### Fase 2: Switch (Rilis V1.2)
1. Update kode aplikasi Next.js / Flutter agar membaca dari kolom baru.
2. Pastikan 100% kueri sudah beralih ke kolom baru.

### Fase 3: Contract (Rilis V1.3)
1. Hapus trigger dual-writing.
2. Tambahkan constraint `NOT NULL` pada kolom baru jika diperlukan.
3. Hapus kolom lama (`DROP COLUMN old_column_name;`).

---

## 4. Prosedur Darurat & Rollback Migrasi

1. Seluruh migrasi database harus menyertakan file pendamping rollback jika terjadi kegagalan (`YYYYMMDDHHMMSS_nama_perubahan.rollback.sql`).
2. Jangan pernah melakukan rollback manual di tengah jam sibuk KRS tanpa koordinasi dengan Tim SRE / Database Administrator.
3. Selalu periksa snapshot point-in-time recovery (PITR) PostgreSQL sebelum mengeksekusi migrasi skala besar (perubahan > 100.000 baris data).
