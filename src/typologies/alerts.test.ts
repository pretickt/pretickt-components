import { describe, expect, expectTypeOf, it } from 'vitest';
import type { AlertUniverse } from '../alerts/rows';
import { MOCK_UNIVERSE } from '../alerts/mock';
import { AlertEventParams, AlertEventPayload, alertEventDemo, AlertUniversePayload, type AlertEvent } from './alerts';

describe('the alerts typologies', () => {
  it("alert-universe@1's payload is the alerts' universe, and its demo the made-up one", () => {
    expectTypeOf<import('zod/mini').infer<typeof AlertUniversePayload>>().toEqualTypeOf<AlertUniverse>();
    expect(AlertUniversePayload.parse(MOCK_UNIVERSE)).toEqual(MOCK_UNIVERSE);
  });

  it('alert-event@1 takes an id the email carries, and its payload never an email', () => {
    expect(AlertEventParams.safeParse({ id: 'e-demo-1' }).success).toBe(false);   // too short
    expect(AlertEventParams.safeParse({ id: 'AbCdEf0123456789_-xy' }).success).toBe(true);
    expect(AlertEventParams.safeParse({ id: '../../etc' }).success).toBe(false);
    const ev: AlertEvent = alertEventDemo(AlertEventParams.parse({ id: 'AbCdEf0123456789_-xy' }));
    expect(Object.keys(ev).sort()).toEqual(['companyName', 'conditions', 'firedAt', 'id', 'logo', 'name', 'session', 'ticker']);
    expect(AlertEventPayload.parse(ev)).toEqual(ev);
  });

  it("alert-event@1 keeps when and at what price a condition's value was seen", () => {
    const ev = alertEventDemo({ id: 'AbCdEf0123456789_-xy' });
    const seen = { ...ev, conditions: [{ ...ev.conditions[0]!, at: '9:31 AM ET', price: 149.27 }, ...ev.conditions.slice(1)] };
    expect(AlertEventPayload.parse(seen).conditions[0]).toEqual({ c: 'session-move', p: { dir: 'down', pct: 5 }, value: -0.079, at: '9:31 AM ET', price: 149.27 });
    expect(AlertEventPayload.parse(ev).conditions[0]).toEqual(ev.conditions[0]);
  });
});
