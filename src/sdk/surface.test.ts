import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as sdk from './index';

describe('public surface', () => {
  it('the SDK index exposes what components use, not the gesture internals', () => {
    for (const k of ['applyXViewport', 'applyYViewport', 'FULL_VIEWPORT', 'ViewportParam', 'helpers', 'defineComponent', 'needPath']) expect(sdk, k).toHaveProperty(k);
    for (const k of ['zoomViewport', 'panViewport', 'scaleYViewport', 'shiftYViewport', 'fitYViewport', 'latestViewport', 'isFullViewport', 'isYFitted', 'isAtLatest'])
      expect(sdk, k).not.toHaveProperty(k);
  });
  it('package entry points: lint and contract apart, no catch-all tools, no test harness', () => {
    const exp = JSON.parse(readFileSync('package.json', 'utf8')).exports as Record<string, string | null>;
    expect(exp['./tools']).toBeUndefined();
    expect(exp['./lint']).toBe('./src/sdk/lint.ts');
    expect(exp['./components/_*']).toBeNull();
  });
  it('jsonSchema describes a typology schema for the admin and the generator prompt', async () => {
    const { jsonSchema, TYPOLOGY_SCHEMAS } = await import('../typologies');
    expect(jsonSchema(TYPOLOGY_SCHEMAS['news@1'].params)).toMatchObject({ type: 'object', properties: { ticker: { type: 'string' } } });
  });
});
