import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { componentFiles } from './budget';
import { describe, expect, it } from 'vitest';

describe('build', () => {
  it('emits static and browser bundles, host, css and the index', async () => {
    execFileSync('npx', ['tsx', 'scripts/build.ts'], { stdio: 'inherit' });
    const index = JSON.parse(readFileSync('dist/index.json', 'utf8')) as { components: { tag: string; static: string; browser: string; element: string }[] };
    expect(index.components.map((c) => `${c.tag}.ts`).sort()).toEqual(componentFiles(readdirSync('components')));
    for (const c of index.components) {
      const s = readFileSync(`dist/${c.static}`, 'utf8');
      expect(s).not.toMatch(/lit-html|LitElement|customElements/);
      expect(existsSync(`dist/${c.browser}`)).toBe(true);
      const m = await import(`${process.cwd()}/dist/${c.static}`);
      expect(typeof m.renderStatic).toBe('function');
      expect(m.manifest.tag).toBe(c.tag);
    }
    expect(existsSync('dist/host.js')).toBe(true); // the size budget is enforced by the build itself (scripts/budget.ts)
    // Shared code (zod, typology schemas, SDK pieces) is one set of immutable chunks, not a copy per bundle: each browser file imports
    // /c/chunk-*.js files that exist and carries no zod of its own.
    const chunkImports = (file: string) => [...readFileSync(file, 'utf8').matchAll(/from\s*"\/c\/(chunk-[A-Z0-9]+\.js)"/g)].map((m) => m[1]!);
    for (const file of ['dist/host.js', ...index.components.map((c) => `dist/${c.browser}`)]) {
      const js = readFileSync(file, 'utf8');
      expect(js, file).not.toContain('ZodError');
      expect(chunkImports(file).length, file).toBeGreaterThan(0);
      for (const ch of chunkImports(file)) expect(existsSync(`dist/browser/${ch}`), ch).toBe(true);
    }
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
