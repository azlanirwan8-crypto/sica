'use client';

import React, { useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { VelzonDataGrid, type ColumnDef } from '@/components/ui/velzon-data-grid';
import {
  generateKhsPrintHtml,
  printDocument,
  type StudentDocHeader,
  type KhsPrintItem,
} from '@/modules/academic/services/pdf-generator.service';

interface KhsGradeRow {
  no: number;
  courseCode: string;
  courseName: string;
  sks: number;
  letterGrade: string;
  pointValue: number;
  qualityScore: number;
  status: 'LULUS' | 'TIDAK_LULUS';
}

const SAMPLE_KHS_DATA: Record<
  string,
  {
    semesterLabel: string;
    academicYear: string;
    ips: number;
    ipk: number;
    totalSks: number;
    passedSks: number;
    rows: KhsGradeRow[];
  }
> = {
  'sem-5': {
    semesterLabel: 'Semester Ganjil 2025/2026 (Semester 5)',
    academicYear: '2025/2026 Ganjil',
    ips: 3.82,
    ipk: 3.78,
    totalSks: 18,
    passedSks: 18,
    rows: [
      {
        no: 1,
        courseCode: 'IF-2101',
        courseName: 'Algoritma & Struktur Data Lanjut',
        sks: 3,
        letterGrade: 'A',
        pointValue: 4.0,
        qualityScore: 12.0,
        status: 'LULUS',
      },
      {
        no: 2,
        courseCode: 'IF-2102',
        courseName: 'Basis Data Terdistribusi & Replikasi',
        sks: 4,
        letterGrade: 'B+',
        pointValue: 3.5,
        qualityScore: 14.0,
        status: 'LULUS',
      },
      {
        no: 3,
        courseCode: 'IF-2103',
        courseName: 'Pemrograman Web Berbasis Komponen',
        sks: 3,
        letterGrade: 'A',
        pointValue: 4.0,
        qualityScore: 12.0,
        status: 'LULUS',
      },
      {
        no: 4,
        courseCode: 'IF-2104',
        courseName: 'Probabilitas & Statistika Terapan',
        sks: 3,
        letterGrade: 'B',
        pointValue: 3.0,
        qualityScore: 9.0,
        status: 'LULUS',
      },
      {
        no: 5,
        courseCode: 'IF-2105',
        courseName: 'Arsitektur Komputer & Jaringan',
        sks: 3,
        letterGrade: 'A',
        pointValue: 4.0,
        qualityScore: 12.0,
        status: 'LULUS',
      },
      {
        no: 6,
        courseCode: 'MKU-102',
        courseName: 'Kewarganegaraan & Etika Profesi',
        sks: 2,
        letterGrade: 'A',
        pointValue: 4.0,
        qualityScore: 8.0,
        status: 'LULUS',
      },
    ],
  },
  'sem-4': {
    semesterLabel: 'Semester Genap 2024/2025 (Semester 4)',
    academicYear: '2024/2025 Genap',
    ips: 3.75,
    ipk: 3.76,
    totalSks: 20,
    passedSks: 20,
    rows: [
      {
        no: 1,
        courseCode: 'IF-1201',
        courseName: 'Struktur Data Dasar',
        sks: 4,
        letterGrade: 'A',
        pointValue: 4.0,
        qualityScore: 16.0,
        status: 'LULUS',
      },
      {
        no: 2,
        courseCode: 'IF-1202',
        courseName: 'Sistem Operasi',
        sks: 3,
        letterGrade: 'B+',
        pointValue: 3.5,
        qualityScore: 10.5,
        status: 'LULUS',
      },
      {
        no: 3,
        courseCode: 'IF-1203',
        courseName: 'Basis Data Relasional',
        sks: 3,
        letterGrade: 'A',
        pointValue: 4.0,
        qualityScore: 12.0,
        status: 'LULUS',
      },
      {
        no: 4,
        courseCode: 'IF-1204',
        courseName: 'Aljabar Linier & Matriks',
        sks: 3,
        letterGrade: 'B',
        pointValue: 3.0,
        qualityScore: 9.0,
        status: 'LULUS',
      },
      {
        no: 5,
        courseCode: 'IF-1205',
        courseName: 'Pemrograman Berorientasi Objek',
        sks: 4,
        letterGrade: 'A',
        pointValue: 4.0,
        qualityScore: 16.0,
        status: 'LULUS',
      },
      {
        no: 6,
        courseCode: 'MKU-103',
        courseName: 'Bahasa Inggris Akademik',
        sks: 3,
        letterGrade: 'A',
        pointValue: 4.0,
        qualityScore: 12.0,
        status: 'LULUS',
      },
    ],
  },
};

export default function KhsPage() {
  const [selectedSemesterKey, setSelectedSemesterKey] = useState<string>('sem-5');
  const currentKhs = SAMPLE_KHS_DATA[selectedSemesterKey] ?? SAMPLE_KHS_DATA['sem-5']!;

  const studentHeader: StudentDocHeader = {
    universityName: 'Universitas Sains & Teknologi Indonesia',
    facultyName: 'Fakultas Teknologi Informasi',
    studyProgram: 'Teknik Informatika (S1)',
    nim: '2201010045',
    studentName: 'Ahmad Faiz Muzaki',
    academicYear: currentKhs.academicYear,
    semester: selectedSemesterKey === 'sem-5' ? '5 (Lima)' : '4 (Empat)',
    advisorName: 'Dr. Ir. Hendra Wijaya, M.Kom.',
  };

  const handlePrintPdf = () => {
    const printItems: KhsPrintItem[] = currentKhs.rows.map((r) => ({
      no: r.no,
      courseCode: r.courseCode,
      courseName: r.courseName,
      sks: r.sks,
      letterGrade: r.letterGrade,
      pointValue: r.pointValue,
      qualityScore: r.qualityScore,
    }));

    const html = generateKhsPrintHtml(
      studentHeader,
      printItems,
      currentKhs.totalSks,
      currentKhs.ips,
      currentKhs.ipk
    );

    printDocument(html);
  };

  const columns: ColumnDef<KhsGradeRow>[] = [
    {
      key: 'no',
      header: 'NO',
      width: '60px',
      align: 'center',
      render: (item) => <span>{item.no}</span>,
    },
    {
      key: 'courseCode',
      header: 'KODE MK',
      width: '110px',
      render: (item) => (
        <span style={{ fontWeight: 600, color: 'var(--sica-color-primary)' }}>
          {item.courseCode}
        </span>
      ),
    },
    {
      key: 'courseName',
      header: 'NAMA MATA KULIAH',
      render: (item) => (
        <span style={{ fontWeight: 600, color: 'var(--sica-text-heading)' }}>
          {item.courseName}
        </span>
      ),
    },
    {
      key: 'sks',
      header: 'SKS',
      width: '70px',
      align: 'center',
      render: (item) => <span>{item.sks}</span>,
    },
    {
      key: 'letterGrade',
      header: 'NILAI HURUF',
      width: '110px',
      align: 'center',
      render: (item) => {
        const isGood = ['A', 'B+', 'B'].includes(item.letterGrade);
        return (
          <span
            style={{
              padding: '3px 12px',
              borderRadius: 'var(--sica-radius-sm)',
              fontWeight: 700,
              fontSize: '13px',
              backgroundColor: isGood ? 'var(--sica-color-success-light)' : 'var(--sica-color-warning-light)',
              color: isGood ? 'var(--sica-color-success)' : 'var(--sica-color-warning)',
            }}
          >
            {item.letterGrade}
          </span>
        );
      },
    },
    {
      key: 'pointValue',
      header: 'BOBOT',
      width: '80px',
      align: 'center',
      render: (item) => <span>{item.pointValue.toFixed(2)}</span>,
    },
    {
      key: 'qualityScore',
      header: 'MUTU (K x N)',
      width: '110px',
      align: 'center',
      render: (item) => (
        <span style={{ fontWeight: 700, color: 'var(--sica-text-heading)' }}>
          {item.qualityScore.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      width: '100px',
      align: 'center',
      render: (item) => (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--sica-color-success)',
          }}
        >
          ✓ {item.status}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Title & Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--sica-text-heading)',
              margin: 0,
            }}
          >
            Kartu Hasil Studi (KHS)
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--sica-text-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Laporan Prestasi Akademik Mahasiswa per Semester
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={selectedSemesterKey}
            onChange={(e) => setSelectedSemesterKey(e.target.value)}
            style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: 'var(--sica-radius-md)',
              border: '1px solid var(--sica-border-color)',
              backgroundColor: 'var(--sica-surface-card)',
              color: 'var(--sica-text-heading)',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
            }}
          >
            <option value="sem-5">Semester 5 (Ganjil 2025/2026)</option>
            <option value="sem-4">Semester 4 (Genap 2024/2025)</option>
          </select>

          <button
            onClick={handlePrintPdf}
            style={{
              height: '36px',
              padding: '0 16px',
              backgroundColor: 'var(--sica-color-secondary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--sica-radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🖨️</span>
            <span>Cetak KHS (PDF)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <StatCard
          title="Indeks Prestasi Semester"
          value={currentKhs.ips.toFixed(2)}
          subtitle="Semester Ini"
          icon="📈"
          variant="primary"
          trend={{ value: '0.07 vs sem. lalu', isPositive: true }}
        />
        <StatCard
          title="Indeks Prestasi Kumulatif"
          value={currentKhs.ipk.toFixed(2)}
          subtitle="Kumulatif s.d. Semester Ini"
          icon="🏆"
          variant="success"
        />
        <StatCard
          title="SKS Semester Ini"
          value={`${currentKhs.totalSks} SKS`}
          subtitle="100% SKS Lulus"
          icon="📘"
          variant="info"
        />
        <StatCard
          title="Status Kelulusan"
          value="LULUS SEMUA"
          subtitle="Tidak Ada Mata Kuliah Mengulang"
          icon="🎖️"
          variant="success"
        />
      </div>

      {/* Grade Table */}
      <VelzonDataGrid
        title={`Rincian Hasil Studi — ${currentKhs.semesterLabel}`}
        subtitle="Daftar seluruh nilai mata kuliah resmi yang telah diterbitkan oleh Program Studi."
        columns={columns}
        data={currentKhs.rows}
        keyExtractor={(row) => row.courseCode}
        searchable={false}
        pagination={false}
      />
    </div>
  );
}
