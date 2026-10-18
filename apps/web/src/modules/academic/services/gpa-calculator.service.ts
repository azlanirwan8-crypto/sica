/**
 * GPA Calculator Service — SICA Academic Engine
 *
 * Kalkulator IPK (Indeks Prestasi Kumulatif) dan IPS (Indeks Prestasi Semester)
 * menggunakan pembulatan deterministik half-up ke 2 desimal.
 *
 * Referensi Business Rule:
 * - BR-A1: IPK = Σ(SKS × Bobot Huruf) / Σ SKS yang diambil (exclude status WITHDRAWN/CANCELLED)
 * - BR-A2: IPS dihitung sama seperti IPK tetapi hanya untuk satu periode akademik
 * - Pembulatan: Half-Up ke 2 desimal (2.345 → 2.35, 2.344 → 2.34)
 */

// =============================================================================
// Tipe Data
// =============================================================================

/** Representasi satu mata kuliah yang diambil mahasiswa */
export interface GradeEntry {
  /** ID enrollment untuk tracing */
  readonly enrollmentId: string;
  /** ID mata kuliah */
  readonly courseId: string;
  /** Kode mata kuliah, e.g. 'IF-101' */
  readonly courseCode: string;
  /** Nama mata kuliah */
  readonly courseName: string;
  /** Jumlah SKS mata kuliah */
  readonly sks: number;
  /** Huruf mutu: A, B+, B, C+, C, D, E */
  readonly letterCode: string | null;
  /** Bobot angka mutu: 4.00, 3.50, 3.00, dst. */
  readonly pointValue: number | null;
  /** Apakah grade ini termasuk lulus (isPassing dari grade_scale_bands) */
  readonly isPassing: boolean;
  /** ID periode akademik */
  readonly periodId: string;
  /** Status enrollment: hanya EFFECTIVE yang dihitung */
  readonly enrollmentStatus: string;
}

/** Hasil kalkulasi IPS satu periode */
export interface SemesterGpaResult {
  /** ID periode akademik */
  readonly periodId: string;
  /** IPS (Indeks Prestasi Semester) — pembulatan half-up 2 desimal */
  readonly ips: number;
  /** Total SKS yang diambil di semester ini (termasuk tidak lulus) */
  readonly totalSks: number;
  /** Total SKS yang lulus */
  readonly passedSks: number;
  /** Jumlah mata kuliah yang diambil */
  readonly courseCount: number;
  /** Jumlah mata kuliah yang lulus */
  readonly passedCourseCount: number;
  /** Detail per mata kuliah */
  readonly entries: ReadonlyArray<GradeEntry>;
}

/** Hasil kalkulasi IPK kumulatif */
export interface CumulativeGpaResult {
  /** IPK (Indeks Prestasi Kumulatif) — pembulatan half-up 2 desimal */
  readonly ipk: number;
  /** Total seluruh SKS yang diambil (kumulatif semua periode) */
  readonly totalSks: number;
  /** Total SKS yang lulus (kumulatif) */
  readonly passedSks: number;
  /** Total mata kuliah yang diambil */
  readonly totalCourseCount: number;
  /** Total mata kuliah yang lulus */
  readonly passedCourseCount: number;
  /** Hasil per semester */
  readonly semesters: ReadonlyArray<SemesterGpaResult>;
}

// =============================================================================
// Konstanta
// =============================================================================

/** Presisi desimal untuk pembulatan IPK/IPS */
const GPA_DECIMAL_PRECISION = 2;

/** Status enrollment yang diikutsertakan dalam kalkulasi */
const ELIGIBLE_ENROLLMENT_STATUSES: ReadonlySet<string> = new Set([
  'EFFECTIVE',
]);

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Pembulatan Half-Up deterministik ke `precision` desimal.
 *
 * Half-Up: jika digit tepat di tengah (e.g. 2.345), dibulatkan ke atas (2.35).
 * Ini berbeda dari JavaScript `Math.round` yang menggunakan banker's rounding pada kasus tertentu.
 *
 * Implementasi menggunakan teknik "multiply → floor → divide" untuk menghindari
 * floating point imprecision dari `toFixed()`.
 *
 * @param value - Angka yang akan dibulatkan
 * @param precision - Jumlah digit desimal (default: 2)
 * @returns Angka yang sudah dibulatkan
 */
export function roundHalfUp(value: number, precision: number = GPA_DECIMAL_PRECISION): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const multiplier = Math.pow(10, precision);

  // Menggunakan epsilon correction untuk menghindari floating point edge cases
  // Contoh: 1.255 * 100 = 125.49999... tanpa koreksi → 125 (salah, seharusnya 126)
  const corrected = value * multiplier + Number.EPSILON;

  return Math.floor(corrected + 0.5) / multiplier;
}

/**
 * Memfilter hanya grade entries yang eligible untuk kalkulasi GPA.
 * - Enrollment status harus 'EFFECTIVE'
 * - pointValue harus ada (bukan null) — grade belum diinput diabaikan
 * - SKS harus > 0
 */
export function filterEligibleEntries(entries: ReadonlyArray<GradeEntry>): GradeEntry[] {
  return entries.filter(
    (entry) =>
      ELIGIBLE_ENROLLMENT_STATUSES.has(entry.enrollmentStatus) &&
      entry.pointValue !== null &&
      entry.sks > 0
  );
}

/**
 * Menghitung IPS (Indeks Prestasi Semester) untuk satu periode akademik.
 *
 * Formula: IPS = Σ(SKS_i × PointValue_i) / Σ SKS_i
 * Pembulatan: Half-Up 2 desimal
 *
 * @param entries - Seluruh grade entries mahasiswa untuk satu periode
 * @param periodId - ID periode akademik yang dihitung
 * @returns Objek SemesterGpaResult
 */
export function calculateIps(
  entries: ReadonlyArray<GradeEntry>,
  periodId: string
): SemesterGpaResult {
  // Filter entries khusus periode ini
  const periodEntries = entries.filter((e) => e.periodId === periodId);
  const eligible = filterEligibleEntries(periodEntries);

  if (eligible.length === 0) {
    return {
      periodId,
      ips: 0,
      totalSks: 0,
      passedSks: 0,
      courseCount: periodEntries.length,
      passedCourseCount: 0,
      entries: periodEntries,
    };
  }

  let totalWeighted = 0;
  let totalSks = 0;
  let passedSks = 0;
  let passedCourseCount = 0;

  for (const entry of eligible) {
    const sks = entry.sks;
    // pointValue dijamin non-null setelah filterEligibleEntries
    const point = entry.pointValue as number;

    totalWeighted += sks * point;
    totalSks += sks;

    if (entry.isPassing) {
      passedSks += sks;
      passedCourseCount++;
    }
  }

  const ips = totalSks > 0 ? roundHalfUp(totalWeighted / totalSks) : 0;

  return {
    periodId,
    ips,
    totalSks,
    passedSks,
    courseCount: eligible.length,
    passedCourseCount,
    entries: periodEntries,
  };
}

/**
 * Menghitung IPK (Indeks Prestasi Kumulatif) dari seluruh periode.
 *
 * Formula: IPK = Σ(SKS_i × PointValue_i) / Σ SKS_i (semua periode)
 * Pembulatan: Half-Up 2 desimal
 *
 * Jika mahasiswa mengulang mata kuliah yang sama, KEDUA enrollment dihitung
 * (sesuai kebijakan umum perguruan tinggi Indonesia). Jika institusi menerapkan
 * kebijakan "ambil nilai terbaik", preprocessing harus dilakukan di caller.
 *
 * @param entries - Seluruh grade entries mahasiswa lintas semua periode
 * @returns Objek CumulativeGpaResult
 */
export function calculateIpk(
  entries: ReadonlyArray<GradeEntry>
): CumulativeGpaResult {
  // Kumpulkan semua periodId unik
  const periodIds = [...new Set(entries.map((e) => e.periodId))];

  // Hitung IPS per semester
  const semesters = periodIds.map((pid) => calculateIps(entries, pid));

  // Hitung kumulatif dari seluruh eligible entries
  const allEligible = filterEligibleEntries(entries);

  if (allEligible.length === 0) {
    return {
      ipk: 0,
      totalSks: 0,
      passedSks: 0,
      totalCourseCount: entries.length,
      passedCourseCount: 0,
      semesters,
    };
  }

  let totalWeighted = 0;
  let totalSks = 0;
  let passedSks = 0;
  let passedCourseCount = 0;

  for (const entry of allEligible) {
    const sks = entry.sks;
    const point = entry.pointValue as number;

    totalWeighted += sks * point;
    totalSks += sks;

    if (entry.isPassing) {
      passedSks += sks;
      passedCourseCount++;
    }
  }

  const ipk = totalSks > 0 ? roundHalfUp(totalWeighted / totalSks) : 0;

  return {
    ipk,
    totalSks,
    passedSks,
    totalCourseCount: allEligible.length,
    passedCourseCount,
    semesters,
  };
}

/**
 * Mendapatkan predikat kelulusan berdasarkan IPK.
 *
 * Referensi: Aturan umum perguruan tinggi Indonesia
 * - IPK ≥ 3.50 → "Dengan Pujian" (Cum Laude)
 * - IPK ≥ 3.00 → "Sangat Memuaskan"
 * - IPK ≥ 2.50 → "Memuaskan"
 * - IPK ≥ 2.00 → "Cukup"
 * - IPK < 2.00 → "Belum Memenuhi"
 *
 * @param ipk - Indeks Prestasi Kumulatif
 * @returns Object berisi kode dan label predikat
 */
export function getGraduationPredicate(ipk: number): {
  code: string;
  labelId: string;
  labelEn: string;
} {
  if (ipk >= 3.5) {
    return { code: 'CUM_LAUDE', labelId: 'Dengan Pujian', labelEn: 'With Honors (Cum Laude)' };
  }
  if (ipk >= 3.0) {
    return { code: 'VERY_SATISFACTORY', labelId: 'Sangat Memuaskan', labelEn: 'Very Satisfactory' };
  }
  if (ipk >= 2.5) {
    return { code: 'SATISFACTORY', labelId: 'Memuaskan', labelEn: 'Satisfactory' };
  }
  if (ipk >= 2.0) {
    return { code: 'SUFFICIENT', labelId: 'Cukup', labelEn: 'Sufficient' };
  }
  return { code: 'INSUFFICIENT', labelId: 'Belum Memenuhi', labelEn: 'Insufficient' };
}

/**
 * Konversi skor mentah (0-100) menjadi huruf mutu berdasarkan skala band.
 *
 * Band harus sudah diurutkan dari minScore tertinggi ke terendah.
 * Pencocokan menggunakan ≥ (greater than or equal).
 *
 * @param rawScore - Skor mentah 0-100
 * @param bands - Array band skala penilaian, terurut minScore descending
 * @returns Object berisi letterCode dan pointValue, atau null jika tidak cocok
 */
export function resolveLetterGrade(
  rawScore: number,
  bands: ReadonlyArray<{
    readonly minScore: number;
    readonly letterCode: string;
    readonly pointValue: number;
    readonly isPassing: boolean;
  }>
): { letterCode: string; pointValue: number; isPassing: boolean } | null {
  // Pastikan bands terurut descending berdasarkan minScore
  const sorted = [...bands].sort((a, b) => b.minScore - a.minScore);

  for (const band of sorted) {
    if (rawScore >= band.minScore) {
      return {
        letterCode: band.letterCode,
        pointValue: band.pointValue,
        isPassing: band.isPassing,
      };
    }
  }

  return null;
}
