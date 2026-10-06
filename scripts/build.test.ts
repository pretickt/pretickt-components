import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demoFor } from '../src/typologies';
import { componentFiles } from './budget';

interface Entry { tag: string; version: string; major: number; question: string; evidence: string[]; props: { name: string; required: boolean }[]; samples: Record<string, unknown>[]; client: string; css: string[] }

describe('build', () => {
  it('emits the server bundle, the client modules, the runtime, the design system and the index', async () => {
    execFileSync('npx', ['tsx', 'scripts/build.ts'], { stdio: 'inherit' });
    const index = JSON.parse(readFileSync('dist/index.json', 'utf8')) as { runtime: string; components: Entry[] };
    const server = await import(`${process.cwd()}/dist/server/index.js`);
    expect(index.components.map((c) => `${c.tag}.vue`).sort()).toEqual(componentFiles(readdirSync('components')));
    for (const c of index.components) {
      expect(c.version, c.tag).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.question.length, c.tag).toBeGreaterThan(10);
      expect(c.evidence.length, c.tag).toBeGreaterThan(0);
      expect(c.props.length, c.tag).toBeGreaterThan(0);
      expect(c.samples.length, c.tag).toBeGreaterThan(0);
      expect(c.props.every((p) => p.type !== 'any'), `${c.tag}: prop types resolved`).toBe(true);
      expect(await server.checkComponent(server.components[c.tag], c.samples), c.tag).toEqual([]);
      // served immutable from /c/: content-hashed names, no "@" (asset hosting rewrites it), a module whose default export is the component
      expect(c.client, c.tag).toMatch(/^client\/pt-[a-z0-9-]+\.[A-Za-z0-9_-]{8}\.js$/);
      expect(readFileSync(`dist/${c.client}`, 'utf8'), c.tag).toMatch(/export\s*\{[^}]*\bas default\b/);
      for (const css of c.css) expect(existsSync(`dist/${css}`), css).toBe(true);
    }
    expect(readdirSync('dist/client').filter((f) => f.includes('@'))).toEqual([]);
    expect(existsSync(`dist/${index.runtime}`)).toBe(true);
    // one Vue for the page: the runtime and every component import the same shared chunks
    const imports = (file: string) => [...readFileSync(`dist/${file}`, 'utf8').matchAll(/["'](?:\.\/|\/c\/)(chunk-[^"'\/]+\.js)["']/g)].map((m) => m[1]!);
    const runtimeChunks = new Set(imports(index.runtime));
    for (const c of index.components) expect(imports(c.client).some((x) => runtimeChunks.has(x)), c.tag).toBe(true);

    // the server bundle renders every component the way the generator will
    for (const c of index.components) {
      const props = { ticker: 'NVDA', metrics: ['pe'], month: '2026-10' };
      const r = await server.renderIsland(server.components[c.tag], props, { resolve: async (t: string, p: unknown) => demoFor({ t, params: p }) });
      expect(r.markup, c.tag).toEqual([]);
      expect(r.html.length, c.tag).toBeGreaterThan(50);
      expect(server.islandMarkup(`${c.tag}@${c.version}`, props, r.html)).toContain(`data-island="${c.tag}@${c.version}"`);
    }
    expect(readFileSync('dist/ds.css', 'utf8')).toContain('pt-badge');
  }, 300_000);
});
