// One hydration case, in a process of its own (one page loads the browser bundle once): the server HTML in happy-dom, the browser
// bundle, every placement in view. Prints one JSON line: problems (empty = clean). Usage: node hydrate-case.mjs <page.html> <main.js URL>
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { readFileSync } from 'node:fs';

const [file, main, liveFile] = process.argv.slice(2);
// with an intraday file: the page reads it, and every island after the first comes into view only once it has arrived (a reader
// scrolling down a company page: the card hydrates at once, "why it moved" later)
const live = liveFile ? readFileSync(liveFile, 'utf8') : null;
GlobalRegistrator.register({ url: 'http://localhost/', width: 1280, height: 800 });
const requests = [];
globalThis.fetch = async (u) => {
  requests.push(String(u));
  if (live && String(u).includes('/live/')) return new Response(live, { status: 200, headers: { 'content-type': 'application/json' } });
  throw new Error('no network in the check');
};
// every placement "in view": incremental hydration hydrates them all
let seen = 0;
globalThis.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) {
  const go = () => this.cb([{ isIntersecting: true, intersectionRatio: 1, target: el }]);
  if (live && seen++ > 0) setTimeout(go, 300); else queueMicrotask(go);
} unobserve() {} disconnect() {} takeRecords() { return []; } };
const errors = [];
console.error = (...a) => { errors.push(a.map((x) => (x instanceof Error ? `${x.message}${process.env.CHECK_DEV ? `\n${x.stack}` : ''}` : String(x))).join(' ').slice(0, process.env.CHECK_DEV ? 4000 : 300)); };
console.warn = () => {};
document.open(); document.write(readFileSync(file, 'utf8')); document.close();
const root = document.querySelector('pt-page');
const before = [...root.querySelectorAll('*')];
const text = root.textContent;
const problems = [];
await import(main);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 100 && root.querySelector('[ngh]'); i++) await wait(20);
await wait(50);
if (root.querySelector('[ngh]')) problems.push('not hydrated after 2 s');
const lost = before.filter((el) => !el.isConnected).length;
// (with today's file the card switches to today's price after its first render: elements it replaces then are no hydration loss)
if (lost && !live) problems.push(`hydration replaced ${lost} of ${before.length} elements of the server HTML`);
if (live) {
  await wait(300);
  // a binding that met live values while hydrating keeps the server's classes and styles beside its own
  const mixed = [...root.querySelectorAll('[class]')].filter((el) => {
    const tones = [...el.classList].filter((c) => /-(pos|neg|flat|na)$/.test(c));
    const st = el.getAttribute('style') ?? '';
    return tones.length > 1 || (/\bleft:/.test(st) && /\bright:/.test(st));
  });
  if (mixed.length) problems.push(`live: ${mixed.length} element(s) mix the server's classes or styles with today's (${mixed[0].className})`);
  if (!root.textContent.includes('today')) problems.push('live: today\'s file was not shown');
} else if (root.textContent !== text) problems.push('the text changed while hydrating');
const data = requests.filter((u) => u.includes('/v1/t/'));
if (data.length) problems.push(`${data.length} data request(s) on load (${data[0]})`);
if (errors.length) problems.push(`console errors: ${errors.join(' | ')}`);
process.stdout.write(`${JSON.stringify({ problems })}\n`);
process.exit(0);
