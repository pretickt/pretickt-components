import vue from '@vitejs/plugin-vue';
import { selfImports } from './scripts/self';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [selfImports(), vue()],
  test: { include: ['src/**/*.test.ts', 'components/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
