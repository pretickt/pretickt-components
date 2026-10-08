import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { Type } from '@angular/core';
import { Pt, PT_STORE, PtStore, validateParams } from '../src/context';
import { demoFor, getTypology } from '../src/typologies';

/** Every call answered with the typology's demo; `variant` adds the catalogue entries a newer API may send. */
export const demo = (variant = false) => async (t: string, params: unknown) => {
  const d = demoFor({ t, params });
  const v = getTypology(t)?.unknownVariant;
  return variant && v ? v(d as never) : d;
};
/** Fixed data: every call to `t` answers `answers[t]`, the rest the demo. */
export const withData = (answers: Record<string, unknown>) => async (t: string, params: unknown) => (t in answers ? answers[t] : demoFor({ t, params }));

/** HTML without Angular's comment anchors, so patterns read like the markup. */
export const clean = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

export async function settle(f: ComponentFixture<unknown>) {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

/**
 * A component rendered the way the build renders it: a `Pt` whose calls `resolve` answers (validated params, the render waits for
 * every call), or — `browser: true` — the way a page behaves after load (failed requests are failures, nothing waits).
 */
export async function render<C>(component: Type<C>, inputs: Record<string, unknown>, resolve: (t: string, p: unknown) => Promise<unknown> = demo(), o: { browser?: boolean } = {}) {
  let calls = 0;
  const record: Record<string, unknown> = {};
  const store = new PtStore({ server: !o.browser, resolve: (t, p) => { calls++; return resolve(t, p); }, validate: validateParams, record });
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: PT_STORE, useValue: store }, Pt] });
  const f = TestBed.createComponent(component);
  for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
  if (o.browser) { f.detectChanges(); for (let i = 0; i < 10; i++) await Promise.resolve(); f.detectChanges(); } else await settle(f);
  const el = f.nativeElement as HTMLElement;
  return { f, el, html: () => clean(el.innerHTML), text: () => el.textContent ?? '', record, calls: () => calls };
}

/** Clicks the button with this text inside `el` and lets the component settle. */
export async function press(f: ComponentFixture<unknown>, el: Element, label: string) {
  const b = [...el.querySelectorAll('button')].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no button "${label}"`);
  b.click();
  await settle(f);
}

/** The text of one column of a table, top to bottom. */
export const column = (el: Element, n: number) => [...el.querySelectorAll(`tbody tr td:nth-child(${n})`)].map((c) => c.textContent!.trim());

/** Every component: demo data renders (no unanswered call), missing data renders the not-available state. */
export function basics<C>(component: Type<C>, inputs: Record<string, unknown>) {
  it('demo data renders, every call answered', async () => {
    const r = await render(component, inputs);
    expect(Object.values(r.record).filter((v) => v === null)).toEqual([]);
    expect(r.html()).not.toContain('pt-na');
  });
  it('missing data renders the not-available state', async () => {
    const r = await render(component, inputs, async () => null);
    expect(r.html()).toContain('pt-na');
  });
}
