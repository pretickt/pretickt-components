import type * as z from 'zod/mini';
import { AnalystsParams, AnalystsPayload, analystsDemo } from './analysts';
import { EventsParams, EventsPayload, eventsDemo } from './events';
import { MetricParams, MetricPayload, metricDemo } from './metric';
import { PriceSeriesParams, PriceSeriesPayload, priceSeriesDemo } from './price-series';
import { FundamentalsParams, FundamentalsPayload, fundamentalsDemo } from './fundamentals';
import { InsiderParams, InsiderPayload, insiderDemo } from './insider';
import { NewsParams, NewsPayload, newsDemo } from './news';

export interface Typology<P extends z.ZodMiniType = z.ZodMiniType, D extends z.ZodMiniType = z.ZodMiniType> {
  id: string;
  params: P;
  payload: D;
  demo: (p: z.infer<P>) => z.infer<D>;
  freshness: 'eod' | { ttlSeconds: number };
}

const def = <P extends z.ZodMiniType, D extends z.ZodMiniType>(t: Typology<P, D>) => t;

export const TYPOLOGIES = {
  'metric@1': def({ id: 'metric@1', params: MetricParams, payload: MetricPayload, demo: metricDemo, freshness: 'eod' }),
  'price-series@1': def({ id: 'price-series@1', params: PriceSeriesParams, payload: PriceSeriesPayload, demo: priceSeriesDemo, freshness: 'eod' }),
  'events@1': def({ id: 'events@1', params: EventsParams, payload: EventsPayload, demo: eventsDemo, freshness: 'eod' }),
  'analysts@1': def({ id: 'analysts@1', params: AnalystsParams, payload: AnalystsPayload, demo: analystsDemo, freshness: 'eod' }),
  'fundamentals@1': def({ id: 'fundamentals@1', params: FundamentalsParams, payload: FundamentalsPayload, demo: fundamentalsDemo, freshness: 'eod' }),
  'insider@1': def({ id: 'insider@1', params: InsiderParams, payload: InsiderPayload, demo: insiderDemo, freshness: 'eod' }),
  'news@1': def({ id: 'news@1', params: NewsParams, payload: NewsPayload, demo: newsDemo, freshness: 'eod' }),
} as const;

export type TypologyIdKnown = keyof typeof TYPOLOGIES;
export const getTypology = (id: string): Typology | undefined =>
  (TYPOLOGIES as unknown as Record<string, Typology>)[id];

export * from './common';
export * from './metric';
export * from './price-series';
export * from './events';
export * from './analysts';
export * from './fundamentals';
export * from './insider';
export * from './news';
