'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import {
  LAYOUT_STYLE_VALUES,
  LAYOUT_WIDTH_VALUES,
  THEME_MODE_VALUES,
  TOPBAR_VALUES,
  useTheme,
  type LayoutStyle,
  type LayoutWidth,
  type ThemeMode,
  type TopbarMode,
} from '@/components/ui/theme-provider';
import { cn } from '@/lib/utils';

/**
 * Panel kustomiser Velzon ("design panel") — tombol melayang + laci kanan.
 *
 * Ia TIDAK menyimpan status apa pun: setiap pilihan langsung ditulis
 * `ThemeProvider` ke `<html>` dan `localStorage`, jadi tidak ada sumber kedua
 * yang bisa berbeda dari atribut tema (§2.6). Nilai yang ditawarkan dibaca dari
 * himpunan validasi yang sama (`THEME_MODE_VALUES` dst.), sehingga panel tidak
 * pernah menawarkan knob yang ditolak `read()`.
 *
 * `vertical` ditampilkan tapi MATI: sidebar belum ada sumber menunya
 * (ROADMAP `UI-VLN-6`), dan menawarkan tata letak yang tidak bisa dirender
 * adalah affordance palsu — pola yang kita vonis di `RD-154`.
 */
export function DesignPanel() {
  const { state, setMode, setTopbar, setStyle, setWidth } = useTheme();
  const pathname = usePathname();
  const dict = getDictionary('id').app.designPanel;
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const inApp = pathname !== '/' && pathname !== '/login';

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="customizer-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={dict.open}
        aria-expanded={open}
      >
        <i className={open ? 'ri-close-line' : 'ri-tools-line'} aria-hidden />
      </button>

      {open ? <div className="customizer-backdrop" aria-hidden /> : null}

      {open ? (
        <div ref={panelRef} className="customizer-panel" role="dialog" aria-label={dict.title} aria-modal="false">
          <div className="customizer-head">
            <div>
              <p className="customizer-title">{dict.title}</p>
              <p className="customizer-description">{dict.description}</p>
            </div>
            <button type="button" className="customizer-close" onClick={() => setOpen(false)} aria-label={dict.close}>
              <i className="ri-close-line text-lg" aria-hidden />
            </button>
          </div>

          <Section label={dict.sectionMode}>
            {THEME_MODE_VALUES.map((value) => (
              <Pill
                key={value}
                checked={state.mode === value}
                onSelect={() => setMode(value as ThemeMode)}
                label={value === 'light' ? dict.optionLight : dict.optionDark}
                icon={value === 'light' ? 'ri-sun-line' : 'ri-moon-line'}
              />
            ))}
          </Section>

          <Section label={dict.sectionTopbar} disabledHint={inApp ? undefined : dict.publicNote}>
            {TOPBAR_VALUES.map((value) => (
              <Pill
                key={value}
                checked={state.topbar === value}
                disabled={!inApp}
                onSelect={() => setTopbar(value as TopbarMode)}
                label={value === 'light' ? dict.optionTopbarFollow : dict.optionTopbarDark}
                icon={value === 'light' ? 'ri-contrast-2-line' : 'ri-computer-line'}
              />
            ))}
          </Section>

          <Section label={dict.sectionStyle} disabledHint={inApp ? undefined : dict.publicNote}>
            {LAYOUT_STYLE_VALUES.map((value) => (
              <Pill
                key={value}
                checked={state.style === value}
                disabled={!inApp}
                onSelect={() => setStyle(value as LayoutStyle)}
                label={
                  value === 'default'
                    ? dict.optionStyleDefault
                    : value === 'gradient'
                      ? dict.optionStyleGradient
                      : dict.optionStyleSeparated
                }
              />
            ))}
          </Section>

          <Section label={dict.sectionWidth} disabledHint={inApp ? undefined : dict.publicNote}>
            {LAYOUT_WIDTH_VALUES.map((value) => (
              <Pill
                key={value}
                checked={state.width === value}
                disabled={!inApp}
                onSelect={() => setWidth(value as LayoutWidth)}
                label={value === 'fluid' ? dict.optionWidthFluid : dict.optionWidthBoxed}
              />
            ))}
            {/* Nilai yang belum bisa dirender tetap terlihat supaya alasan
                penundaannya terbaca, bukan disembunyikan. */}
            <Pill checked={false} disabled onSelect={() => undefined} label="Vertikal" title={dict.verticalNote} />
          </Section>

          {!inApp ? <p className="customizer-hint">{dict.publicNote}</p> : null}
        </div>
      ) : null}
    </>
  );
}

function Section({
  label,
  children,
  disabledHint,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly disabledHint?: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <p className="customizer-section-label">{label}</p>
      <div className="customizer-options" role="radiogroup" aria-label={label}>
        {children}
      </div>
      {disabledHint ? <p className="customizer-hint">{disabledHint}</p> : null}
    </section>
  );
}

function Pill({
  label,
  checked,
  disabled,
  onSelect,
  icon,
  title,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
  readonly icon?: string;
  readonly title?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={onSelect}
      className={cn('customizer-option')}
    >
      {icon ? <i className={icon} aria-hidden /> : null}
      {label}
    </button>
  );
}
