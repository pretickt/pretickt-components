import { describe, expect, expectTypeOf, it } from 'vitest';
import type * as z from 'zod/mini';
import type { Badge, Tone, Viewport } from './index';
import { ViewportParam } from './index';
import { BADGE_UNITS, TONES, type MetricItem, type ToneSchema } from '../typologies';

describe('one source for shared shapes', () => {
  it('a Badge is exactly a metric@1 item, a Tone a ToneSchema value, a Viewport the view param', () => {
    expectTypeOf<Badge>().toEqualTypeOf<MetricItem>();
    expectTypeOf<Tone>().toEqualTypeOf<z.infer<typeof ToneSchema>>();
    expectTypeOf<Viewport>().toEqualTypeOf<z.infer<typeof ViewportParam>>();
    expect(TONES).toEqual(['pos', 'neg', 'flat', 'na']);
    expect(BADGE_UNITS).toEqual(['x', '%', '$', '$c', 'd', '']);
  });
});
