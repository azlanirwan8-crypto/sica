'use client';

import React, { useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { VelzonDataGrid, type ColumnDef } from '@/components/ui/velzon-data-grid';

interface AdviseeStudent {
  id: string;
  nim: string;
  fullName: string;
  studyProgram: string;
  semester: number;
  totalSksSubmitted: number;
  maxSksAllowed: number;
  ipsPrevious: number;
  ipkCumulative: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
}

const INITIAL_ADVISEES: AdviseeStudent[] = [
  {
    id: 'adv-01',
    nim: '2201010045',
    fullName: 'Ahmad Faiz Muzaki',
    studyProgram: 'Teknik Informatika (S1)',
    semester: 5,
    totalSksSubmitted: 21,
    maxSksAllowed: 24,
    ipsPrevious: 3.82,
    ipkCumulative: 3.78,
    status: 'PENDING',
    submittedAt: '18 Okt 2026, 09:30',
  },
  {
    id: 'adv-02',
    nim: '2201010012',
    fullName: 'Dewi Anggraini',
    studyProgram: 'Teknik Informatika (S1)',
    semester: 5,
    totalSksSubmitted: 24,
    maxSksAllowed: 24,
    ipsPrevious: 3.90,
    ipkCumulative: 3.85,
    status: 'APPROVED',
    submittedAt: '17 Okt 2026, 14:15',
  },
  {
    id: 'adv-03',
    nim: '2201010088',
    fullName: 'Rizky Ramadhan',
    studyProgram: 'Teknik Informatika (S1)',
    semester: 5,
    totalSksSubmitted: 22,
    maxSksAllowed: 20,
    ipsPrevious: 2.85,
    ipkCumulative: 3.12,
    status: 'PENDING',
    submittedAt: '18 Okt 2026, 11:00',
  },
  {
    id: 'adv-04',
    nim: '2201010023',
    fullName: 'Siti Sarah Nurhaliza',
    studyProgram: 'Teknik Informatika (S1)',
    semester: 5,
    totalSksSubmitted: 18,
    maxSksAllowed: 20,
    ipsPrevious: 2.95,
    ipkCumulative: 3.20,
    status: 'APPROVED',
    submittedAt: '16 Okt 2026, 16:40',
  },
  {
    id: 'adv-05',
    nim: '2201010077',
    fullName: 'Budi Santoso',
    studyProgram: 'Teknik Informatika (S1)',
    semester: 5,
    totalSksSubmitted: 15,
    maxSksAllowed: 18,
    ipsPrevious: 2.20,
    ipkCumulative: 2.65,
    status: 'REJECTED',
    submittedAt: '15 Okt 2026, 10:20',
  },
];

export default function AdvisorApprovalPage() {
  const [advisees, setAdvisees] = useState<AdviseeStudent[]>(INITIAL_ADVISEES);
  // NOTE: drawer detail mahasiswa bimbingan belum diimplementasikan (tech debt — lihat docs/ISSUE_RESOLUTION.md).
  const [, setSelectedStudent] = useState<AdviseeStudent | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const totalAdvisees = advisees.length;
  const pendingCount = advisees.filter((a) => a.status === 'PENDING').length;
  const approvedCount = advisees.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = advisees.filter((a) => a.status === 'REJECTED').length;

  const handleApprove = (studentId: string) => {
    setAdvisees((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status: 'APPROVED' } : s))
    );
    setSelectedStudent(null);
    setNotification('Pengajuan KRS mahasiswa berhasil disetujui (Approved).');
    setTimeout(() => setNotification(null), 4000);
  };

  const handleReject = (studentId: string) => {
    setAdvisees((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status: 'REJECTED' } : s))
    );
    setSelectedStudent(null);
    setNotification('Pengajuan KRS mahasiswa telah ditolak dengan catatan revisi.');
    setTimeout(() => setNotification(null), 4000);
  };

  const columns: ColumnDef<AdviseeStudent>[] = [
    {
      key: 'nim',
      header: 'NIM & MAHASISWA',
      width: '240px',
      render: (item) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--sica-text-heading)' }}>
            {item.fullName}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--sica-text-muted)' }}>
            NIM: {item.nim} • Sem. {item.semester}
          </div>
        </div>
      ),
    },
    {
      key: 'academicScore',
      header: 'IPS / IPK',
      width: '130px',
      render: (item) => (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600 }}>
            IPS Lalu: <span style={{ color: 'var(--sica-color-primary)' }}>{item.ipsPrevious.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--sica-text-muted)' }}>
            IPK: {item.ipkCumulative.toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      key: 'totalSksSubmitted',
      header: 'BEBAN SKS',
      width: '140px',
      align: 'center',
      render: (item) => {
        const isExceeded = item.totalSksSubmitted > item.maxSksAllowed;
        return (
          <div>
            <span
              style={{
                fontWeight: 700,
                color: isExceeded ? 'var(--sica-color-danger)' : 'var(--sica-color-success)',
                fontSize: '13px',
              }}
            >
              {item.totalSksSubmitted} SKS
            </span>
            <span style={{ fontSize: '11px', color: 'var(--sica-text-muted)' }}>
              {' '}/ Maks. {item.maxSksAllowed}
            </span>
            {isExceeded && (
              <div style={{ fontSize: '10px', color: 'var(--sica-color-danger)', fontWeight: 600 }}>
                ⚠️ Melampaui Batas
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'submittedAt',
      header: 'WAKTU PENGAJUAN',
      render: (item) => (
        <span style={{ fontSize: '12px', color: 'var(--sica-text-muted)' }}>
          {item.submittedAt}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      width: '120px',
      align: 'center',
      render: (item) => {
        const statusMap = {
          PENDING: { label: 'Menunggu', color: 'var(--sica-color-warning)', bg: 'var(--sica-color-warning-light)' },
          APPROVED: { label: 'Disetujui', color: 'var(--sica-color-success)', bg: 'var(--sica-color-success-light)' },
          REJECTED: { label: 'Revisi', color: 'var(--sica-color-danger)', bg: 'var(--sica-color-danger-light)' },
        };
        const s = statusMap[item.status];
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--sica-radius-full)',
              backgroundColor: s.bg,
              color: s.color,
              fontWeight: 600,
              fontSize: '11px',
            }}
          >
            {s.label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'AKSI',
      width: '160px',
      align: 'center',
      sortable: false,
      render: (item) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
          {item.status === 'PENDING' ? (
            <>
              <button
                onClick={() => handleApprove(item.id)}
                style={{
                  padding: '4px 10px',
                  backgroundColor: 'var(--sica-color-success)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--sica-radius-sm)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Setujui
              </button>
              <button
                onClick={() => handleReject(item.id)}
                style={{
                  padding: '4px 10px',
                  backgroundColor: 'var(--sica-color-danger)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--sica-radius-sm)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Tolak
              </button>
            </>
          ) : (
            <button
              onClick={() => setSelectedStudent(item)}
              style={{
                padding: '4px 10px',
                backgroundColor: 'var(--sica-surface-hover)',
                color: 'var(--sica-text-body)',
                border: '1px solid var(--sica-border-color)',
                borderRadius: 'var(--sica-radius-sm)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Lihat Detail
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--sica-text-heading)',
            margin: 0,
          }}
        >
          Approval KRS Dosen Pembimbing Akademik (DPA)
        </h1>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--sica-text-muted)',
            margin: '4px 0 0 0',
          }}
        >
          Verifikasi rencana studi dan beban SKS mahasiswa bimbingan akademik Anda • Semester Ganjil 2025/2026
        </p>
      </div>

      {notification && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--sica-color-success-light)',
            color: 'var(--sica-color-success)',
            borderRadius: 'var(--sica-radius-md)',
            border: '1px solid var(--sica-color-success)',
            fontSize: '13px',
          }}
        >
          ✅ {notification}
        </div>
      )}

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <StatCard
          title="Total Bimbingan"
          value={totalAdvisees}
          subtitle="Mahasiswa Aktif"
          icon="👥"
          variant="primary"
        />
        <StatCard
          title="Menunggu Review"
          value={pendingCount}
          subtitle="Perlu Tindakan Cepat"
          icon="⏳"
          variant="warning"
        />
        <StatCard
          title="Telah Disetujui"
          value={approvedCount}
          subtitle="KRS Terverifikasi"
          icon="✅"
          variant="success"
        />
        <StatCard
          title="Perlu Revisi"
          value={rejectedCount}
          subtitle="Dikembalikan ke Mahasiswa"
          icon="⚠️"
          variant="danger"
        />
      </div>

      {/* Grid Mahasiswa Bimbingan */}
      <VelzonDataGrid
        title="Daftar Mahasiswa Bimbingan Akademik"
        subtitle="Klik tombol Setujui untuk meratifikasi KRS atau Tolak jika rencana studi tidak sesuai beban SKS."
        columns={columns}
        data={advisees}
        keyExtractor={(row) => row.id}
        searchPlaceholder="Cari nama atau NIM mahasiswa..."
        searchKeys={['fullName', 'nim']}
      />
    </div>
  );
}
