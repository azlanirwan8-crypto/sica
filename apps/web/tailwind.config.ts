import type { Config } from 'tailwindcss';

/**
 * SICA — konfigurasi Tailwind untuk Velzon Design System.
 *
 * Semua warna diarahkan ke variabel CSS di `src/app/globals.css`
 * (kanal RGB supaya modifier opasitas seperti `bg-slate-50/50` tetap bekerja
 * DAN ikut berganti tema). Tidak ada hexa di file ini kecuali komentar.
 */

const channel = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const neutralScale = (prefix: string) => ({
  50: channel(`--sica-rgb-${prefix}-50`),
  100: channel(`--sica-rgb-${prefix}-100`),
  200: channel(`--sica-rgb-${prefix}-200`),
  300: channel(`--sica-rgb-${prefix}-300`),
  400: channel(`--sica-rgb-${prefix}-400`),
  500: channel(`--sica-rgb-${prefix}-500`),
  600: channel(`--sica-rgb-${prefix}-600`),
  700: channel(`--sica-rgb-${prefix}-700`),
  800: channel(`--sica-rgb-${prefix}-800`),
  900: channel(`--sica-rgb-${prefix}-900`),
  950: channel(`--sica-rgb-${prefix}-950`),
});

const config: Config = {
  // Tema dibaca dari atribut kosakata Velzon (UI_UX_DESIGN §2.6), bukan `data-theme`.
  darkMode: ['class', '[data-bs-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  /**
   * Kelas design-system Velzon ditulis di `@layer components`, jadi Tailwind
   * memperlakukannya seperti utilitas: hanya keluar bila terlihat oleh pemindai
   * konten. Komponen kita merangkainya secara dinamis (`avatar-${size}`,
   * `status-dot-${status}`, `badge-soft-${tone}`) sehingga 25 dari 59 kelas
   * **menghilang dari CSS produksi** tanpa terdengar oleh `tsc`, `vitest`,
   * maupun `lint` (terukur 2026-10-19 pada artefak `.next/static/css`).
   * Safelist ini menutup kelas tersebut untuk semua varian nada/ukuran yang
   * sah, sehingga perangkai dinamis aman dan gerbangnya ada di satu tempat.
   */
  safelist: [
    { pattern: /^(badge|btn)-(soft|label)-(primary|secondary|success|info|warning|danger|neutral)$/ },
    { pattern: /^avatar-(xxs|xs|sm|md|lg|xl)$/ },
    { pattern: /^status-dot-(online|busy|away|offline)$/ },
    { pattern: /^progress-(sm|lg)$/ },
    { pattern: /^(card|card-header|card-body|card-footer|card-title|card-hover)$/ },
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--sica-font-sans)'],
        mono: ['var(--sica-font-mono)'],
      },
      colors: {
        // ── Semantik Velzon ────────────────────────────────────────────────
        // DEFAULT = aksen merek (#0ab39c) untuk border/chart/progres/cincin.
        // solid   = isian tombol yang menampung teks putih (lolos AA 4.5:1).
        // ink     = teks berwarna primary di atas permukaan tema.
        primary: {
          DEFAULT: channel('--sica-rgb-primary'),
          hover: 'var(--sica-primary-hover)',
          active: 'var(--sica-primary-active)',
          soft: 'var(--sica-primary-soft)',
          on: 'var(--sica-on-primary)',
          ink: 'var(--sica-primary-ink)',
          solid: {
            DEFAULT: 'var(--sica-primary-solid)',
            hover: 'var(--sica-primary-solid-hover)',
            active: 'var(--sica-primary-solid-active)',
          },
        },
        secondary: {
          DEFAULT: channel('--sica-rgb-secondary'),
          hover: 'var(--sica-secondary-hover)',
          soft: 'var(--sica-secondary-soft)',
          on: 'var(--sica-on-secondary)',
        },
        success: {
          DEFAULT: channel('--sica-rgb-success'),
          soft: 'var(--sica-success-soft)',
          ink: 'var(--sica-primary-ink)',
          solid: { DEFAULT: 'var(--sica-primary-solid)', hover: 'var(--sica-primary-solid-hover)' },
          on: 'var(--sica-on-primary)',
        },
        info: {
          DEFAULT: channel('--sica-rgb-info'),
          hover: 'var(--sica-info-hover)',
          soft: 'var(--sica-info-soft)',
          on: 'var(--sica-on-info)',
          solid: { DEFAULT: 'var(--sica-info-solid)', hover: 'var(--sica-info-solid-hover)' },
        },
        warning: {
          DEFAULT: channel('--sica-rgb-warning'),
          hover: 'var(--sica-warning-hover)',
          soft: 'var(--sica-warning-soft)',
          on: 'var(--sica-on-warning)',
        },
        danger: {
          DEFAULT: channel('--sica-rgb-danger'),
          hover: 'var(--sica-danger-hover)',
          soft: 'var(--sica-danger-soft)',
          on: 'var(--sica-on-danger)',
          ink: 'var(--sica-danger-ink)',
          solid: { DEFAULT: 'var(--sica-danger-solid)', hover: 'var(--sica-danger-solid-hover)' },
        },

        // ── Netral (tema-sadar; `gray` dijaga sebagai jembatan compat) ─────
        slate: neutralScale('slate'),
        gray: neutralScale('slate'),

        // ── Permukaan & teks ───────────────────────────────────────────────
        sica: {
          canvas: 'var(--sica-surface-canvas)',
          card: 'var(--sica-surface-card)',
          raised: 'var(--sica-surface-raised)',
          inset: 'var(--sica-surface-inset)',
          hover: 'var(--sica-surface-hover)',
          selected: 'var(--sica-surface-selected)',
          sidebar: 'var(--sica-surface-sidebar)',
          input: 'var(--sica-surface-input)',
          border: 'var(--sica-border-color)',
          divider: 'var(--sica-divider)',
          backdrop: 'var(--sica-backdrop)',
          text: {
            DEFAULT: 'var(--sica-text-body)',
            heading: 'var(--sica-text-heading)',
            body: 'var(--sica-text-body)',
            muted: 'var(--sica-text-muted)',
            subtle: 'var(--sica-text-subtle)',
            inverse: 'var(--sica-text-inverse)',
            sidebar: 'var(--sica-text-sidebar)',
            active: 'var(--sica-text-sidebar-active)',
          },
          chart: {
            1: 'var(--sica-chart-1)',
            2: 'var(--sica-chart-2)',
            3: 'var(--sica-chart-3)',
            4: 'var(--sica-chart-4)',
            5: 'var(--sica-chart-5)',
          },
        },

        // ── Nama lama (compat; jangan dipakai untuk komponen baru) ─────────
        velzon: {
          primary: { DEFAULT: channel('--sica-rgb-primary'), hover: 'var(--sica-primary-hover)', light: 'var(--sica-primary-soft)' },
          secondary: { DEFAULT: channel('--sica-rgb-secondary'), hover: 'var(--sica-secondary-hover)', light: 'var(--sica-secondary-soft)' },
          success: { DEFAULT: channel('--sica-rgb-success'), light: 'var(--sica-success-soft)' },
          info: { DEFAULT: channel('--sica-rgb-info'), light: 'var(--sica-info-soft)' },
          warning: { DEFAULT: channel('--sica-rgb-warning'), light: 'var(--sica-warning-soft)' },
          danger: { DEFAULT: channel('--sica-rgb-danger'), light: 'var(--sica-danger-soft)' },
        },
      },
      borderRadius: {
        sm: 'var(--sica-radius-sm)',
        md: 'var(--sica-radius-md)',
        lg: 'var(--sica-radius-lg)',
        xl: 'var(--sica-radius-xl)',
        '2xl': 'var(--sica-radius-2xl)',
        full: 'var(--sica-radius-full)',
      },
      boxShadow: {
        xs: 'var(--sica-shadow-xs)',
        sm: 'var(--sica-shadow-sm)',
        card: 'var(--sica-shadow-card)',
        raised: 'var(--sica-shadow-raised)',
        dropdown: 'var(--sica-shadow-dropdown)',
        modal: 'var(--sica-shadow-modal)',
        ring: 'var(--sica-shadow-focus)',
        'slate-200/50': '0 12px 28px rgb(var(--sica-rgb-slate-300) / 0.5)',
      },
      letterSpacing: {
        tightest: 'var(--sica-tracking-display)',
        wider2: 'var(--sica-tracking-wide)',
      },
      lineHeight: {
        relaxed2: 'var(--sica-leading-loose)',
      },
      transitionTimingFunction: {
        velzon: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translate3d(0, 14px, 0)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale3d(0.96, 0.96, 1)' },
          to: { opacity: '1', transform: 'none' },
        },
        'drawer-in': {
          from: { transform: 'translate3d(24px, 0, 0)', opacity: '0' },
          to: { transform: 'none', opacity: '1' },
        },
        shimmer: { '100%': { transform: 'translate3d(100%, 0, 0)' } },
      },
      animation: {
        'fade-up': 'fade-up 520ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 420ms ease-out both',
        'scale-in': 'scale-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'drawer-in': 'drawer-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      spacing: {
        header: 'var(--sica-header-height)',
      },
    },
  },
  plugins: [],
};

export default config;
