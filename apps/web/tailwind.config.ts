import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Velzon Design Tokens
        velzon: {
          primary: {
            DEFAULT: '#3577f1',
            hover: '#2960c9',
            light: 'rgba(53, 119, 241, 0.1)',
          },
          secondary: {
            DEFAULT: '#405189',
            hover: '#344270',
            light: 'rgba(64, 81, 137, 0.1)',
          },
          success: {
            DEFAULT: '#0ab39c',
            light: 'rgba(10, 179, 156, 0.1)',
          },
          info: {
            DEFAULT: '#299cdb',
            light: 'rgba(41, 156, 219, 0.1)',
          },
          warning: {
            DEFAULT: '#f7b84b',
            light: 'rgba(247, 184, 75, 0.12)',
          },
          danger: {
            DEFAULT: '#f06548',
            light: 'rgba(240, 101, 72, 0.1)',
          },
        },
        // Semantic Canvas / Surfaces
        sica: {
          canvas: 'var(--sica-surface-canvas)',
          card: 'var(--sica-surface-card)',
          sidebar: 'var(--sica-surface-sidebar)',
          border: 'var(--sica-border-color)',
          text: {
            heading: 'var(--sica-text-heading)',
            body: 'var(--sica-text-body)',
            muted: 'var(--sica-text-muted)',
            sidebar: 'var(--sica-text-sidebar)',
          },
        },
      },
      borderRadius: {
        sm: 'var(--sica-radius-sm)',
        md: 'var(--sica-radius-md)',
        lg: 'var(--sica-radius-lg)',
        xl: 'var(--sica-radius-xl)',
      },
      boxShadow: {
        card: 'var(--sica-shadow-card)',
        dropdown: 'var(--sica-shadow-dropdown)',
      },
    },
  },
  plugins: [],
};

export default config;
