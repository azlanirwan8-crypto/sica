import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Alias `@/` → src/ agar modul app (mis. api-response → @/modules/...) dapat
// di-resolve saat pengujian, sama seperti tsconfig paths di build.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
