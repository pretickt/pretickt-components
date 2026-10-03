import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { defineComponent } from './define';
import { checkContract } from './contract';
import type { ComponentModule } from './types';
import { Ticker } from '../typologies';

const manifest = defineComponent({
  tag: 'pt-probe', version: '1.0.0', need: { question: 'q', evidence: [] },
  params: z.object({ ticker: Ticker }), user: [], uses: [],
  needs: (p) => ({ m: { t: 'metric@1', params: { ticker: p.ticker, metrics: ['pe'] } } }),
});

describe('checkContract', () => {
  it('passes a component that handles null and unknown items', () => {
    const mod: ComponentModule = { manifest, renderStatic: (d, _p, h) => (d.m ? `<ul>${(d.m as { label: string }[]).map((x) => `<li>${h.esc(x.label)}</li>`).join('')}</ul>` : h.na()) };
    expect(checkContract(mod, [{ ticker: 'NVDA' }])).toEqual([]);
  });
  it('reports a component that ignores null data', () => {
    const mod: ComponentModule = { manifest, renderStatic: (d) => `<ul>${(d.m as unknown[]).length}</ul>` };
    expect(checkContract(mod, [{ ticker: 'NVDA' }]).join('\n')).toMatch(/null/);
  });
  it('reports non-determinism and script tags', () => {
    let n = 0;
    const mod: ComponentModule = { manifest, renderStatic: (d, _p, h) => (d.m ? `<script></script>${n++}` : h.na()) };
    const errs = checkContract(mod, [{ ticker: 'NVDA' }]).join('\n');
    expect(errs).toMatch(/deterministic/);
    expect(errs).toMatch(/script/);
  });
  it('reports invalid sample params and unknown typologies', () => {
    const bad = defineComponent({ ...manifest, needs: () => ({ x: { t: 'nope@1', params: {} } }) });
    const mod: ComponentModule = { manifest: bad, renderStatic: () => '' };
    expect(checkContract(mod, [{ ticker: '^GSPC' }]).join('\n')).toMatch(/params/);
    expect(checkContract(mod, [{ ticker: 'NVDA' }]).join('\n')).toMatch(/unknown typology/);
  });
  it('reports a component that throws on an unknown metric key', () => {
    const mod: ComponentModule = { manifest, renderStatic: (d, _p, h) => {
      if (!d.m) return h.na();
      return (d.m as { key: string }[]).map((x) => { if (x.key !== 'pe') throw new Error('boom'); return 'pe'; }).join('');
    } };
    expect(checkContract(mod, [{ ticker: 'NVDA' }]).join('\n')).toMatch(/unknown/);
  });
});
