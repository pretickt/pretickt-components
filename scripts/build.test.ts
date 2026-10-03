import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('build', () => {
  it('emits static and browser bundles, host, css and the index', async () => {
    execFileSync('npx', ['tsx', 'scripts/build.ts'], { stdio: 'inherit' });
    const index = JSON.parse(readFileSync('dist/index.json', 'utf8')) as { components: { tag: string; static: string; browser: string; element: string }[] };
    expect(index.components.map((c) => c.tag).sort()).toEqual(['pt-calendar', 'pt-metric', 'pt-price-events', 'pt-price-target']);
    for (const c of index.components) {
      const s = readFileSync(`dist/${c.static}`, 'utf8');
      expect(s).not.toMatch(/lit-html|LitElement|customElements/);
      expect(existsSync(`dist/${c.browser}`)).toBe(true);
      const m = await import(`${process.cwd()}/dist/${c.static}`);
      expect(typeof m.renderStatic).toBe('function');
      expect(m.manifest.tag).toBe(c.tag);
    }
    expect(existsSync('dist/host.js')).toBe(true);
    // Size budget: classic zod (453 KB, not tree-shakeable) once slipped in — public pages must stay light.
    expect(statSync('dist/host.js').size).toBeLessThan(100_000);
    for (const c of index.components) expect(statSync(`dist/${c.browser}`).size, c.tag).toBeLessThan(60_000);
    expect(readFileSync('dist/ds.css', 'utf8')).toContain('pt-badge');
  }, 120_000);
});
