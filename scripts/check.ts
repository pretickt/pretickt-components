// After the build (`npm run check`): the built bundles, the way the generator and the browser use them. For every component and
// sample: the server checks (demo / missing / unknown data, markup); its page hydrates in happy-dom with the browser bundle keeping
// every element of the server HTML and its text, without one data request. And concurrent page renders after the warm-up are whole.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { demoFor } from '../src/typologies';

const dist = resolve('dist');
// Hydration is checked twice: with a development build (Angular validates every node it adopts: a structural mismatch is NG0500)
// and with the production build (what ships: it adopts nodes by position and would not notice).
execFileSync('npx', ['ng', 'build', '--configuration', 'development', '--output-path', 'dist-dev'], { stdio: 'ignore' });
const mains = { development: pathToFileURL(resolve('dist-dev/browser/main.js')).href, production: '' };
const index = JSON.parse(readFileSync(`${dist}/index.json`, 'utf8')) as {
  site: { server: string; polyfills: string; main: string };
  components: { tag: string; samples: Record<string, unknown>[] }[];
};
await import(pathToFileURL(`${dist}/${index.site.polyfills}`).href);
const server = await import(pathToFileURL(`${dist}/${index.site.server}`).href) as typeof import('../src/site/main.server');
const demo = async (t: string, params: unknown) => demoFor({ t, params } as never);
const problems: string[] = [];
const say = (s: string) => process.stdout.write(`${s}\n`);

await server.warmUp(demo);
for (const c of index.components) for (const e of await server.checkComponent(c.tag, c.samples)) problems.push(`${c.tag}: ${e}`);
say(`server checks: ${index.components.length} components`);

// concurrent renders after the warm-up are whole (the lazy-chunk state is shared by every render in the process)
const all = index.components.flatMap((c) => c.samples.map((props) => ({ c: c.tag, props })));
const pages = Array.from({ length: 30 }, (_, i) => ({ buildId: 'check', api: '', sections: [{ id: 's', items: [all[i % all.length]!, all[(i * 7 + 3) % all.length]!] }] }));
let next = 0;
const empties: string[] = [];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < pages.length) {
    const r = await server.renderPage(pages[next++]!, { document: server.BARE_DOCUMENT, resolve: demo });
    empties.push(...r.empty);
  }
}));
if (empties.length) problems.push(`concurrent renders: ${empties.length} empty placement(s)`);
say(`concurrent renders: ${pages.length} pages, ${empties.length} empty`);

// hydration in a browser-like DOM, with the browser bundle: one process per page, as a browser loads the bundle once per page
const tmp = mkdtempSync(join(tmpdir(), 'pt-check-'));
mains.production = pathToFileURL(`${dist}/${index.site.main}`).href;
let n = 0;
for (const c of index.components) {
  for (const props of c.samples.slice(0, 2)) {
    const label = `${c.tag} ${JSON.stringify(props)}`;
    const r = await server.renderPage({ buildId: 'check', api: '', sections: [{ id: 's', items: [{ c: c.tag, props }] }] }, { document: server.BARE_DOCUMENT, resolve: demo });
    const file = join(tmp, `${n++}.html`);
    writeFileSync(file, r.html);
    for (const [build, main] of Object.entries(mains)) {
      const out = execFileSync(process.execPath, [resolve('scripts/hydrate-case.mjs'), file, main], { encoding: 'utf8', env: process.env });
      const { problems: found } = JSON.parse(out.trim().split('\n').at(-1)!) as { problems: string[] };
      problems.push(...found.map((p) => `${label} (${build}): ${p}`));
    }
  }
}
rmSync(tmp, { recursive: true, force: true });
say(`hydration: ${n} pages`);
if (problems.length) { for (const p of problems) say(`✗ ${p}`); process.exit(1); }
say('check: ok');
process.exit(0);
