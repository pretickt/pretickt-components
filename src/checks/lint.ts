/** The only modules a component may import. */
export const ALLOWED_IMPORTS = new Set(['vue', '@pretickt/components/context', '@pretickt/components/ds', '@pretickt/components/format',
  '@pretickt/components/typologies', '@pretickt/components/indicators']);

const RULES: [RegExp, string][] = [
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/, 'no data access of your own: ask usePt()'],
  [/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/, 'no storage or cookies'],
  [/(?<![.\w$])(window|document|globalThis)\s*[.[]|\bself\.(?:top|parent|opener)\b/, 'no globals: the component renders on the server too'],
  [/\b(eval|Function)\s*\(|new\s+Function\b|\bimport\s*\(/, 'no code from strings, no dynamic import'],
  [/\bDate\.now\s*\(|new\s+Date\s*\(\s*\)|Math\.random\s*\(/, 'deterministic only: no clock, no randomness ("today" is the payload asOf)'],
  [/\bIntl\b|\.toLocale\w*\s*\(/, 'no Intl / toLocale*: use @pretickt/components/format (the same text on server and browser)'],
  [/postMessage\b/, 'no messaging'],
  [/\bimport\s*\.\s*meta\b/, 'no import.meta: the compiler would read files for it'],
];

/** The at-rules a component's CSS may use: nothing that loads a file (the design system comes in through @reference only). */
const AT_RULES = new Set(['apply', 'media', 'supports', 'keyframes', 'container']);
const DS_REFERENCE = /^\s*@reference\s+(['"])@pretickt\/components\/ds\.css\1\s*;?\s*$/;

function lintStyle(text: string, n: number, out: string[]) {
  if (text.includes('\\')) out.push(`${n}: \\ — no escapes in a component's CSS`);
  for (const m of text.replace(/(['"])(?:(?!\1).)*\1/g, '""').matchAll(/@([a-zA-Z-]+)/g)) {
    if (AT_RULES.has(m[1]!) || (m[1] === 'reference' && DS_REFERENCE.test(text))) continue;
    out.push(`${n}: @${m[1]} — a component's CSS loads nothing: only @reference "@pretickt/components/ds.css", @${[...AT_RULES].join(', @')}`);
  }
  const url = /\b(url|image-set|src)\s*\(/i.exec(text);
  if (url) out.push(`${n}: ${url[0].replace(/\s+/g, '')} — no urls in a component's CSS`);
}

/**
 * A line-oriented lint of a component file: forbidden APIs in its scripts, imports outside ALLOWED_IMPORTS, `v-html` in its template,
 * anything that makes the compiler read a file (external blocks, import.meta, CSS that loads).
 * Feedback for authors and the generator — the sandbox and the checks are what contain untrusted code.
 */
export function lintSfc(source: string): string[] {
  const out: string[] = [];
  const lines = source.split('\n');
  let block: 'script' | 'template' | 'style' | null = null;
  lines.forEach((text, i) => {
    const n = i + 1;
    const open = /^<(script|template|style)\b([^>]*)>/.exec(text);
    if (open) {
      const kind = open[1] as 'script' | 'template' | 'style';
      if (/\ssrc\s*=/.test(open[2]!)) out.push(`${n}: <${kind} src=…> — no external blocks: the whole component is this file`);
      block = kind;
      if (kind !== 'template') { if (text.includes(`</${kind}>`)) block = null; return; }
    }
    if (/^<\/(script|style)>/.test(text)) { block = null; return; }
    if (block === 'style') lintStyle(text, n, out);
    if (block === 'script') {
      const code = text.replace(/\/\/.*$/, '').replace(/(['"`])(?:\\.|(?!\1).)*\1/g, (m) => (/^\s*import\b|\bfrom\s/.test(text) ? m : '""'));
      for (const m of text.matchAll(/(?:^|\s)(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1] ?? m[2]!;
        if (!ALLOWED_IMPORTS.has(spec)) out.push(`${n}: import "${spec}" is not allowed (only ${[...ALLOWED_IMPORTS].join(', ')})`);
      }
      for (const [re, why] of RULES) { const m = re.exec(code); if (m) out.push(`${n}: ${m[0].trim()} — ${why}`); }
      if (/^\s*\/\/\/\s*<reference\b/.test(text)) out.push(`${n}: /// <reference> — no triple-slash references`); // a comment to the stripper above
    }
    if (block === 'template' && /\sv-html\s*=/.test(text)) out.push(`${n}: v-html — never: Vue escapes text, links go through href()`);
    if (block === 'template' && /^<\/template>|<\/template>\s*$/.test(text) && !/^\s+/.test(text)) block = null;
  });
  return out;
}
