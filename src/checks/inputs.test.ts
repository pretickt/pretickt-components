import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPONENTS_ROOT, componentsProgram, readInputs } from './inputs';
import { sampleProps } from './props';

const file = (tag: string) => join(COMPONENTS_ROOT, 'components', `${tag}.ts`);
const program = componentsProgram(['pt-why-today', 'pt-screen', 'pt-calendar', 'pt-company-card', 'pt-metric'].map(file));

describe('readInputs (the TypeScript checker on the component file)', () => {
  it('names, required, types, literal unions and literal defaults', () => {
    expect(readInputs(program, file('pt-why-today'))).toEqual({ className: 'PtWhyToday', inputs: [
      { name: 'ticker', required: true, type: 'string', literals: [] },
      { name: 'window', required: false, type: "Window", literals: ['1d', '5d', '1m'], default: '1d' },
    ] });
    const screen = readInputs(program, file('pt-screen')).inputs;
    expect(screen.map((i) => [i.name, i.required, i.default])).toEqual([['list', false, undefined], ['peersOf', false, undefined], ['limit', false, 25], ['sector', false, undefined]]);
    expect(screen[0]!.literals).toContain('largest');
    expect(screen[3]!.literals).toContain('Financial Services');
    expect(readInputs(program, file('pt-company-card')).inputs.find((i) => i.name === 'extra')).toMatchObject({ required: false, default: null });
  });
  it('samples: required inputs by known name, one variant per other literal', () => {
    expect(sampleProps(readInputs(program, file('pt-why-today')).inputs)).toEqual([{ ticker: 'NVDA' }, { ticker: 'NVDA', window: '5d' }, { ticker: 'NVDA', window: '1m' }]);
    const cal = sampleProps(readInputs(program, file('pt-calendar')).inputs);
    expect(cal[0]).toEqual({ month: expect.stringMatching(/^\d{4}-\d{2}$/) });
    expect(cal).toContainEqual({ ...cal[0], kind: 'dividend' });
    expect(cal).toContainEqual({ ...cal[0], view: 'week' });
    expect(sampleProps(readInputs(program, file('pt-metric')).inputs)[0]).toEqual({ ticker: 'NVDA', metrics: expect.any(Array) });
  });
});
