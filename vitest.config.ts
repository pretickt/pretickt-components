import { defineConfig } from 'vitest/config';

// Plain TypeScript tests (typologies, indicators, checks, scripts, the page runtime's DOM code). Angular specs run with `ng test`.
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
