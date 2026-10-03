import { describe, expect, it } from 'vitest';
import { lintSource } from './lint';

const rules = (src: string) => lintSource(src).map((v) => v.rule);

describe('lintSource', () => {
  it('passes a well-formed component', () => {
    expect(lintSource(`
      import * as z from 'zod/mini';
      import { defineComponent } from '@pretickt/components/sdk';
      import type { Events } from '@pretickt/components/typologies';
      const ICON = { a: 1 };
      export const manifest = defineComponent({} as never);
      export function renderStatic() { const top = 4; return String(top); }
      export const element = (kit: any) => class extends kit.PtElement {};
    `)).toEqual([]);
  });
  it.each([
    ['fetch("/x")', 'network'],
    ['new XMLHttpRequest()', 'network'],
    ['new WebSocket("wss://x")', 'network'],
    ['navigator.sendBeacon("/x")', 'network'],
    ['document.cookie', 'storage'],
    ['localStorage.getItem("x")', 'storage'],
    ['window.top.location', 'frame'],
    ['window.parent.postMessage(1, "*")', 'frame'],
    ['import("https://evil.example/x.js")', 'dynamic-import'],
    ['eval("1")', 'eval'],
    ['new Function("return 1")', 'eval'],
    ['Date.now()', 'nondeterministic'],
    ['new Date()', 'nondeterministic'],
    ['Math.random()', 'nondeterministic'],
    ['(1).toLocaleString()', 'nondeterministic'],
    ['Intl.NumberFormat', 'nondeterministic'],
    ['customElements.define("x-y", class {})', 'define'],
  ])('flags %s as %s', (expr, rule) => {
    expect(rules(`export function f() { return ${expr}; }`)).toContain(rule);
  });
  it('allows new Date(iso)', () => {
    expect(rules(`export function f(s: string) { return new Date(s); }`)).toEqual([]);
  });
  it('flags disallowed imports and top-level side effects', () => {
    expect(rules(`import x from 'lodash';`)).toContain('import');
    expect(rules(`console.log(1);`)).toContain('side-effect');
    expect(rules(`let n = 1;`)).toContain('side-effect');
    expect(rules(`class X {}`)).toContain('side-effect');
  });
  it('allows the in-repo relative sdk and typologies paths, but not the build tools', () => {
    expect(rules(`import { helpers } from '../src/sdk'; import { Ticker } from '../src/typologies';`)).toEqual([]);
    expect(rules(`import { lintSource } from '../src/sdk/tools';`)).toContain('import');
  });
});
