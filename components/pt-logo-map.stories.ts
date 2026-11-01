/** pt-logo-map (H3 · The market at a glance): the largest companies by sector, on demo data and www's, a red day, one sector. */
import type { Screen } from '@pretickt/components/typologies';
import { demo, story } from '../src/stories/story';
import { PtLogoMap } from './pt-logo-map';

const base = demo<Screen>('screen@1', { scope: { list: 'largest' }, limit: 100 });
const red: Screen = { ...base, rows: base.rows.map((r, i) => ({ ...r, chg1d: -0.004 - (i % 7) * 0.006 })) };

export const stories = [
  story(PtLogoMap, { name: 'The largest 100 (demo)', inputs: {} }),
  story(PtLogoMap, { name: 'www: today', inputs: {}, live: true }),
  story(PtLogoMap, { name: 'www: Technology', inputs: { sector: 'Technology' }, live: true }),
  story(PtLogoMap, { name: 'www: mega caps (worth $200B or more)', inputs: { lens: 'mega' }, live: true }),
  story(PtLogoMap, { name: 'News: the most covered companies of the day (demo)', inputs: { lens: 'news' } }),
  story(PtLogoMap, { name: 'www: news', inputs: { lens: 'news' }, live: true }),
  story(PtLogoMap, { name: 'Social: the most talked about on Reddit and X (demo)', inputs: { lens: 'social' } }),
  story(PtLogoMap, { name: 'www: Energy (a small sector)', inputs: { sector: 'Energy' }, live: true }),
  story(PtLogoMap, { name: 'A red day', inputs: {}, data: { 'screen@1': red } }),
  story(PtLogoMap, { name: 'No companies', inputs: {}, data: { 'screen@1': { ...base, rows: [] } } }),
  story(PtLogoMap, { name: 'Not available', inputs: {}, data: null }),
];
