import { describe, expect, it } from 'vitest';
import { ICON_PATHS } from '../src/ds/icons';
import { registrySource } from './registry';

describe('the generated slot', () => {
  const src = registrySource([{ tag: 'pt-x', className: 'PtX', version: '1.0.0', inputs: [], sample: {} }]);

  it('the slot shows the bell only when the page has alerts and the placement has a badge', () => {
    expect(src).toContain('readonly a = input<string | null>(null);');
    expect(src).toMatch(/@if \(a\(\); as alert\) \{<button type="button" class="pt-alert-bell" \[attr\.data-alert\]="alert"/);
    expect(src).not.toContain('alertSourceOf');   // the mapping runs on the server (renderPage), not in the main bundle
    expect(src).toContain(ICON_PATHS['bell']!);
  });

  it('keeps Share first in the foot', () => {
    expect(src.indexOf('class="pt-share"')).toBeLessThan(src.indexOf('class="pt-alert-bell"'));
  });
});
