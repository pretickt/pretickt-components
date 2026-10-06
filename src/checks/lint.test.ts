import { describe, expect, it } from 'vitest';
import { ALLOWED_IMPORTS, lintCss, lintSfc } from './lint';

const sfc = (script: string, template = '<p>x</p>') => `<!--\n  Q?\n  @version 1.0.0\n  @evidence e\n-->\n<script setup lang="ts">\n${script}\n</script>\n<template>${template}</template>`;

describe('lintSfc (quality feedback for authors and the generator; the sandbox is the boundary)', () => {
  it('a component on the contract is clean, a "window" param included', () => {
    expect(lintSfc(sfc(`import { usePt } from '@pretickt/components/context';\nconst x = await usePt().news({ ticker: 'NVDA' });\nconst m = await usePt().moveBreakdown({ ticker: 'NVDA', window: props.window });`))).toEqual([]);
  });
  it('names the line of every forbidden thing', () => {
    const out = lintSfc(sfc(`import x from 'node:fs';\nconst r = await fetch('/x');\nconst t = Date.now();\nwindow.alert(1);\n/// <reference path="/etc/x" />`, '<div v-html="r"></div>'));
    expect(out).toEqual([
      expect.stringMatching(/^7: import "node:fs" is not allowed/),
      expect.stringMatching(/^8: fetch/),
      expect.stringMatching(/^9: Date\.now/),
      expect.stringMatching(/^10: window/),
      expect.stringMatching(/^11: .*triple-slash/),
      expect.stringMatching(/^13: v-html/),
    ]);
  });
  it('refuses what makes the compiler read files: block src, import.meta, CSS imports and urls', () => {
    const src = '<!--\n  Q?\n  @version 1.0.0\n  @evidence e\n-->\n<script setup lang="ts" src="../x.ts"></script>\n<template src="/etc/hosts"></template>\n' +
      '<script setup lang="ts">\nconst g = import.meta.glob(\'/*\');\nconst u = new URL(\'./x\', import . meta.url);\n</script>\n' +
      '<style scoped>\n@reference "@pretickt/components/ds.css";\n@import "/etc/hosts";\n.a { @apply text-neg; background: url(/etc/hosts); }\n@media (width > 1px) { .b { color: red } }\n.c { content: "\\69" }\n@plugin "x";\n</style>';
    expect(lintSfc(src)).toEqual([
      expect.stringMatching(/^6: .*src=/),
      expect.stringMatching(/^7: .*src=/),
      expect.stringMatching(/^9: import\.meta/),
      expect.stringMatching(/^10: import \. meta/),
      expect.stringMatching(/^14: @import/),
      expect.stringMatching(/^15: url\(/),
      expect.stringMatching(/^17: .*\\/),
      expect.stringMatching(/^18: @plugin/),
    ]);
    expect(lintSfc('<!--\n  Q?\n-->\n<style scoped>\n@reference "./other.css";\n</style>')).toEqual([expect.stringMatching(/^5: @reference/)]);
  });
  it('reads CSS as CSS: quotes in comments cannot hide an @import or @plugin', () => {
    expect(lintCss(`/* ' */ @import "x.css"; /* ' */`)).toEqual([expect.stringMatching(/^1: @import/)]);
    expect(lintCss(`/* " */ @plugin "./x.mjs"; /* " */`)).toEqual([expect.stringMatching(/^1: @plugin/)]);
    expect(lintCss('.a { background: URL( "/etc/hosts" ) }')).toEqual([expect.stringMatching(/^1: url\(/i)]);
    expect(lintCss('.a { color: red')).toEqual([expect.stringMatching(/^1: .*parse/)]);
    expect(lintCss('.a { color: red }\n@\\69mport "x";')).toEqual([expect.stringMatching(/^2: \\/), expect.stringMatching(/^2: .*parse/)]);
  });
  it('CSS stays the component\'s own: scoped, no global selectors, no !important, plain CSS only', () => {
    const out = lintSfc('<!--\n  Q?\n-->\n<style>\nbody, .a :global(.b) { color: red !important; }\n:root { --x: 1px; }\n</style>\n<style scoped lang="scss">\n.a { color: red }\n</style>');
    expect(out).toEqual([
      expect.stringMatching(/^4: <style> without scoped/),
      expect.stringMatching(/^5: body, \.a :global\(\.b\) — no global selectors/),
      expect.stringMatching(/^5: !important/),
      expect.stringMatching(/^6: :root — no global selectors/),
      expect.stringMatching(/^8: <style lang="scss">/),
    ]);
  });
  it('lintCss checks a style block alone, as a compiler sees it', () => {
    expect(lintCss('@reference "@pretickt/components/ds.css";\n.a { @apply text-neg; }')).toEqual([]);
    expect(lintCss('.a { color: red }\n@import "/etc/hosts";')).toEqual([expect.stringMatching(/^2: @import/)]);
  });
  it('never writes HTML: innerHTML / outerHTML in the template or the script', () => {
    const out = lintSfc(sfc(`const s = '<b>';\nconst el = { innerHTML: s };`, '<div :innerHTML="s"></div><p v-bind:inner-html="s"></p>'));
    expect(out).toEqual([expect.stringMatching(/^8: innerHTML/), expect.stringMatching(/^10: :innerHTML/), expect.stringMatching(/^10: :inner-html/)]);
  });
  it('the allowed imports are the package entry points a component may use', () => {
    expect([...ALLOWED_IMPORTS].sort()).toEqual(['@pretickt/components/context', '@pretickt/components/ds', '@pretickt/components/format', '@pretickt/components/indicators', '@pretickt/components/typologies', 'vue']);
  });
});
