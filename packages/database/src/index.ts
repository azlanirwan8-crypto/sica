export * from './client';
export * from './schema';

// Re-export operator Drizzle yang dibutuhkan lapisan akses data di consumer (apps/web)
// agar aplikasi tidak perlu bergantung langsung ke paket `drizzle-orm` (pnpm isolated).
export { eq, and, or, inArray, isNull, gt } from 'drizzle-orm';
