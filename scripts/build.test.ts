import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { demoFor } from '../src/typologies';
import { describe, expect, it } from 'vitest';
import { componentFiles } from './budget';

interface Entry { tag: string; version: string; major: number; question: string; evidence: string[]; props: { name: string; required: boolean; type: string; default: string | null }[];
  samples: Record<string, unknown>[]; source: string; chunk: string }

describe('build', () => {
  it('emits the site bundles, the design system and the index; the registry in the repo is current; every component passes the checks', () => {
    execFileSync('npx', ['tsx', 'scripts/build.ts'], { stdio: 'inherit' });
    const index = JSON.parse(readFileSync('dist/index.json', 'utf8')) as { site: Record<string, string>; components: Entry[] };
    expect(index.components.map((c) => `${c.tag}.ts`).sort()).toEqual(componentFiles(readdirSync('components')));
    for (const c of index.components) {
      expect(c.version, c.tag).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.question.length, c.tag).toBeGreaterThan(10);
      expect(c.evidence.length, c.tag).toBeGreaterThan(0);
      expect(c.props.length, c.tag).toBeGreaterThan(0);
      expect(c.props.every((p) => p.type !== 'any'), `${c.tag}: input types resolved`).toBe(true);
      expect(c.samples.length, c.tag).toBeGreaterThan(0);
      expect(existsSync(`dist/${c.chunk}`), c.tag).toBe(true);
    }
    for (const f of Object.values(index.site)) expect(existsSync(`dist/${f}`), f).toBe(true);
    for (const f of ['ds.css', 'fonts', 'brand/favicon.svg']) expect(existsSync(`dist/${f}`), f).toBe(true);
    expect(index.components.find((c) => c.tag === 'pt-why-today')!.props).toContainEqual({ name: 'window', required: false, type: 'Window', default: '"1d"' });
    // the build regenerates the registry from the components: committed and generated must agree
    execFileSync('git', ['diff', '--exit-code', '--', 'src/site/registry.generated.ts']);
    execFileSync('npx', ['tsx', 'scripts/check.ts'], { stdio: 'inherit' });
  }, 900_000);

  it('the server bundle: a component that throws fails the render; renders sharing a cache resolve each call once', async () => {
    const index = JSON.parse(readFileSync('dist/index.json', 'utf8')) as { site: { server: string; polyfills: string } };
    await import(pathToFileURL(resolve('dist', index.site.polyfills)).href);
    const server = await import(pathToFileURL(resolve('dist', index.site.server)).href) as typeof import('../src/site/main.server');
    // params the typology rejects are a component bug: the render throws, the check says so
    expect(await server.checkComponent('pt-metric', [{ ticker: 'NVDA', metrics: ['not-a-metric'] }])).toEqual(expect.arrayContaining([expect.stringMatching(/throws/)]));
    const asked: string[] = [];
    const resolveDemo = async (t: string, params: unknown) => { asked.push(`${t}|${JSON.stringify(params)}`); return demoFor({ t, params } as never); };
    const cache = new Map<string, Promise<unknown>>();
    const page = { buildId: 'b', api: '', sections: [{ id: 's', items: [{ c: 'pt-company-card', props: { ticker: 'NVDA' } }] }] };
    await server.renderPage(page, { document: server.BARE_DOCUMENT, resolve: resolveDemo, cache });
    await server.renderPage(page, { document: server.BARE_DOCUMENT, resolve: resolveDemo, cache });
    expect(asked).toHaveLength(3); // the second page found the company card's three answers in the cache
  }, 300_000);
});
