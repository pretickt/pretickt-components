import { describe, expect, it } from 'vitest';
import { readComponentMeta } from './meta';
import { sampleProps, type PropInfo } from './props';

const SFC = `<!--
  Why did this stock move today: the whole market, its sector,
  or something specific to the company?
  @version 2.1.0
  @evidence DataForSEO: "why is <ticker> stock down today"
  @evidence beta: news spike detector
-->
<script setup lang="ts"></script>`;

describe('component metadata (the leading comment of the file)', () => {
  it('reads the question, the version and every evidence line', () => {
    expect(readComponentMeta(SFC)).toEqual({ ok: true, question: 'Why did this stock move today: the whole market, its sector, or something specific to the company?',
      version: '2.1.0', major: 2, evidence: ['DataForSEO: "why is <ticker> stock down today"', 'beta: news spike detector'] });
  });
  it('says what is missing', () => {
    expect(readComponentMeta('<script setup></script>')).toEqual({ ok: false, errors: ['the file must start with a <!-- … --> comment: the question, @version, @evidence'] });
    expect(readComponentMeta('<!--\n  Q?\n  @version 1.0\n-->')).toEqual({ ok: false, errors: ['@version must be semver x.y.z', 'at least one @evidence line'] });
  });
});

describe('sampleProps (props the checks render with, read from the component\'s prop types)', () => {
  const p = (name: string, required: boolean, schema: PropInfo['schema'], dflt?: string): PropInfo => ({ name, required, schema, default: dflt });
  it('fills required props by known name or first literal, then one variant per literal of each optional union', () => {
    expect(sampleProps([p('ticker', true, 'string'), p('window', false, { kind: 'enum', schema: ['undefined', '"1d"', '"5d"', '"1m"'] }, '"1d"'),
      p('kind', true, { kind: 'enum', schema: ['"earnings"', '"dividend"'] }), p('limit', false, { kind: 'enum', schema: ['undefined', 'number'] }, '5')]))
      .toEqual([{ ticker: 'NVDA', kind: 'earnings' }, { ticker: 'NVDA', kind: 'earnings', window: '5d' }, { ticker: 'NVDA', kind: 'earnings', window: '1m' },
        { ticker: 'NVDA', kind: 'dividend' }]);
  });
  it('an optional prop with a known name gets a variant of its own (peersOf)', () => {
    expect(sampleProps([p('peersOf', false, { kind: 'enum', schema: ['undefined', 'string'] })])).toEqual([{}, { peersOf: 'NVDA' }]);
  });
  it('refuses a required prop it cannot sample, saying how to fix it', () => {
    expect(() => sampleProps([p('foo', true, 'string')])).toThrow(/required prop "foo".*default/);
  });
});
