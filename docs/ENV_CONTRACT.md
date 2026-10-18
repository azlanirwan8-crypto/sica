# SICA Environment Variables Strict Contract
**Status:** Mandatory Engineering Standard  
**Role:** DevOps Lead & Platform Architect  
**Validation Engine:** Zod Schema Parser  
**Enforcement:** Zero `process.env` Unvalidated Access Policy  

---

## 1. Kebijakan Mutlak "Zero Unvalidated process.env Access"

Seluruh komponen kode pada SICA (Next.js App Router, Server Actions, Background Workers, API Handlers) **DILARANG KERAS** membaca `process.env` secara langsung (contoh terlarang: `const dbUrl = process.env.DATABASE_URL;`).

### 1.1 Risiko Pelanggaran Tanpa Parser
1. **Silent Undefined Bugs:** Aplikasi berjalan normal saat boot, namun crash saat runtime ketika fungsi tertentu dipanggil karena variabel tidak didefinisikan.
2. **Security Leakage:** Variabel rahasia (*secret keys*) secara tidak sengaja ter-bundle ke browser client karena penamaan prefix yang salah.
3. **Type Insecurity:** Semua `process.env` bertipe `string | undefined`, menimbulkan potensi bug konversi angka (port, TTL) atau boolean.

### 1.2 Aturan Impor Baku
Seluruh pembacaan variabel lingkungan wajib mengimpor modul singleton ter-validasi:
```typescript
// BENAR (Type-Safe & Validated):
import { env } from '@/config/env';
console.log(env.DATABASE_URL); // Tipe pasti string valid URL

// SALAH (DITOLAK LINTER):
console.log(process.env.DATABASE_URL); // Eslint error: @typescript-eslint/no-process-env
```

---

## 2. Skema Validasi Zod Web & Server (`packages/config/src/env.ts`)

File parser ini akan dieksekusi saat aplikasi pertama kali melakukan bootstrap. Jika ada 1 variabel wajib yang hilang atau formatnya tidak sesuai, aplikasi akan langsung **gagal boot (fail-fast)** dengan ringkasan error deskriptif.

```typescript
import { z } from 'zod';

const ServerEnvSchema = z.object({
  // ==========================================
  // 1. Application & Core Runtime
  // ==========================================
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // ==========================================
  // 2. Database & In-Memory Redis
  // ==========================================
  DATABASE_URL: z.string().url().startsWith('postgresql://', {
    message: 'DATABASE_URL harus berupa URL koneksi PostgreSQL yang valid.'
  }),
  DIRECT_DATABASE_URL: z.string().url().startsWith('postgresql://').describe('Koneksi langsung tanpa PgBouncer untuk migrasi DDL'),
  REDIS_URL: z.string().url().regex(/^rediss?:\/\//, {
    message: 'REDIS_URL harus menggunakan protokol redis:// atau rediss://'
  }),

  // ==========================================
  // 3. Cryptography & JWT RS256 Authentication
  // ==========================================
  JWT_PUBLIC_KEY: z.string().min(64).describe('Public Key PEM untuk verifikasi token (Node runtime)'),
  JWT_PUBLIC_KEY_JWK: z.string().min(20).describe('Public Key JWK (JSON) untuk verifikasi di Edge middleware (WebCrypto)'),
  JWT_PRIVATE_KEY: z.string().min(64).describe('Private Key PEM untuk signing token'),
  JWT_ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().min(60).max(86400).default(900), // 15 menit
  JWT_REFRESH_TOKEN_TTL_SEC: z.coerce.number().int().min(86400).default(604800), // 7 hari
  PASSWORD_HASH_PEPPER: z.string().min(32).describe('Salt rahasia pelindung Argon2id'),

  // ==========================================
  // 4. OAuth & Identity Federation (Kampus SSO)
  // ==========================================
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  // ==========================================
  // 5. Payment Gateway Credentials
  // ==========================================
  MIDTRANS_SERVER_KEY: z.string().min(10),
  MIDTRANS_CLIENT_KEY: z.string().min(10),
  MIDTRANS_IS_PRODUCTION: z.coerce.boolean().default(false),
  XENDIT_SECRET_KEY: z.string().min(10).optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16),

  // ==========================================
  // 6. Messaging Gateway
  // ==========================================
  FONNTE_WHATSAPP_TOKEN: z.string().min(10),
  RESEND_API_KEY: z.string().startsWith('re_', { message: 'RESEND_API_KEY harus berawalan re_' }),
  EMAIL_SENDER_ADDRESS: z.string().email().default('no-reply@sica.ac.id'),

  // ==========================================
  // 7. Object Storage (S3 / Cloudflare R2)
  // ==========================================
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_BUCKET_NAME: z.string().min(3),
  STORAGE_ACCESS_KEY_ID: z.string().min(10),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(20),
  STORAGE_PUBLIC_CDN_URL: z.string().url()
});

const ClientEnvSchema = z.object({
  // ==========================================
  // Public Variables (NEXT_PUBLIC_*)
  // ==========================================
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']),
  NEXT_PUBLIC_APP_NAME: z.string().default('SICA Academic Cloud'),
  NEXT_PUBLIC_BASE_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional()
});

// Gabungkan dan parse lingkungan
const processEnvMerged = {
  ...process.env,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN
};

const _serverParsed = ServerEnvSchema.safeParse(process.env);
const _clientParsed = ClientEnvSchema.safeParse(processEnvMerged);

if (!_serverParsed.success || !_clientParsed.success) {
  const serverErrors = !_serverParsed.success ? _serverParsed.error.flatten().fieldErrors : {};
  const clientErrors = !_clientParsed.success ? _clientParsed.error.flatten().fieldErrors : {};

  console.error('\n❌ [CRITICAL] INVALID ENVIRONMENT VARIABLES CONFIGURATION:');
  console.error(JSON.stringify({ server: serverErrors, client: clientErrors }, null, 2));
  console.error('Silakan periksa file .env Anda dan sesuaikan dengan .env.example!\n');

  throw new Error('Aplikasi dihentikan karena kegagalan validasi environment variables.');
}

export const env = {
  ..._serverParsed.data,
  ..._clientParsed.data
};
```

---

## 3. Skema Kontrak Lingkungan Flutter Mobile

Aplikasi mobile Flutter membaca variabel lingkungan dari compiler compile-time define (`--dart-define`) atau package `flutter_dotenv`. Seluruh variabel dikonversi ke kelas statis immutable yang tervalidasi saat inisialisasi aplikasi (`main.dart`).

```dart
// lib/core/config/app_env.dart
class AppEnv {
  static const String appFlavor = String.fromEnvironment('APP_FLAVOR', defaultValue: 'development');
  static const String apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const String appPackageName = String.fromEnvironment('APP_PACKAGE_NAME', defaultValue: 'id.ac.sica.mobile');
  static const bool enableRootDetection = bool.fromEnvironment('ENABLE_ROOT_DETECTION', defaultValue: true);
  static const bool enableSslPinning = bool.fromEnvironment('ENABLE_SSL_PINNING', defaultValue: true);
  static const String sentryDsn = String.fromEnvironment('SENTRY_DSN');

  /// Validasi mandatory environment variables sebelum runApp()
  static void validate() {
    final missing = <String>[];
    if (apiBaseUrl.isEmpty || !apiBaseUrl.startsWith('https://')) {
      missing.add('API_BASE_URL (Wajib berawalan https://)');
    }

    if (missing.isNotEmpty) {
      throw StateError(
        'CRITICAL CONFIG ERROR: Variabel compile-time berikut tidak valid: ${missing.join(', ')}.\n'
        'Jalankan aplikasi dengan menyertakan argumen: --dart-define=API_BASE_URL=https://...',
      );
    }
  }
}
```

---

## 4. Matriks Ringkasan Variabel Wajib SICA

| Kategori | Nama Variabel | Wajib | Keterangan & Karakteristik |
| :--- | :--- | :---: | :--- |
| **Runtime** | `NODE_ENV` | Ya | `development` / `production` |
| **Database** | `DATABASE_URL` | Ya | PostgreSQL pool connection string via PgBouncer. **Supabase:** host `aws-0-<region>.pooler.supabase.com:6543` + `?pgbouncer=true&pool_mode=transaction`; user `postgres.<ref>` |
| **Database** | `DIRECT_DATABASE_URL` | Ya | Koneksi **session** (bukan transaction-mode) untuk DDL/migrasi. **Supabase:** pakai **session pooler** `aws-0-<region>.pooler.supabase.com:5432` (bukan `db.<ref>.supabase.co` yang **IPv6-only** & tak ter-resolve di IPv4 dev/Vercel) |

> **Catatan Supabase (wajib):** koneksi runtime & migrasi memakai **pooler IPv4** dengan user `postgres.<project-ref>`. Host direct `db.<ref>.supabase.co` hanya IPv6 → `ENOTFOUND` di Vercel/dev. Region proyek SICA dev: **`ap-northeast-1`**.
| **Cache** | `REDIS_URL` | Ya | Connection string Redis 7 untuk BullMQ & Lock |
| **Auth** | `JWT_PRIVATE_KEY` | Ya | RS256 Private Key format PEM (hanya ada di server) |
| **Auth** | `JWT_PUBLIC_KEY` | Ya | RS256 Public Key format PEM (verifikasi token, Node runtime) |
| **Auth** | `JWT_PUBLIC_KEY_JWK` | Ya | RS256 Public Key format JWK (JSON) — verifikasi di **Edge middleware** (WebCrypto). Satu kunci dengan `JWT_PUBLIC_KEY`, hanya berbeda encoding |
| **Auth** | `JWT_ISSUER` | Ya | Claim `iss` access/refresh token (default `sica`) |
| **Auth** | `JWT_AUDIENCE` | Ya | Claim `aud` audience token (default `sica-web`) |
| **Payment** | `MIDTRANS_SERVER_KEY`| Ya | Secret key server Midtrans untuk pembuatan invoice |
| **Payment** | `PAYMENT_WEBHOOK_SECRET`| Ya | Shared secret verifikasi signature callback payment |
| **Messaging** | `FONNTE_WHATSAPP_TOKEN`| Ya | API token WhatsApp Gateway untuk OTP & notifikasi |
| **Messaging** | `RESEND_API_KEY` | Ya | API key pengiriman email transaksi mahasiswa |
| **Storage** | `STORAGE_ENDPOINT` | Ya | URL S3 / Cloudflare R2 |
| **Storage** | `STORAGE_ACCESS_KEY_ID`| Ya | Kredensial access ID bucket penyimpanan berkas |
| **Storage** | `STORAGE_SECRET_ACCESS_KEY`| Ya | Secret key bucket penyimpanan berkas |
| **Client** | `NEXT_PUBLIC_API_URL` | Ya | Endpoint API yang diekspos ke browser / mobile |
| **Client** | `NEXT_PUBLIC_BASE_URL`| Ya | FQDN domain utama sistem |
