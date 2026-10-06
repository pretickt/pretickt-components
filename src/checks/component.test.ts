import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { usePt } from '../context/pt';
import { checkComponent } from './component';

const Good = defineComponent({ props: { ticker: { type: String, required: true } }, async setup(p) {
  const news = await usePt().news({ ticker: p.ticker, limit: 3 });
  return () => (news ? h('ul', news.items.map((s) => h('li', s.title))) : h('p', { class: 'pt-na' }, 'Data not available'));
} });
const NullUnsafe = defineComponent({ props: { ticker: { type: String, required: true } }, async setup(p) {
  const news = await usePt().news({ ticker: p.ticker, limit: 3 });
  return () => h('p', news!.items[0]!.title);
} });
const Evil = defineComponent({ props: { ticker: String }, setup: () => () => h('a', { href: 'javascript:alert(1)' }, 'x') });
const BadParams = defineComponent({ props: { ticker: String }, async setup() { await usePt().news({ ticker: 'NVDA', limit: 999 }); return () => h('p'); } });

describe('checkComponent (what the catalogue and the generator check on the server; hydration is checked where there is a DOM)', () => {
  it('a component that renders demo data, missing data and unknown entries passes', async () => {
    expect(await checkComponent(Good, [{ ticker: 'NVDA' }])).toEqual([]);
  });
  it('reports a component that breaks on missing data, unsafe markup, or params its typology rejects', async () => {
    expect(await checkComponent(NullUnsafe, [{ ticker: 'NVDA' }])).toEqual([expect.stringMatching(/\{"ticker":"NVDA"\}: missing data: throws/)]);
    expect(await checkComponent(Evil, [{ ticker: 'NVDA' }])).toEqual(expect.arrayContaining([expect.stringMatching(/demo data: markup non-http URL scheme/)]));
    expect((await checkComponent(BadParams, [{}])).join()).toMatch(/params rejected by news@1: limit/);
  });
});
