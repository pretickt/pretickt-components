import { expect, it } from 'vitest';
import { needKey, stableStringify } from './key';

it('serialises objects independently of key order', () => {
  expect(stableStringify({ b: 1, a: { d: [2, { y: 1, x: 0 }], c: null } }))
    .toBe('{"a":{"c":null,"d":[2,{"x":0,"y":1}]},"b":1}');
});
it('builds the same key for equivalent needs', () => {
  expect(needKey({ t: 'metric@1', params: { ticker: 'NVDA', metrics: ['pe'] } }))
    .toBe(needKey({ params: { metrics: ['pe'], ticker: 'NVDA' }, t: 'metric@1' }));
});
