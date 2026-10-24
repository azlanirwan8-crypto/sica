'use client';

import React, { useState } from 'react';
import { BadgeCheck, BookOpen, ChevronDown, Printer, TrendingUp, Trophy } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardHeading, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { MetaRow, PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { VelzonChart } from '@/components/ui/velzon-chart';
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

/** Ambang nilai lulus — mengikuti predikat lama (`A/B+/B`), bukan menebak warna baru. */
const PASSING_GRADES: readonly string[] = ['A', 'B+', 'B'];

const gradeTone = (letterGrade: string): NonNullable<BadgeProps['tone']> =>
  PASSING_GRADES.includes(letterGrade) ? 'success' : 'warning';

const STATUS_LABEL: Record<KhsGradeRow['status'], string> = {
  LULUS: 'Lulus',
  TIDAK_LULUS: 'Tidak Lulus',
};

const SEMESTER_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'sem-5', label: 'Semester 5 (Ganjil 2025/2026)' },
  { value: 'sem-4', label: 'Semester 4 (Genap 2024/2025)' },
];

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

  const allPassed = currentKhs.rows.every((row) => row.status === 'LULUS');
  const sksRatio = currentKhs.totalSks > 0 ? (currentKhs.passedSks / currentKhs.totalSks) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kartu Hasil Studi (KHS)"
        description="Laporan Prestasi Akademik Mahasiswa per Semester"
        crumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Akademik' }, { label: 'KHS' }]}
        actions={
          <>
            <span className="relative inline-flex items-center">
              <Select
                aria-label="Pilih semester"
                value={selectedSemesterKey}
                onChange={(event) => setSelectedSemesterKey(event.target.value)}
                className="w-56 sm:w-64"
              >
                {SEMESTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <ChevronDown
                size={15}
                strokeWidth={2}
                aria-hidden
                className="pointer-events-none absolute right-3.5 text-slate-400"
              />
            </span>
            <Button onClick={handlePrintPdf}>
              <Printer size={15} strokeWidth={2} aria-hidden />
              Cetak KHS (PDF)
            </Button>
          </>
        }
      />

      <section aria-label="Indikator hasil studi" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Indeks Prestasi Semester"
          value={currentKhs.ips.toFixed(2)}
          hint="Semester Ini"
          trend="up"
          trendValue="0.07 vs sem. lalu"
          trendSemantic="good-when-up"
          icon={<TrendingUp size={16} strokeWidth={2} aria-hidden />}
        />
        <StatCard
          label="Indeks Prestasi Kumulatif"
          value={currentKhs.ipk.toFixed(2)}
          hint="Kumulatif s.d. Semester Ini"
          icon={<Trophy size={16} strokeWidth={2} aria-hidden />}
        />
        <StatCard
          label="SKS Semester Ini"
          value={`${currentKhs.totalSks} SKS`}
          hint={`${currentKhs.passedSks} dari ${currentKhs.totalSks} SKS lulus`}
          icon={<BookOpen size={16} strokeWidth={2} aria-hidden />}
        />
        <StatCard
          label="Status Kelulusan"
          value={allPassed ? 'Lulus Semua' : 'Ada Mengulang'}
          hint={allPassed ? 'Tidak Ada Mata Kuliah Mengulang' : 'Sebagian mata kuliah perlu diulang'}
          icon={<BadgeCheck size={16} strokeWidth={2} aria-hidden />}
        />
      </section>

      <section aria-label="Tren dan ringkasan" className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardHeading>
              <CardTitle>Bobot Nilai per Mata Kuliah</CardTitle>
              <CardDescription>
                Skala 0 – 4,00 berdasarkan nilai poin resmi semester berjalan.
              </CardDescription>
            </CardHeading>
            <Badge tone="secondary" look="label">
              {currentKhs.rows.length} mata kuliah
            </Badge>
          </CardHeader>
          <div className="card-body">
            <VelzonChart
              height={236}
              series={[
                {
                  name: 'Nilai poin',
                  points: currentKhs.rows.map((row) => ({ label: row.courseCode, value: row.pointValue })),
                },
              ]}
              valueFormat={(value) => value.toFixed(2)}
            />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardHeading>
              <CardTitle>Ringkasan Semester</CardTitle>
              <CardDescription>{currentKhs.academicYear}</CardDescription>
            </CardHeading>
          </CardHeader>
          <div className="card-body flex flex-col gap-5">
            <MetaRow
              items={[
                { label: 'IPS', value: currentKhs.ips.toFixed(2) },
                { label: 'IPK', value: currentKhs.ipk.toFixed(2) },
                { label: 'Total SKS', value: `${currentKhs.totalSks}` },
              ]}
            />
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <span className="section-label">SKS diselesaikan</span>
                <span className="text-[13px] font-semibold tabular text-[color:var(--sica-text-heading)]">
                  {currentKhs.passedSks} / {currentKhs.totalSks}
                </span>
              </div>
              <Progress
                value={sksRatio}
                tone={sksRatio >= 100 ? 'success' : 'warning'}
                label="Rasio SKS yang diselesaikan"
              />
            </div>
          </div>
          <CardFooter className="flex items-center justify-between gap-4">
            <span className="text-[12.5px] text-[color:var(--sica-text-muted)]">
              Nilai yang belum tuntas dapat ditempuh pada semester berikutnya.
            </span>
            <Badge tone={allPassed ? 'success' : 'warning'} look="label" className="shrink-0">
              {allPassed ? 'Lulus Semua' : 'Ada Mengulang'}
            </Badge>
          </CardFooter>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardHeading>
            <CardTitle>Rincian Hasil Studi — {currentKhs.semesterLabel}</CardTitle>
            <CardDescription>
              Daftar seluruh nilai mata kuliah resmi yang telah diterbitkan oleh Program Studi.
            </CardDescription>
          </CardHeading>
        </CardHeader>

        <Table>
          <THead>
            <TH align="center" className="w-[56px]">No</TH>
            <TH className="w-[112px]">Kode MK</TH>
            <TH>Nama Mata Kuliah</TH>
            <TH align="center" className="w-[72px]">SKS</TH>
            <TH align="center" className="w-[112px]">Nilai Huruf</TH>
            <TH align="center" className="w-[88px]">Bobot</TH>
            <TH align="center" className="w-[120px]">Mutu (K x N)</TH>
            <TH align="center" className="w-[124px]">Status</TH>
          </THead>
          <TBody>
            {currentKhs.rows.map((row) => (
              <TR key={row.courseCode}>
                <TD align="center" className="text-[13px] tabular text-[color:var(--sica-text-muted)]">
                  {row.no}
                </TD>
                <TD className="text-[12.5px] font-semibold tabular text-primary-hover">{row.courseCode}</TD>
                <TD className="text-[13.5px] font-medium text-[color:var(--sica-text-heading)]">
                  {row.courseName}
                </TD>
                <TD align="center" className="text-[13px] tabular">{row.sks}</TD>
                <TD align="center">
                  <Badge tone={gradeTone(row.letterGrade)} look="label">
                    {row.letterGrade}
                  </Badge>
                </TD>
                <TD align="center" className="text-[13px] tabular">{row.pointValue.toFixed(2)}</TD>
                <TD align="center" className="text-[13px] font-semibold tabular text-[color:var(--sica-text-heading)]">
                  {row.qualityScore.toFixed(2)}
                </TD>
                <TD align="center">
                  <Badge
                    tone={row.status === 'LULUS' ? 'success' : 'danger'}
                    look="soft"
                  >
                    {STATUS_LABEL[row.status]}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
