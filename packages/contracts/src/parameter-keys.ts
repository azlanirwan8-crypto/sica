/**
 * Registri kunci parameter sistem — sumber tunggal untuk seed, proyeksi dampak, dan
 * bukti konsumen (`AGENTS §3.10` gerbang (n), `API_SPEC §4.16.3` butir (3), `SPE-2`).
 *
 * Kenapa berkas ini ada dan bukan array opsi di layar: katalog kunci adalah **data
 * yang lahir lewat seed/register** (`§4.16.2`: "kunci baru tidak pernah dibuat lewat
 * `POST` bebas"), sedangkan nilai yang berlaku adalah baris `master_system_parameters`
 * milik tenant. Yang dibekukan di sini hanyalah *bentuk* kunci — tipe, satuan, rentang,
 * kelas risiko, rumah kebenaran, dan siapa pembaca nilainya. Nilai itu sendiri tidak
 * pernah dibaca dari berkas ini: resolver hanya pernah membaca tabel.
 *
 * Tiga hal yang diikat oleh registri ini:
 *  1. **Konsumen wajib ada.** `consumers` adalah call site nyata di branch ini. Kunci tanpa
 *     konsumen adalah "parameter hantu" — layar Admin menulis angka yang tidak dibaca
 *     siapa pun (`§4.16.7` butir 2), dan `register` (§4.16.4) menolaknya.
 *  2. **Plafon keamanan bukan preferensi.** Kunci ber-`allowedValues` memiliki `CHECK`
 *     yang sama di DB (`ck_param_security_floor`, `0088`). Transport menolak lebih dulu
 *     dengan pesan yang menjelaskan sebab; DB menolak selundupan. Keduanya diuji terpisah.
 *  3. **Baris penemuan menunjuk rumah yang benar.** Enam butir `DATA_MODEL §21.3` (nomor
 *     4, 13, 16, 17, 20, 21) ditolak menjadi pasangan kunci-nilai karena sudah punya
 *     tabel/aturan sendiri; barisnya tetap ada sebagai indeks penemuan
 *     (`source_of_truth <> 'PARAM'`, `is_editable = false`) dan `PUT` dijawab
 *     `403 PARAM_READONLY` (108) dengan `remedyHref` ke layar yang benar — bukan
 *     disimpan-then-ignored (`AC-PG-9`).
 */
import type { ModuleCode } from './entitlement';

// ── Kosakata kelas A: tertutup, tidak dapat disunting tenant (DATA_MODEL §21.2/§15) ──
export const PARAMETER_MODULE_CODES = [
  'attendance', 'krs', 'grading', 'feeder', 'finance', 'pmb', 'lms', 'platform',
  'conference', 'analytics', 'ai',
] as const;
export type ParameterModuleCode = (typeof PARAMETER_MODULE_CODES)[number];

export const PARAMETER_DATA_TYPES = [
  'STRING', 'REGEX', 'INT', 'DECIMAL', 'PCT', 'BP', 'SECONDS', 'METERS', 'BOOL',
  'JSON', 'DATE', 'TIME', 'CRON',
] as const;
export type ParameterDataType = (typeof PARAMETER_DATA_TYPES)[number];

export const PARAMETER_RISK_CLASSES = [
  'TECHNICAL', 'OPS', 'ACADEMIC', 'FINANCIAL', 'REGULATORY', 'SECURITY',
] as const;
export type ParameterRiskClass = (typeof PARAMETER_RISK_CLASSES)[number];

/** Rumah kebenaran. `ENV` ditolak `CHECK (source_of_truth <> 'ENV')` (`0049`). */
export const PARAMETER_SOURCES = [
  'PARAM', 'academic_rules', 'reference_items', 'tenant_custom_attributes', 'tenant_settings',
  'domain_table', 'ENV',
] as const;
export type ParameterSource = (typeof PARAMETER_SOURCES)[number];

/** Kelas yang menuntut penyetuju kedua — satu-satunya tempat aturan ini dituliskan. */
export const FOUR_EYES_RISK_CLASSES: ReadonlySet<ParameterRiskClass> = new Set(['REGULATORY', 'SECURITY']);

export function requiresSecondApprover(riskClass: ParameterRiskClass): boolean {
  return FOUR_EYES_RISK_CLASSES.has(riskClass);
}

/**
 * Peta prefiks kunci → modul entitlement (gerbang `§4.16.5`: "entitlement memotong lebih
 * dulu dari role"). `module_code` parameter adalah kosakata katalog, sedangkan
 * `tenant_modules.code` adalah kosakata entitlement — keduanya tidak identik dan peta ini
 * adalah satu-satunya tempat ketidaksamaan itu dinyatakan (`G-18`/`SPE-3` butir peta).
 */
export const PARAMETER_MODULE_TO_ENTITLEMENT: Readonly<Record<ParameterModuleCode, ModuleCode>> = {
  attendance: 'attendance',
  krs: 'enrollment',
  grading: 'assessment',
  feeder: 'feeder_pddikti',
  finance: 'finance',
  pmb: 'academic',
  lms: 'teaching',
  platform: 'identity',
  conference: 'teaching',
  analytics: 'academic',
  ai: 'academic',
};

/** Alamat layar tempat nilai sebenarnya dirawat, untuk `remedyHref` baris penemuan. */
export const PARAMETER_HOME_HREF: Readonly<Record<ParameterSource, string | null>> = {
  PARAM: null,
  academic_rules: '/academic/aturan',
  reference_items: '/master/kamus',
  tenant_custom_attributes: '/admin/atribut-kustom',
  tenant_settings: '/pengaturan/umum',
  domain_table: '/admin/data-master',
  ENV: null,
};

export interface ParameterConsumer {
  /** `file:symbol` — call site yang sudah ada di branch ini (SPE-7 butir e). */
  readonly callSite: string;
  /** Uji yang membaca nilai itu; wajib sebelum kunci dapat di-`register` lewat API. */
  readonly testRef: string;
}

export interface SystemParameterDefinition {
  readonly parameterKey: string;
  readonly moduleCode: ParameterModuleCode;
  readonly dataType: ParameterDataType;
  readonly unit: string | null;
  readonly defaultValue: string;
  readonly minValue: string | null;
  readonly maxValue: string | null;
  /** Himpunan sah yang juga ditegakkan `CHECK` DB; `null` = rentang bebas dalam min/max. */
  readonly allowedValues: readonly string[] | null;
  readonly enumKind: string | null;
  readonly riskClass: ParameterRiskClass;
  readonly sourceOfTruth: ParameterSource;
  readonly description: string;
  readonly consumers: readonly ParameterConsumer[];
}

const def = (d: SystemParameterDefinition): SystemParameterDefinition => d;

/**
 * Katalog §21.3 — baris `PARAM` yang nilainya benar-benar dibaca mesin.
 * `description` wajib menyebut efek bila diubah (`DATA_MODEL §21.2`), karena layar
 * tidak punya tempat lain untuk menjelaskan "kenapa angka ini penting".
 */
export const SYSTEM_PARAMETER_CATALOG: readonly SystemParameterDefinition[] = [
  def({
    parameterKey: 'attendance.min_presence_pct', moduleCode: 'attendance', dataType: 'PCT', unit: '%',
    defaultValue: '75', minValue: '0', maxValue: '100', allowedValues: null, enumKind: null,
    riskClass: 'ACADEMIC', sourceOfTruth: 'PARAM',
    description:
      'Ambang kehadiran minimum yang dipakaikan pada kartu dashboard mahasiswa (nilai di bawah ambang tampil sebagai peringatan). Menurunkannya melonggarkan tampilan syarat ikut ujian; menaikkannya dapat memblokir mahasiswa yang sedang berjalan. Vonis yudisium belum membacanya — mesin itu belum dibangun.',
    consumers: [
      { callSite: 'apps/web/src/modules/academic/services/dashboard.service.ts:loadDashboard', testRef: 'apps/web/tests/unit/parameter-consumers.test.ts' },
    ],
  }),
  def({
    parameterKey: 'attendance.totp_rotate_seconds', moduleCode: 'attendance', dataType: 'SECONDS', unit: 's',
    defaultValue: '5', minValue: '5', maxValue: '30', allowedValues: ['5', '10', '15'], enumKind: null,
    riskClass: 'SECURITY', sourceOfTruth: 'PARAM',
    description:
      'Periode rotasi token Tantangan QR presensi. Hanya 5/10/15 detik yang sah (CHECK `ck_param_security_floor`, 0088): memperbesar nilai membuat mahasiswa lebih sering kehilangan jendela scan, menurunkannya di bawah 5 membuka celah replay. Nilai di luar himpunan ditolak transport DAN database.',
    consumers: [
      { callSite: 'apps/web/src/app/api/v1/attendance/qr/generate/route.ts:POST', testRef: 'apps/web/tests/unit/parameter-consumers.test.ts' },
    ],
  }),
  def({
    parameterKey: 'attendance.totp_window_steps', moduleCode: 'attendance', dataType: 'INT', unit: 'langkah',
    defaultValue: '1', minValue: '0', maxValue: '2', allowedValues: ['0', '1', '2'], enumKind: null,
    riskClass: 'SECURITY', sourceOfTruth: 'PARAM',
    description:
      'Lebar jendela langkah token yang masih diterima saat verifikasi (0 = hanya langkah berjalan). Menaikkannya menoleransi perangkat dengan jam menyimpang tetapi memperlebar jendela pemalsuan; CHECK DB menutup 0..2.',
    consumers: [
      { callSite: 'apps/web/src/app/api/v1/attendance/qr/scan/route.ts:POST', testRef: 'apps/web/tests/unit/parameter-consumers.test.ts' },
    ],
  }),
  def({
    parameterKey: 'attendance.geofence_default_radius_m', moduleCode: 'attendance', dataType: 'METERS', unit: 'm',
    defaultValue: '50', minValue: '10', maxValue: '500', allowedValues: null, enumKind: null,
    riskClass: 'SECURITY', sourceOfTruth: 'PARAM',
    description:
      'Radius presensi baku (meter) tenant. Pada penerbitan tantangan ia menjadi plafon bagi radius kiriman dosen; pada verifikasi ia memotong radius yang terbawa di token QR. Semakin besar radius, semakin longgar bukti lokasi; plafon 500 m dijaga CHECK sehingga satu klik tidak dapat mengubah presensi menjadi absen massal.',
    consumers: [
      { callSite: 'apps/web/src/app/api/v1/attendance/qr/generate/route.ts:POST', testRef: 'apps/web/tests/unit/parameter-consumers.test.ts' },
      { callSite: 'apps/web/src/app/api/v1/attendance/qr/scan/route.ts:POST', testRef: 'apps/web/tests/unit/parameter-consumers.test.ts' },
    ],
  }),
  def({
    parameterKey: 'attendance.gps_max_accuracy_m', moduleCode: 'attendance', dataType: 'METERS', unit: 'm',
    defaultValue: '100', minValue: '5', maxValue: '200', allowedValues: null, enumKind: null,
    riskClass: 'SECURITY', sourceOfTruth: 'PARAM',
    description:
      'Akurasi GPS maksimum yang masih diterima sebagai bukti, dan dikurangkan dari jarak pada vonis `jarak − akurasi ≤ radius`. Menaikkannya berarti lokasi yang tidak pasti dianggap hadir; menurunkannya menolak lebih banyak pembacaan sah di dalam gedung.',
    consumers: [
      { callSite: 'apps/web/src/app/api/v1/attendance/qr/scan/route.ts:POST', testRef: 'apps/web/tests/unit/parameter-consumers.test.ts' },
    ],
  }),
];

/**
 * Katalog §21.3 yang BELUM terpasang — dinyatakan, bukan disembunyikan.
 *
 * Bukan kegagalan layanan: namanya sudah dipetakan dan nilainya siap dibaca begitu konsumen
 * modulnya lahir (vonis hadir M-18, rekonsiliasi §21.5, kanal vicon design-only, peta sesi,
 * cicilan BAUK, engine anomali). Yang tidak boleh terjadi adalah menseed barisnya hari ini:
 * layar Admin lalu menulis angka yang tidak dibaca siapa pun — itu persis "parameter hantu"
 * yang ditolak `API_SPEC §4.16.7` butir 2. Tiap entri karena itu membawa alasan yang dapat
 * ditagih, dan uji katalog (`apps/web/tests/unit/parameter-consumers.test.ts`) menolak entri
 * deferred tanpa alasan.
 */
export interface DeferredParameter {
  readonly parameterKey: string;
  readonly moduleCode: ParameterModuleCode;
  readonly riskClass: ParameterRiskClass;
  readonly reason: string;
}

export const SYSTEM_PARAMETER_DEFERRED: readonly DeferredParameter[] = [
  { parameterKey: 'attendance.online_min_join_ratio', moduleCode: 'attendance', riskClass: 'ACADEMIC', reason: 'vonis hadir-daring dihitung engine penentu presensi (M-18) yang belum dibangun' },
  { parameterKey: 'attendance.async_min_watch_ratio', moduleCode: 'attendance', riskClass: 'ACADEMIC', reason: 'RD-72: rujukan INTEGRATIONS §5.7/§6.7 ada, konsumennya belum' },
  { parameterKey: 'attendance.multi_source_policy', moduleCode: 'attendance', riskClass: 'ACADEMIC', reason: 'rekonsiliasi dua sumber bukti (§21.5) belum punya mesin; kamus kebijakan_rekonsiliasi ikut ditunda' },
  { parameterKey: 'krs.withdraw_window_hours', moduleCode: 'krs', riskClass: 'ACADEMIC', reason: 'jendela pembatalan KRS hari ini dibaca dari academic_rules per periode; pemisahan ambang non-akademik belum diminta kampus' },
  { parameterKey: 'krs.war_lease_ttl_s', moduleCode: 'krs', riskClass: 'TECHNICAL', reason: 'lease KRS masih pg_advisory_xact_lock (pengecualian berjangka RD-11/P-6); kunci ini baru bermakna saat antrean Redis-Lua terpasang' },
  { parameterKey: 'finance.webhook_reconcile_timeout_s', moduleCode: 'finance', riskClass: 'TECHNICAL', reason: 'rute webhook kanal pembayaran belum ada (gugus BAUK 0022 belum dimigrasikan)' },
  { parameterKey: 'finance.webhook_max_clock_skew_s', moduleCode: 'finance', riskClass: 'TECHNICAL', reason: 'penjaga skew hidup di jalur webhook yang sama; menolak memasangnya sebelum pemanggilnya ada' },
  { parameterKey: 'finance.installment_max_terms', moduleCode: 'finance', riskClass: 'FINANCIAL', reason: 'payment_plans belum punya rute tulis; plafon termin tidak dibaca siapa pun' },
  { parameterKey: 'conference.default_provider', moduleCode: 'conference', riskClass: 'TECHNICAL', reason: 'kanal vicon (PRD §5.15) masih design-only; enum conference_provider sudah ada di 0073 tetapi tidak ada pembacanya' },
  { parameterKey: 'conference.fallback_chain', moduleCode: 'conference', riskClass: 'TECHNICAL', reason: 'rantai fallback menuntut resolver kanal yang belum terpasang' },
  { parameterKey: 'conference.attendance_source_priority', moduleCode: 'conference', riskClass: 'ACADEMIC', reason: 'VENDOR_ONLY menuntut gerbang §21.6 butir 3 yang belum punya pemanggil' },
  { parameterKey: 'conference.evidence_max_age_hours', moduleCode: 'conference', riskClass: 'TECHNICAL', reason: 'attendance_evidence (0075) belum ditulis siapa pun' },
  { parameterKey: 'analytics.map.enabled', moduleCode: 'analytics', riskClass: 'OPS', reason: 'widget peta sesi (§24) belum dibangun; GEOIP_DB_PATH belum terdaftar di ENV_CONTRACT' },
  { parameterKey: 'analytics.session.active_window_s', moduleCode: 'analytics', riskClass: 'OPS', reason: 'indikator beban sesi membaca store Redis yang belum ada (RD-11)' },
  { parameterKey: 'analytics.map.ip_retention_days', moduleCode: 'analytics', riskClass: 'REGULATORY', reason: 'session_geo_facts (0078) belum dimigrasikan, jadi retensi belum dapat ditegakkan' },
  { parameterKey: 'analytics.map.geo_source_priority', moduleCode: 'analytics', riskClass: 'OPS', reason: 'sumber geolokasi ganda belum ada untuk diprioritaskan' },
  { parameterKey: 'ai.anomaly.contamination_bp', moduleCode: 'ai', riskClass: 'TECHNICAL', reason: 'deteksi menyimpang (ALG-14, anomaly_domain_settings 0081) belum terpasang' },
  { parameterKey: 'ai.anomaly.min_score_bp', moduleCode: 'ai', riskClass: 'TECHNICAL', reason: 'kartu pemeriksa anomali belum dirender' },
  { parameterKey: 'ai.anomaly.enabled_domains', moduleCode: 'ai', riskClass: 'SECURITY', reason: 'menyalakan domain = mengaktifkan pengawasan atas orang; menuntut konsumen nyata sebelum empat-mata punya arti' },
];

export const WIRED_PARAMETER_KEYS: readonly string[] = SYSTEM_PARAMETER_CATALOG.map((d) => d.parameterKey);
export const DEFERRED_PARAMETER_KEYS: readonly string[] = SYSTEM_PARAMETER_DEFERRED.map((d) => d.parameterKey);

/**
 * Baris penemuan (§21.3 butir yang ditolak menjadi key-value + contoh kamus).
 * Nilainya TIDAK PERNAH dibaca dari baris ini — `currentValue` diproyeksikan `null`
 * dan setiap tulis dijawab `403 PARAM_READONLY` dengan `remedyHref`.
 */
export const SYSTEM_PARAMETER_POINTERS: readonly SystemParameterDefinition[] = [
  def({
    parameterKey: 'krs.sks_band_by_ipk', moduleCode: 'krs', dataType: 'INT', unit: null,
    defaultValue: '', minValue: null, maxValue: null, allowedValues: null, enumKind: null,
    riskClass: 'REGULATORY', sourceOfTruth: 'academic_rules',
    description:
      'Indeks penemuan saja. Band SKS per IPK adalah aturan berversi ber-scope prodi × periode di `academic_rules`; ia tidak dapat disunting sebagai pasangan kunci-nilai karena setiap band punya riwayat transisi dan uji sendiri (BR-PG1, AC-PG-9).',
    consumers: [{ callSite: 'docs/DATA_MODEL.md §21.3 butir 4', testRef: 'apps/web/tests/unit/system-parameter-guards.test.ts' }],
  }),
  def({
    parameterKey: 'grading.scale_bands', moduleCode: 'grading', dataType: 'DECIMAL', unit: null,
    defaultValue: '', minValue: null, maxValue: null, allowedValues: null, enumKind: null,
    riskClass: 'REGULATORY', sourceOfTruth: 'academic_rules',
    description:
      'Indeks penemuan saja. Skala dan konversi nilai mutu hidup di `grade_scales` + `grade_scale_bands` (rentang `int4range` NOT OVERLAPS) — struktural, bukan key-value.',
    consumers: [{ callSite: 'docs/DATA_MODEL.md §21.3 butir 13', testRef: 'apps/web/tests/unit/system-parameter-guards.test.ts' }],
  }),
  def({
    parameterKey: 'finance.fee_components', moduleCode: 'finance', dataType: 'DECIMAL', unit: 'IDR',
    defaultValue: '', minValue: null, maxValue: null, allowedValues: null, enumKind: null,
    riskClass: 'FINANCIAL', sourceOfTruth: 'domain_table',
    description:
      'Indeks penemuan saja. Komponen biaya punya `gl_account_code` dan tarif per kelompok di `fee_tariff_groups` (0046); memindahkannya ke parameter menciptakan dua sumber kebenaran (pola RD-32).',
    consumers: [{ callSite: 'docs/DATA_MODEL.md §21.3 butir 16', testRef: 'apps/web/tests/unit/system-parameter-guards.test.ts' }],
  }),
  def({
    parameterKey: 'finance.discount_scheme', moduleCode: 'finance', dataType: 'PCT', unit: '%',
    defaultValue: '', minValue: null, maxValue: null, allowedValues: null, enumKind: null,
    riskClass: 'FINANCIAL', sourceOfTruth: 'domain_table',
    description:
      'Indeks penemuan saja. Skema potongan/beasiswa hidup di `tuition_discounts` + `payment_waivers` (0015) dengan alur empat-mata sendiri; nominal tidak pernah lewat parameter (BR-PG1).',
    consumers: [{ callSite: 'docs/DATA_MODEL.md §21.3 butir 17', testRef: 'apps/web/tests/unit/system-parameter-guards.test.ts' }],
  }),
  def({
    parameterKey: 'finance.payment_channels', moduleCode: 'finance', dataType: 'STRING', unit: null,
    defaultValue: '', minValue: null, maxValue: null, allowedValues: null, enumKind: null,
    riskClass: 'FINANCIAL', sourceOfTruth: 'domain_table',
    description:
      'Indeks penemuan saja. Kanal pembayaran & Virtual Account adalah baris `payment_channels`/`virtual_accounts` (0022); kredensial kanal tidak pernah masuk DB maupun parameter (`is_secret = false`).',
    consumers: [{ callSite: 'docs/DATA_MODEL.md §21.3 butir 20', testRef: 'apps/web/tests/unit/system-parameter-guards.test.ts' }],
  }),
  def({
    parameterKey: 'pmb.nim_pattern', moduleCode: 'pmb', dataType: 'REGEX', unit: null,
    defaultValue: '', minValue: null, maxValue: null, allowedValues: null, enumKind: null,
    riskClass: 'REGULATORY', sourceOfTruth: 'tenant_settings',
    description:
      'Indeks penemuan saja. Pola NIM tersimpan di `tenant_settings.nim_format` dan dipakai generator ALG-18; mengubahnya di sini tidak akan pernah mengubah NIM yang dihasilkan (§21.3 butir 21).',
    consumers: [{ callSite: 'docs/DATA_MODEL.md §21.3 butir 21', testRef: 'apps/web/tests/unit/system-parameter-guards.test.ts' }],
  }),
  def({
    parameterKey: 'pmb.garment_sizes', moduleCode: 'pmb', dataType: 'STRING', unit: null,
    defaultValue: '', minValue: null, maxValue: null, allowedValues: null, enumKind: 'ukuran_baju',
    riskClass: 'OPS', sourceOfTruth: 'reference_items',
    description:
      'Indeks penemuan saja. Daftar ukuran baju almamater adalah kamus `reference_items(kind=ukuran_baju)` yang dapat dirawat kampus per butir, bukan satu string pada parameter (§21.3 butir 7).',
    consumers: [{ callSite: 'docs/DATA_MODEL.md §21.3 butir 7', testRef: 'apps/web/tests/unit/system-parameter-guards.test.ts' }],
  }),
];

export const ALL_SYSTEM_PARAMETER_DEFINITIONS: readonly SystemParameterDefinition[] = [
  ...SYSTEM_PARAMETER_CATALOG,
  ...SYSTEM_PARAMETER_POINTERS,
];

const DEFINITION_BY_KEY = new Map(ALL_SYSTEM_PARAMETER_DEFINITIONS.map((d) => [d.parameterKey, d]));

export function findParameterDefinition(key: string): SystemParameterDefinition | null {
  return DEFINITION_BY_KEY.get(key) ?? null;
}

/** Kunci yang memiliki konsumen statis terdaftar — dasar proyeksi `impact` (§4.16.3). */
export function parameterImpactOf(key: string): readonly ParameterConsumer[] {
  return DEFINITION_BY_KEY.get(key)?.consumers ?? [];
}

/** Kunci dengan `CHECK` himpunan sah di DB (`ck_param_security_floor`, 0088). */
export const DB_ENFORCED_ALLOWED_KEYS: ReadonlySet<string> = new Set(
  ['attendance.totp_rotate_seconds', 'attendance.totp_window_steps']
);

/**
 * Item kamus yang dibutuhkan katalog ini supaya FK `enum_kind` (`0049`) sah dan penjaga
 * `PARAM_ENUM_UNKNOWN` (§4.16.2 langkah 5) punya sasaran.
 *
 * Ini sebagian dari `MDE-11`: butir datanya didaftarkan (kelas C — `reference_items`
 * per-tenant), tetapi layar perawatannya tetap milik gugus `MDE-*`. Kode + label hidup di
 * SATU tempat: tidak ada daftar kode kedua yang bisa melenceng dari labelnya.
 */
export interface ParameterEnumSeedEntry {
  readonly code: string;
  readonly label: string;
  readonly labelEn: string;
  readonly order: number;
}

export interface ParameterEnumSeedKind {
  /** Nilai enum `reference_domain` (`0007`) — kelas A, tidak dapat ditambah tenant. */
  readonly domain: 'BIODATA' | 'AKADEMIK' | 'PEKULIAHAN' | 'KEPEGAWAIAN' | 'WILAYAH' | 'KEUANGAN' | 'KEMAHASISWAAN';
  readonly entries: readonly ParameterEnumSeedEntry[];
}

export const PARAMETER_ENUM_SEEDS: Readonly<Record<string, ParameterEnumSeedKind>> = {
  // `kebijakan_rekonsiliasi` sengaja BELUM ada di sini: kind kamus hanya didaftarkan bersama
  // kunci yang membacanya (`attendance.multi_source_policy`, kini tertunda bersama mesin
  // rekonsiliasi §21.5). Kind tanpa pemakai = kamus mati, dan itu persis yang ditolak
  // `AGENTS §3.10` gerbang (n) — uji `nol kind mati` menegakkannya.
  ukuran_baju: {
    domain: 'KEMAHASISWAAN',
    entries: [
      { code: 'S', label: 'S', labelEn: 'S', order: 10 },
      { code: 'M', label: 'M', labelEn: 'M', order: 20 },
      { code: 'L', label: 'L', labelEn: 'L', order: 30 },
      { code: 'XL', label: 'XL', labelEn: 'XL', order: 40 },
      { code: 'XXL', label: 'XXL', labelEn: 'XXL', order: 50 },
      { code: 'CUSTOM', label: 'Ukuran khusus (isi manual)', labelEn: 'Custom size (free text)', order: 60 },
    ],
  },
};

/** Kode sah per kind — diturunkan dari registri di atas, tidak pernah ditulis ulang. */
export function parameterEnumCodesOf(kind: string): readonly string[] {
  return (PARAMETER_ENUM_SEEDS[kind]?.entries ?? []).map((e) => e.code);
}

