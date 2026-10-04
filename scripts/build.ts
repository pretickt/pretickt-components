import { build, type Metafile } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { elementName, majorOf, type ComponentModule } from '../src/sdk';
import { componentFiles, overBudget } from './budget';
import { checkContract } from '../src/sdk/contract';
import { lintSource } from '../src/sdk/lint';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/static', { recursive: true });
mkdirSync('dist/browser', { recursive: true });

const common = { bundle: true, format: 'esm' as const, target: 'es2022', minify: true, legalComments: 'none' as const, logLevel: 'error' as const };
const built: { f: string; id: string; mod: ComponentModule }[] = [];

// Static bundles (Node and QuickJS render them at build time): one self-contained file per component.
for (const f of componentFiles(readdirSync('components'))) {
  const lint = lintSource(readFileSync(`components/${f}`, 'utf8'), f);
  if (lint.length) throw new Error(`${f}: ${lint.map((v) => `${v.line}:${v.rule} ${v.message}`).join('; ')}`);
  const mod = (await import(`../components/${f}`)) as ComponentModule;
  const errors = checkContract(mod);
  if (errors.length) throw new Error(`${f}: ${errors.join('; ')}`);
  const id = `${mod.manifest.tag}@${mod.manifest.version}`;
  await build({ ...common, platform: 'neutral', mainFields: ['module', 'main'], outfile: `dist/static/${id}.js`,
    stdin: { contents: `export { manifest, renderStatic, samples } from './components/${f}';`, resolveDir: process.cwd(), loader: 'ts' } });
  built.push({ f, id, mod });
}

// Browser bundles: the host and every component in one build, so the code they share (zod, typology schemas, SDK pieces) is one set of
// chunks the browser caches once, instead of a copy inside every bundle. Chunks are imported by absolute path (/c/, where the site serves
// dist/browser), so host.js can stay at the site root.
const out = await build({
  ...common, platform: 'browser', write: false, metafile: true, splitting: true, outdir: 'dist/browser', publicPath: '/c/', chunkNames: 'chunk-[hash]',
  entryPoints: [{ in: 'src/host/entry.ts', out: 'host' }, ...built.map((b) => ({ in: `components/${b.f}`, out: b.id }))],
});
const bytesOf = new Map(out.outputFiles.map((o) => [basename(o.path), o.contents]));
const meta: Metafile['outputs'] = Object.fromEntries(Object.entries(out.metafile.outputs).map(([k, v]) => [basename(k), v]));
/** A file plus every chunk it pulls in. */
const closure = (name: string, seen = new Set<string>()): Set<string> => {
  if (seen.has(name)) return seen;
  seen.add(name);
  for (const i of meta[name]?.imports ?? []) if (i.kind === 'import-statement') closure(basename(i.path), seen);
  return seen;
};
const size = (names: Iterable<string>) => [...names].reduce((n, x) => n + (bytesOf.get(x)?.length ?? 0), 0);

for (const [name, bytes] of bytesOf) if (name.startsWith('chunk-')) writeFileSync(`dist/browser/${name}`, bytes); // esbuild hashes chunk names
const hostFiles = closure('host.js');
const hostBig = overBudget('host', size(hostFiles)); // what every page loads
if (hostBig) throw new Error(hostBig);
writeFileSync('dist/host.js', bytesOf.get('host.js')!);

const index = built.map(({ f, id, mod }) => {
  const bytes = bytesOf.get(`${id}.js`)!;
  // budgeted on what the component adds to a page that already has the host
  const big = overBudget('component', size([...closure(`${id}.js`)].filter((x) => !hostFiles.has(x))));
  if (big) throw new Error(`${f}: ${big}`);
  // served as immutable: the name carries a hash of the bytes (which name the chunks they import), so any change is a new URL
  const file = `browser/${id}.${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}.js`;
  writeFileSync(`dist/${file}`, bytes);
  const { tag, version } = mod.manifest;
  return { tag, version, major: majorOf(version), element: elementName(mod.manifest), static: `static/${id}.js`, browser: file };
});

execFileSync('npx', ['@tailwindcss/cli', '-i', 'styles/ds.css', '-o', 'dist/ds.css', '--minify'], { stdio: 'inherit' });
writeFileSync('dist/index.json', JSON.stringify({ components: index }, null, 2));
console.log(`built ${index.length} components; a page loads ${size(hostFiles)} bytes of host code`);
