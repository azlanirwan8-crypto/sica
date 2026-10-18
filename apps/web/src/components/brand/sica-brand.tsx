import React from 'react';
import Image from 'next/image';

interface SicaBrandProps {
  /** Tinggi emblem dalam piksel; lockup teks mengikuti skala brand. */
  height?: number;
  /** Tampilkan lockup "SICA — System Integration Central Academic". */
  showWordmark?: boolean;
  /** Versi terang untuk latar gelap (menaikkan kontras teks). */
  variant?: 'light' | 'dark';
  className?: string;
}

/**
 * Lockup resmi SICA. Emblem dipakai dari `sica-emblem.png` (background transparan,
 * wordmark terbaked sudah dipotong) sehingga tipografi nama dapat dirender tajam
 * dan konsisten di semua ukuran.
 */
export function SicaBrand({ height = 40, showWordmark = true, variant = 'light', className }: SicaBrandProps) {
  const titleColor = variant === 'dark' ? '#ffffff' : '#0f172a';
  const taglineColor = variant === 'dark' ? 'rgba(255,255,255,0.65)' : '#64748b';

  return (
    <span className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <Image
        src="/sica-emblem.png"
        alt="Emblem SICA"
        width={height}
        height={height}
        priority
        className="shrink-0 object-contain"
        style={{ height, width: 'auto' }}
      />
      {showWordmark && (
        <span className="leading-none">
          <span className="block text-[17px] font-extrabold tracking-[0.02em]" style={{ color: titleColor }}>
            SICA
          </span>
          <span
            className="mt-1 block text-[9.5px] font-semibold uppercase tracking-[0.13em]"
            style={{ color: taglineColor }}
          >
            System Integration Central Academic
          </span>
        </span>
      )}
    </span>
  );
}
