/**
 * Klien fetch layar admin & platform (amplop standar API_SPEC §2.4).
 *
 * Bentuknya sama untuk kedua gugus: `{ success, data, meta }` atau
 * `{ success:false, error:{ code, message, details[] } }`. Layar tidak boleh menebak
 * status — KODE error yang menentukan pesan, termasuk `MFA_REQUIRED` (401) yang berarti
 * sesi belum melewati tantangan TOTP dan aksi tulis akan selalu ditolak.
 */

export interface ApiPagination {
  readonly page: number;
  readonly limit: number;
  readonly totalRecords: number;
  readonly totalPages: number;
}

export interface ApiFieldIssue {
  readonly field?: string;
  readonly message: string;
}

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T; readonly pagination: ApiPagination | null }
  | { readonly ok: false; readonly status: number; readonly code: string; readonly message: string; readonly issues: readonly ApiFieldIssue[] };

export interface ApiRequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string | number | undefined>>;
}

function buildUrl(path: string, query: ApiRequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

interface RawEnvelope {
  readonly success?: boolean;
  readonly data?: unknown;
  readonly meta?: { readonly pagination?: Partial<ApiPagination> };
  readonly error?: { readonly code?: string; readonly message?: string; readonly details?: readonly ApiFieldIssue[] };
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const method = options.method ?? 'GET';
  const response = await fetch(buildUrl(path, options.query), {
    method,
    credentials: 'same-origin',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = (await response.json().catch(() => null)) as RawEnvelope | null;

  if (response.ok && payload?.success === true) {
    const p = payload.meta?.pagination;
    const pagination =
      p && typeof p.totalRecords === 'number' && typeof p.page === 'number'
        ? { page: p.page, limit: p.limit ?? 50, totalRecords: p.totalRecords, totalPages: p.totalPages ?? 1 }
        : null;
    return { ok: true, data: payload.data as T, pagination };
  }

  return {
    ok: false,
    status: response.status,
    code: payload?.error?.code ?? (response.status === 0 ? 'NETWORK' : `HTTP_${response.status}`),
    message: payload?.error?.message ?? 'Respons server tidak dikenali.',
    issues: payload?.error?.details ?? [],
  };
}

/** Peta `details[]` kontrak → error per kolom untuk `Field error=`. */
export function issuesByField(issues: readonly ApiFieldIssue[]): Readonly<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    if (!issue.field) continue;
    map[issue.field] = issue.message;
  }
  return map;
}

/**
 * Pesan yang jujur per kode error — bukan banner generik "terjadi kesalahan".
 * `labels` menerima namespace kamus apa pun (`admin`, `platform`), termasuk yang memiliki
 * anak bersarang (mis. `admin.param`): hanya daun bertipe string yang dipakai.
 */
export function describeFailure(
  result: Extract<ApiResult<unknown>, { readonly ok: false }>,
  labels: Readonly<Record<string, unknown>>
): string {
  const pick = (key: string): string | null => {
    const value = labels[key];
    return typeof value === 'string' ? value : null;
  };
  if (result.code === 'MFA_REQUIRED') return pick('mfaRequired') ?? result.message;
  if (result.status === 403) return pick('forbidden') ?? result.message;
  if (result.status === 409) return pick('conflict') ?? result.message;
  return result.message;
}

const STAMP = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : STAMP.format(date);
}
