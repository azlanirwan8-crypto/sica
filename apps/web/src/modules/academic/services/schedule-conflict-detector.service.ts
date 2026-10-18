/**
 * Schedule Conflict Detector Service — SICA Academic Engine
 *
 * Detektor bentrok jadwal kuliah menggunakan pendekatan Interval Overlap Matrix.
 * Mendeteksi konflik berdasarkan 3 dimensi:
 * 1. Ruangan (Room Conflict) — dua kelas di ruang sama, waktu sama
 * 2. Dosen (Lecturer Conflict) — satu dosen mengajar dua kelas bersamaan
 * 3. Mahasiswa (Student Conflict) — satu mahasiswa mengambil dua kelas yang jadwalnya bentrok
 *
 * Algoritma: O(n log n) per hari menggunakan sweep line pada interval waktu.
 */

// =============================================================================
// Tipe Data
// =============================================================================

/** Representasi satu slot jadwal kelas */
export interface ScheduleSlot {
  /** ID jadwal (class_schedules.id) */
  readonly scheduleId: string;
  /** ID kelas (classes.id) */
  readonly classId: string;
  /** Nama kelas, e.g. 'Algoritma - Kelas A' */
  readonly className: string;
  /** ID ruangan (rooms.id), null jika online */
  readonly roomId: string | null;
  /** Kode ruangan, e.g. 'R.301' */
  readonly roomCode: string | null;
  /** Hari dalam minggu: 1=Senin ... 7=Minggu */
  readonly dayOfWeek: number;
  /** Waktu mulai dalam format 'HH:MM' (24h) */
  readonly startTime: string;
  /** Waktu selesai dalam format 'HH:MM' (24h) */
  readonly endTime: string;
  /** ID dosen pengampu (lecturer membership IDs) */
  readonly lecturerIds: ReadonlyArray<string>;
  /** ID mahasiswa yang terdaftar di kelas ini (untuk deteksi konflik mahasiswa) */
  readonly studentIds?: ReadonlyArray<string>;
  /** ID periode akademik */
  readonly periodId: string;
}

/** Jenis konflik jadwal */
export type ConflictType = 'ROOM' | 'LECTURER' | 'STUDENT';

/** Detail satu konflik jadwal */
export interface ScheduleConflict {
  /** Jenis konflik */
  readonly type: ConflictType;
  /** Jadwal pertama yang bentrok */
  readonly slotA: ScheduleSlot;
  /** Jadwal kedua yang bentrok */
  readonly slotB: ScheduleSlot;
  /** ID resource yang bentrok (roomId / lecturerId / studentId) */
  readonly conflictingResourceId: string;
  /** Label deskriptif untuk UI */
  readonly description: string;
  /** Hari bentrok (1-7) */
  readonly dayOfWeek: number;
  /** Rentang waktu overlap */
  readonly overlapStart: string;
  readonly overlapEnd: string;
}

/** Hasil deteksi bentrok keseluruhan */
export interface ConflictDetectionResult {
  /** Apakah ada konflik */
  readonly hasConflicts: boolean;
  /** Total konflik ditemukan */
  readonly totalConflicts: number;
  /** Daftar konflik per jenis */
  readonly roomConflicts: ReadonlyArray<ScheduleConflict>;
  readonly lecturerConflicts: ReadonlyArray<ScheduleConflict>;
  readonly studentConflicts: ReadonlyArray<ScheduleConflict>;
  /** Semua konflik gabungan */
  readonly allConflicts: ReadonlyArray<ScheduleConflict>;
}

// =============================================================================
// Utilitas Waktu
// =============================================================================

/** Label nama hari untuk pesan deskriptif */
const DAY_LABELS: Readonly<Record<number, string>> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

/**
 * Konversi waktu 'HH:MM' ke menit dari 00:00.
 * Contoh: '08:30' → 510, '14:00' → 840
 */
export function timeToMinutes(time: string): number {
  const parts = time.split(':');
  if (parts.length < 2) return 0;

  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);

  if (isNaN(hours) || isNaN(minutes)) return 0;

  return hours * 60 + minutes;
}

/**
 * Konversi menit ke format 'HH:MM'.
 * Contoh: 510 → '08:30', 840 → '14:00'
 */
export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Cek apakah dua interval waktu overlap.
 *
 * Dua interval [s1, e1) dan [s2, e2) overlap jika:
 *   s1 < e2 AND s2 < e1
 *
 * Interval bersifat half-open: start inclusive, end exclusive.
 * Contoh: [08:00, 09:40) dan [09:40, 11:20) TIDAK overlap.
 */
export function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && startB < endA;
}

/**
 * Hitung rentang overlap antara dua interval.
 * Asumsi: interval sudah diketahui overlap.
 */
export function getOverlapRange(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): { start: number; end: number } {
  return {
    start: Math.max(startA, startB),
    end: Math.min(endA, endB),
  };
}

/**
 * Mendapatkan label hari dari angka (1-7).
 */
function getDayLabel(day: number): string {
  return DAY_LABELS[day] ?? `Hari ${day}`;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Generic pairwise conflict checker pada sekelompok slot yang sudah dikelompokkan.
 * Menerima resourceId untuk menandai resource yang bentrok.
 */
function findPairwiseConflicts(
  group: ReadonlyArray<ScheduleSlot>,
  type: ConflictType,
  resourceId: string
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  if (group.length < 2) return conflicts;

  // Sort by start time untuk efisiensi early-exit
  const sorted = [...group].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  for (let i = 0; i < sorted.length; i++) {
    const slotA = sorted[i];
    if (!slotA) continue;

    const aStart = timeToMinutes(slotA.startTime);
    const aEnd = timeToMinutes(slotA.endTime);

    for (let j = i + 1; j < sorted.length; j++) {
      const slotB = sorted[j];
      if (!slotB) continue;

      const bStart = timeToMinutes(slotB.startTime);
      const bEnd = timeToMinutes(slotB.endTime);

      // Early exit: karena sorted, jika bStart >= aEnd, tidak mungkin overlap lagi
      if (bStart >= aEnd) break;

      if (slotA.classId !== slotB.classId && intervalsOverlap(aStart, aEnd, bStart, bEnd)) {
        const overlap = getOverlapRange(aStart, aEnd, bStart, bEnd);
        const typeLabel =
          type === 'ROOM'
            ? `Ruangan ${slotA.roomCode ?? slotA.roomId ?? resourceId}`
            : type === 'LECTURER'
              ? `Dosen (ID: ${resourceId})`
              : `Mahasiswa (ID: ${resourceId})`;

        conflicts.push({
          type,
          slotA,
          slotB,
          conflictingResourceId: resourceId,
          dayOfWeek: slotA.dayOfWeek,
          overlapStart: minutesToTime(overlap.start),
          overlapEnd: minutesToTime(overlap.end),
          description:
            `Bentrok ${typeLabel}: ` +
            `"${slotA.className}" vs "${slotB.className}" ` +
            `pada ${getDayLabel(slotA.dayOfWeek)} ` +
            `${minutesToTime(overlap.start)}-${minutesToTime(overlap.end)}`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Mendeteksi konflik ruangan: dua kelas berbeda di ruang yang sama, waktu bentrok.
 */
function detectRoomConflicts(slots: ReadonlyArray<ScheduleSlot>): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Kelompokkan per (dayOfWeek, roomId) — hanya jadwal yang punya ruangan
  const grouped = new Map<string, ScheduleSlot[]>();

  for (const slot of slots) {
    if (!slot.roomId) continue; // Skip online tanpa ruangan
    const key = `${slot.dayOfWeek}:${slot.roomId}`;
    const group = grouped.get(key);
    if (group) {
      group.push(slot);
    } else {
      grouped.set(key, [slot]);
    }
  }

  for (const [key, group] of grouped.entries()) {
    const roomId = key.split(':')[1] ?? '';
    conflicts.push(...findPairwiseConflicts(group, 'ROOM', roomId));
  }

  return conflicts;
}

/**
 * Mendeteksi konflik dosen: satu dosen mengajar di dua kelas berbeda waktu bersamaan.
 */
function detectLecturerConflicts(slots: ReadonlyArray<ScheduleSlot>): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Kelompokkan per (dayOfWeek, lecturerId)
  const grouped = new Map<string, ScheduleSlot[]>();

  for (const slot of slots) {
    for (const lecturerId of slot.lecturerIds) {
      const key = `${slot.dayOfWeek}:${lecturerId}`;
      const group = grouped.get(key);
      if (group) {
        group.push(slot);
      } else {
        grouped.set(key, [slot]);
      }
    }
  }

  for (const [key, group] of grouped.entries()) {
    const lecturerId = key.split(':')[1] ?? '';
    conflicts.push(...findPairwiseConflicts(group, 'LECTURER', lecturerId));
  }

  return conflicts;
}

/**
 * Mendeteksi konflik mahasiswa: satu mahasiswa terdaftar di dua kelas yang jadwalnya bentrok.
 * Hanya dijalankan jika studentIds tersedia pada ScheduleSlot.
 */
function detectStudentConflicts(slots: ReadonlyArray<ScheduleSlot>): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Filter slots yang memiliki data mahasiswa
  const slotsWithStudents = slots.filter(
    (s) => s.studentIds && s.studentIds.length > 0
  );
  if (slotsWithStudents.length < 2) return conflicts;

  // Kelompokkan per (dayOfWeek, studentId)
  const grouped = new Map<string, ScheduleSlot[]>();

  for (const slot of slotsWithStudents) {
    if (!slot.studentIds) continue;
    for (const studentId of slot.studentIds) {
      const key = `${slot.dayOfWeek}:${studentId}`;
      const group = grouped.get(key);
      if (group) {
        group.push(slot);
      } else {
        grouped.set(key, [slot]);
      }
    }
  }

  for (const [key, group] of grouped.entries()) {
    const studentId = key.split(':')[1] ?? '';
    conflicts.push(...findPairwiseConflicts(group, 'STUDENT', studentId));
  }

  return conflicts;
}

/**
 * Mendeteksi seluruh konflik jadwal dari kumpulan slot jadwal.
 *
 * Mendukung 3 jenis deteksi:
 * - Ruangan: otomatis jika slot memiliki roomId
 * - Dosen: otomatis jika slot memiliki lecturerIds
 * - Mahasiswa: opsional, hanya jika slot memiliki studentIds
 *
 * @param slots - Seluruh slot jadwal yang akan dicek (biasanya per periode akademik)
 * @param options - Opsi untuk mengaktifkan/menonaktifkan jenis deteksi
 * @returns ConflictDetectionResult
 */
export function detectAllConflicts(
  slots: ReadonlyArray<ScheduleSlot>,
  options: {
    checkRoom?: boolean;
    checkLecturer?: boolean;
    checkStudent?: boolean;
  } = {}
): ConflictDetectionResult {
  const {
    checkRoom = true,
    checkLecturer = true,
    checkStudent = true,
  } = options;

  const roomConflicts = checkRoom ? detectRoomConflicts(slots) : [];
  const lecturerConflicts = checkLecturer ? detectLecturerConflicts(slots) : [];
  const studentConflicts = checkStudent ? detectStudentConflicts(slots) : [];

  const allConflicts = [...roomConflicts, ...lecturerConflicts, ...studentConflicts];

  return {
    hasConflicts: allConflicts.length > 0,
    totalConflicts: allConflicts.length,
    roomConflicts,
    lecturerConflicts,
    studentConflicts,
    allConflicts,
  };
}

/**
 * Validasi apakah satu slot jadwal baru akan bentrok dengan jadwal existing.
 *
 * Berguna untuk validasi saat admin menambah atau mengubah jadwal kelas individual.
 *
 * @param newSlot - Slot jadwal baru yang akan divalidasi
 * @param existingSlots - Jadwal existing dalam periode yang sama
 * @returns ConflictDetectionResult khusus untuk slot baru
 */
export function validateNewSlot(
  newSlot: ScheduleSlot,
  existingSlots: ReadonlyArray<ScheduleSlot>
): ConflictDetectionResult {
  // Gabungkan slot baru dengan existing, lalu cek konflik
  const allSlots = [...existingSlots, newSlot];
  const result = detectAllConflicts(allSlots);

  // Filter hanya konflik yang melibatkan newSlot
  const relevantConflicts = result.allConflicts.filter(
    (c) =>
      c.slotA.scheduleId === newSlot.scheduleId ||
      c.slotB.scheduleId === newSlot.scheduleId
  );

  return {
    hasConflicts: relevantConflicts.length > 0,
    totalConflicts: relevantConflicts.length,
    roomConflicts: relevantConflicts.filter((c) => c.type === 'ROOM'),
    lecturerConflicts: relevantConflicts.filter((c) => c.type === 'LECTURER'),
    studentConflicts: relevantConflicts.filter((c) => c.type === 'STUDENT'),
    allConflicts: relevantConflicts,
  };
}
