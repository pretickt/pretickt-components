/**
 * pt-value: value@1's three made-up companies (a strong business at a high price, a weakening one at a low price, a fragile one), the
 * company page's compact form, a bank's three questions, not available; and www's when it serves value@1. Fixtures made up.
 */
import type { Value } from '@pretickt/components/typologies';
import { demo, story } from '../src/stories/story';
import { PtValue } from './pt-value';

const NVDA = demo<Value>('value@1', { ticker: 'NVDA' });
const bank: Value = { ...NVDA, sections: NVDA.sections.filter((s) => ['economics', 'execution', 'price'].includes(s.key)) };

export const stories = [
  story(PtValue, { name: 'A strong business at a high price (demo, NVDA)', inputs: { ticker: 'NVDA' } }),
  story(PtValue, { name: 'A weakening business at a low price (demo, NKE)', inputs: { ticker: 'NKE' } }),
  story(PtValue, { name: 'A fragile business without a P/E (demo, INTC)', inputs: { ticker: 'INTC' } }),
  story(PtValue, { name: 'On the company page: the compact form (demo, NVDA)', inputs: { ticker: 'NVDA', compact: true } }),
  story(PtValue, { name: 'Three questions, as a bank answers (demo)', inputs: { ticker: 'NVDA' }, data: { 'value@1': bank } }),
  story(PtValue, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
  story(PtValue, { name: 'www: NVDA', inputs: { ticker: 'NVDA' }, live: true }),
  story(PtValue, { name: 'www: JPM', inputs: { ticker: 'JPM' }, live: true }),
];
