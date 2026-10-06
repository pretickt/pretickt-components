import { describe, expect, it } from 'vitest';
import { ALLOWED_IMPORTS, lintSfc } from './lint';

const sfc = (script: string, template = '<p>x</p>') => `<!--\n  Q?\n  @version 1.0.0\n  @evidence e\n-->\n<script setup lang="ts">\n${script}\n</script>\n<template>${template}</template>`;

describe('lintSfc (quality feedback for authors and the generator; the sandbox is the boundary)', () => {
  it('a component on the contract is clean, a "window" param included', () => {
    expect(lintSfc(sfc(`import { usePt } from '@pretickt/components/context';\nconst x = await usePt().news({ ticker: 'NVDA' });\nconst m = await usePt().moveBreakdown({ ticker: 'NVDA', window: props.window });`))).toEqual([]);
  });
  it('names the line of every forbidden thing', () => {
    const out = lintSfc(sfc(`import x from 'node:fs';\nconst r = await fetch('/x');\nconst t = Date.now();\nwindow.alert(1);`, '<div v-html="r"></div>'));
    expect(out).toEqual([
      expect.stringMatching(/^7: import "node:fs" is not allowed/),
      expect.stringMatching(/^8: fetch/),
      expect.stringMatching(/^9: Date\.now/),
      expect.stringMatching(/^10: window/),
      expect.stringMatching(/^12: v-html/),
    ]);
  });
  it('the allowed imports are the package entry points a component may use', () => {
    expect([...ALLOWED_IMPORTS].sort()).toEqual(['@pretickt/components/context', '@pretickt/components/ds', '@pretickt/components/format', '@pretickt/components/indicators', '@pretickt/components/typologies', 'vue']);
  });
});
