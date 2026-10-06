import * as z from 'zod/mini';
import type { Viewport } from '../ds/viewport';

/** The `view` param a zoomable component declares: `view: z.optional(ViewportParam)`. Absent = the full view. */
export const ViewportParam: z.ZodMiniType<Viewport> = z.object({
  /** Fractions of the full series, 0 ≤ start < end ≤ 1. */
  start: z.number().check(z.minimum(0), z.maximum(1)),
  end: z.number().check(z.minimum(0), z.maximum(1)),
  /** Vertical zoom: 1 = fit the data, <1 = stretched (finer detail), >1 = compressed. */
  yScale: z.optional(z.number().check(z.positive())),
  /** Vertical pan, in fractions of the (scaled) price range; positive looks lower down the range (the content moves up). */
  yShift: z.optional(z.number()),
}).check(z.refine((v) => v.end > v.start, 'end must be after start'));


