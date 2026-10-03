import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { defineComponent, elementName, majorOf } from './define';

const base = {
  tag: 'pt-demo', version: '1.2.3',
  need: { question: 'Why?', evidence: ['x'] },
  params: z.object({ ticker: z.string() }),
  user: [], uses: [],
  needs: () => ({}),
};

describe('defineComponent', () => {
  it('accepts a valid manifest and names the element with its major', () => {
    const m = defineComponent(base);
    expect(majorOf(m.version)).toBe(1);
    expect(elementName(m)).toBe('pt-demo-v1');
  });
  it.each([
    [{ tag: 'demo' }, /tag/],
    [{ tag: 'pt-demo-v2' }, /major/],
    [{ version: '1.2' }, /version/],
    [{ need: { question: '  ', evidence: [] } }, /need/],
    [{ uses: ['pt-other@1'] }, /composition/],
  ])('rejects %o', (patch, msg) => {
    expect(() => defineComponent({ ...base, ...patch } as never)).toThrow(msg);
  });
});
