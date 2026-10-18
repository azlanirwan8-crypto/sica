'use client';

import React, { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Menganimasikan anak masuk saat elemen pertama kali terlihat di viewport.
 * Memakai IntersectionObserver + animasi CSS agar hemat dan halus.
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
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
    variant === 'left' ? 'translate3d(-26px,0,0)' : variant === 'right' ? 'translate3d(26px,0,0)' : 'translate3d(0,22px,0)';

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : variant === 'in' ? 'scale(0.985)' : hiddenTransform,
        transition: `opacity 720ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 720ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Menghitung naik dari 0 ke nilai target saat terlihat.
 * `format` dipakai untuk mempertahankan gaya penulisan (mis. "1.000+", "30 dtk").
 */
export function CountUp({
  value,
  duration = 1400,
  className,
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(() => value.replace(/\d/g, '0'));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const match = /^([^\d.]*)(\d[\d.,]*)(.*)$/.exec(value);
    const digits = match?.[2];
    if (!match || digits === undefined) {
      setDisplay(value);
      return;
    }
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    const numeric = Number(digits.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(numeric)) {
      setDisplay(value);
      return;
    }

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
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return <span ref={ref} className={className}>{display}</span>;
}
