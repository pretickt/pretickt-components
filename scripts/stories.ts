/**
 * `npm run stories`: the stories page on http://localhost:4300 (see src/stories/story.ts). Three things run together: Tailwind
 * rebuilds ds.css on every change, `ng serve stories` serves the app (its proxy answers the live stories from www), and the
 * platform's experiments (`../pretickt-platform/admin/experiments`, or `PT_EXPERIMENTS`) are copied in with their bench presets as
 * stories, again whenever they change. Extra arguments go to `ng serve` (`npm run stories -- --port 4301`).
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { experimentsCss, experimentsModule, readExperiments } from './stories-experiments';

const OUT = '.stories';
const ROOT = resolve(process.env.PT_EXPERIMENTS ?? '../pretickt-platform/admin/experiments');

/** Writes only what changed: every write makes the dev server build again. */
function put(path: string, text: string) {
  if (existsSync(path) && readFileSync(path, 'utf8') === text) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function sync() {
  const list = readExperiments(ROOT);
  for (const e of list) for (const c of e.components) put(join(OUT, 'experiments', e.slug, `${c.tag}.ts`), c.source);
  put(join(OUT, 'experiments.ts'), experimentsModule(list));
  put(join(OUT, 'experiments.css'), experimentsCss(list));
  return list;
}

const found = sync();
console.log(existsSync(ROOT)
  ? `stories: experiments from ${ROOT}: ${found.map((e) => `${e.slug} (${e.components.length})`).join(', ') || 'none'}`
  : `stories: no experiments (${ROOT} not found)`);
if (existsSync(ROOT)) {
  let timer: NodeJS.Timeout | undefined;
  watch(ROOT, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(sync, 200); });
}

// ds.css once before the server starts (the page links it), then on every change; `always` keeps watching without a terminal
const tailwind = ['@tailwindcss/cli', '-i', 'styles/ds.css', '-o', join(OUT, 'ds.css')];
execFileSync('npx', tailwind, { stdio: 'inherit' });
const children = [
  spawn('npx', [...tailwind, '--watch=always'], { stdio: 'inherit' }),
  spawn('npx', ['ng', 'serve', 'stories', '-c', 'experiments', ...process.argv.slice(2)], { stdio: 'inherit' }),
];
const stop = (code: number) => { for (const c of children) c.kill(); process.exit(code); };
for (const c of children) c.on('exit', (code) => stop(code ?? 0));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
