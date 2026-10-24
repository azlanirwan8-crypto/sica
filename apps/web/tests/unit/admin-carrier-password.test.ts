/**
 * Unit tests — gerbang carrier akun kampus & hasher sandi asinkron.
 *
 * Dua temuan audit UI Fase 1 (2026-10-23) yang dikunci di sini supaya tidak kembali:
 *  1. `POST /api/v1/admin/pengguna` dulu menerima `memberRole: 'super_admin'`. Carrier
 *     memang bukan hak (peran efektif selalu dari `user_role_assignments`), tetapi ia
 *     menentukan arah login/routeset dan perluasan menu lewat `rolesForCarrier`, jadi
 *     Admin kampus tidak boleh mencetak akun yang tampak seperti operator platform di
 *     tenant-nya sendiri.
 *  2. `ScryptPasswordHasher` memakai `scryptSync`. Format hash TIDAK berubah (parameter
 *     N/r/p ikut tersimpan di string), jadi uji round-trip ini juga membuktikan hash
 *     lama tetap terbaca setelah KDF dipindah ke varian async.
 */
import { describe, it, expect } from 'vitest';
import {
  AdminMemberRoleSchema,
  CampusMemberRoleSchema,
  CreateAdminUserRequestSchema,
  UpdateAdminUserRequestSchema,
} from '@sica/contracts';
import { createPasswordHasher } from '../../src/modules/auth/services/password.service';

const VALID_BODY = {
  fullName: 'Warga Uji Carrier',
  email: 'warga.uji@demo.test',
  memberCode: 'UJI-CARRIER-01',
  initialPassword: 'KataSandiUji123',
  reason: 'alasan uji kontrak pembuatan akun',
};

describe('carrier akun yang boleh dibuat Admin kampus', () => {
  it('menolak super_admin pada pembuatan akun', () => {
    const res = CreateAdminUserRequestSchema.safeParse({ ...VALID_BODY, memberRole: 'super_admin' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.map((i) => i.path.join('.'))).toContain('memberRole');
    }
  });

  it('menolak super_admin pada perubahan akun', () => {
    const res = UpdateAdminUserRequestSchema.safeParse({ memberRole: 'super_admin', reason: VALID_BODY.reason });
    expect(res.success).toBe(false);
  });

  it('menerima keempat carrier kampus', () => {
    for (const role of CampusMemberRoleSchema.options) {
      expect(CreateAdminUserRequestSchema.safeParse({ ...VALID_BODY, memberRole: role }).success).toBe(true);
    }
  });

  it('proyeksi baca tetap menerima super_admin — baris lama tidak boleh gagal parse', () => {
    expect(AdminMemberRoleSchema.safeParse('super_admin').success).toBe(true);
  });
});

describe('ScryptPasswordHasher (varian async)', () => {
  const hasher = createPasswordHasher('pepper-uji');

  it('round-trip hash → verify, dan sandi salah ditolak', async () => {
    const stored = await hasher.hash('KataSandiUji123');
    expect(stored.startsWith('scrypt-v1$')).toBe(true);
    await expect(hasher.verify('KataSandiUji123', stored)).resolves.toBe(true);
    await expect(hasher.verify('KataSandiSalah123', stored)).resolves.toBe(false);
  }, 30_000);

  it('pepper berbeda tidak dapat memverifikasi hash', async () => {
    const stored = await hasher.hash('KataSandiUji123');
    const other = createPasswordHasher('pepper-lain');
    await expect(other.verify('KataSandiUji123', stored)).resolves.toBe(false);
  }, 30_000);

  it('hash tidak memblokir event loop sampai selesai', async () => {
    // Pembuktian perilaku, bukan angka: bila KDF masih sinkron, tick timer ini tidak
    // pernah sempat berjalan selama `hash()` bekerja.
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
    }, 5);
    const pending = hasher.hash('KataSandiUji123');
    await new Promise((resolve) => setTimeout(resolve, 30));
    const ticksWhilePending = ticks;
    await pending;
    clearInterval(timer);
    expect(ticksWhilePending).toBeGreaterThan(0);
  }, 30_000);
});
