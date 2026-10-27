/** pt-value on made-up data: three companies, three answers — a strong business at a high price, a weakening one at a low price, a fragile one. */
import { story } from '../../src/stories/story';
import { PtValue } from './pt-value';
import { VALUE_INTC, VALUE_NKE, VALUE_NVDA } from './value-mock';

const GROUP = 'Drafts · is it a company of value? (made-up data)';

export const stories = [
  story(PtValue, { name: 'A strong business at a high price (NVDA-like)', inputs: { data: VALUE_NVDA }, group: GROUP }),
  story(PtValue, { name: 'A weakening business at a low price (NKE-like)', inputs: { data: VALUE_NKE }, group: GROUP }),
  story(PtValue, { name: 'A fragile business (INTC-like)', inputs: { data: VALUE_INTC }, group: GROUP }),
  story(PtValue, { name: 'Without pretickt\'s analysis (the direct data only)', group: GROUP,
    inputs: { data: { ...VALUE_NVDA, sections: VALUE_NVDA.sections.map((s) => ({ ...s, cards: s.cards.filter((c) => !c.via) })) } } }),
  story(PtValue, { name: 'Not available', inputs: { data: null }, group: GROUP }),
];
