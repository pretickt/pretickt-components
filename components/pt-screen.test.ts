// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { helpers as h } from '../src/sdk';
import { screenDemo } from '../src/typologies';
import * as mod from './pt-screen';
import { standardSuite } from './_harness';

describe('pt-screen', () => {
  standardSuite('pt-screen.ts', mod);
  it('renders one linked row per company with a sparkline', () => {
    const data = screenDemo({ scope: { list: 'biggest_losers' }, limit: 10 });
    const out = mod.renderStatic({ rows: data }, { scope: { list: 'biggest_losers' }, limit: 10 }, h);
    expect(out.match(/<tr class="pt-scr-row/g)).toHaveLength(data.rows.length);
    expect(out).toContain('href="/stocks/brk.b/"');
    expect(out.match(/<polyline/g)).toHaveLength(data.rows.length);
  });
  it('highlights the subject of a peer list', () => {
    const data = screenDemo({ scope: { peersOf: 'NVDA' }, limit: 5 });
    expect(mod.renderStatic({ rows: data }, { scope: { peersOf: 'NVDA' }, limit: 5 }, h)).toContain('pt-scr-row pt-scr-self');
  });
  it('shows the list-specific column', () => {
    const data = screenDemo({ scope: { list: 'insider_buying' }, limit: 5 });
    expect(mod.renderStatic({ rows: data }, { scope: { list: 'insider_buying' }, limit: 5 }, h)).toContain('>Insiders 90d<');
  });
  it('explains an empty list and null', () => {
    expect(mod.renderStatic({ rows: { asOf: '2026-10-02', rows: [] } }, { scope: { list: '52w_low' }, limit: 5 }, h)).toContain('No companies match');
    expect(mod.renderStatic({ rows: null }, { scope: { list: '52w_low' }, limit: 5 }, h)).toContain('pt-na');
  });
});
