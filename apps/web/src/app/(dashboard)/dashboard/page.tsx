import React from 'react';
import Link from 'next/link';
import { getDictionary } from '../../../lib/i18n';

export const metadata = {
  title: 'Dashboard — SICA Academic Cloud',
  description: 'Ringkasan Akademik dan Status Mahasiswa',
};

export default function DashboardPage() {
  const dict = getDictionary('id');

  const statCards = [
    {
      title: 'Indeks Prestasi Kumulatif',
      value: '3.82',
      badge: '+0.05 dari semester lalu',
      badgeType: 'success',
      icon: '⭐',
      color: 'var(--sica-color-primary)',
    },
    {
      title: 'Total SKS Lulus',
      value: '84 / 144',
      badge: 'Batas SKS Semester: 24 SKS',
      badgeType: 'info',
      icon: '📚',
      color: 'var(--sica-color-info)',
    },
    {
      title: 'Presensi Kehadiran',
      value: '95.8%',
      badge: 'Memenuhi syarat ujian',
      badgeType: 'success',
      icon: '✅',
      color: 'var(--sica-color-success)',
    },
    {
      title: 'Status Tagihan UKT',
      value: 'LUNAS',
      badge: 'Semester Ganjil 2026/2027',
      badgeType: 'success',
      icon: '💳',
      color: 'var(--sica-color-success)',
    },
  ];

  const todayClasses = [
    {
      time: '08:00 - 09:40 WIB',
      code: 'IF3201',
      name: 'Rekayasa Perangkat Lunak',
      room: 'Ruang Teori 302',
      lecturer: 'Dr. Ir. Hendra Gunawan, M.T.',
      status: 'SELESAI',
      statusColor: 'var(--sica-color-success)',
    },
    {
      time: '10:00 - 12:30 WIB',
      code: 'IF3204',
      name: 'Basis Data Terdistribusi & Multi-Tenant',
      room: 'Lab Komputasi A',
      lecturer: 'Prof. Siti Nurhaliza, Ph.D.',
      status: 'BERLANGSUNG',
      statusColor: 'var(--sica-color-primary)',
    },
    {
      time: '13:30 - 15:10 WIB',
      code: 'IF3208',
      name: 'Keamanan Siber & Kriptografi',
      room: 'Ruang Seminar 101',
      lecturer: 'Agus Pratama, M.Kom.',
      status: 'MENDATANG',
      statusColor: 'var(--sica-color-warning)',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome Banner */}
      <div
        className="velzon-card"
        style={{
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #ffffff 0%, #f7f9ff 100%)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px' }}>
            {dict.dashboard.welcome}, Budi Santoso 👋
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--sica-text-muted)' }}>
            Program Studi S1 Teknik Informatika · NIM: 2208561012
          </p>
        </div>
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--sica-color-primary-light)',
            color: 'var(--sica-color-primary)',
            borderRadius: 'var(--sica-radius-pill)',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          Semester Ganjil 2026/2027
        </div>
      </div>

      {/* Stat Cards Grid (4 Columns) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
        }}
      >
        {statCards.map((card, idx) => (
          <div key={idx} className="velzon-card" style={{ padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sica-text-muted)' }}>
                {card.title}
              </div>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(53, 119, 241, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                {card.icon}
              </div>
            </div>
            <div
              style={{
                fontSize: '24px',
                fontWeight: '700',
                color: 'var(--sica-text-heading)',
                marginBottom: '8px',
              }}
            >
              {card.value}
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: '500',
                color: card.badgeType === 'success' ? 'var(--sica-color-success)' : 'var(--sica-color-info)',
              }}
            >
              {card.badge}
            </div>
          </div>
        ))}
      </div>

      {/* 2 Columns: Jadwal Hari Ini & Quick Actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Jadwal Kuliah Hari Ini */}
        <div className="velzon-card" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Jadwal Kuliah Hari Ini</h2>
            <Link href="/academic/schedule" style={{ fontSize: '13px', fontWeight: '500' }}>
              Lihat Semua →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {todayClasses.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--sica-radius-md)',
                  backgroundColor: 'var(--sica-surface-canvas)',
                  border: '1px solid var(--sica-border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sica-color-primary)', marginBottom: '2px' }}>
                    {item.time} · {item.room}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sica-text-heading)', marginBottom: '2px' }}>
                    {item.code} — {item.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--sica-text-muted)' }}>
                    {item.lecturer}
                  </div>
                </div>

                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--sica-radius-sm)',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: item.statusColor,
                    backgroundColor: 'rgba(0,0,0,0.04)',
                  }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="velzon-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px' }}>
            {dict.dashboard.quickActions}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Link
              href="/academic/krs"
              style={{
                padding: '20px',
                borderRadius: 'var(--sica-radius-md)',
                border: '1px solid var(--sica-border-color)',
                backgroundColor: 'var(--sica-surface-canvas)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'transform 150ms ease, box-shadow 150ms ease',
              }}
            >
              <span style={{ fontSize: '24px' }}>📝</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sica-text-heading)' }}>
                {dict.dashboard.krsOnline}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--sica-text-muted)' }}>
                Pilih matakuliah semester aktif
              </span>
            </Link>

            <Link
              href="/academic/khs"
              style={{
                padding: '20px',
                borderRadius: 'var(--sica-radius-md)',
                border: '1px solid var(--sica-border-color)',
                backgroundColor: 'var(--sica-surface-canvas)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '24px' }}>📜</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sica-text-heading)' }}>
                {dict.dashboard.khsTranscript}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--sica-text-muted)' }}>
                Cetak KHS & transkrip nilai
              </span>
            </Link>

            <Link
              href="/academic/attendance"
              style={{
                padding: '20px',
                borderRadius: 'var(--sica-radius-md)',
                border: '1px solid var(--sica-border-color)',
                backgroundColor: 'var(--sica-surface-canvas)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '24px' }}>📱</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sica-text-heading)' }}>
                {dict.dashboard.attendance}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--sica-text-muted)' }}>
                Scan QR kehadiran kuliah
              </span>
            </Link>

            <Link
              href="/finance/billing"
              style={{
                padding: '20px',
                borderRadius: 'var(--sica-radius-md)',
                border: '1px solid var(--sica-border-color)',
                backgroundColor: 'var(--sica-surface-canvas)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '24px' }}>💳</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sica-text-heading)' }}>
                {dict.dashboard.billing}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--sica-text-muted)' }}>
                Riwayat pembayaran & invoice UKT
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
