import { z } from 'zod';

const ServerEnvSchema = z.object({
  // 1. Application & Core Runtime
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // 2. Database & In-Memory Redis
  DATABASE_URL: z.string().url().startsWith('postgresql://', {
    message: 'DATABASE_URL harus berupa URL koneksi PostgreSQL yang valid.',
  }),
  DIRECT_DATABASE_URL: z
    .string()
    .url()
    .startsWith('postgresql://')
    .describe('Koneksi langsung tanpa PgBouncer untuk migrasi DDL'),
  REDIS_URL: z.string().url().regex(/^rediss?:\/\//, {
    message: 'REDIS_URL harus menggunakan protokol redis:// atau rediss://',
  }),

  // 3. Cryptography & JWT RS256 Authentication
  JWT_PUBLIC_KEY: z.string().min(64).describe('Public Key PEM untuk verifikasi token (Node runtime)'),
  JWT_PUBLIC_KEY_JWK: z
    .string()
    .min(20)
    .describe('Public Key berformat JWK (JSON) untuk verifikasi di Edge middleware (WebCrypto)'),
  JWT_PRIVATE_KEY: z.string().min(64).describe('Private Key PEM untuk signing token'),
  JWT_ISSUER: z.string().default('sica').describe('Claim iss token'),
  JWT_AUDIENCE: z.string().default('sica-web').describe('Claim aud token'),
  JWT_ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().min(60).max(86400).default(900),
  JWT_REFRESH_TOKEN_TTL_SEC: z.coerce.number().int().min(86400).default(604800),
  PASSWORD_HASH_PEPPER: z.string().min(32).describe('Salt rahasia pelindung Argon2id'),

  // 4. OAuth & Identity Federation (Kampus SSO)
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  // 5. Payment Gateway Credentials
  MIDTRANS_SERVER_KEY: z.string().min(10),
  MIDTRANS_CLIENT_KEY: z.string().min(10),
  MIDTRANS_IS_PRODUCTION: z.coerce.boolean().default(false),
  XENDIT_SECRET_KEY: z.string().min(10).optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16),

  // 6. Messaging Gateway
  FONNTE_WHATSAPP_TOKEN: z.string().min(10),
  RESEND_API_KEY: z.string().startsWith('re_', { message: 'RESEND_API_KEY harus berawalan re_' }),
  EMAIL_SENDER_ADDRESS: z.string().email().default('no-reply@sica.ac.id'),

  // 7. Object Storage (S3 / Cloudflare R2)
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_BUCKET_NAME: z.string().min(3),
  STORAGE_ACCESS_KEY_ID: z.string().min(10),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(20),
  STORAGE_PUBLIC_CDN_URL: z.string().url(),
});

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_APP_NAME: z.string().default('SICA Academic Cloud'),
  NEXT_PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000/api/v1'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;
export type ClientEnv = z.infer<typeof ClientEnvSchema>;

function validateEnv(): ServerEnv & ClientEnv {
  // Hanya validasi client env jika di browser
  const isServer = typeof window === 'undefined';

  const clientParsed = ClientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_ENV: process.env['NEXT_PUBLIC_APP_ENV'],
    NEXT_PUBLIC_APP_NAME: process.env['NEXT_PUBLIC_APP_NAME'],
    NEXT_PUBLIC_BASE_URL: process.env['NEXT_PUBLIC_BASE_URL'],
    NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
    NEXT_PUBLIC_SENTRY_DSN: process.env['NEXT_PUBLIC_SENTRY_DSN'],
  });

  if (!clientParsed.success) {
    console.error('❌ [CRITICAL] Client environment validation failed:');
    console.error(JSON.stringify(clientParsed.error.flatten().fieldErrors, null, 2));
    throw new Error('Validasi variabel lingkungan client gagal.');
  }

  if (isServer) {
    const serverParsed = ServerEnvSchema.safeParse(process.env);
    if (!serverParsed.success) {
      console.error('❌ [CRITICAL] Server environment validation failed:');
      console.error(JSON.stringify(serverParsed.error.flatten().fieldErrors, null, 2));
      // In development or build mode, prevent immediate process termination if partial env
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Validasi variabel lingkungan server gagal.');
      }
      // Dalam development/test, jangan hentikan proses bila env server belum lengkap.
      // Kembalikan hanya client env yang valid; akses server env berikutnya akan undefined.
      return clientParsed.data as unknown as ServerEnv & ClientEnv;
    }

    return {
      ...serverParsed.data,
      ...clientParsed.data,
    };
  }

  return clientParsed.data as unknown as ServerEnv & ClientEnv;
}

export const env = validateEnv();
