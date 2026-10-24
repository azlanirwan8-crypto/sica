/**
 * Pemetaan galat domain mesin parameter ke envelope HTTP (`API_SPEC §2.3` + `§4.16.2`).
 *
 * Semua kode diambil dari register yang sudah ada — tidak ada kode baru di file ini:
 * 5 `NOT_FOUND` · 6 `VALIDATION_FAILED` · 12 `CONFLICT` · 16 `ADMIN_SCOPE_MISMATCH` ·
 * 26 `MODULE_NOT_AVAILABLE` · 55 `DECISION_ALREADY_MADE` · 56 `SELF_APPROVAL_FORBIDDEN` ·
 * 92 `LOOKUP_GROUP_NOT_FOUND` · 107 `PARAM_OUT_OF_RANGE` · 108 `PARAM_READONLY` ·
 * 109 `PARAM_INVALID_TYPE` · 110 `PARAM_ENUM_UNKNOWN` · 111 `PARAM_SECRET_FORBIDDEN` ·
 * 112 `PARAM_RESTART_REQUIRED` · 113 `PARAM_APPROVAL_REQUIRED` · 114 `PARAM_PATTERN_INVALID`.
 *
 * Aturan pesan yang berlaku di seluruh gugus ini: sebab + langkah perbaikan, dan **tidak
 * pernah** mengulang nilai yang ditolak sebagai rahasia (`111`). Rentang, satuan, dan kelas
 * risiko justru WAJIB terlihat — operator yang tidak tahu batasnya tidak bisa memperbaiki.
 */
import type { NextResponse } from 'next/server';
import { errorResponse, type RequestContext } from '@/lib/api-response';
import type { ParameterError } from '@/modules/settings/services/system-parameters.service';

export function mapParameterError(err: ParameterError, ctx: RequestContext): NextResponse {
  switch (err.kind) {
    case 'NOT_FOUND':
    case 'APPROVAL_NOT_FOUND':
      // 404, bukan 403: keberadaan kunci institusi lain tidak boleh menjadi oracle.
      return errorResponse('NOT_FOUND', 'Kunci parameter tidak ditemukan dalam institusi ini.', ctx, 404);

    case 'NO_VALUE_AT_DATE':
      // Bukan "nilai sekarang" yang disamarkan: kunci belum lahir pada tanggal itu, dan
      // laporan rekonstruksi wajib mengatakan itu apa adanya (BR-R12).
      return errorResponse(
        'NOT_FOUND',
        `${err.key} belum punya nilai tercatat pada ${err.at} — kuncinya lahir setelah tanggal itu. Nilai hari ini sengaja tidak dikembalikan agar laporan tidak mengutip angka yang belum berlaku.`,
        ctx,
        404,
        [
          { field: 'parameterKey', message: err.key },
          { field: 'at', message: err.at },
        ]
      );

    case 'PARAM_READONLY':
      return errorResponse(
        'PARAM_READONLY',
        `Kunci ini hanya indeks penemuan — nilai sebenarnya tinggal di ${err.home} dan dirawat di layar sana.`,
        ctx,
        403,
        [
          { field: 'parameterKey', message: err.key },
          { field: 'remedyHref', message: err.remedyHref ?? 'rumah konfigurasi terkait' },
        ]
      );

    case 'PARAM_INVALID_TYPE':
      return errorResponse(
        'PARAM_INVALID_TYPE',
        `Tipe nilai tidak cocok untuk ${err.key}: ${err.reason}.`,
        ctx,
        422,
        [{ field: 'value', message: err.reason }]
      );

    case 'PARAM_OUT_OF_RANGE':
      return errorResponse(
        'PARAM_OUT_OF_RANGE',
        `${err.key} hanya menerima ${err.min ?? '−'}..${err.max ?? '∞'}${err.unit ? ` ${err.unit}` : ''} (kelas ${err.riskClass}); nilai terkirim di luar itu.`,
        ctx,
        422,
        [
          { field: 'parameterKey', message: err.key },
          { field: 'sentValue', message: err.sent },
          { field: 'min', message: err.min ?? '—' },
          { field: 'max', message: err.max ?? '—' },
          { field: 'riskClass', message: err.riskClass },
        ]
      );

    case 'PARAM_ENUM_UNKNOWN':
      return errorResponse(
        'PARAM_ENUM_UNKNOWN',
        `Nilai untuk ${err.key} wajib anggota kamus ${err.enumKind} pada tanggal itu. Server tidak menambah item kamus agar nilai "lulus".`,
        ctx,
        422,
        [{ field: 'value', message: `${err.enumKind} ∌ ${err.sent}` }]
      );

    case 'LOOKUP_GROUP_NOT_FOUND':
      return errorResponse(
        'NOT_FOUND',
        `Kamus ${err.enumKind} belum terdaftar. Daftarkan kind-nya lewat /api/v1/master/kinds lebih dulu.`,
        ctx,
        404,
        [{ field: 'enumKind', message: err.enumKind }]
      );

    case 'PARAM_SECRET_FORBIDDEN':
      // Nilai TIDAK pernah di-echo dan tidak pernah masuk log (§4.16.2 langkah 7).
      return errorResponse(
        'PARAM_SECRET_FORBIDDEN',
        `Nilai untuk ${err.key} berbentuk kredensial. Parameter tidak pernah menyimpan rahasia: gunakan ENV/vault (ENV_CONTRACT).`,
        ctx,
        422,
        [{ field: 'value', message: 'bentuk kredensial ditolak' }]
      );

    case 'VERSION_CONFLICT':
      return errorResponse(
        'CONFLICT',
        `${err.key} sudah berada di versi ${err.currentVersion}. Baca ulang sebelum menyimpan — suntingan admin lain tidak boleh tertimpa.`,
        ctx,
        409,
        [{ field: 'expectedVersion', message: String(err.currentVersion) }]
      );

    case 'DUPLICATE_PENDING_APPROVAL':
      return errorResponse(
        'CONFLICT',
        'Sudah ada draf PENDING untuk kunci ini. Satu kunci tidak dapat menunggu dua persetujuan sekaligus.',
        ctx,
        409,
        [{ field: 'approvalId', message: err.approvalId }]
      );

    case 'PARAM_RESTART_REQUIRED':
      return errorResponse(
        'PARAM_RESTART_REQUIRED',
        `${err.key} ditandai requires_restart=true — deviasi norma hot-reload. Jalur rilis (DEPLOYMENT_DEVOPS §4) belum terpasang, jadi nilai tidak ditulis.`,
        ctx,
        409,
        [{ field: 'deployRef', message: 'diperlukan bukti pelepasan' }]
      );

    case 'PARAM_APPROVAL_REQUIRED': {
      const outcome = err.result;
      return errorResponse(
        'PARAM_APPROVAL_REQUIRED',
        `Nilai ${outcome.parameterKey} tersimpan sebagai draf dan BELUM berlaku; efektif tetap ${outcome.effectiveValue} sampai orang kedua menyetujui.`,
        ctx,
        409,
        [
          { field: 'approvalId', message: outcome.approval?.approvalId ?? '' },
          { field: 'proposedValue', message: outcome.proposedValue },
          { field: 'effectiveValue', message: outcome.effectiveValue },
          { field: 'riskClass', message: outcome.riskClass },
        ]
      );
    }

    case 'SELF_APPROVAL':
      return errorResponse(
        'SELF_APPROVAL_FORBIDDEN',
        'Empat-mata: Anda tidak dapat menyetujui draf yang Anda ajukan sendiri.',
        ctx,
        403
      );

    case 'DECISION_ALREADY_MADE':
      return errorResponse('DECISION_ALREADY_MADE', `Permintaan sudah berada pada keadaan terminal ${err.state}.`, ctx, 409);

    case 'APPROVAL_PERMISSION_MISSING':
      return errorResponse(
        'FORBIDDEN',
        `Menyetujui kelas ${err.riskClass} menuntut izin VALIDATE kelas itu (RBAC §4.5.10 baris 375/376).`,
        ctx,
        403,
        [{ field: 'riskClass', message: err.riskClass }]
      );

    case 'SCOPE_MISMATCH':
      return errorResponse(
        'ADMIN_SCOPE_MISMATCH',
        `Lingkup penugasan Anda tidak mencakup permintaan ini (${err.permission}).`,
        ctx,
        403,
        [{ field: 'permission', message: err.permission }]
      );

    case 'TOGGLE_BLOCKED':
      return errorResponse(
        'PARAM_APPROVAL_REQUIRED',
        `${err.key} masih dibaca konsumen terdaftar dan fallback-nya tidak terdefinisi; menonaktifkannya menghapus ambang gerbang, bukan mengubah preferensi.`,
        ctx,
        409,
        [{ field: 'fallback', message: err.fallback }]
      );

    case 'STALE_APPROVAL_BASE':
      return errorResponse(
        'CONFLICT',
        `Draf ${err.key} diajukan pada versi ${err.expected}, tetapi barisnya sudah bergerak ke ${err.actual}. Ajukan ulang.`,
        ctx,
        409,
        [{ field: 'expectedVersion', message: String(err.actual) }]
      );

    case 'KEY_TAKEN':
      return errorResponse('CONFLICT', `Kunci ${err.key} sudah terdaftar untuk institusi ini.`, ctx, 409, [
        { field: 'parameterKey', message: err.key },
      ]);

    case 'KEY_PREFIX_INVALID':
      return errorResponse(
        'VALIDATION_FAILED',
        `parameterKey wajib berawalan modulnya (${err.module}.) — ${err.key} melanggar aturan penamaan §4.16.4.`,
        ctx,
        422,
        [{ field: 'parameterKey', message: err.key }]
      );

    case 'CONSUMERS_MISSING':
      return errorResponse(
        'VALIDATION_FAILED',
        err.deferredReason !== null
          ? `${err.key} sengaja belum dipasang: ${err.deferredReason}. Registrasi kunci ini tetap ditolak sampai konsumennya benar-benar ada — menunjuk berkas karangan hanya memindahkan angkanya ke layar yang tidak dibaca siapa pun.`
          : 'Kunci baru ditolak karena konsumen statis tidak terbukti — parameter tanpa pembaca adalah "parameter hantu" (gerbang CI (n)).',
        ctx,
        422,
        [
          ...err.missing.map((path) => ({ field: 'consumerEvidence.callSites', message: path })),
          ...(err.deferredReason !== null ? [{ field: 'deferral', message: err.deferredReason }] : []),
        ]
      );

    case 'RISK_CLASS_NOT_REGISTRABLE':
      return errorResponse(
        'VALIDATION_FAILED',
        `Kunci kelas ${err.riskClass} tidak dapat diregistrasi dari API: CHECK DB menuntut penyetuju berbeda dari pengajukan, dan satu permintaan HTTP tidak pernah mewakili dua orang. Lahirkan lewat migrasi/seed (§21.2.1).`,
        ctx,
        422,
        [{ field: 'riskClass', message: err.riskClass }]
      );
  }
}
