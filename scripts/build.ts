import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { componentsProgram, readInputs } from '../src/checks/inputs';
import { lintComponent } from '../src/checks/lint';
import { readComponentMeta } from '../src/checks/meta';
import { sampleProps } from '../src/checks/props';
import { componentFiles, overBudget } from './budget';
import { registrySource } from './registry';

rmSync('dist', { recursive: true, force: true });
const files = componentFiles(readdirSync('components'));
const tagOf = (f: string) => f.slice(0, -'.ts'.length);

// Metadata and lint first: a component without its question, version and evidence, or off the authoring rules, never ships.
const meta = new Map(files.map((f) => {
  const source = readFileSync(`components/${f}`, 'utf8');
  const m = readComponentMeta(source);
  if (!m.ok) throw new Error(`${f}: ${m.errors.join('; ')}`);
  const lint = lintComponent(source, tagOf(f));
  if (lint.length) throw new Error(`${f}: ${lint.join('; ')}`);
  return [f, m];
}));
// Inputs from the type checker: the registry's bindings and defaults, the catalogue's props, the checks' samples.
const program = componentsProgram(files.map((f) => resolve('components', f)));
const entries = files.map((f) => {
  const m = meta.get(f)!;
  if (!m.ok) throw new Error(f);
  const r = readInputs(program, resolve('components', f));
  return { tag: tagOf(f), className: r.className, version: m.version, major: m.major, question: m.question, evidence: m.evidence, inputs: r.inputs, samples: sampleProps(r.inputs) };
});
const registry = registrySource(entries.map((e) => ({ tag: e.tag, className: e.className, version: e.version, inputs: e.inputs, sample: e.samples[0]! })));
const registryFile = 'src/site/registry.generated.ts';
if (!existsSync(registryFile) || readFileSync(registryFile, 'utf8') !== registry) writeFileSync(registryFile, registry);

// The site app: the official compiler (Angular CLI), browser + server bundles.
execFileSync('npx', ['ng', 'build', '--stats-json'], { stdio: 'inherit' });

interface Output { bytes: number; entryPoint?: string; inputs: Record<string, unknown> }
const stats = JSON.parse(readFileSync('dist/site/browser-stats.json', 'utf8')) as { outputs: Record<string, Output> };
const outputs = Object.entries(stats.outputs).filter(([k]) => k.endsWith('.js'));
const main = outputs.find(([, o]) => o.entryPoint === 'src/site/main.ts');
if (!main) throw new Error('no main bundle in the build stats');
const big = overBudget('main', main[1].bytes);
if (big) throw new Error(big);
const chunks = entries.map((e) => {
  const own = outputs.find(([, o]) => o.entryPoint === `components/${e.tag}.ts`);
  if (!own) throw new Error(`${e.tag}: no lazy chunk of its own (every component is a @defer block of the registry)`);
  const over = overBudget('component', own[1].bytes);
  if (over) throw new Error(`${e.tag}: ${over}`);
  return own[0];
});

execFileSync('npx', ['@tailwindcss/cli', '-i', 'styles/ds.css', '-o', 'dist/ds.css', '--minify'], { stdio: 'inherit' });
// the fonts ds.css names (/fonts/…) and the brand marks (logo, favicon): the platform publishes them beside ds.css
cpSync('styles/fonts', 'dist/fonts', { recursive: true, filter: (f) => !f.endsWith('.txt') });
cpSync('styles/brand', 'dist/brand', { recursive: true });

writeFileSync('dist/index.json', JSON.stringify({
  site: { browser: 'site/browser', server: 'site/server/main.server.mjs', polyfills: 'site/server/polyfills.server.mjs', template: 'site/server/index.server.html', main: `site/browser/${main[0]}` },
  components: entries.map((e, i) => ({ tag: e.tag, version: e.version, major: e.major, question: e.question, evidence: e.evidence,
    props: e.inputs.map((p) => ({ name: p.name, required: p.required, type: p.type, default: 'default' in p ? JSON.stringify(p.default) : null })),
    samples: e.samples, source: `components/${e.tag}.ts`, chunk: `site/browser/${chunks[i]}` })),
}, null, 2));
const gz = gzipSync(readFileSync(`dist/site/browser/${main[0]}`)).length;
console.log(`built ${entries.length} components; every page loads ${main[1].bytes} bytes of main bundle (${gz} gzip)`);
