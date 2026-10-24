/**
 * GET `/api/v1/settings/effective` (`API_SPEC §4.16.5`, `SPE-6`, M-02).
 *
 * Kontrak baca untuk SEMUA platform: Web dan Flutter membaca angka yang sama dari rute yang
 * sama, dan tidak ada satu pun dari keduanya yang memilih di antara kandidat. Resolusi
 * (aktif → jendela → `applies_to` terspesifik → default) terjadi di server
 * (`parameter-resolver.ts`); yang keluar sudah keadaan efektif.
 *
 * Tiga hal yang membuatnya bukan "endpoint pengaturan" biasa:
 *  - **Tidak ada rute tulis pada prefix ini.** Menulis hanya lewat §4.16.2–§4.16.4.
 *  - **Kelas `SECURITY`/`REGULATORY` di-mask, bukan ditolak satu layar**: peran tanpa izin
 *    baca kelas menerima `masked: true` + `READ_ROLE_NOT_ALLOWED`, jadi ambang sensitif tidak
 *    bocor ke kartu tugas — dan satu kunci sensitif tidak menjatuhkan seluruh permintaan.
 *  - **Entitlement memotong lebih dulu dari role**: kunci modul non-`ACTIVE`/`TRIAL` masuk
 *    `unresolvedKeys` dengan `MODULE_NOT_AVAILABLE`; permintaan satu kunci modul itu dijawab
 *    `404` (26).
 *
 * Cache: `private, max-age=60` + `ETag`/`If-None-Match` → `304` tanpa body. `private` karena
 * isinya ambang satu institusi; menyimpannya di lapisan bersama = membocorkan konfigurasi
 * antar-tenant.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { EffectiveSettingsQuerySchema } from '@sica/contracts';
import { errorResponse, extractRequestContext } from '@/lib/api-response';
import { actorOf } from '@/modules/identity/services/access-request.service';
import { loadActiveModuleCodes, resolveEffectiveSettings, type ScopeContext } from '@/modules/settings/services/parameter-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Konteks scope peminta. `scopeHint` HANYA memilih turunan `applies_to` yang sah; ia tidak
 * memotong RLS dan tidak pernah menjadi pengganti izin (§4.16.5). Prodi diambil dari
 * penugasan aktor — bila ia memegang tepat satu prodi konkret.
 */
function contextFor(access: { readonly grants: readonly { readonly scope: { readonly programId?: string | null } }[] }): ScopeContext {
  const programs = new Set(
    access.grants.map((grant) => grant.scope.programId).filter((id): id is string => typeof id === 'string' && id.length > 0)
  );
  return programs.size === 1 ? { programId: [...programs][0] ?? null } : {};
}

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);
  if (!ctx.authenticated || !ctx.tenantId || !ctx.userId) {
    return errorResponse('UNAUTHORIZED', 'Keadaan efektif hanya dibaca dalam sesi terautentikasi.', ctx, 401);
  }

  const parsed = EffectiveSettingsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Permintaan kunci wajib `keys` 1..40 dan tanpa parameter identitas.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const keys = parsed.data.keys;
  const actor = await actorOf(ctx.tenantId, ctx.userId);
  const activeModules = await loadActiveModuleCodes(ctx.tenantId);

  const resolved = await resolveEffectiveSettings(
    ctx.tenantId,
    keys,
    contextFor(actor.access),
    actor.access,
    activeModules
  );

  if (!resolved.ok) {
    return errorResponse(
      'CONFLICT',
      'Dua baris parameter ACTIVE dengan spesifisitas scope yang sama melayani konteks ini — konfigurasi rusak, bukan "yang terakhir menang".',
      ctx,
      409,
      [{ field: 'parameterKey', message: resolved.error.key }]
    );
  }

  const { value } = resolved;

  // Satu kunci modul non-aktif = 404; lebih dari satu = 200 + unresolvedKeys (kontrak klien).
  if (keys.length === 1) {
    const missing = value.unresolvedKeys.find((entry) => entry.key === keys[0]);
    if (missing?.reason === 'MODULE_NOT_AVAILABLE') {
      return errorResponse(
        'MODULE_NOT_AVAILABLE',
        `Modul pemilik ${keys[0]} tidak aktif untuk institusi ini.`,
        ctx,
        404,
        [{ field: 'keys', message: keys[0] ?? '' }]
      );
    }
  }

  if (request.headers.get('if-none-match') === value.etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: value.etag,
        'X-Parameter-Version': value.parameterVersion,
        'Cache-Control': 'private, max-age=60',
        Vary: 'Accept-Language',
      },
    });
  }

  const response = NextResponse.json(
    {
      success: true,
      data: { resolvedAt: value.resolvedAt, settings: value.settings, unresolvedKeys: value.unresolvedKeys },
      meta: { timestamp: ctx.timestamp, requestId: ctx.requestId, parameterVersion: value.parameterVersion },
    },
    { status: 200 }
  );
  response.headers.set('ETag', value.etag);
  response.headers.set('X-Parameter-Version', value.parameterVersion);
  response.headers.set('Cache-Control', 'private, max-age=60');
  response.headers.set('Vary', parsed.data.scopeHint ? 'Accept-Language, X-Parameter-Scope' : 'Accept-Language');
  return response;
}
