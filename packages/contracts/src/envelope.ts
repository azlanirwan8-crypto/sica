import { z } from 'zod';

// ==========================================
// 1. Primitive Reusable Schemas
// ==========================================
export const UUIDSchema = z
  .string()
  .uuid({ message: 'Harus berupa format UUID v4 yang valid.' });

export const TimestampSchema = z
  .string()
  .datetime({ message: 'Format waktu harus ISO-8601 UTC.' });

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// ==========================================
// 2. Standard Envelope Schemas
// ==========================================
export const PaginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalRecords: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export const MetaResponseSchema = z.object({
  timestamp: TimestampSchema,
  requestId: z.string(),
  pagination: PaginationMetaSchema.optional(),
});

export type MetaResponse = z.infer<typeof MetaResponseSchema>;
export const ResponseMetaSchema = MetaResponseSchema; // Alias for backward compatibility
export type ResponseMeta = MetaResponse;

export const ErrorDetailSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
});

export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export const ApiErrorDetailSchema = ErrorDetailSchema; // Alias
export type ApiErrorDetail = ErrorDetail;

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.array(ErrorDetailSchema).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Standard Success Response Envelope Builder
 */
export function createSuccessEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: MetaResponseSchema,
  });
}

export const createSuccessEnvelopeSchema = createSuccessEnvelope; // Alias

/**
 * Standard Error Response Envelope Schema
 */
export const StandardErrorResponseSchema = z.object({
  success: z.literal(false),
  error: ApiErrorSchema,
  meta: z.object({
    timestamp: TimestampSchema,
    requestId: z.string(),
  }),
});

export type StandardErrorResponse = z.infer<typeof StandardErrorResponseSchema>;
export const ErrorEnvelopeSchema = StandardErrorResponseSchema; // Alias
export type ErrorEnvelope = StandardErrorResponse;
