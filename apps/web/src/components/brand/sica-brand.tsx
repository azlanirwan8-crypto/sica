import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface SicaBrandProps {
  /** Tinggi emblem dalam piksel; lockup teks mengikuti skala brand. */
  height?: number;
  /** Tampilkan lockup "SICA — System Integration Central Academic". */
  showWordmark?: boolean;
  /** `dark` dipakai di atas permukaan gelap (menaikkan kontras teks). */
  variant?: 'light' | 'dark';
  className?: string;
}

/**
 * Lockup resmi SICA. Emblem dipakai dari `sica-emblem.png` (background transparan,
 * wordmark terbaked sudah dipotong) sehingga tipografi nama dapat dirender tajam
 * dan konsisten di semua ukuran.
 *
 * Warna teks murni lewat token agar ikut `data-theme` — tanpa hexa di JSX.
 */
export function SicaBrand({ height = 40, showWordmark = true, variant = 'light', className }: SicaBrandProps) {
  const ink = variant === 'dark' ? 'text-white' : 'text-[color:var(--sica-text-heading)]';

  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Image
        src="/sica-emblem.png"
        // Wordmark sudah menyebut "SICA", jadi emblemnya bersifat dekoratif.
        alt={showWordmark ? '' : 'SICA'}
        width={108}
        height={134}
        className="shrink-0 object-contain"
        style={{ height, width: 'auto' }}
      />
      {showWordmark && (
        <span className={cn('text-[17px] font-bold leading-none tracking-tightest', ink)}>SICA</span>
      )}
    </span>
  );
}
