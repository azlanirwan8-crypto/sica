import { describe, expect, it } from 'vitest';
import { DEV_MFA_BYPASS_ENV, devMfaBypassEnabled, devMfaBypassHint } from '@/lib/dev-flags';

/**
 * `RD-173` — bypass MFA dev-only. Predikatnya wajib gagal-tertutup: satu nilai
 * lain di luar `development` + `'1'` harus tetap mewajibkan MFA.
 */
describe('devMfaBypassEnabled (gagal-tertutup)', () => {
  it('aktif hanya pada development dengan flag "1"', () => {
    expect(devMfaBypassEnabled({ NODE_ENV: 'development', [DEV_MFA_BYPASS_ENV]: '1' })).toBe(true);
  });

  it('mati di production/staging/test walaupun flag terpasang', () => {
    for (const mode of ['production', 'staging', 'test']) {
      expect(devMfaBypassEnabled({ NODE_ENV: mode, [DEV_MFA_BYPASS_ENV]: '1' })).toBe(false);
    }
  });

  it('mati bila flag absen atau bukan "1" persis', () => {
    expect(devMfaBypassEnabled({ NODE_ENV: 'development' })).toBe(false);
    for (const nilai of ['0', 'true', 'yes', '', ' 1', '1 ']) {
      expect(devMfaBypassEnabled({ NODE_ENV: 'development', [DEV_MFA_BYPASS_ENV]: nilai })).toBe(false);
    }
  });

  it('lingkungan kosong tidak pernah mengaktifkan bypass', () => {
    expect(devMfaBypassEnabled({})).toBe(false);
  });
});

describe('devMfaBypassHint (pesan tidak boleh menyuruh hal mustahil)', () => {
  it('kosong saat bypass nonaktif', () => {
    expect(devMfaBypassHint({ NODE_ENV: 'production', [DEV_MFA_BYPASS_ENV]: '1' })).toBe('');
  });

  it('menyebut nama flag dan jalan keluarnya saat aktif', () => {
    const hint = devMfaBypassHint({ NODE_ENV: 'development', [DEV_MFA_BYPASS_ENV]: '1' });
    expect(hint).toContain(DEV_MFA_BYPASS_ENV);
    expect(hint).toContain('hapus flag');
  });
});
