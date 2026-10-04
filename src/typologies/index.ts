import type * as z from 'zod/mini';
import { analystsDemo, analystsSamples } from './analysts';
import { eventsDemo, eventsSamples, eventsUnknownVariant } from './events';
import { fundamentalsDemo, fundamentalsSamples } from './fundamentals';
import { insiderDemo, insiderSamples } from './insider';
import { metricDemo, metricSamples, metricUnknownVariant } from './metric';
import { moveBreakdownDemo, moveBreakdownSamples } from './move-breakdown';
import { newsDemo, newsSamples } from './news';
import { priceSeriesDemo, priceSeriesSamples } from './price-series';
import { TYPOLOGY_SCHEMAS, type TypologyKey, type TypologySchema } from './schemas';
import { screenDemo, screenSamples } from './screen';

type S = typeof TYPOLOGY_SCHEMAS;
interface Extras<P extends z.ZodMiniType, D extends z.ZodMiniType> {
  /** Deterministic fake payload: tests, parity, the admin bench and (later) the community sandbox. */
  demo: (p: z.output<P>) => z.output<D>;
  /** Params the checks and the bench use: at least one per typology. */
  samples: readonly z.input<P>[];
  /** The payload plus catalogue entries this build has never seen; the contract renders components against it. */
  unknownVariant?: (payload: z.output<D>) => unknown;
}
export type Typology<P extends z.ZodMiniType = z.ZodMiniType, D extends z.ZodMiniType = z.ZodMiniType> = TypologySchema<P, D> & Extras<P, D>;

const EXTRAS: { [K in TypologyKey]: Extras<S[K]['params'], S[K]['payload']> } = {
  'metric@1': { demo: metricDemo, samples: metricSamples, unknownVariant: metricUnknownVariant },
  'price-series@1': { demo: priceSeriesDemo, samples: priceSeriesSamples },
  'events@1': { demo: eventsDemo, samples: eventsSamples, unknownVariant: eventsUnknownVariant },
  'analysts@1': { demo: analystsDemo, samples: analystsSamples },
  'fundamentals@1': { demo: fundamentalsDemo, samples: fundamentalsSamples },
  'insider@1': { demo: insiderDemo, samples: insiderSamples },
  'news@1': { demo: newsDemo, samples: newsSamples },
  'move-breakdown@1': { demo: moveBreakdownDemo, samples: moveBreakdownSamples },
  'screen@1': { demo: screenDemo, samples: screenSamples },
};

function withExtras(): { [K in TypologyKey]: S[K] & Extras<S[K]['params'], S[K]['payload']> } {
  return Object.fromEntries(Object.entries(TYPOLOGY_SCHEMAS).map(([id, s]) => [id, { ...s, ...EXTRAS[id as TypologyKey] }])) as never;
}
/** Every typology: schemas, demo and samples. Pure, so a bundle that only reads TYPOLOGY_SCHEMAS drops the demos. */
export const TYPOLOGIES = /* @__PURE__ */ withExtras();

export const getTypology = (id: string): Typology | undefined =>
  Object.hasOwn(TYPOLOGIES, id) ? (TYPOLOGIES as unknown as Record<string, Typology>)[id] : undefined;

/** The demo payload of one need. Throws with what is wrong: an unknown typology or params it rejects. */
export function demoFor(need: { t: string; params: unknown }): unknown {
  const t = getTypology(need.t);
  if (!t) throw new Error(`unknown typology ${need.t}`);
  const p = t.params.safeParse(need.params);
  if (!p.success) throw new Error(`invalid params for ${need.t}`);
  return t.demo(p.data);
}

export * from './schemas';
export * from './common';
export * from './metric';
export * from './price-series';
export * from './events';
export * from './analysts';
export * from './fundamentals';
export * from './insider';
export * from './news';
export * from './move-breakdown';
export * from './screen';
