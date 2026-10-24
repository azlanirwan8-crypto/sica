export * from './client';
export * from './schema';

// Re-export operator Drizzle yang dibutuhkan lapisan akses data di consumer (apps/web)
// agar aplikasi tidak perlu bergantung langsung ke paket `drizzle-orm` (pnpm isolated).
export { eq, and, or, inArray, isNull, not, ne, gt, gte, lt, lte, asc, desc, ilike } from 'drizzle-orm';
import { isNull, sql, type Column } from 'drizzle-orm';

/**
 * `column = value` bila nilai ada, `column IS NULL` bila tidak. Dibutuhkan karena
 * `eq(col, null)` menghasilkan `col = NULL` yang tidak pernah benar di SQL — jebakan
 * klasik saat membandingkan kolom scope penugasan yang memang boleh kosong.
 */
export function eqOrIsNull(column: Column, value: string | null | undefined) {
  return value == null ? isNull(column) : sql`${column} = ${value}`;
}
