import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { execFileSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build, type Manifest } from 'vite';
import { createChecker } from 'vue-component-meta';
import { readComponentMeta } from '../src/checks/meta';
import { sampleProps, type PropInfo } from '../src/checks/props';
import { componentFiles, overBudget } from './budget';
import { selfImports } from './self';

rmSync('dist', { recursive: true, force: true });
const files = componentFiles(readdirSync('components'));
const tagOf = (f: string) => f.slice(0, -'.vue'.length);
const plugins = [selfImports(), tailwindcss(), vue()];
// Vue's compile-time flags: no Options API, no devtools, short hydration warnings in production.
const define = { __VUE_OPTIONS_API__: 'false', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' };

// Metadata first: a component without its question, version and evidence never ships.
const meta = new Map(files.map((f) => {
  const m = readComponentMeta(readFileSync(`components/${f}`, 'utf8'));
  if (!m.ok) throw new Error(`${f}: ${m.errors.join('; ')}`);
  return [f, m];
}));
// absolute paths: with relative ones the checker cannot follow the package's self imports and types fall back to `any`
const checker = createChecker(resolve('tsconfig.json'), { forceUseTs: true, schema: { ignore: [] } });

// Client: the islands runtime and one module per component in one build, so Vue and the shared code are one set of chunks the
// browser caches once. Served from /c/ as immutable: names carry a content hash and no "@" (asset hosting rewrites it).
await build({
  configFile: false, logLevel: 'warn', plugins, define, base: '/c/',
  build: {
    outDir: 'dist/client', emptyOutDir: true, manifest: true, minify: true, cssCodeSplit: true, target: 'es2022',
    rollupOptions: {
      input: { islands: 'src/islands/entry.ts', ...Object.fromEntries(files.map((f) => [tagOf(f), `components/${f}`])) },
      preserveEntrySignatures: 'exports-only', // the runtime imports a component module for its default export
      output: { entryFileNames: '[name].[hash].js', chunkFileNames: 'chunk-[hash].js', assetFileNames: '[name].[hash][extname]' },
    },
  },
});
// Server: every component and the island renderer, for the generator (Node). Dependencies (vue, zod) stay external.
await build({
  configFile: false, logLevel: 'warn', plugins, define,
  build: { ssr: 'src/server-entry.ts', outDir: 'dist/server', emptyOutDir: true, target: 'node22', rollupOptions: { output: { entryFileNames: 'index.js', format: 'es' } } },
});

const manifest = JSON.parse(readFileSync('dist/client/.vite/manifest.json', 'utf8')) as Manifest;
const bytes = (file: string) => readFileSync(`dist/client/${file}`).length;
/** A manifest entry plus every chunk it imports statically. */
const closure = (key: string, seen = new Set<string>()): Set<string> => {
  const e = manifest[key];
  if (!e || seen.has(e.file)) return seen;
  seen.add(e.file);
  for (const i of e.imports ?? []) closure(i, seen);
  return seen;
};
const runtimeKey = 'src/islands/entry.ts';
const runtimeFiles = closure(runtimeKey);
const runtimeBytes = [...runtimeFiles].reduce((n, f) => n + bytes(f), 0);
const big = overBudget('runtime', runtimeBytes);
if (big) throw new Error(big);

const components = files.map((f) => {
  const m = meta.get(f)!;
  if (!m.ok) throw new Error(f);
  const key = `components/${f}`;
  const entry = manifest[key]!;
  const own = [...closure(key)].filter((x) => !runtimeFiles.has(x)); // what the component adds to a page that has the runtime
  const over = overBudget('component', own.reduce((n, x) => n + bytes(x), 0));
  if (over) throw new Error(`${f}: ${over}`);
  const propMeta = checker.getComponentMeta(resolve(`components/${f}`)).props.filter((p) => !p.global);
  const props = propMeta.map((p) => ({ name: p.name, required: p.required, type: p.type, default: p.default ?? null }));
  // the props the checks render with (and the bench starts from): sampled from the prop types
  const samples = sampleProps(propMeta.map((p) => ({ name: p.name, required: p.required, schema: p.schema as PropInfo['schema'], default: p.default })));
  return { tag: tagOf(f), version: m.version, major: m.major, question: m.question, evidence: m.evidence, props, samples,
    client: `client/${entry.file}`, css: (entry.css ?? []).map((c) => `client/${c}`) };
});

execFileSync('npx', ['@tailwindcss/cli', '-i', 'styles/ds.css', '-o', 'dist/ds.css', '--minify'], { stdio: 'inherit' });
// the fonts ds.css names (/fonts/…) and the brand marks (logo, favicon): the platform publishes them beside ds.css
cpSync('styles/fonts', 'dist/fonts', { recursive: true, filter: (f) => !f.endsWith('.txt') });
cpSync('styles/brand', 'dist/brand', { recursive: true });
writeFileSync('dist/index.json', JSON.stringify({ runtime: `client/${manifest[runtimeKey]!.file}`, components }, null, 2));
const gz = [...runtimeFiles].reduce((n, f) => n + gzipSync(readFileSync(`dist/client/${f}`)).length, 0);
console.log(`built ${components.length} components; every page loads ${runtimeBytes} bytes of runtime (${gz} gzip)`);
