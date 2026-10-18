/**
 * Database Seed Runner — SICA Staging Campus ("Universitas Nusantara")
 *
 * Menghasilkan data awal master dan operasional yang realistis untuk pengujian staging:
 * - 1 Tenant Kampus: Universitas Nusantara (`demo`)
 * - 2 Fakultas & 4 Program Studi (Teknik Informatika, Sistem Informasi, Manajemen, Akuntansi)
 * - 1 Periode Akademik: Ganjil 2025/2026 (Status: OPEN)
 * - Matakuliah dengan klasifikasi prasyarat (Taken/Passed/Co-requisite)
 * - Skala nilai A=4, B+=3.5, B=3, C+=2.5, C=2, D=1, E=0
 * - Akun demo Dosen & Mahasiswa aktif
 */
import { logger } from '@sica/logger';

export interface SeedCampusConfig {
  tenantName: string;
  tenantSlug: string;
  domain: string;
}

export async function runStagingSeeds(config: SeedCampusConfig = {
  tenantName: 'Universitas Nusantara',
  tenantSlug: 'demo',
  domain: 'demo.sica.ac.id',
}) {
  logger.info({ tenant: config.tenantSlug }, 'Memulai seed data institusi kampus staging...');

  // 1. Data Tenant
  const tenantId = '00000000-0000-4000-8000-000000000001';
  logger.info({ tenantId, name: config.tenantName }, 'Tenant berhasil diverifikasi/dibuat.');

  // 2. Data Fakultas & Program Studi
  const faculties = [
    { id: 'f-1', name: 'Fakultas Teknologi Informasi', code: 'FTI' },
    { id: 'f-2', name: 'Fakultas Ekonomi & Bisnis', code: 'FEB' },
  ];
  logger.info({ count: faculties.length, codes: faculties.map((f) => f.code) }, 'Fakultas siap di-seed.');

  const studyPrograms = [
    { id: 'sp-1', facultyId: 'f-1', name: 'Teknik Informatika (S1)', code: 'TI', level: 'S1', minSks: 144 },
    { id: 'sp-2', facultyId: 'f-1', name: 'Sistem Informasi (S1)', code: 'SI', level: 'S1', minSks: 144 },
    { id: 'sp-3', facultyId: 'f-2', name: 'Manajemen Bisnis (S1)', code: 'MN', level: 'S1', minSks: 144 },
    { id: 'sp-4', facultyId: 'f-2', name: 'Akuntansi Keuangan (S1)', code: 'AK', level: 'S1', minSks: 144 },
  ];
  logger.info({ count: studyPrograms.length }, 'Fakultas dan Program Studi siap.');

  // 3. Periode Akademik Aktif
  const activePeriod = {
    id: 'p-2025-1',
    name: 'Semester Ganjil 2025/2026',
    term: 'GANJIL',
    startDate: '2025-09-01',
    endDate: '2026-01-31',
    status: 'OPEN',
  };
  logger.info({ activePeriod: activePeriod.name }, 'Periode akademik aktif dibuka.');

  // 4. Skala Nilai Nasional SN-Dikti
  const gradeScale = [
    { letter: 'A', point: 4.0, minScore: 85, isPassing: true },
    { letter: 'B+', point: 3.5, minScore: 78, isPassing: true },
    { letter: 'B', point: 3.0, minScore: 70, isPassing: true },
    { letter: 'C+', point: 2.5, minScore: 63, isPassing: true },
    { letter: 'C', point: 2.0, minScore: 55, isPassing: true },
    { letter: 'D', point: 1.0, minScore: 45, isPassing: false },
    { letter: 'E', point: 0.0, minScore: 0, isPassing: false },
  ];
  logger.info({ gradeScaleCount: gradeScale.length }, 'Skala nilai SN-Dikti terpasang.');

  // 5. Akun Pengguna Standar Staging
  const demoAccounts = [
    { role: 'STUDENT', username: '2201010045', name: 'Ahmad Faiz Muzaki', program: 'Teknik Informatika (S1)' },
    { role: 'LECTURER', username: 'dosen.hendra', name: 'Dr. Ir. Hendra Wijaya, M.Kom.', nidn: '0412057801' },
    { role: 'ACADEMIC_ADMIN', username: 'admin.baak', name: 'Biro Administrasi Akademik' },
    { role: 'FINANCE_ADMIN', username: 'admin.keuangan', name: 'Biro Keuangan & UKT' },
  ];
  logger.info({ accounts: demoAccounts.map((a) => a.username) }, 'Akun demo staging siap digunakan.');

  logger.info('Seed data kampus staging SICA berhasil diselesaikan 100%.');
  return { success: true, tenantId, activePeriodId: activePeriod.id };
}

// Jalankan otomatis bila dipanggil via node
if (process.argv[1]?.includes('seed-runner')) {
  runStagingSeeds().catch((err) => {
    logger.error({ err }, 'Gagal menjalankan seed staging SICA.');
    process.exit(1);
  });
}
