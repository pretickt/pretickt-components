// After the build (`npm run check`): the built bundles, the way the generator and the browser use them. For every component and
// sample: the server checks (demo / missing / unknown data, markup); its page hydrates in happy-dom with the browser bundle keeping
// every element of the server HTML and its text, without one data request. And concurrent page renders after the warm-up are whole.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { demoFor } from '../src/typologies';
import { DEMO_ASOF } from '../src/typologies/common';

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
/** A page's server HTML hydrated with both builds, its problems labelled. */
const hydrate = (file: string, label: string, liveFile?: string) => {
  for (const [build, main] of Object.entries(mains)) {
    const out = execFileSync(process.execPath, [resolve('scripts/hydrate-case.mjs'), file, main, ...(liveFile ? [liveFile] : [])], { encoding: 'utf8', env: process.env });
    problems.push(...(JSON.parse(out.trim().split('\n').at(-1)!) as { problems: string[] }).problems.map((p) => `${label} (${build}): ${p}`));
  }
};
const page = async (label: string, items: { c: string; props: Record<string, unknown> }[]) => {
  const r = await server.renderPage({ buildId: 'check', api: '', sections: [{ id: 's', items }] }, { document: server.BARE_DOCUMENT, resolve: demo });
  const file = join(tmp, `${n++}.html`);
  writeFileSync(file, r.html);
  hydrate(file, label);
};
for (const c of index.components) for (const props of c.samples.slice(0, 2)) await page(`${c.tag} ${JSON.stringify(props)}`, [{ c: c.tag, props }]);
// the generator's pages, where a component meets the inputs it is placed with (sampled props change one input at a time) and its
// neighbours: pt-answer on each topic with the company, list or month it needs (sentences that name companies), the calendar pages
// (the answer and the calendar on one call)
const month = DEMO_ASOF.slice(0, 7);
for (const topic of ['forecast', 'price-target', 'peers', 'financials', 'insiders', 'earnings-date'])
  await page(`pt-answer ${topic} of NVDA`, [{ c: 'pt-answer', props: { topic, ticker: 'NVDA' } }]);
await page('pt-answer list', [{ c: 'pt-answer', props: { topic: 'list', list: 'biggest_losers' } }, { c: 'pt-screen', props: { list: 'biggest_losers' } }]);
const basket = (p: Record<string, unknown>, sections: string[]) => sections.map((section) => ({ c: 'pt-basket', props: { ...p, section } }));
await page('fund page', [{ c: 'pt-company-header', props: { ticker: 'SMH', size: 'full' } }, { c: 'pt-answer', props: { topic: 'basket', ticker: 'SMH' } }, ...basket({ ticker: 'SMH' }, ['moves']),
  { c: 'pt-price-target', props: { ticker: 'SMH', basket: true } }, ...basket({ ticker: 'SMH' }, ['analysts', 'holdings', 'questions', 'faq']),
  { c: 'pt-price-events', props: { ticker: 'SMH', range: '1y', fund: true } }, { c: 'pt-news', props: { ticker: 'SMH', limit: 10 } }]);
// a sector page (plant/src/generate/pages.ts sectorPage): every component takes the sector, the target chart on its value line
await page('sector page', [{ c: 'pt-answer', props: { topic: 'sector', sector: 'Technology' } }, { c: 'pt-company-header', props: { sector: 'Technology', size: 'full' } },
  ...basket({ sector: 'Technology' }, ['moves']), { c: 'pt-price-target', props: { sector: 'Technology' } }, ...basket({ sector: 'Technology' }, ['analysts', 'questions']),
  { c: 'pt-price-events', props: { sector: 'Technology' } }, { c: 'pt-news', props: { sector: 'Technology', limit: 10 } }, ...basket({ sector: 'Technology' }, ['holdings', 'faq'])]);
await page('earnings calendar page', [{ c: 'pt-answer', props: { topic: 'earnings', month } }, { c: 'pt-calendar', props: { month } }]);
await page('dividend calendar page', [{ c: 'pt-answer', props: { topic: 'dividends', month } }, { c: 'pt-calendar', props: { month, kind: 'dividend' } }]);
// the week's and the day's earnings pages (/earnings-this-week/, /earnings-today/): the answer and the week calendar on one call
await page('earnings this week page', [{ c: 'pt-answer', props: { topic: 'earnings', start: DEMO_ASOF } }, { c: 'pt-calendar', props: { month, view: 'week', start: DEMO_ASOF } }]);
await page('earnings today page', [{ c: 'pt-answer', props: { topic: 'earnings-day', start: DEMO_ASOF } }, { c: 'pt-calendar', props: { month, view: 'day', start: DEMO_ASOF } }]);
// a company page while the market is open: the card hydrates at once and loads today's file, "why it moved" hydrates once the file
// is in (every sign flipped against the demo, so a server class left beside today's shows)
{
  const t = 'NVDA', m = demoFor({ t: 'move-breakdown@1', params: { ticker: t, window: '1d' } } as never) as { market: number; sector: number; specific: number; ret: number };
  const flip = (v: number) => (v >= 0 ? -1 : 1) * Math.max(Math.abs(v), 0.01);
  const liveFile = join(tmp, 'live.json');
  writeFileSync(liveFile, JSON.stringify({ v: 1, session: '2026-10-01', prev: '2026-09-30', asOf: '2026-10-01T15:30:00Z', delayMin: 15, closed: false,
    q: { [t]: { p: 100, pc: 101, r: flip(m.ret), m: flip(m.market), s: flip(m.sector), x: flip(m.specific) } }, news: {}, earnings: {} }));
  const r = await server.renderPage({ buildId: 'check', api: '', live: 'https://storage.example/live/v1.json', sections: [
    { id: 'card', items: [{ c: 'pt-company-card', props: { ticker: t } }] }, { id: 'why', items: [{ c: 'pt-why-today', props: { ticker: t } }] }] },
  { document: server.BARE_DOCUMENT, resolve: demo });
  const file = join(tmp, 'live.html');
  writeFileSync(file, r.html);
  hydrate(file, 'company page with today\'s file', liveFile);
  n++;
}
rmSync(tmp, { recursive: true, force: true });
say(`hydration: ${n} pages`);
if (problems.length) { for (const p of problems) say(`✗ ${p}`); process.exit(1); }
say('check: ok');
process.exit(0);
