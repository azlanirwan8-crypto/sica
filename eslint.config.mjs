// Konfigurasi ESLint_flat untuk SELURUH repo kecuali `apps/web` (Next memegang
// `.eslintrc.json` sendiri — lihat catatan di bawah). Sumber aturan tunggal; `.eslintrc.json`
// di root pernah ada tetapi ESLint 9 tidak pernah membacanya, sehingga `pnpm turbo run lint`
// keluar dengan code 2 dan gerbang "Strict No-Any" di CI sebenarnya tidak pernah berjalan.
//
// Kenapa `apps/web` dikecualikan: `next lint` memuat `.eslintrc.json` milik app-nya sendiri
// (plugin `next/core-web-vitals` hanya hidup di sana). Bila direktori ini ikut di-lint dari
// root oleh config ini, aturan Next hilang dan hasil lint menjadi dua versi — pola `RD-03`
// (dua sumber kebenaran untuk satu norma). Aturan inti AGENTS §3.1 tetap identik di keduanya.
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/drizzle/**',
      'apps/web/**',
      'apps/mobile/**',
      '.tools/**',
      'scripts/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    // Skrip tooling yang sah mencetak laporan ke stdout (mis. harness RLS, seed dev,
    // alat audit dokumen). Menolaknya akan mendorong orang menghapus gerbang, bukan
    // memakai `info` — jadi pengecualian ini dinyatakan, bukan diam-diam.
    files: ['**/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];
