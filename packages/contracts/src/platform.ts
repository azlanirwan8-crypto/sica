import { z } from 'zod';

/**
 * Kontrak rute `/api/v1/platform/**` (API_SPEC §4.20, M-01) — provisioning tenant,
 * transisi status, kuota, dukungan terawasi. Aturan yang melekat di semua badan:
 * `tenantId`/`userId` TIDAK PERNAH diterima dari body (hanya dari token terverifikasi,
 * `SEC-07`); status adalah kolom SERVER_ONLY yang hanya berubah lewat transisi (§4.20);
 * alasan wajib untuk aksi sensitif (10–500 karakter).
 */

export const PlatformSlugSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, { message: 'Slug hanya huruf kecil, angka, dan tanda sambung.' });

export const PlatformReasonSchema = z.string().min(10).max(500);

export const ProvisionTenantRequestSchema = z
  .object({
    slug: PlatformSlugSchema,
    legalName: z.string().min(3).max(200),
    planId: z.string().uuid().optional(),
    adminEmail: z.string().email({ message: 'Email admin pertama tidak valid.' }),
    adminFullName: z.string().min(3).max(120),
    adminInitialPassword: z
      .string()
      .min(12, { message: 'Sandi awal minimal 12 karakter (SECURITY §2.1).' })
      .max(200),
    initialMemberCode: z.string().min(3).max(64).optional(),
    moduleCodes: z.array(z.string().min(2).max(40)).max(30).default([]),
    reason: PlatformReasonSchema,
  })
  .strict();
export type ProvisionTenantRequest = z.infer<typeof ProvisionTenantRequestSchema>;

export const ProvisionTenantResponseDataSchema = z.object({
  tenantId: z.string().uuid(),
  slug: z.string(),
  status: z.literal('ONBOARDING'),
  adminUserId: z.string().uuid(),
  rolesSeeded: z.number().int().min(0),
  modulesActivated: z.number().int().min(0),
});
export type ProvisionTenantResponseData = z.infer<typeof ProvisionTenantResponseDataSchema>;

export const TenantStatusTransitionRequestSchema = z
  .object({ reason: PlatformReasonSchema })
  .strict();
export type TenantStatusTransitionRequest = z.infer<typeof TenantStatusTransitionRequestSchema>;

export const TenantStatusViewSchema = z.object({
  tenantId: z.string().uuid(),
  slug: z.string(),
  legalName: z.string(),
  status: z.enum(['ONBOARDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  updatedAt: z.string().datetime(),
});
export type TenantStatusView = z.infer<typeof TenantStatusViewSchema>;

export const PlatformQuotaKeySchema = z.enum([
  'maxConcurrentOwRequests',
  'maxApiRps',
  'maxStorageMb',
  'maxExportRows',
  'maxBatchInvoiceRows',
]);
export type PlatformQuotaKey = z.infer<typeof PlatformQuotaKeySchema>;

/** Kunci kuota = kolom `tenant_quotas` (DATA_MODEL §3.1); kunci asing → 422 PLATFORM_QUOTA_KEY_UNKNOWN (153). */
export const UpdateTenantQuotasRequestSchema = z
  .object({
    quotas: z
      .object({
        maxConcurrentOwRequests: z.number().int().min(1).max(5000).optional(),
        maxApiRps: z.number().int().min(1).max(10000).optional(),
        maxStorageMb: z.number().int().min(1024).max(104_857_600).optional(),
        maxExportRows: z.number().int().min(1000).max(10_000_000).optional(),
        maxBatchInvoiceRows: z.number().int().min(100).max(1_000_000).optional(),
      })
      .strict(),
    reason: PlatformReasonSchema,
  })
  .strict();
export type UpdateTenantQuotasRequest = z.infer<typeof UpdateTenantQuotasRequestSchema>;

/** Grant dukungan terawasi / impersonation (0083; TTL ditetapkan SERVER ≤ 30 menit). */
export const CreateImpersonationGrantRequestSchema = z
  .object({
    targetTenantSlug: z.string().min(3).max(40).optional(),
    targetTenantId: z.string().uuid().optional(),
    targetUserId: z.string().uuid(),
    reason: PlatformReasonSchema,
    scope: z.enum(['READ_ONLY', 'HELPDESK_REPAIR']).default('READ_ONLY'),
    ticketId: z.string().uuid().optional(),
    ttlMinutes: z.number().int().min(1).max(30).default(15),
  })
  .strict()
  .refine((v) => Boolean(v.targetTenantSlug ?? v.targetTenantId), {
    message: 'targetTenantId atau targetTenantSlug wajib diisi.',
    path: ['targetTenantId'],
  });
export type CreateImpersonationGrantRequest = z.infer<typeof CreateImpersonationGrantRequestSchema>;

export const ImpersonationGrantViewSchema = z.object({
  grantId: z.string().uuid(),
  tenantId: z.string().uuid(),
  grantKind: z.enum(['PLATFORM_SUPPORT', 'TENANT_IMPERSONATION']),
  scope: z.enum(['READ_ONLY', 'HELPDESK_REPAIR']),
  state: z.enum(['REQUESTED', 'GRANTED', 'ACTIVE', 'ENDED', 'EXPIRED', 'REVOKED']),
  reason: z.string(),
  requestedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type ImpersonationGrantView = z.infer<typeof ImpersonationGrantViewSchema>;

/** Baca jejak audit lintas-tenant (§4.21 baris platform): `reason` WAJIB, filer terbatas. */
export const CrossTenantAuditQuerySchema = z.object({
  tenantId: z.string().uuid(),
  action: z.string().min(2).max(80).optional(),
  targetEntity: z.string().min(2).max(80).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  reason: PlatformReasonSchema,
});
export type CrossTenantAuditQuery = z.infer<typeof CrossTenantAuditQuerySchema>;

export const AuditEventViewSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  targetEntity: z.string(),
  targetId: z.string().uuid().nullable(),
  action: z.string(),
  reason: z.string().nullable(),
  occurredAt: z.string().datetime(),
  hash: z.string(),
  prevHash: z.string().nullable(),
});
export type AuditEventView = z.infer<typeof AuditEventViewSchema>;
