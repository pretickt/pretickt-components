import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('build', () => {
  it('emits static and browser bundles, host, css and the index', async () => {
    execFileSync('npx', ['tsx', 'scripts/build.ts'], { stdio: 'inherit' });
    const index = JSON.parse(readFileSync('dist/index.json', 'utf8')) as { components: { tag: string; static: string; browser: string; element: string }[] };
    expect(index.components.map((c) => c.tag).sort()).toEqual(['pt-calendar', 'pt-financials', 'pt-insiders', 'pt-metric', 'pt-news', 'pt-price-events', 'pt-price-target', 'pt-screen', 'pt-why-today']);
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
    // Only the component's own code plus what it uses: zod and the typologies it does not touch are tree-shaken.
    for (const c of index.components) expect(statSync(`dist/${c.browser}`).size, c.tag).toBeLessThan(32_000);
    // Browser bundles are served as immutable for a year: the file name carries a hash of the bytes, so any change (component
    // or SDK) is a new URL and no visitor keeps stale code.
    for (const c of index.components) {
      const m = /^browser\/(pt-[a-z0-9-]+@\d+\.\d+\.\d+)\.([0-9a-f]{12})\.js$/.exec(c.browser);
      expect(m, c.browser).not.toBeNull();
      expect(createHash('sha256').update(readFileSync(`dist/${c.browser}`)).digest('hex').slice(0, 12)).toBe(m![2]);
    }
    expect(readFileSync('dist/ds.css', 'utf8')).toContain('pt-badge');
  }, 120_000);
});
