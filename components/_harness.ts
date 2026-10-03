import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { LitElement, html, svg } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { ComponentModule } from '../src/sdk';
import { checkContract, lintSource } from '../src/sdk/tools';
import { checkParity } from '../src/sdk/parity';

export const lit = { LitElement, html, svg, unsafeHTML };

/** The four checks every component must pass. Call it at the top level of a happy-dom test file.
 *  Sources are read from the repo root: under happy-dom `import.meta.url` is not a file URL. */
export function standardSuite(file: string, mod: ComponentModule) {
  const samples = mod.samples ?? [];
  it('declares at least one sample', () => expect(samples.length).toBeGreaterThan(0));
  it('passes the lint', () => expect(lintSource(readFileSync(join(process.cwd(), 'components', file), 'utf8'), file)).toEqual([]));
  it('passes the static contract', () => expect(checkContract(mod, samples)).toEqual([]));
  it('passes the parity check', async () => expect(await checkParity(lit, mod, samples)).toEqual([]));
}
