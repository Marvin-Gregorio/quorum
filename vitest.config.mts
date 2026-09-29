import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/rls/**/*.test.ts'],
    // The RLS suite's beforeAll hooks each mint several real users/sessions
    // against a local Supabase Auth instance; with enough RLS test files
    // running as parallel workers, that can comfortably exceed vitest's
    // default 10s hook timeout even though nothing is actually broken.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
