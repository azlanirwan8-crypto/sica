'use client';

import React, { useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { VelzonDataGrid, type ColumnDef } from '@/components/ui/velzon-data-grid';

export interface OpenClassItem {
  id: string;
  courseCode: string;
  courseName: string;
  className: string;
  sks: number;
  lecturerName: string;
  day: string;
  time: string;
  room: string;
  capacity: number;
  enrolled: number;
}

const AVAILABLE_CLASSES: OpenClassItem[] = [
  {
    id: 'cls-101',
    courseCode: 'IF-3101',
    courseName: 'Kecerdasan Buatan & Machine Learning',
    className: 'IF-A',
    sks: 3,
    lecturerName: 'Dr. Hendra Wijaya, M.Kom',
    day: 'Senin',
    time: '08:00 - 10:30',
    room: 'Lab AI 3.1',
    capacity: 40,
    enrolled: 28,
  },
  {
    id: 'cls-102',
    courseCode: 'IF-3102',
    courseName: 'Rekayasa Perangkat Lunak Berorientasi Objek',
    className: 'IF-A',
    sks: 4,
    lecturerName: 'Rina Kusuma, S.T., M.T.',
    day: 'Senin',
    time: '10:45 - 13:15',
    room: 'R. 402',
    capacity: 45,
    enrolled: 40,
  },
  {
    id: 'cls-103',
    courseCode: 'IF-3103',
    courseName: 'Keamanan Siber & Kriptografi Modern',
    className: 'IF-B',
    sks: 3,
    lecturerName: 'Bambang Pratama, M.Sc.',
    day: 'Selasa',
    time: '08:00 - 10:30',
    room: 'Lab Cyber 2',
    capacity: 35,
    enrolled: 31,
  },
  {
    id: 'cls-104',
    courseCode: 'IF-3104',
    courseName: 'Komputasi Awan & DevOps Engineering',
    className: 'IF-A',
    sks: 3,
    lecturerName: 'Ahmad Fauzi, M.Kom',
    day: 'Rabu',
    time: '13:00 - 15:30',
    room: 'Lab Cloud 1',
    capacity: 40,
    enrolled: 15,
  },
  {
    id: 'cls-105',
    courseCode: 'IF-3105',
    courseName: 'Pengembangan Aplikasi Bergerak (Mobile)',
    className: 'IF-C',
    sks: 3,
    lecturerName: 'Dewi Lestari, M.T.',
    day: 'Kamis',
    time: '09:00 - 11:30',
    room: 'Lab Mobile',
    capacity: 35,
    enrolled: 22,
  },
  {
    id: 'cls-106',
    courseCode: 'IF-3106',
    courseName: 'Interaksi Manusia & Komputer (UI/UX)',
    className: 'IF-A',
    sks: 3,
    lecturerName: 'Siti Rahmawati, S.Kom., M.Cs.',
    day: 'Jumat',
    time: '08:00 - 10:30',
    room: 'R. 305',
    capacity: 50,
    enrolled: 48,
  },
  {
    id: 'cls-107',
    courseCode: 'MKU-201',
    courseName: 'Bahasa Indonesia & Penulisan Ilmiah',
    className: 'MKU-B',
    sks: 2,
    lecturerName: 'Dra. Endang Sulastri, M.Pd.',
    day: 'Jumat',
    time: '13:30 - 15:10',
    room: 'Auditorium 2',
    capacity: 60,
    enrolled: 30,
  },
];

export function KrsCoursePicker() {
  const maxQuotaSks = 24; // Hasil dari IPS semester lalu = 3.82 -> max 24 SKS
  const [selectedClasses, setSelectedClasses] = useState<OpenClassItem[]>([]);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  const usedSks = selectedClasses.reduce((acc, curr) => acc + curr.sks, 0);
  const remainingSks = maxQuotaSks - usedSks;
  const isOverQuota = usedSks > maxQuotaSks;

  const toggleSelectClass = (cls: OpenClassItem) => {
    const isAlreadySelected = selectedClasses.some((c) => c.id === cls.id);
    if (isAlreadySelected) {
      setSelectedClasses(selectedClasses.filter((c) => c.id !== cls.id));
    } else {
      setSelectedClasses([...selectedClasses, cls]);
    }
  };

  const handleSubmitKrs = () => {
    if (selectedClasses.length === 0) return;
    setSubmitStatus('Pengajuan KRS berhasil dikirim ke Dosen Pembimbing Akademik (DPA).');
  };

  const columns: ColumnDef<OpenClassItem>[] = [
    {
      key: 'select',
      header: 'PILIH',
      width: '70px',
      align: 'center',
      sortable: false,
      render: (cls) => {
        const isSelected = selectedClasses.some((c) => c.id === cls.id);
        return (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelectClass(cls)}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer',
              accentColor: 'var(--sica-color-primary)',
            }}
          />
        );
      },
    },
    {
      key: 'courseCode',
      header: 'KODE',
      width: '110px',
      render: (cls) => (
        <span style={{ fontWeight: 600, color: 'var(--sica-color-primary)' }}>
          {cls.courseCode}
        </span>
      ),
    },
    {
      key: 'courseName',
      header: 'MATA KULIAH & DOSEN',
      render: (cls) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--sica-text-heading)' }}>
            {cls.courseName} ({cls.className})
          </div>
          <div style={{ fontSize: '11px', color: 'var(--sica-text-muted)', marginTop: '2px' }}>
            👤 {cls.lecturerName}
          </div>
        </div>
      ),
    },
    {
      key: 'sks',
      header: 'SKS',
      width: '70px',
      align: 'center',
      render: (cls) => (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 'var(--sica-radius-sm)',
            backgroundColor: 'var(--sica-surface-hover)',
            fontWeight: 700,
            fontSize: '12px',
          }}
        >
          {cls.sks} SKS
        </span>
      ),
    },
    {
      key: 'schedule',
      header: 'JADWAL & RUANG',
      render: (cls) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            📅 {cls.day}, {cls.time}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--sica-text-muted)' }}>
            📍 {cls.room}
          </div>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'KUOTA KELAS',
      width: '130px',
      align: 'center',
      render: (cls) => {
        const percent = Math.round((cls.enrolled / cls.capacity) * 100);
        const isFull = cls.enrolled >= cls.capacity;
        return (
          <div style={{ width: '100%' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                marginBottom: '4px',
              }}
            >
              <span>{cls.enrolled}/{cls.capacity}</span>
              <span style={{ fontWeight: 600, color: isFull ? 'var(--sica-color-danger)' : 'inherit' }}>
                {percent}%
              </span>
            </div>
            <div
              style={{
                height: '6px',
                width: '100%',
                backgroundColor: 'var(--sica-border-color)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  backgroundColor: isFull ? 'var(--sica-color-danger)' : 'var(--sica-color-primary)',
                }}
              />
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Panel Kuota & Status Live */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <StatCard
          title="Batas Kuota SKS"
          value={`${maxQuotaSks} SKS`}
          subtitle="IPS Semester Lalu: 3.82 (Kategori Beban Maksimal)"
          icon="🎓"
          variant="primary"
        />
        <StatCard
          title="SKS Dipilih"
          value={`${usedSks} SKS`}
          subtitle={`${selectedClasses.length} Mata Kuliah Terpilih`}
          icon="📚"
          variant={isOverQuota ? 'danger' : 'info'}
        />
        <StatCard
          title="Sisa Kuota SKS"
          value={`${remainingSks} SKS`}
          subtitle={isOverQuota ? 'Melebihi Kuota Maksimum!' : 'Dapat Ditambahkan'}
          icon="⚡"
          variant={isOverQuota ? 'danger' : 'success'}
        />
      </div>

      {isOverQuota && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--sica-color-danger-light)',
            color: 'var(--sica-color-danger)',
            borderRadius: 'var(--sica-radius-md)',
            border: '1px solid var(--sica-color-danger)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span>⚠️</span>
          <span>
            <strong>Batas SKS Terlampaui!</strong> Total SKS yang Anda pilih ({usedSks} SKS) melebihi batas yang diizinkan ({maxQuotaSks} SKS). Harap batalkan sebagian pilihan kelas sebelum submit.
          </span>
        </div>
      )}

      {submitStatus && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--sica-color-success-light)',
            color: 'var(--sica-color-success)',
            borderRadius: 'var(--sica-radius-md)',
            border: '1px solid var(--sica-color-success)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span>✅</span>
          <span>{submitStatus}</span>
        </div>
      )}

      {/* Grid Pemilihan Kelas */}
      <VelzonDataGrid
        title="Daftar Penawaran Kelas Kuliah — Semester Ganjil 2025/2026"
        subtitle="Pilih kelas kuliah yang akan Anda tempuh semester ini. Perhatikan jadwal agar tidak bertabrakan."
        columns={columns}
        data={AVAILABLE_CLASSES}
        keyExtractor={(row) => row.id}
        searchPlaceholder="Cari kode atau nama matakuliah..."
        searchKeys={['courseCode', 'courseName', 'lecturerName']}
        actions={
          <button
            disabled={selectedClasses.length === 0 || isOverQuota}
            onClick={handleSubmitKrs}
            style={{
              height: '36px',
              padding: '0 18px',
              backgroundColor:
                selectedClasses.length === 0 || isOverQuota
                  ? '#c4c8d0'
                  : 'var(--sica-color-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--sica-radius-md)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: selectedClasses.length === 0 || isOverQuota ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.2s',
            }}
          >
            <span>🚀</span>
            <span>Submit KRS ({usedSks} SKS)</span>
          </button>
        }
      />
    </div>
  );
}
