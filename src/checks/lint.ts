import postcss from 'postcss';

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
  [/\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/, 'never write HTML: Vue escapes text, links go through href()'],
];

/** The at-rules a component's CSS may use: nothing that loads a file (the design system comes in through @reference only). */
const AT_RULES = new Set(['apply', 'media', 'supports', 'keyframes', 'container']);
const DS_REFERENCE = /^(['"])@pretickt\/components\/ds\.css\1$/;
const LOADS = /\b(?:url|image-set|src)\s*\(/i;
const GLOBAL = /(?:^|[\s,>+~(])(?:html|body|:root)(?![\w-])|:global\b|::v-global\b/i;

/**
 * A style block on its own, parsed as CSS (so comments and strings cannot hide anything), as a compiler would read it: it loads
 * nothing, stays the component's own (no global selectors, no !important) and has no escapes. `lineOffset` = the line before it.
 */
export function lintCss(css: string, lineOffset = 0): string[] {
  const out: [number, string][] = [];
  const at = (node: { source?: { start?: { line: number } } }) => (node.source?.start?.line ?? 1) + lineOffset;
  css.split('\n').forEach((text, i) => { if (text.includes('\\')) out.push([i + 1 + lineOffset, `\\ — no escapes in a component's CSS`]); });
  let root: postcss.Root;
  try { root = postcss.parse(css); } catch (e) {
    out.push([((e as { line?: number }).line ?? 1) + lineOffset, `the CSS does not parse: ${(e as { reason?: string }).reason ?? (e as Error).message}`]);
    return out.map(([n, m]) => `${n}: ${m}`);
  }
  root.walkAtRules((r) => {
    const ok = r.name === 'reference' ? DS_REFERENCE.test(r.params.trim()) : AT_RULES.has(r.name);
    if (!ok) out.push([at(r), `@${r.name} — a component's CSS loads nothing: only @reference "@pretickt/components/ds.css", @${[...AT_RULES].join(', @')}`]);
    else if (LOADS.test(r.params)) out.push([at(r), `${LOADS.exec(r.params)![0].replace(/\s+/g, '')} — no urls in a component's CSS`]);
  });
  root.walkRules((r) => { if (GLOBAL.test(r.selector)) out.push([at(r), `${r.selector} — no global selectors (html, body, :root, :global): style your own markup`]); });
  root.walkDecls((d) => {
    if (LOADS.test(d.value)) out.push([at(d), `${LOADS.exec(d.value)![0].replace(/\s+/g, '')} — no urls in a component's CSS`]);
    if (d.important) out.push([at(d), '!important — the design system must stay able to win']);
  });
  return out.sort((a, b) => a[0] - b[0]).map(([n, m]) => `${n}: ${m}`);
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
  let style: { from: number; lines: string[] } | null = null;
  lines.forEach((text, i) => {
    const n = i + 1;
    const open = /^<(script|template|style)\b([^>]*)>/.exec(text);
    if (open) {
      const kind = open[1] as 'script' | 'template' | 'style';
      if (/\ssrc\s*=/.test(open[2]!)) out.push(`${n}: <${kind} src=…> — no external blocks: the whole component is this file`);
      if (kind === 'style') {
        if (!/\sscoped\b/.test(open[2]!)) out.push(`${n}: <style> without scoped — a component's CSS applies to its own markup only`);
        const lang = /\slang\s*=\s*["']?([\w-]+)/.exec(open[2]!)?.[1];
        if (lang && lang !== 'css') out.push(`${n}: <style lang="${lang}"> — plain CSS (with @apply) only`);
        style = { from: n, lines: [] };
      }
      block = kind;
      if (kind !== 'template') { if (text.includes(`</${kind}>`)) block = null; return; }
    }
    if (/^<\/(script|style)>/.test(text)) {
      if (block === 'style' && style) out.push(...lintCss(style.lines.join('\n'), style.from));
      block = null;
      return;
    }
    if (block === 'style') style?.lines.push(text);
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
    if (block === 'template') for (const m of text.matchAll(/(?:\s|^)(?:v-bind)?:((?:inner|outer)-?html)\s*=/gi)) out.push(`${n}: :${m[1]} — never write HTML: Vue escapes text`);
    if (block === 'template' && /^<\/template>|<\/template>\s*$/.test(text) && !/^\s+/.test(text)) block = null;
  });
  return out;
}
