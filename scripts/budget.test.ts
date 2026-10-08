import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUDGET, componentFiles, overBudget } from './budget';

describe('build budget', () => {
  it('one size budget per kind, enforced where the files are produced', () => {
    expect(overBudget('main', BUDGET.main)).toBeNull();
    expect(overBudget('component', BUDGET.component + 1)).toMatch(/component bundle is \d+ bytes, over the 32000-byte budget/);
  });
  it('the components to build are the pt-*.ts files, never their specs or the spec helpers', () => {
    const files = componentFiles(readdirSync('components'));
    expect(files.length).toBe(10);
    expect(files.every((f) => /^pt-[a-z0-9-]+\.ts$/.test(f))).toBe(true);
  });
});
