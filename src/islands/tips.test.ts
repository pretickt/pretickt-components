// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { attachTips } from './tips';

describe('tooltips', () => {
  it('a skipped target (a company link whose card opens on hover) keeps its tooltip for the keyboard', () => {
    document.body.innerHTML = '<div id="i"><a id="a" href="/stocks/aapl/" data-tip=\'{"Earnings":"Oct 28"}\'>AAPL</a></div>';
    const island = document.getElementById('i')!;
    attachTips(island, () => {}, () => true);
    const a = document.getElementById('a')!;
    a.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(island.querySelector<HTMLElement>('.pt-tip')!.hidden).toBe(true);
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(island.querySelector<HTMLElement>('.pt-tip')!.hidden).toBe(false);
    expect(island.querySelector('.pt-tip')!.textContent).toBe('Earnings Oct 28');
  });
});
