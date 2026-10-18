/**
 * SKS Quota Validator Service — SICA Academic Engine
 *
 * Validator batas pengambilan SKS mahasiswa berdasarkan IPS semester sebelumnya.
 *
 * Referensi Business Rule:
 * - BR-R2: Mahasiswa semester 1-2 dibatasi maks SKS sesuai sksCapLowerSemesters prodi
 * - BR-A2: Mahasiswa semester 3+ mendapat kuota SKS berdasarkan IPS semester sebelumnya:
 *     • IPS ≥ 3.00 → 24 SKS (sksCapUpperSemesters)
 *     • IPS ≥ 2.50 → 21 SKS
 *     • IPS ≥ 2.00 → 18 SKS
 *     • IPS < 2.00 → 15 SKS (minimum)
 *   Batas atas & bawah dikonfigurasi per program studi di tabel study_programs
 * - BR-A3: Semester Antara (ANTAR) memiliki batas sendiri (sksCapBetweenTerm)
 * - BR-A4: Mahasiswa cuti (ON_LEAVE) tidak boleh mengambil mata kuliah
 */

// =============================================================================
// Tipe Data
// =============================================================================

/** Konfigurasi batas SKS dari program studi */
export interface ProgramSksConfig {
  /** Maks SKS untuk semester awal (1-2), default 20 */
  readonly sksCapLowerSemesters: number;
  /** Maks SKS untuk semester lanjut dengan IPS tinggi, default 24 */
  readonly sksCapUpperSemesters: number;
  /** Maks SKS untuk semester antara/pendek, default 9 */
  readonly sksCapBetweenTerm: number;
}

/** Informasi konteks mahasiswa untuk validasi kuota */
export interface StudentContext {
  /** Status mahasiswa (ACTIVE, ON_LEAVE, dll.) */
  readonly status: string;
  /** Semester berjalan (1-14) — dihitung dari entryYear */
  readonly currentSemester: number;
  /** IPS semester terakhir yang terisi (null jika semester 1) */
  readonly lastIps: number | null;
  /** Jenis term periode: GANJIL | GENAP | ANTAR */
  readonly periodTerm: string;
  /** SKS yang sudah diambil di periode ini (dari enrollment EFFECTIVE + APPROVED) */
  readonly currentPeriodSks: number;
}

/** Threshold IPS dan kuota SKS yang dihasilkan */
export interface IpsThreshold {
  /** Batas bawah IPS (inclusive) */
  readonly minIps: number;
  /** Kuota SKS maksimal */
  readonly maxSks: number;
  /** Label deskriptif */
  readonly label: string;
}

/** Hasil validasi kuota SKS */
export interface SksQuotaResult {
  /** Apakah validasi lulus */
  readonly isValid: boolean;
  /** Kuota SKS maksimal yang diperbolehkan */
  readonly maxAllowedSks: number;
  /** SKS yang sudah terpakai di periode ini */
  readonly usedSks: number;
  /** Sisa SKS yang tersedia */
  readonly remainingSks: number;
  /** Kode error jika validasi gagal */
  readonly errorCode: string | null;
  /** Pesan detail untuk UI */
  readonly message: string;
  /** Threshold IPS yang berlaku (null jika semester awal atau semester antara) */
  readonly appliedThreshold: IpsThreshold | null;
}

// =============================================================================
// Konstanta
// =============================================================================

/**
 * Tabel threshold IPS → Kuota SKS default.
 * Urut descending dari IPS tertinggi.
 * Nilai maxSks ini merupakan proporsi dari sksCapUpperSemesters prodi.
 */
const DEFAULT_IPS_THRESHOLDS: ReadonlyArray<IpsThreshold> = [
  { minIps: 3.0, maxSks: 24, label: 'IPS ≥ 3.00 → Kuota penuh' },
  { minIps: 2.5, maxSks: 21, label: 'IPS ≥ 2.50 → Kuota dikurangi' },
  { minIps: 2.0, maxSks: 18, label: 'IPS ≥ 2.00 → Kuota terbatas' },
  { minIps: 0.0, maxSks: 15, label: 'IPS < 2.00 → Kuota minimum' },
];

/** Batas semester yang dianggap "awal" (menggunakan sksCapLowerSemesters) */
const LOWER_SEMESTER_THRESHOLD = 2;

/** Status mahasiswa yang diperbolehkan mengambil KRS */
const ALLOWED_STUDENT_STATUSES: ReadonlySet<string> = new Set(['ACTIVE']);

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Menentukan kuota SKS maksimal berdasarkan IPS semester sebelumnya.
 *
 * Menggunakan interpolasi proporsional dari sksCapUpperSemesters prodi
 * terhadap tabel threshold default.
 *
 * @param ips - IPS semester sebelumnya
 * @param config - Konfigurasi SKS program studi
 * @returns IpsThreshold yang berlaku
 */
export function resolveIpsThreshold(
  ips: number,
  config: ProgramSksConfig
): IpsThreshold {
  // Proporsi berdasarkan cap atas prodi
  const ratio = config.sksCapUpperSemesters / 24;

  for (const threshold of DEFAULT_IPS_THRESHOLDS) {
    if (ips >= threshold.minIps) {
      return {
        minIps: threshold.minIps,
        maxSks: Math.floor(threshold.maxSks * ratio),
        label: threshold.label,
      };
    }
  }

  // Fallback: kuota minimum (last element selalu ada karena array konstanta)
  const lastIdx = DEFAULT_IPS_THRESHOLDS.length - 1;
  const fallback = DEFAULT_IPS_THRESHOLDS[lastIdx];
  if (fallback) {
    return {
      minIps: fallback.minIps,
      maxSks: Math.floor(fallback.maxSks * ratio),
      label: fallback.label,
    };
  }

  // Failsafe — seharusnya tidak pernah tercapai
  return { minIps: 0, maxSks: Math.floor(15 * ratio), label: 'Fallback minimum' };
}

/**
 * Validasi kuota SKS untuk pengambilan KRS mahasiswa.
 *
 * Alur validasi:
 * 1. Cek status mahasiswa → harus ACTIVE
 * 2. Tentukan jenis batas berdasarkan term dan semester
 * 3. Hitung sisa kuota
 * 4. Kembalikan hasil validasi
 *
 * @param student - Konteks mahasiswa
 * @param config - Konfigurasi SKS program studi
 * @param additionalSks - SKS baru yang hendak ditambahkan (default 0 = cek sisa saja)
 * @returns SksQuotaResult
 */
export function validateSksQuota(
  student: StudentContext,
  config: ProgramSksConfig,
  additionalSks: number = 0
): SksQuotaResult {
  // 1. Validasi status mahasiswa
  if (!ALLOWED_STUDENT_STATUSES.has(student.status)) {
    return {
      isValid: false,
      maxAllowedSks: 0,
      usedSks: student.currentPeriodSks,
      remainingSks: 0,
      errorCode: 'STUDENT_NOT_ACTIVE',
      message: `Mahasiswa dengan status "${student.status}" tidak diperbolehkan mengambil KRS.`,
      appliedThreshold: null,
    };
  }

  // 2. Tentukan batas SKS berdasarkan konteks
  let maxAllowed: number;
  let appliedThreshold: IpsThreshold | null = null;

  if (student.periodTerm === 'ANTAR') {
    // BR-A3: Semester Antara memiliki cap sendiri
    maxAllowed = config.sksCapBetweenTerm;
  } else if (student.currentSemester <= LOWER_SEMESTER_THRESHOLD) {
    // BR-R2: Semester 1-2 menggunakan cap bawah
    maxAllowed = config.sksCapLowerSemesters;
  } else if (student.lastIps === null) {
    // Belum ada IPS (edge case: mahasiswa transfer langsung semester 3+)
    // Gunakan cap bawah sebagai safe default
    maxAllowed = config.sksCapLowerSemesters;
  } else {
    // BR-A2: Semester 3+ berdasarkan IPS
    appliedThreshold = resolveIpsThreshold(student.lastIps, config);
    maxAllowed = appliedThreshold.maxSks;
  }

  // 3. Hitung sisa kuota
  const remaining = maxAllowed - student.currentPeriodSks;
  const afterAdding = student.currentPeriodSks + additionalSks;

  // 4. Validasi
  if (afterAdding > maxAllowed) {
    return {
      isValid: false,
      maxAllowedSks: maxAllowed,
      usedSks: student.currentPeriodSks,
      remainingSks: Math.max(0, remaining),
      errorCode: 'SKS_QUOTA_EXCEEDED',
      message:
        `Kuota SKS terlampaui. Maksimal ${maxAllowed} SKS, ` +
        `sudah terpakai ${student.currentPeriodSks} SKS, ` +
        `hendak menambah ${additionalSks} SKS (total ${afterAdding} SKS).`,
      appliedThreshold,
    };
  }

  return {
    isValid: true,
    maxAllowedSks: maxAllowed,
    usedSks: student.currentPeriodSks,
    remainingSks: remaining - additionalSks,
    errorCode: null,
    message: `Kuota SKS valid. Sisa ${remaining - additionalSks} dari ${maxAllowed} SKS.`,
    appliedThreshold,
  };
}

/**
 * Menghitung semester berjalan mahasiswa berdasarkan tahun masuk.
 *
 * Asumsi: satu tahun akademik = 2 semester reguler
 * (GANJIL dan GENAP, ANTAR tidak dihitung)
 *
 * @param entryYear - Tahun masuk mahasiswa (e.g. 2023)
 * @param currentPeriodYear - Tahun akademik periode sekarang (e.g. 2025)
 * @param currentTerm - Term periode sekarang: GANJIL | GENAP | ANTAR
 * @returns Semester berjalan (1-based)
 */
export function calculateCurrentSemester(
  entryYear: number,
  currentPeriodYear: number,
  currentTerm: string
): number {
  const yearDiff = currentPeriodYear - entryYear;

  if (yearDiff < 0) return 1;

  // Setiap tahun = 2 semester
  let semester = yearDiff * 2;

  // Semester ganjil = awal tahun akademik (+1), genap = +2
  if (currentTerm === 'GANJIL') {
    semester += 1;
  } else if (currentTerm === 'GENAP') {
    semester += 2;
  }
  // ANTAR tidak menambah hitungan semester, tapi tetap pakai semester sebelumnya
  if (currentTerm === 'ANTAR') {
    semester += 2; // Ikut semester genap karena antara ada setelah genap
  }

  return Math.max(1, semester);
}

/**
 * Validasi batch: cek apakah seluruh daftar mata kuliah bisa diambil bersamaan.
 *
 * Berguna untuk validasi saat submit KRS sekaligus banyak mata kuliah.
 *
 * @param student - Konteks mahasiswa
 * @param config - Konfigurasi SKS program studi
 * @param courseSksArray - Array SKS dari mata kuliah yang hendak diambil
 * @returns SksQuotaResult untuk keseluruhan batch
 */
export function validateBatchEnrollment(
  student: StudentContext,
  config: ProgramSksConfig,
  courseSksArray: ReadonlyArray<number>
): SksQuotaResult {
  const totalAdditionalSks = courseSksArray.reduce((sum, sks) => sum + sks, 0);
  return validateSksQuota(student, config, totalAdditionalSks);
}
