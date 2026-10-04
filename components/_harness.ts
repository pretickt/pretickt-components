import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { ComponentModule } from '../src/sdk';
import { checkContract } from '../src/sdk/contract';
import { lintSource } from '../src/sdk/lint';
import { checkParity } from '../src/sdk/parity';
import { lit } from '../src/sdk/testing';

export { lit };

/** The four checks every component must pass. Call it at the top level of a happy-dom test file.
 *  Sources are read from the repo root: under happy-dom `import.meta.url` is not a file URL. */
export function standardSuite(mod: ComponentModule) {
  const file = `${mod.manifest.tag}.ts`;
  it('passes the lint', () => expect(lintSource(readFileSync(join(process.cwd(), 'components', file), 'utf8'), file)).toEqual([]));
  it('passes the static contract (samples included)', () => expect(checkContract(mod)).toEqual([]));
  it('passes the parity check', async () => expect(await checkParity(lit, mod)).toEqual([]));
}
