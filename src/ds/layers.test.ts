import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../styles/ds.css', import.meta.url), 'utf8');
const rule = (sel: string) => new RegExp(`\\${sel} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
const z = (sel: string) => Number(/\bz-(\d+)\b/.exec(rule(sel))?.[1]);

describe('the fixed header in the page\'s layers', () => {
  it('sits above the page and its pop-ups, under the tooltip and the hover card', () => {
    expect(rule('.pt-header')).toMatch(/\bsticky\b.*\btop-0\b/);
    expect(z('.pt-header')).toBeGreaterThanOrEqual(z('.pt-cal-pop'));
    expect(z('.pt-header')).toBeLessThan(z('.pt-tip'));
    expect(z('.pt-header')).toBeLessThan(z('.pt-hovercard'));
  });
  it('an anchored section (#financials) lands below the header', () => {
    expect(rule('.pt-section')).toMatch(/\bscroll-mt-\d+\b/);
  });
});
