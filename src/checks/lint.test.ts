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
      '<style scoped>\n@reference "@pretickt/components/ds.css";\n@import "/etc/hosts";\n.a { @apply text-neg; background: url(/etc/hosts); }\n@media (width > 1px) { .b { color: red } }\n@\\69mport "x";\n@plugin "x";\n</style>';
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
  it('lintCss checks a style block alone, as a compiler sees it', () => {
    expect(lintCss('@reference "@pretickt/components/ds.css";\n.a { @apply text-neg; }')).toEqual([]);
    expect(lintCss('.a { color: red }\n@import "/etc/hosts";')).toEqual([expect.stringMatching(/^2: @import/)]);
  });
  it('the allowed imports are the package entry points a component may use', () => {
    expect([...ALLOWED_IMPORTS].sort()).toEqual(['@pretickt/components/context', '@pretickt/components/ds', '@pretickt/components/format', '@pretickt/components/indicators', '@pretickt/components/typologies', 'vue']);
  });
});
