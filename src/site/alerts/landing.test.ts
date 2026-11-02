import { describe, expect, it } from 'vitest';
import { landingOf } from './landing';

describe("an email link's landing (spec §4: no account, the link's token)", () => {
  it('an alert email opens the company page with the event it fired', () => {
    expect(landingOf('?alert=Ab12_-cdEFgh34ijKL')).toEqual({ alert: 'Ab12_-cdEFgh34ijKL', token: null, action: null });
  });

  it('the confirmation link confirms, the weekly link turns the weekly email on, a token alone manages', () => {
    expect(landingOf('?do=confirm&t=eyJzIjoi.c2ln')).toEqual({ alert: null, token: 'eyJzIjoi.c2ln', action: 'confirm' });
    expect(landingOf('?do=weekly&t=eyJzIjoi.c2ln')).toEqual({ alert: null, token: 'eyJzIjoi.c2ln', action: 'weekly' });
    expect(landingOf('?t=eyJzIjoi.c2ln')).toEqual({ alert: null, token: 'eyJzIjoi.c2ln', action: 'manage' });
    expect(landingOf('?do=nonsense&t=eyJzIjoi.c2ln').action).toBe('manage');
  });

  it('anything else is no landing', () => {
    const none = { alert: null, token: null, action: null };
    expect(landingOf('')).toEqual(none);
    expect(landingOf('?alert=%3Cscript%3E')).toEqual(none);
    expect(landingOf('?alert=short')).toEqual(none);
    expect(landingOf('?do=confirm')).toEqual(none);   // no token: nothing to confirm
    expect(landingOf('?t=not a token')).toEqual(none);
    expect(landingOf(`?t=${'a'.repeat(2000)}.b`)).toEqual(none);
  });
});
