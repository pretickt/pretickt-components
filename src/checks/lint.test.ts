import { describe, expect, it } from 'vitest';
import { ALLOWED_IMPORTS, lintComponent, lintCss } from './lint';
import { readComponentMeta } from './meta';

const file = (body: string, o: { tag?: string; head?: string } = {}) => `/**
 * Q?
 * @version 1.0.0
 * @evidence e${o.tag ? `\n * @tag ${o.tag}` : ''}
 */
${o.head ?? `import { Component, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';`}
${body}`;
const OK = `@Component({
  selector: 'pt-thing',
  template: \`<p class="pt-lede">{{ news.value()?.items?.length }}</p>\`,
})
export class PtThing {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  readonly limit = input(20);
  readonly window = input<'1d' | '5d'>('1d');
  readonly list = input<string>();
  readonly metrics = input(['pe', 'rsi14']);
  readonly odd = input({ a: 1, b: [true, null] });
  protected readonly news = this.pt.news(() => ({ ticker: this.ticker(), limit: this.limit() }));
}`;

describe('lintComponent (quality feedback for authors and the generator; the sandbox is the boundary)', () => {
  it('a component on the contract is clean (a "window" input included)', () => {
    expect(lintComponent(file(OK), 'pt-thing')).toEqual([]);
  });
  it('names the line of every forbidden thing in the code', () => {
    const out = lintComponent(file(OK.replace('  protected readonly news', `  a = fetch('/x');\n  b = Date.now();\n  c = window.alert(1);\n  d = import('./x');\n  e = new Intl.NumberFormat();\n  protected readonly news`), {
      head: `import { Component, inject, input } from '@angular/core';\nimport { Pt } from '@pretickt/components/context';\nimport { readFileSync } from 'node:fs';` }), 'pt-thing');
    expect(out).toEqual([
      expect.stringMatching(/^8: import "node:fs" is not allowed/),
      expect.stringMatching(/^21: fetch/),
      expect.stringMatching(/^22: Date\.now/),
      expect.stringMatching(/^23: window/),
      expect.stringMatching(/^24: import\(/),
      expect.stringMatching(/^25: Intl/),
    ]);
  });
  it('strings and comments are not code: a "window" word in text or a comment is fine', () => {
    expect(lintComponent(file(OK.replace('readonly limit = input(20);', `readonly limit = input(20); // window.alert in a comment\n  readonly label = 'fetch window document';`)), 'pt-thing')).toEqual([]);
  });
  it('refuses what makes the compiler read files or escapes the page: templateUrl, styleUrl(s), import.meta', () => {
    const out = lintComponent(file(OK.replace("template: `", "templateUrl: './x.html',\n  styleUrls: ['./x.css'],\n  template: `").replace('  private readonly pt', '  m = import.meta.url;\n  private readonly pt')), 'pt-thing');
    expect(out).toEqual([expect.stringMatching(/templateUrl/), expect.stringMatching(/styleUrls/), expect.stringMatching(/import\.meta/)]);
  });
  it('no component styles: Angular inserts them as <style> elements, which the site CSP refuses — design-system classes only', () => {
    const out = lintComponent(file(OK.replace("template: `", "styles: `.x { color: red; }`,\n  template: `")), 'pt-thing');
    expect(out).toEqual([expect.stringMatching(/^10: styles — .*CSP.*ds\.css/)]);
  });
  it('one standalone component, its selector the tag; no providers, no encapsulation, inline template only', () => {
    expect(lintComponent(file(OK), 'pt-other')).toEqual([expect.stringMatching(/selector "pt-thing" .* "pt-other"/)]);
    expect(lintComponent(file(OK.replace("selector: 'pt-thing',", "selector: 'pt-thing', standalone: false, providers: [], encapsulation: 2,")), 'pt-thing'))
      .toEqual([expect.stringMatching(/standalone/), expect.stringMatching(/providers/), expect.stringMatching(/encapsulation/)]);
    expect(lintComponent(file(OK.replace('template: `', 'template: someTemplate + `')), 'pt-thing')).toEqual([expect.stringMatching(/template.*literal/)]);
    expect(lintComponent(file(`${OK}\n@Component({ selector: 'pt-two', template: '' })\nexport class Two {}`), 'pt-thing')).toEqual([expect.stringMatching(/one component/)]);
    expect(lintComponent(file('export const x = 1;'), 'pt-thing')).toEqual([expect.stringMatching(/no component/)]);
  });
  it('input defaults are literals, without alias or transform (the page fills a missing prop with that default)', () => {
    const out = lintComponent(file(OK.replace('readonly limit = input(20);', "readonly limit = input(LIMIT);\n  readonly x = input('a', { alias: 'y' });\n  readonly z = input(0, { transform: (v: number) => v });")), 'pt-thing');
    expect(out).toEqual([expect.stringMatching(/^15: .*limit.*literal/), expect.stringMatching(/^16: .*alias/), expect.stringMatching(/^17: .*transform/)]);
  });
  it('the template may not name the page state or Angular\'s event contract (an id there blanks the whole page app)', () => {
    const out = lintComponent(file(OK.replace('<p class="pt-lede">', '<p id="ng-state" class="pt-lede">')), 'pt-thing');
    expect(out).toEqual([expect.stringMatching(/ng-state — the page owns/)]);
  });
  it('never writes HTML: innerHTML / outerHTML bindings in the template, DomSanitizer in the code', () => {
    const out = lintComponent(file(OK.replace('<p class="pt-lede">', '<p [innerHTML]="x" bind-outerHTML="y" class="pt-lede">'),
      { head: "import { Component, DomSanitizer, inject, input } from '@angular/core';\nimport { Pt } from '@pretickt/components/context';" }), 'pt-thing');
    expect(out).toEqual(expect.arrayContaining([expect.stringMatching(/innerHTML/), expect.stringMatching(/outerHTML/), expect.stringMatching(/DomSanitizer/)]));
  });
  it('a script element in the template is refused', () => {
    expect(lintComponent(file(OK.replace('<p class="pt-lede">', '<script>x</script><p class="pt-lede">')), 'pt-thing')).toEqual([expect.stringMatching(/<script/)]);
  });
});

describe('readComponentMeta (the leading /** */ block)', () => {
  it('reads the question, version, evidence and (drafts) the tag', () => {
    expect(readComponentMeta(file(OK, { tag: 'pt-thing' }))).toEqual({ ok: true, question: 'Q?', version: '1.0.0', major: 1, evidence: ['e'], tag: 'pt-thing' });
  });
  it('says what is missing', () => {
    expect(readComponentMeta(OK)).toEqual({ ok: false, errors: [expect.stringMatching(/must start with/)] });
    expect(readComponentMeta('/**\n * @version 1\n */\nx')).toEqual({ ok: false, errors: [expect.stringMatching(/question/), expect.stringMatching(/semver/), expect.stringMatching(/evidence/)] });
    expect(readComponentMeta(file(OK, { tag: 'Thing' }))).toMatchObject({ ok: false, errors: [expect.stringMatching(/@tag/)] });
  });
});

describe('lintCss (a style block alone, as a compiler sees it)', () => {
  it('reads CSS as CSS: quotes in comments cannot hide an @import or @plugin; urls, parse errors and escapes are refused', () => {
    expect(lintCss(`/* ' */ @import "x.css"; /* ' */`)).toEqual([expect.stringMatching(/^1: @import/)]);
    expect(lintCss(`/* " */ @plugin "./x.mjs"; /* " */`)).toEqual([expect.stringMatching(/^1: @plugin/)]);
    expect(lintCss('.a { background: URL( "/etc/hosts" ) }')).toEqual([expect.stringMatching(/^1: url\(/i)]);
    expect(lintCss('.a { color: red')).toEqual([expect.stringMatching(/^1: .*parse/)]);
    expect(lintCss('.a { color: red }\n@\\69mport "x";')).toEqual([expect.stringMatching(/^2: \\/), expect.stringMatching(/^2: .*parse/)]);
  });
  it('the design system by @reference, @apply; no global selectors, no !important', () => {
    expect(lintCss('@reference "@pretickt/components/ds.css";\n.a { @apply text-neg; }')).toEqual([]);
    expect(lintCss('@reference "./other.css";')).toEqual([expect.stringMatching(/^1: @reference/)]);
    expect(lintCss('body, .a :global(.b) { color: red !important; }\n:root { --x: 1px; }')).toEqual([
      expect.stringMatching(/^1: body, \.a :global\(\.b\) — no global selectors/), expect.stringMatching(/^1: !important/), expect.stringMatching(/^2: :root — no global selectors/)]);
    expect(lintCss('.a ::ng-deep .b { color: red; }\n:host-context(body) .c { color: red; }')).toEqual([
      expect.stringMatching(/^1: \.a ::ng-deep \.b — no global selectors/), expect.stringMatching(/^2: :host-context\(body\) \.c — no global selectors/)]);
  });
  it('the allowed imports are the package entry points a component may use', () => {
    expect([...ALLOWED_IMPORTS].sort()).toEqual(['@angular/core', '@pretickt/components/context', '@pretickt/components/ds', '@pretickt/components/format', '@pretickt/components/indicators', '@pretickt/components/typologies']);
  });
});
