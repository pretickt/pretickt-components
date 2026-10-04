import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { elementName, majorOf, type ComponentModule } from '../src/sdk';
import { checkContract, lintSource } from '../src/sdk/tools';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/static', { recursive: true });
mkdirSync('dist/browser', { recursive: true });

const common = { bundle: true, format: 'esm' as const, target: 'es2022', minify: true, legalComments: 'none' as const, logLevel: 'error' as const };
const files = readdirSync('components').filter((f) => /^pt-[a-z0-9-]+\.ts$/.test(f)).sort();
const index: Record<string, unknown>[] = [];

for (const f of files) {
  const src = readFileSync(`components/${f}`, 'utf8');
  const lint = lintSource(src, f);
  if (lint.length) throw new Error(`${f}: ${lint.map((v) => `${v.line}:${v.rule} ${v.message}`).join('; ')}`);
  const mod = (await import(`../components/${f}`)) as ComponentModule;
  const errors = checkContract(mod);
  if (errors.length) throw new Error(`${f}: ${errors.join('; ')}`);
  const { tag, version } = mod.manifest;
  const id = `${tag}@${version}`;
  await build({ ...common, platform: 'neutral', mainFields: ['module', 'main'], outfile: `dist/static/${id}.js`,
    stdin: { contents: `export { manifest, renderStatic, samples } from './components/${f}';`, resolveDir: process.cwd(), loader: 'ts' } });
  const browser = await build({ ...common, platform: 'browser', write: false,
    stdin: { contents: `export * from './components/${f}';`, resolveDir: process.cwd(), loader: 'ts' } });
  const bytes = browser.outputFiles[0]!.contents;
  // served as immutable: the name carries a hash of the bytes, so an SDK-only change still gets a new URL
  const file = `browser/${id}.${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}.js`;
  writeFileSync(`dist/${file}`, bytes);
  index.push({ tag, version, major: majorOf(version), element: elementName(mod.manifest), static: `static/${id}.js`, browser: file });
}

await build({ ...common, platform: 'browser', entryPoints: ['src/host/entry.ts'], outfile: 'dist/host.js' });
execFileSync('npx', ['@tailwindcss/cli', '-i', 'styles/ds.css', '-o', 'dist/ds.css', '--minify'], { stdio: 'inherit' });
writeFileSync('dist/index.json', JSON.stringify({ components: index }, null, 2));
console.log(`built ${index.length} components`);
