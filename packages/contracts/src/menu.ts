import { z } from 'zod';

/**
 * Kontrak rute `/api/v1/me/**` (API_SPEC §4.17.1) — pohon menu yang disaring server.
 *
 * Yang paling mudah disalahpahami: rute ini **bukan** kontrol akses. Ia hanya memutuskan
 * apa yang terlihat; L1–L6 tetap wajib di setiap rute tulis. Karena itu bentuk respons
 * sengaja tidak pernah memuat cabang yang haknya tidak dimiliki peminta (norma 2: yang
 * disaring adalah cabang, bukan label) — tidak ada `visible: false` untuk hal yang tidak
 * boleh diketahui.
 */

export const MeMenuQuerySchema = z
  .object({
    layer: z.enum(['WEB', 'MOBILE']).default('WEB'),
    at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD.' })
      .optional(),
    depth: z.coerce.number().int().min(1).max(4).default(4),
  })
  .strict();

export type MeMenuQuery = z.infer<typeof MeMenuQuerySchema>;

export const MenuLayerSchema = z.enum(['WEB', 'MOBILE', 'BOTH']);
export type MenuLayerValue = z.infer<typeof MenuLayerSchema>;

/** `blockedBy[]` — sebab cabang terkunci (§2.5), bukan hilangnya cabang. */
export const MenuBlockSchema = z.object({
  code: z.string().max(64),
  reason: z.string().max(280),
  remedyHref: z.string().max(200).nullable().default(null),
});
export type MenuBlock = z.infer<typeof MenuBlockSchema>;

export interface MeMenuItem {
  readonly code: string;
  /** Kunci registri rute statis; `null` = header/pemisah atau layar belum dibangun. */
  readonly routeKey: string | null;
  /** Path hasil registri — klien tidak pernah merakit URL dari `code`/`label`. */
  readonly href: string | null;
  readonly labelKey: string | null;
  readonly label: string;
  /** Label Inggris dari DB — dipakai saat bahasa tampilan `en` dan `labelKey` tidak ada. */
  readonly labelEn: string | null;
  /**
   * Keterangan spesifikasi daun (`menu_items.description`, `0096`). Teks panjang register
   * `BLUEPRINT §12` tinggal di sini, bukan di `label`; dipakai untuk `title`/subjudul dan
   * untuk membandingkan dokumen terhadap DB. `null` = "nama = keterangan" (DATA_MODEL §21.7 butir 4).
   */
  readonly description: string | null;
  readonly descriptionEn: string | null;
  readonly icon: string | null;
  readonly sortOrder: number;
  readonly moduleCode: string | null;
  readonly requiresMfa: boolean;
  readonly disabled: boolean;
  readonly blockedBy: readonly MenuBlock[];
  readonly children: readonly MeMenuItem[];
}

export interface MeMenuResponse {
  readonly layer: 'WEB' | 'MOBILE';
  /** Agregat versi baris; naik pada setiap tulis §4.17.2 — dipakai sebagai ETag. */
  readonly menuVersion: number;
  readonly resolvedAt: string;
  readonly tree: readonly MeMenuItem[];
  readonly prunedCounts: {
    readonly byEntitlement: number;
    readonly byPermission: number;
    readonly byDepthLimit: number;
  };
  readonly registry: { readonly unknownRouteKeys: readonly string[] };
}

/** Peta `menu_items` mentah yang dibutuhkan resolver (proyeksi, bukan seluruh baris). */
export interface MenuRowProjection {
  readonly id: string;
  readonly code: string;
  readonly parentId: string | null;
  readonly label: string;
  readonly labelEn: string | null;
  readonly description: string | null;
  readonly descriptionEn: string | null;
  readonly routeKey: string | null;
  readonly moduleCode: string | null;
  readonly icon: string | null;
  readonly sortOrder: number;
  readonly isVisible: boolean;
  readonly requiresMfa: boolean;
  readonly version: number;
}

export interface MenuGrantProjection {
  readonly menuId: string;
  readonly permissionCode: string;
  readonly effect: 'ALLOW' | 'DENY';
  readonly scopeKind: string;
}
