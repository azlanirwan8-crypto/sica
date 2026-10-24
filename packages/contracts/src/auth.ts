import { z } from 'zod';
import { UUIDSchema, createSuccessEnvelope } from './envelope';

// ==========================================
// 1. Roles & Sub-Entities
// ==========================================
export const AuthUserRoleSchema = z.enum([
  'super_admin',
  'tenant_admin',
  'dosen',
  'mahasiswa',
  'staff',
]);

export type AuthUserRole = z.infer<typeof AuthUserRoleSchema>;

export const AuthUserSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  username: z.string(),
  fullName: z.string(),
  role: AuthUserRoleSchema,
  avatarUrl: z.string().url().nullable().optional(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

// ==========================================
// 2. Login Schemas
// ==========================================
export const DeviceInfoSchema = z.object({
  os: z.enum(['ios', 'android', 'web']),
  model: z.string().optional(),
  appVersion: z.string(),
});

export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

export const LoginRequestSchema = z.object({
  tenantIdentifier: z
    .string()
    .min(3, { message: 'Subdomain minimal 3 karakter.' })
    .max(64, { message: 'Subdomain maksimal 64 karakter.' })
    .describe('Subdomain institusi (e.g. unpad)'),
  username: z
    .string()
    .min(3, { message: 'Username/NIM/Email minimal 3 karakter.' })
    .max(100, { message: 'Username/NIM/Email maksimal 100 karakter.' })
    .describe('NIM, NIDN, atau Email Pengguna'),
  password: z
    .string()
    .min(8, { message: 'Password minimal 8 karakter.' })
    .max(128, { message: 'Password maksimal 128 karakter.' }),
  deviceId: z
    .string()
    .max(128)
    .optional()
    .describe('Wajib dikirimkan oleh Flutter Mobile'),
  deviceInfo: DeviceInfoSchema.optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseDataSchema = z.object({
  requireMfa: z.boolean(),
  mfaToken: z.string().optional().describe('Diberikan jika requireMfa=true'),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int().optional().describe('Masa berlaku token dalam detik (900 = 15m)'),
  user: AuthUserSchema.optional(),
});

export type LoginResponseData = z.infer<typeof LoginResponseDataSchema>;

export const LoginResponseEnvelopeSchema = createSuccessEnvelope(LoginResponseDataSchema);
export type LoginResponseEnvelope = z.infer<typeof LoginResponseEnvelopeSchema>;

// ==========================================
// 3. MFA Verification Schemas
// ==========================================
export const MfaVerifyRequestSchema = z.object({
  mfaToken: z.string().min(32, { message: 'MFA Token tidak valid.' }),
  totpCode: z
    .string()
    .length(6, { message: 'Kode OTP harus tepat 6 digit angka.' })
    .regex(/^\d+$/, { message: 'Kode OTP hanya boleh berisi angka.' }),
  deviceId: z.string().max(128).optional(),
});

export type MfaVerifyRequest = z.infer<typeof MfaVerifyRequestSchema>;

export const MfaVerifyResponseDataSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().default(900),
  user: AuthUserSchema,
});

export type MfaVerifyResponseData = z.infer<typeof MfaVerifyResponseDataSchema>;

export const MfaVerifyResponseEnvelopeSchema = createSuccessEnvelope(MfaVerifyResponseDataSchema);
export type MfaVerifyResponseEnvelope = z.infer<typeof MfaVerifyResponseEnvelopeSchema>;

// ── MFA self-service (enroll + konfirmasi) — R-1 `BLUEPRINT_ROLE_BY_ROLE §1.7`: aksi tulis
// platform mewajibkan sesi `amr=['mfa']`, yang hanya bisa lahir setelah faktor terkonfirmasi.
export const MfaEnrollRequestSchema = z.object({
  label: z.string().max(80).optional(),
});
export type MfaEnrollRequest = z.infer<typeof MfaEnrollRequestSchema>;

export const MfaEnrollResponseDataSchema = z.object({
  factorId: z.string().uuid(),
  secret: z.string().min(16),          // hanya keluar pada respons ini; tak ada jalur baca setelahnya
  otpauthUri: z.string().url(),
});
export type MfaEnrollResponseData = z.infer<typeof MfaEnrollResponseDataSchema>;

export const MfaConfirmRequestSchema = z.object({
  code: z
    .string()
    .length(6, { message: 'Kode OTP harus tepat 6 digit angka.' })
    .regex(/^\d+$/, { message: 'Kode OTP hanya boleh berisi angka.' }),
});
export type MfaConfirmRequest = z.infer<typeof MfaConfirmRequestSchema>;

export const MfaConfirmResponseDataSchema = z.object({
  verified: z.literal(true),
  mfaRequired: z.boolean(),
});
export type MfaConfirmResponseData = z.infer<typeof MfaConfirmResponseDataSchema>;

// ==========================================
// 4. Token Refresh Schemas
// ==========================================
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(32, { message: 'Refresh token tidak valid.' }),
  deviceId: z.string().max(128).optional(),
});

export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const RefreshTokenResponseDataSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().describe('Refresh token rotasi baru (token lama di-revoke)'),
  expiresIn: z.number().int().default(900),
});

export type RefreshTokenResponseData = z.infer<typeof RefreshTokenResponseDataSchema>;

export const RefreshTokenResponseEnvelopeSchema = createSuccessEnvelope(
  RefreshTokenResponseDataSchema
);
export type RefreshTokenResponseEnvelope = z.infer<typeof RefreshTokenResponseEnvelopeSchema>;

// ==========================================
// 5. Logout Schema
// ==========================================
export const LogoutRequestSchema = z.object({
  refreshToken: z.string().min(32).optional(),
});

export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

export const LogoutResponseDataSchema = z.object({
  loggedOut: z.literal(true),
});

export type LogoutResponseData = z.infer<typeof LogoutResponseDataSchema>;

export const LogoutResponseEnvelopeSchema = createSuccessEnvelope(LogoutResponseDataSchema);
export type LogoutResponseEnvelope = z.infer<typeof LogoutResponseEnvelopeSchema>;
