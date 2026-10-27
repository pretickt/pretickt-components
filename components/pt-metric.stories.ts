/** pt-metric: badge strips of the catalogue, www's real values, entries a newer API may send, an empty answer. */
import { METRIC_KEYS, type MetricItem } from '@pretickt/components/typologies';
import { demo, story } from '../src/stories/story';
import { getTypology } from '../src/typologies';
import { PtMetric } from './pt-metric';

const TEN = ['pe', 'pe_vs_sector', 'pe_vs_own', 'pt_upside', 'consensus', 'market_cap', 'fcf_yield', 'insider_net', 'earnings_in', 'news'];
const pair = demo<MetricItem[]>('metric@1', { ticker: 'NVDA', metrics: ['pe', 'rsi14'] });

export const stories = [
  story(PtMetric, { name: 'P/E and RSI (demo)', inputs: { ticker: 'NVDA', metrics: ['pe', 'rsi14'] } }),
  story(PtMetric, { name: 'The snapshot ten (demo)', inputs: { ticker: 'NVDA', metrics: TEN } }),
  story(PtMetric, { name: 'Every catalogue item (demo)', inputs: { ticker: 'NVDA', metrics: [...METRIC_KEYS] } }),
  story(PtMetric, { name: 'www: NVDA, the snapshot ten', inputs: { ticker: 'NVDA', metrics: TEN }, live: true }),
  story(PtMetric, { name: 'www: XOM, technicals', inputs: { ticker: 'XOM', metrics: ['trend', 'rsi14', 'macd', 'bollinger', 'support', 'resistance', 'atr_pct', 'volume_ratio'] }, live: true }),
  story(PtMetric, { name: 'Entries a newer API may send', inputs: { ticker: 'NVDA', metrics: ['pe', 'rsi14'] },
    data: { 'metric@1': getTypology('metric@1')!.unknownVariant!(pair as never) } }),
  story(PtMetric, { name: 'An empty answer', inputs: { ticker: 'NVDA', metrics: ['pe'] }, data: { 'metric@1': [] } }),
  story(PtMetric, { name: 'Not available', inputs: { ticker: 'NVDA', metrics: ['pe', 'rsi14'] }, data: null }),
];
