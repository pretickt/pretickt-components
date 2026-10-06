import { toJSONSchema } from 'zod/mini';
import type * as z from 'zod/mini';
import { AnalystsParams, AnalystsPayload } from './analysts';
import { CompanyParams, CompanyPayload } from './company';
import { EventsParams, EventsPayload } from './events';
import { FundamentalsParams, FundamentalsPayload } from './fundamentals';
import { InsiderParams, InsiderPayload } from './insider';
import { MetricParams, MetricPayload } from './metric';
import { MoveBreakdownParams, MoveBreakdownPayload } from './move-breakdown';
import { NewsParams, NewsPayload } from './news';
import { PriceSeriesParams, PriceSeriesPayload } from './price-series';
import { ScreenParams, ScreenPayload } from './screen';

export interface TypologySchema<P extends z.ZodMiniType = z.ZodMiniType, D extends z.ZodMiniType = z.ZodMiniType> {
  id: string;
  params: P;
  payload: D;
}

function withIds<T extends Record<string, { params: z.ZodMiniType; payload: z.ZodMiniType }>>(t: T): { [K in keyof T]: T[K] & { id: K } } {
  return Object.fromEntries(Object.entries(t).map(([id, s]) => [id, { id, ...s }])) as { [K in keyof T]: T[K] & { id: K } };
}

/**
 * What every typology accepts and returns — schemas only, so code that just validates (the browser host, the Worker) never carries
 * the demo generators. The full registry (`TYPOLOGIES`: demo, samples) builds on this one.
 */
export const TYPOLOGY_SCHEMAS = /* @__PURE__ */ withIds({
  'metric@1': { params: MetricParams, payload: MetricPayload },
  'price-series@1': { params: PriceSeriesParams, payload: PriceSeriesPayload },
  'events@1': { params: EventsParams, payload: EventsPayload },
  'analysts@1': { params: AnalystsParams, payload: AnalystsPayload },
  'fundamentals@1': { params: FundamentalsParams, payload: FundamentalsPayload },
  'insider@1': { params: InsiderParams, payload: InsiderPayload },
  'news@1': { params: NewsParams, payload: NewsPayload },
  'move-breakdown@1': { params: MoveBreakdownParams, payload: MoveBreakdownPayload },
  'screen@1': { params: ScreenParams, payload: ScreenPayload },
  'company@1': { params: CompanyParams, payload: CompanyPayload },
});
export type TypologyKey = keyof typeof TYPOLOGY_SCHEMAS;

export const getTypologySchema = (id: string): TypologySchema | undefined =>
  Object.hasOwn(TYPOLOGY_SCHEMAS, id) ? (TYPOLOGY_SCHEMAS as Record<string, TypologySchema>)[id] : undefined;

/** JSON Schema of a typology schema (input side), for the admin catalogue and the generator prompt; null when it has no JSON form. */
export function jsonSchema(s: z.ZodMiniType): Record<string, unknown> | null {
  try { return toJSONSchema(s, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>; } catch { return null; }
}
