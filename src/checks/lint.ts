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
];

/**
 * A line-oriented lint of a component file: forbidden APIs in its scripts, imports outside ALLOWED_IMPORTS, `v-html` in its template.
 * Feedback for authors and the generator — the sandbox and the checks are what contain untrusted code.
 */
export function lintSfc(source: string): string[] {
  const out: string[] = [];
  const lines = source.split('\n');
  let block: 'script' | 'template' | 'style' | null = null;
  lines.forEach((text, i) => {
    const n = i + 1;
    if (/^<script\b/.test(text)) { block = 'script'; return; }
    if (/^<template\b/.test(text)) block = 'template';
    if (/^<style\b/.test(text)) { block = 'style'; return; }
    if (/^<\/(script|style)>/.test(text)) { block = null; return; }
    if (block === 'script') {
      const code = text.replace(/\/\/.*$/, '').replace(/(['"`])(?:\\.|(?!\1).)*\1/g, (m) => (/^\s*import\b|\bfrom\s/.test(text) ? m : '""'));
      for (const m of text.matchAll(/(?:^|\s)(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1] ?? m[2]!;
        if (!ALLOWED_IMPORTS.has(spec)) out.push(`${n}: import "${spec}" is not allowed (only ${[...ALLOWED_IMPORTS].join(', ')})`);
      }
      for (const [re, why] of RULES) { const m = re.exec(code); if (m) out.push(`${n}: ${m[0].trim()} — ${why}`); }
    }
    if (block === 'template' && /\sv-html\s*=/.test(text)) out.push(`${n}: v-html — never: Vue escapes text, links go through href()`);
  });
  return out;
}
