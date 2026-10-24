/**
 * Unit tests — Penjaga nilai & skema transport parameter (`API_SPEC §4.16.2` langkah 2–7,
 * `§4.16.4`, `SPE-3`/`SPE-5`).
 *
 * Semua fungsi yang diuji di sini PURE: tidak menyentuh DB. Batas yang dijaga adalah
 * "transport menjawab sebelum satu baris pun terbentuk" — kalau logika ini bocor ke service,
 * nilai ilegal bisa sampai ke transaksi dan meninggalkan jejak audit palsu.
 */
import { describe, it, expect } from 'vitest';
import {
  ApproveParameterSchema,
  EffectiveSettingsQuerySchema,
  ParameterPatternBodySchema,
  RevertParameterBodySchema,
  RegisterParameterBodySchema,
  RejectParameterSchema,
  SystemParameterListQuerySchema,
  SystemParameterViewSchema,
  SystemParameterWriteBodySchema,
  ToggleActiveBodySchema,
  canonicalize,
  checkAllowedValues,
  checkEnumMember,
  checkJsonShape,
  checkRange,
  coerceByType,
  findParameterDefinition,
  guardParameterWrite,
  isKeyPrefixedByModule,
  looksLikeCredential,
  parameterEnumCodesOf,
  riskRequiresApproval,
  type ParameterRiskClass,
  type SystemParameterDefinition,
} from '@sica/contracts';

const defOf = (key: string): SystemParameterDefinition => {
  const def = findParameterDefinition(key);
  if (!def) throw new Error(`kunci ${key} tidak ada di registri — uji ini menunjuk katalog, bukan karangan`);
  return def;
};

const WRITE_BODY = {
  value: '10',
  reason: 'menyesuaikan jam perangkat dosen di lapangan',
  expectedVersion: 1,
};

describe('coerceByType — langkah 2', () => {
  it('menolak karakter kontrol dan nilai raksasa', () => {
    expect(coerceByType('STRING', 'a\u0000b')).toMatchObject({ kind: 'PARAM_INVALID_TYPE' });
    expect(coerceByType('STRING', 'x'.repeat(4001))).toMatchObject({ kind: 'PARAM_INVALID_TYPE' });
  });

  it('INT bulat, PCT 0..100, BP 0..10.000 sebagai tipe (bukan hanya rentang)', () => {
    expect(coerceByType('INT', '12.5')).toMatchObject({ kind: 'PARAM_INVALID_TYPE' });
    expect(coerceByType('INT', '12')).toBe('12');
    // Batas tipe PCT/BP dilaporkan sebagai OUT_OF_RANGE: operator butuh "107 + min/max",
    // bukan "109 tipe" yang terdengar seperti salah ketik format (ralat e2e 2026-10-23).
    expect(coerceByType('PCT', '120')).toMatchObject({ kind: 'PARAM_OUT_OF_RANGE', min: '0', max: '100' });
    expect(coerceByType('PCT', '-1')).toMatchObject({ kind: 'PARAM_OUT_OF_RANGE' });
    expect(coerceByType('BP', '10001')).toMatchObject({ kind: 'PARAM_OUT_OF_RANGE', min: '0', max: '10000' });
    expect(coerceByType('DECIMAL', '0.75')).toBe('0.75');
    expect(coerceByType('DECIMAL', 'nol')).toMatchObject({ kind: 'PARAM_INVALID_TYPE' });
  });

  it('BOOL menormalkan berbagai bentuk tetapi menolak kata bebas', () => {
    expect(coerceByType('BOOL', 'TRUE')).toBe('true');
    expect(coerceByType('BOOL', '0')).toBe('false');
    expect(coerceByType('BOOL', 'ya')).toMatchObject({ kind: 'PARAM_INVALID_TYPE' });
  });

  it('DATE/TIME/CRON/REGEX punya bentuknya sendiri', () => {
    expect(coerceByType('DATE', '2026-10-23')).toBe('2026-10-23');
    expect(coerceByType('DATE', '23-10-2026')).toMatchObject({ kind: 'PARAM_INVALID_TYPE' });
    expect(coerceByType('TIME', '25:00')).toMatchObject({ kind: 'PARAM_INVALID_TYPE' });
    expect(coerceByType('CRON', '0 5 * *')).toMatchObject({ kind: 'PARAM_INVALID_TYPE', reason: 'CRON wajib 5 field' });
    expect(coerceByType('REGEX', '[a-z')).toMatchObject({ kind: 'PARAM_INVALID_TYPE', reason: 'REGEX tidak dapat dikompilasi' });
    expect(coerceByType('STRING', '')).toMatchObject({ kind: 'PARAM_INVALID_TYPE', reason: 'nilai wajib terisi' });
  });

  it('JSON dinormalkan (spasi bukan bagian dari nilai yang disimpan)', () => {
    expect(coerceByType('JSON', '{"a": 1, "b": [2]}')).toBe('{"a":1,"b":[2]}');
    expect(coerceByType('JSON', 'null')).toMatchObject({ kind: 'PARAM_INVALID_TYPE' });
    expect(coerceByType('JSON', '{')).toMatchObject({ kind: 'PARAM_INVALID_TYPE' });
    // Baris baru literal kena penjaga karakter kontrol lebih dulu. Disengaja: nilai yang
    // masuk `parameter_value` harus satu baris, kalau tidak ia bisa memalsukan baris log.
    expect(coerceByType('JSON', '{"a": 1,\n"b": 2}')).toMatchObject({
      kind: 'PARAM_INVALID_TYPE',
      reason: 'nilai tidak boleh mengandung karakter kontrol',
    });
  });
});

describe('langkah 3–5 — rentang, himpunan sah, kamus', () => {
  it('rentang dibandingkan sebagai angka, bukan teks', () => {
    expect(checkRange('METERS', '900', '10', '500')).toMatchObject({ kind: 'PARAM_OUT_OF_RANGE' });
    expect(checkRange('METERS', '9', '10', '500')).toMatchObject({ kind: 'PARAM_OUT_OF_RANGE' });
    expect(checkRange('METERS', '90', '10', '500')).toBeNull();
    // '9' > '500' sebagai teks: bukti kenapa perbandingan string salah untuk angka.
    expect('9' > '500').toBe(true);
  });

  it('tanpa min/max berarti tanpa batas rentang', () => {
    expect(checkRange('STRING', 'apa pun', null, null)).toBeNull();
  });

  it('himpunan sah menutup nilai di dalam rentang (cek keamanan dua lapis)', () => {
    expect(checkAllowedValues(['5', '10', '15'], '20')).toMatchObject({ kind: 'PARAM_VALUE_NOT_ALLOWED' });
    expect(checkAllowedValues(['5', '10', '15'], '15')).toBeNull();
    expect(checkAllowedValues(null, '20')).toBeNull();
  });

  it('anggota kamus diverifikasi dari kode terdaftar, bukan dari string kosong', () => {
    const codes = parameterEnumCodesOf('ukuran_baju');
    expect(codes.length).toBeGreaterThan(0);
    expect(checkEnumMember('ukuran_baju', codes, 'XL')).toBeNull();
    expect(checkEnumMember('ukuran_baju', codes, 'XXXL')).toMatchObject({ kind: 'PARAM_ENUM_UNKNOWN' });
    expect(checkEnumMember(null, [], 'apapun')).toBeNull();
  });

  it('kind yang tidak terdaftar menghasilkan nol kode (server tidak mengarang kamus)', () => {
    expect(parameterEnumCodesOf('kind_yangtidakada')).toEqual([]);
    expect(checkEnumMember('kind_yangtidakada', parameterEnumCodesOf('kind_yangtidakada'), 'X')).toMatchObject({
      kind: 'PARAM_ENUM_UNKNOWN',
    });
  });
});

describe('bentuk JSON per kunci (§21.3 butir 14/33/36)', () => {
  it('rantai fallback: token sah, unik, 1..6', () => {
    expect(checkJsonShape('conference.fallback_chain', '["BBB","JITSI"]')).toBeNull();
    expect(checkJsonShape('conference.fallback_chain', '["BBB","BBB"]')).toMatchObject({ kind: 'PARAM_VALUE_NOT_ALLOWED' });
    expect(checkJsonShape('conference.fallback_chain', '["SKYPE"]')).toMatchObject({ kind: 'PARAM_VALUE_NOT_ALLOWED' });
    expect(checkJsonShape('conference.fallback_chain', '[]')).toMatchObject({ kind: 'PARAM_VALUE_NOT_ALLOWED' });
  });

  it('prioritas geolokasi wajib permutasi lengkap tanpa duplikat', () => {
    expect(checkJsonShape('analytics.map.geo_source_priority', '["GEOIP_DB","CLIENT_GEO","SITE_GEO"]')).toBeNull();
    expect(checkJsonShape('analytics.map.geo_source_priority', '["GEOIP_DB"]')).toMatchObject({ kind: 'PARAM_VALUE_NOT_ALLOWED' });
  });

  it('domain anomali wajib anggota kosakata; kosong berarti mati — sah', () => {
    expect(checkJsonShape('ai.anomaly.enabled_domains', '[]')).toBeNull();
    expect(checkJsonShape('ai.anomaly.enabled_domains', '["ATTENDANCE"]')).toBeNull();
    expect(checkJsonShape('ai.anomaly.enabled_domains', '["MAHASISWA"]')).toMatchObject({ kind: 'PARAM_VALUE_NOT_ALLOWED' });
  });

  it('kunci lain tidak ikut diperiksa bentuknya', () => {
    expect(checkJsonShape('attendance.totp_window_steps', '1')).toBeNull();
  });
});

describe('langkah 7 — rahasia tidak pernah menjadi parameter', () => {
  it('mengenali bentuk kredensial', () => {
    for (const value of [
      'postgresql://user:pass@host:5432/db',
      'Bearer abcdef123456.ghijkl',
      '-----BEGIN PRIVATE KEY-----',
      'ghp_abcdefghijklmnopqrstuvwxyz123456',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijk',
      'api_key= supersecret ',
    ]) {
      expect(looksLikeCredential(value), value).toBe(true);
    }
  });

  it('tidak salah tuduh pada nilai operasional biasa', () => {
    for (const value of ['50', 'true', 'ONSITE_PRIMARY', '0 5 * * 1', '2201\\d{5}']) {
      expect(looksLikeCredential(value), value).toBe(false);
    }
  });

  it('guard mengembalikan Penolakan TANPA mengulang nilainya (pesan/log tidak boleh membocorkan)', () => {
    const failure = guardParameterWrite(defOf('attendance.min_presence_pct'), 'sk-1234567890abcdefghij', null);
    expect(failure).toEqual({ kind: 'PARAM_SECRET_FORBIDDEN' });
    expect(JSON.stringify(failure)).not.toContain('1234567890');
  });
});

describe('guardParameterWrite di atas katalog nyata', () => {
  it('nilai baku tiap kunci terpasang lolos', () => {
    for (const def of ['attendance.min_presence_pct', 'attendance.totp_rotate_seconds', 'attendance.totp_window_steps', 'attendance.geofence_default_radius_m', 'attendance.gps_max_accuracy_m'].map(defOf)) {
      expect(guardParameterWrite(def, def.defaultValue, def.enumKind ? parameterEnumCodesOf(def.enumKind) : null)).toBe(def.defaultValue);
    }
  });

  it('20 detik untuk rotasi TOTP ditolak himpunan, bukan rentang', () => {
    expect(guardParameterWrite(defOf('attendance.totp_rotate_seconds'), '20', null)).toMatchObject({ kind: 'PARAM_VALUE_NOT_ALLOWED' });
  });

  it('angka dari klien (number/boolean) dikawatkan lebih dulu', () => {
    expect(guardParameterWrite(defOf('attendance.geofence_default_radius_m'), 120, null)).toBe('120');
    expect(guardParameterWrite(defOf('attendance.geofence_default_radius_m'), 9, null)).toMatchObject({ kind: 'PARAM_OUT_OF_RANGE' });
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(0.75)).toBe('0.750000'.replace(/0+$/, '').replace(/\.$/, ''));
  });

  it('jendela verifikasi 3 langkah ditolak — rentang lebih dulu, himpunan jaring kedua', () => {
    // Urutan penjaga (§4.16.2 langkah 3 sebelum 4) penting untuk pesan: `3` sudah keluar
    // rentang 0..2, jadi sebab yang ditampilkan adalah rentang, bukan "tidak ada di daftar".
    expect(guardParameterWrite(defOf('attendance.totp_window_steps'), '3', null)).toMatchObject({ kind: 'PARAM_OUT_OF_RANGE' });
    // Nilai di DALAM rentang tetapi bukan anggota himpunan sah → jaring kedua yang menangkap.
    const def = defOf('attendance.totp_rotate_seconds');
    expect(guardParameterWrite(def, '20', null)).toMatchObject({ kind: 'PARAM_VALUE_NOT_ALLOWED' });
    // Untuk INT, '2' lolos keduanya; '1' adalah satu-satunya nilai di dalam kedua jaring.
    expect(guardParameterWrite(defOf('attendance.totp_window_steps'), '1', null)).toBe('1');
  });
});

describe('penamaan & kelas risiko', () => {
  it('kunci wajib berawalan modulnya (§4.16.4)', () => {
    expect(isKeyPrefixedByModule('attendance.totp_window_steps', 'attendance')).toBe(true);
    expect(isKeyPrefixedByModule('finance.installment_max_terms', 'attendance')).toBe(false);
    expect(isKeyPrefixedByModule('totp_window_steps', 'attendance')).toBe(false);
  });

  it('hanya REGULATORY/SECURITY yang menuntut orang kedua', () => {
    const classes: ParameterRiskClass[] = ['TECHNICAL', 'OPS', 'ACADEMIC', 'FINANCIAL', 'REGULATORY', 'SECURITY'];
    for (const c of classes) expect(riskRequiresApproval(c)).toBe(c === 'REGULATORY' || c === 'SECURITY');
  });
});

describe('skema transport menolak sebelum service', () => {
  it('body tulis: reason ≥10 karakter, expectedVersion wajib, kunci asing ditolak', () => {
    expect(SystemParameterWriteBodySchema.safeParse(WRITE_BODY).success).toBe(true);
    expect(SystemParameterWriteBodySchema.safeParse({ ...WRITE_BODY, reason: 'pendek' }).success).toBe(false);
    expect(SystemParameterWriteBodySchema.safeParse({ ...WRITE_BODY, expectedVersion: 0 }).success).toBe(false);
    expect(SystemParameterWriteBodySchema.safeParse({ ...WRITE_BODY, tenantId: 'lain' }).success).toBe(false);
  });

  it('appliesTo hanya menerima UUID dan menolak field di luar kontrak', () => {
    expect(SystemParameterWriteBodySchema.safeParse({ ...WRITE_BODY, appliesTo: { programIds: ['2f8f9f0c-3f1e-4a6b-9c2d-7a1b2c3d4e5f'] } }).success).toBe(true);
    expect(SystemParameterWriteBodySchema.safeParse({ ...WRITE_BODY, appliesTo: { programIds: ['prodi-1'] } }).success).toBe(false);
    expect(SystemParameterWriteBodySchema.safeParse({ ...WRITE_BODY, appliesTo: { prodiLain: ['2f8f9f0c-3f1e-4a6b-9c2d-7a1b2c3d4e5f'] } }).success).toBe(false);
  });

  it('revert: toVersion ATAU toDefault, bukan keduanya dan bukan nol-duanya', () => {
    const base = { reason: 'mengembalikan nilai sebelum insiden', expectedVersion: 4 };
    expect(RevertParameterBodySchema.safeParse({ ...base, toVersion: 3 }).success).toBe(true);
    expect(RevertParameterBodySchema.safeParse({ ...base, toDefault: true }).success).toBe(true);
    expect(RevertParameterBodySchema.safeParse(base).success).toBe(false);
    expect(RevertParameterBodySchema.safeParse({ ...base, toVersion: 3, toDefault: true }).success).toBe(false);
  });

  it('approve opsional reason, reject wajib reason', () => {
    expect(ApproveParameterSchema.safeParse({}).success).toBe(true);
    expect(RejectParameterSchema.safeParse({}).success).toBe(false);
    expect(RejectParameterSchema.safeParse({ reason: 'ambang belum dibahas senate akademik' }).success).toBe(true);
  });

  it('toggle tanpa expectedVersion ditolak (dua klik tidak boleh bertukar keadaan)', () => {
    expect(ToggleActiveBodySchema.safeParse({ isActive: false, reason: 'mata rantai verifikasi ini mati' }).success).toBe(false);
    expect(ToggleActiveBodySchema.safeParse({ isActive: false, reason: 'mata rantai verifikasi ini mati', expectedVersion: 2 }).success).toBe(true);
  });

  it('register: requiresRestart literal false dan pola kunci ber-titik', () => {
    const base = {
      module: 'attendance',
      parameterKey: 'attendance.uji_baru',
      dataType: 'INT',
      defaultValue: '5',
      description: 'kunci uji untuk membuktikan penolakan transport',
      riskClass: 'TECHNICAL',
      consumerEvidence: { callSites: ['apps/web/src/modules/x.ts:f'], testRef: 'apps/web/tests/unit/parameter-consumers.test.ts' },
      reason: 'menambah ambang baru untuk uji',
    };
    expect(RegisterParameterBodySchema.safeParse(base).success).toBe(true);
    expect(RegisterParameterBodySchema.safeParse({ ...base, requiresRestart: true }).success).toBe(false);
    expect(RegisterParameterBodySchema.safeParse({ ...base, parameterKey: 'attendance' }).success).toBe(false);
    expect(RegisterParameterBodySchema.safeParse({ ...base, parameterKey: 'Attendance.uji' }).success).toBe(false);
    expect(RegisterParameterBodySchema.safeParse({ ...base, riskClass: 'SECURITY' }).success).toBe(true);
  });

  it('query daftar: koersi boolean/angka, limit dibatasi, sortBy tertutup', () => {
    const q = SystemParameterListQuerySchema.safeParse({ includeInactive: 'true', page: '2', limit: '25', sortBy: 'version' });
    expect(q.success).toBe(true);
    if (q.success) expect(q.data).toMatchObject({ includeInactive: true, page: 2, limit: 25, sortBy: 'version' });
    expect(SystemParameterListQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
    expect(SystemParameterListQuerySchema.safeParse({ sortBy: 'parameter_value' }).success).toBe(false);
  });

  it('effective: 1..40 kunci, tanpa tenantId di query', () => {
    expect(EffectiveSettingsQuerySchema.safeParse({ keys: 'attendance.min_presence_pct,attendance.totp_window_steps' }).success).toBe(true);
    expect(EffectiveSettingsQuerySchema.safeParse({ keys: '' }).success).toBe(false);
    expect(EffectiveSettingsQuerySchema.safeParse({ keys: Array.from({ length: 41 }, (_, i) => `attendance.k${i}`).join(',') }).success).toBe(false);
    expect(EffectiveSettingsQuerySchema.safeParse({ keys: 'attendance.min_presence_pct', tenantId: 'x' }).success).toBe(false);
  });

  it('pola grant: kosakata verba/kelas tertutup dan efek whitelist', () => {
    const body = {
      patterns: [
        {
          parameterPattern: 'attendance.*',
          permissionCode: 'settings.param.view.technical',
          effect: 'ALLOW',
          minScope: 'TENANT',
          requiresMfa: false,
          requiresSecondApprover: false,
          note: 'operator IT membaca ambang teknis',
        },
      ],
      reason: 'memberi_view teknis ke operator',
    };
    expect(ParameterPatternBodySchema.safeParse(body).success).toBe(true);
    expect(ParameterPatternBodySchema.safeParse({ ...body, patterns: [{ ...body.patterns[0], effect: 'GRANT' }] }).success).toBe(false);
    expect(ParameterPatternBodySchema.safeParse({ ...body, patterns: [{ ...body.patterns[0], parameterPattern: 'Attendance.*' }] }).success).toBe(false);
  });
});

describe('proyeksi baca (`allowedActions`, `G-18`)', () => {
  it('hanya menerima verba yang dikenal server', () => {
    const view = {
      parameterKey: 'attendance.totp_window_steps',
      module: 'attendance',
      dataType: 'INT',
      unit: 'langkah',
      currentValue: '1',
      value: 1,
      defaultValue: '1',
      min: '0',
      max: '2',
      allowedValues: ['0', '1', '2'],
      effective: { from: null, to: null, appliesTo: {}, isEffectiveNow: true },
      riskClass: 'SECURITY',
      version: 1,
      isEditable: true,
      isActive: true,
      isSecret: false,
      requiresRestart: false,
      requiresSecondApprover: true,
      sourceOfTruth: 'PARAM',
      enumKind: null,
      enumOptions: null,
      description: 'jendela toleransi token',
      requestedBy: null,
      approvedBy: null,
      approvedAt: null,
      updatedAt: '2026-10-23T00:00:00.000Z',
      pendingValue: null,
      pendingApprovalId: null,
      updateDisabledReason: null,
      allowedActions: ['view', 'write', 'history', 'impact'],
      remedyHref: null,
      consumerCount: 1,
    };
    expect(SystemParameterViewSchema.safeParse(view).success).toBe(true);
    expect(SystemParameterViewSchema.safeParse({ ...view, allowedActions: ['view', 'delete-everything'] }).success).toBe(false);
  });
});