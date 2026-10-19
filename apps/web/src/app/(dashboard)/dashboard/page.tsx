import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDictionary } from '../../../lib/i18n';
import { loadDashboard, type DashboardStatCard, type TodayClassRow } from '../../../modules/academic/services/dashboard.service';

export const metadata = {
  title: 'Dashboard Akademik',
  description: 'Ringkasan akademik dan status mahasiswa sesuai data pada database tenant aktif',
};

const CARD_ICON = ['⭐', '📚', '✅', '🎓'];
const TONE_COLOR: Record<DashboardStatCard['tone'], string> = {
  success: 'var(--sica-color-success)',
  info: 'var(--sica-color-info)',
  warning: 'var(--sica-color-warning)',
  muted: 'var(--sica-text-muted)',
};
const STATUS_COLOR: Record<TodayClassRow['tone'], string> = {
  success: 'var(--sica-color-success)',
  info: 'var(--sica-color-primary)',
  warning: 'var(--sica-color-warning)',
};

export default async function DashboardPage() {
  const dict = getDictionary('id');
  const h = await headers();
  const tenantId = h.get('x-tenant-id');
  const userId = h.get('x-user-id');

  // Middleware sudah menolak token cacat; ini penjaga kedua agar halaman tidak
  // pernah merender data tenant lain bila header konteks hilang.
  if (!tenantId || !userId) redirect('/login?redirect=/dashboard');

  const view = await loadDashboard(tenantId, userId);
  if (!view) redirect('/login?redirect=/dashboard');

  const quickActions = [
    { href: '/academic/krs', icon: '📝', title: dict.dashboard.krsOnline, desc: 'Pilih matakuliah semester aktif' },
    { href: '/academic/khs', icon: '📜', title: dict.dashboard.khsTranscript, desc: 'Cetak KHS & transkrip nilai' },
    { href: '/academic/attendance', icon: '📱', title: dict.dashboard.attendance, desc: 'Scan QR kehadiran kuliah' },
    { href: '/finance/billing', icon: '💳', title: dict.dashboard.billing, desc: 'Riwayat pembayaran & invoice UKT' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Sapaan */}
      <div
        className="velzon-card"
        style={{
          padding: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f7f9ff 100%)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>
            {dict.dashboard.welcome}, {view.greetingName} 👋
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--sica-text-muted)' }}>{view.identityLine}</p>
        </div>
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--sica-color-primary-light)',
            color: 'var(--sica-color-primary)',
            borderRadius: 'var(--sica-radius-pill)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {view.activePeriodLabel}
        </div>
      </div>

      {/* Kartu statistik */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '20px' }}>
        {view.cards.map((card, idx) => (
          <div key={card.label} className="velzon-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sica-text-muted)' }}>{card.label}</div>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  backgroundColor: 'rgba(10, 179, 156, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                {CARD_ICON[idx] ?? '📊'}
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--sica-text-heading)', marginBottom: '8px', wordBreak: 'break-word' }}>
              {card.value}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: TONE_COLOR[card.tone] }}>{card.badge}</div>
          </div>
        ))}
      </div>

      {/* Jadwal hari ini & aksi cepat */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px' }}>
        <div className="velzon-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Jadwal Kuliah Hari Ini</h2>
            <Link href="/academic/schedule" style={{ fontSize: '13px', fontWeight: 500 }}>
              Lihat Semua →
            </Link>
          </div>

          {view.todayClasses.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--sica-text-muted)', padding: '24px 0', textAlign: 'center' }}>
              Tidak ada kelas terjadwal hari ini.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {view.todayClasses.map((item) => (
                <div
                  key={`${item.code}-${item.time}`}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--sica-radius-md)',
                    backgroundColor: 'var(--sica-surface-card)',
                    border: '1px solid var(--sica-border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sica-color-primary)', marginBottom: '2px' }}>
                      {item.time} · {item.room}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sica-text-heading)', marginBottom: '2px' }}>
                      {item.code} — {item.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--sica-text-muted)' }}>{item.lecturer}</div>
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--sica-radius-sm)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: STATUS_COLOR[item.tone],
                      backgroundColor: 'rgba(0,0,0,0.04)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="velzon-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>{dict.dashboard.quickActions}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: '14px' }}>
            {quickActions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
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
                <span style={{ fontSize: '24px' }}>{a.icon}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sica-text-heading)' }}>{a.title}</span>
                <span style={{ fontSize: '12px', color: 'var(--sica-text-muted)' }}>{a.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
