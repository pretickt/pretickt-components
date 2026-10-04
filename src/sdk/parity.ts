import { getTypology } from '../typologies';
import { elementName } from './define';
import { NO_SAMPLES } from './contract';
import { classFor, type LitKit } from './element';
import { helpers } from './helpers';
import type { ComponentModule } from './types';

let seq = 0;
const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Browser/happy-dom only. The element's visible text must equal the static HTML's text on demo data. */
export async function checkParity(lit: LitKit, mod: ComponentModule, samples: unknown[] = mod.samples ?? []): Promise<string[]> {
  if (!samples.length) return [`${mod.manifest.tag}: ${NO_SAMPLES}`];
  const errors: string[] = [];
  const name = `${elementName(mod.manifest)}-parity${seq++}`;
  customElements.define(name, classFor(lit, mod, { resolve: async () => { throw new Error('no network during parity'); } }));
  for (const raw of samples) {
    const params = mod.manifest.params.parse(raw);
    const data: Record<string, unknown> = {};
    for (const [k, n] of Object.entries(mod.manifest.needs(params as never))) {
      const t = getTypology(n.t)!;
      data[k] = t.demo(t.params.parse(n.params));
    }
    const html = mod.renderStatic(data, params, helpers);
    const ref = document.createElement('div');
    ref.innerHTML = html;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<${name}>${html}</${name}>`;
    document.body.append(wrap);
    const el = wrap.firstElementChild as HTMLElement & { params: unknown; data: unknown; updateComplete: Promise<boolean> };
    el.params = params;
    el.data = data;
    await el.updateComplete;
    el.querySelector('.pt-tip')?.remove();
    if (norm(el.textContent) !== norm(ref.textContent))
      errors.push(`${mod.manifest.tag} ${JSON.stringify(raw)}: parity failed — element text differs from renderStatic text`);
    wrap.remove();
  }
  return errors;
}
