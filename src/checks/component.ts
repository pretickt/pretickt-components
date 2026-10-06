import type { Component } from 'vue';
import { renderIsland } from '../islands/server';
import { demoFor, getTypology } from '../typologies';

const demo = (variant: boolean) => async (t: string, params: unknown) => {
  const d = demoFor({ t, params });
  const v = getTypology(t)?.unknownVariant;
  return variant && v ? v(d as never) : d;
};

/**
 * The server-side checks of one component, for props sampled from its prop types: demo data renders with every call answered and
 * safe markup; missing data (every call null) renders the not-available state; catalogue entries it does not know are tolerated.
 * One line per problem. (Hydration needs a DOM: the component suite and the generator's sandbox check it with happy-dom.)
 */
export async function checkComponent(component: Component, samples: Record<string, unknown>[]): Promise<string[]> {
  const errors: string[] = [];
  for (const props of samples) {
    const label = JSON.stringify(props);
    const run = async (what: string, resolve: (t: string, p: unknown) => Promise<unknown>, judge: (r: Awaited<ReturnType<typeof renderIsland>>) => string[]) => {
      try { errors.push(...judge(await renderIsland(component, props, { resolve })).map((e) => `${label}: ${what}: ${e}`)); }
      catch (e) { errors.push(`${label}: ${what}: throws ${(e as Error).message}`); }
    };
    await run('demo data', demo(false), (r) => [...r.failed.map((k) => `no answer for ${k}`), ...r.markup.map((m) => `markup ${m}`)]);
    await run('missing data', async () => null, (r) => (r.html.includes('pt-na') ? [] : ['does not render the not-available state (class "pt-na")']));
    await run('unknown catalogue entries', demo(true), (r) => r.markup.map((m) => `markup ${m}`));
  }
  return errors;
}
