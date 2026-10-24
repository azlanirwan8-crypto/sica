'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Motion landing.
 *
 * Prinsip: animasi dipakai untuk memandu mata, bukan pamer. Semua gerak
 * dihentikan total saat pengguna memilih `prefers-reduced-motion` — termasuk
 * transisi inline di sini, bukan hanya keyframe di stylesheet.
 */

/** Jarak antar-item stagger (ms), dijaga singkat agar konten cepat terbaca. */
export const STAGGER_MS = 48;

/** Batas kumulatif agar item ke-n tidak muncul terlalu lama (ms). */
const STAGGER_CAP = 240;

/** Hitungan delay stagger yang selalu berada di dalam batas. */
export function stagger(index: number, step: number = STAGGER_MS, cap: number = STAGGER_CAP): number {
  return Math.min(Math.max(index, 0) * step, cap);
}

function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

/** `true` saat pengguna meminta gerak minimal; ikut berubah bila setelan diganti. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = reducedMotionQuery();
    if (!mq) return;
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Menganimasikan anak masuk saat elemen pertama kali terlihat di viewport.
 * Memakai IntersectionObserver + transform/opacity saja (compositor-friendly).
 */
export function Reveal({
  children,
  delay = 0,
  variant = 'up',
  once = true,
  threshold = 0.15,
  className = '',
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  variant?: 'up' | 'in' | 'left' | 'right';
  once?: boolean;
  threshold?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = reducedMotionQuery();
    if (mq?.matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold, rootMargin: '0px 0px -6% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold]);

  const hiddenTransform =
    variant === 'left' ? 'translate3d(-12px,0,0)' : variant === 'right' ? 'translate3d(12px,0,0)' : 'translate3d(0,12px,0)';

  const ease = 'cubic-bezier(0.22,1,0.36,1)';
  const safeDelay = Math.min(Math.max(delay, 0), 600);

  const motion: React.CSSProperties = reduced
    ? { opacity: 1, transform: 'none', transition: 'none', willChange: 'auto' }
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : variant === 'in' ? 'scale(0.99)' : hiddenTransform,
        transition: `opacity 360ms ${ease} ${safeDelay}ms, transform 360ms ${ease} ${safeDelay}ms`,
        willChange: 'opacity, transform',
      };

  return (
    <div ref={ref} className={className} style={{ ...style, ...motion }}>
      {children}
    </div>
  );
}

/**
 * Menghitung naik dari 0 ke nilai target saat terlihat.
 * `value` selalu berada di DOM (`.sr-only`) supaya pembaca layar tidak pernah
 * menangkap angka antara; versi animasinya murni dekoratif.
 */
export function CountUp({
  value,
  duration = 1200,
  className,
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(value);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const match = /^([^\d.]*)(\d[\d.,]*)(.*)$/.exec(value);
    const digits = match?.[2];
    if (!match || digits === undefined) return;

    const numeric = Number(digits.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(numeric)) return;

    const prefix = match[1] ?? '';
    const suffix = match[3] ?? '';
    const usesDotGroup = digits.includes('.');
    let raf = 0;
    let started = false;

    const render = (n: number) => {
      const rounded = Math.round(n);
      const body = usesDotGroup ? rounded.toLocaleString('id-ID') : String(rounded);
      setDisplay(`${prefix}${body}${suffix}`);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || started) return;
        started = true;
        io.disconnect();
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          render(numeric * eased);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        render(0);
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden>{display}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
