'use client';

import React from 'react';
import { KrsCoursePicker } from '@/modules/academic/components/krs-course-picker';

export default function KrsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
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
            Kartu Rencana Studi (KRS) Online
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--sica-text-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Periode Pengisian KRS Aktif • Semester Ganjil 2025/2026
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            backgroundColor: 'var(--sica-color-info-light)',
            color: 'var(--sica-color-info)',
            borderRadius: 'var(--sica-radius-full)',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <span>⏳</span>
          <span>Batas Pengisian: 25 Oktober 2026, 23:59 WIB</span>
        </div>
      </div>

      {/* Main Interactive Picker */}
      <KrsCoursePicker />
    </div>
  );
}
