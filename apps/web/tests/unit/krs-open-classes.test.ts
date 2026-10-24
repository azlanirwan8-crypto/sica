/**
 * Unit tests — pemetaan bentrok jadwal KRS (`krs-open-classes.service.ts`).
 *
 * Kenapa berkas ini ada: `hasConflict`/`conflictDescription` yang dikirim rute
 * `GET /api/v1/academic/krs/open-classes` dulu diasumsikan benar (nilainya
 * di-hardcode `false` oleh fixture). Setelah pindah ke DB, aturan interval harus
 * DIBUKTIKAN, bukan dipercaya — dan aturan itu sama persis dengan yang dipakai
 * `krs.service.ts` saat menulis, sehingga peringatan UI tidak bisa berbeda dari
 * vonis server.
 *
 * Murni: hanya menyentuh `findScheduleOverlap` + `formatConflictDescription`
 * (tidak ada query, tidak ada koneksi, tidak ada HTTP).
 */
import { describe, it, expect } from 'vitest';
import {
  findScheduleOverlap,
  formatConflictDescription,
  type OwnConflictSlot,
} from '@/modules/academic/services/krs-open-classes.service';

const own = (
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  label = 'Basis Data — Kelas A',
): OwnConflictSlot => ({ dayOfWeek, startTime, endTime, label });

describe('findScheduleOverlap — aturan interval setengah-terbuka', () => {
  it('tidak menganggap dua jadwal bersebelahan sebagai bentrok', () => {
    const overlap = findScheduleOverlap(
      [{ dayOfWeek: 1, startTime: '09:40', endTime: '11:20' }],
      [own(1, '08:00', '09:40')],
    );
    expect(overlap).toBeNull();
  });

  it('menandai tumpang tindih dan menghitung rentang overlap-nya', () => {
    const overlap = findScheduleOverlap(
      [{ dayOfWeek: 1, startTime: '08:30', endTime: '10:00' }],
      [own(1, '09:00', '11:00')],
    );
    expect(overlap).not.toBeNull();
    expect(overlap?.dayOfWeek).toBe(1);
    expect(overlap?.overlapStart).toBe('09:00');
    expect(overlap?.overlapEnd).toBe('10:00');
    expect(overlap?.withLabel).toBe('Basis Data — Kelas A');
  });

  it('memotong rentang ke bagian yang benar-benar bertumpuk', () => {
    const overlap = findScheduleOverlap(
      [{ dayOfWeek: 3, startTime: '08:00', endTime: '12:00' }],
      [own(3, '09:00', '10:00', 'Kriptografi — Kelas B')],
    );
    expect(overlap?.overlapStart).toBe('09:00');
    expect(overlap?.overlapEnd).toBe('10:00');
    expect(overlap?.withLabel).toBe('Kriptografi — Kelas B');
  });

  it('hanya membandingkan slot pada hari yang sama', () => {
    const overlap = findScheduleOverlap(
      [{ dayOfWeek: 2, startTime: '08:00', endTime: '10:00' }],
      [own(5, '08:00', '10:00')],
    );
    expect(overlap).toBeNull();
  });

  it('kembali null bila mahasiswa belum memegang kelas apa pun', () => {
    const overlap = findScheduleOverlap(
      [
        { dayOfWeek: 1, startTime: '08:00', endTime: '10:00' },
        { dayOfWeek: 4, startTime: '13:00', endTime: '15:00' },
      ],
      [],
    );
    expect(overlap).toBeNull();
  });

  it('deterministik: overlap pertama yang dipilih, bukan yang acak', () => {
    const candidate = [
      { dayOfWeek: 1, startTime: '08:00', endTime: '10:00' },
      { dayOfWeek: 1, startTime: '13:00', endTime: '15:00' },
    ];
    const ownedSlots = [
      own(1, '09:00', '09:30', 'Pagi — Kelas A'),
      own(1, '14:00', '14:30', 'Siang — Kelas B'),
    ];
    const first = findScheduleOverlap(candidate, ownedSlots);
    const again = findScheduleOverlap(candidate, ownedSlots);
    expect(first).toEqual(again);
    expect(first?.withLabel).toBe('Pagi — Kelas A');
  });

  it('menemukan bentrok pada slot kandidat kedua', () => {
    const overlap = findScheduleOverlap(
      [
        { dayOfWeek: 1, startTime: '08:00', endTime: '09:00' },
        { dayOfWeek: 6, startTime: '13:00', endTime: '15:00' },
      ],
      [own(6, '14:00', '16:00', 'Praktikum — Lab 1')],
    );
    expect(overlap?.dayOfWeek).toBe(6);
    expect(overlap?.overlapStart).toBe('14:00');
    expect(overlap?.overlapEnd).toBe('15:00');
  });
});

describe('formatConflictDescription — sebab bentrok untuk UI', () => {
  it('memakai label hari Indonesia dan rentang overlap', () => {
    const overlap = findScheduleOverlap(
      [{ dayOfWeek: 2, startTime: '10:00', endTime: '12:00' }],
      [own(2, '11:00', '13:00', 'Jaringan — Kelas C')],
    );
    expect(overlap).not.toBeNull();
    const description = overlap ? formatConflictDescription(overlap) : '';
    expect(description).toContain('Jaringan — Kelas C');
    expect(description).toContain('Selasa');
    expect(description).toContain('11:00-12:00');
  });

  it('hari 7 berlabel Minggu (batas enum 1..7)', () => {
    const overlap = findScheduleOverlap(
      [{ dayOfWeek: 7, startTime: '08:00', endTime: '09:00' }],
      [own(7, '08:30', '09:30', 'MKU — Kelas A')],
    );
    const description = overlap ? formatConflictDescription(overlap) : '';
    expect(description).toContain('Minggu');
    expect(description).toContain('08:30-09:00');
  });
});
