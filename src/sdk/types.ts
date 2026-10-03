import type * as z from 'zod/mini';
import type { Helpers } from './helpers';

export type TypologyId = `${string}@${number}`;
export interface Need { t: TypologyId; params: unknown }

export interface Manifest<P extends z.ZodMiniType = z.ZodMiniType> {
  /** Lowercase, `pt-` prefixed, without the major suffix (the host adds `-v<major>`). */
  tag: string;
  version: string;
  /** The market need this component answers, with evidence. Mandatory for PUBLISHED. */
  need: { question: string; evidence: string[] };
  params: P;
  /** User data keys the component needs (type-3 data). Empty for now. */
  user: string[];
  /** PUBLISHED components this one renders. Must be empty until composition ships. */
  uses: string[];
  /** Data the component needs, keyed by the name it will read in `data`. Pure. */
  needs: (p: z.infer<P>) => Record<string, Need>;
}

/** Every key may be null: the resolver failed or its payload did not validate. */
export type DataFor<T extends Record<string, unknown>> = { [K in keyof T]: T[K] | null };

export type RenderStatic = (data: Record<string, unknown>, params: unknown, h: Helpers) => string;

export interface HostApi {
  /** Resolve one need to its validated payload (API in the browser, demo in the sandbox). Rejects on failure. */
  resolve(need: Need): Promise<unknown>;
}

/** What an `element` factory receives. `PtElement` is already bound to the module and the host. */
export interface Kit {
  PtElement: CustomElementConstructor & (new () => HTMLElement);
  html: typeof import('lit').html;
  svg: typeof import('lit').svg;
  unsafeHTML: typeof import('lit/directives/unsafe-html.js').unsafeHTML;
}

/* Method syntax on purpose: parameters are checked bivariantly, so a component whose renderStatic
   takes a precise `DataFor<{…}>` still satisfies the interface. */
export interface ComponentModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manifest: Manifest<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderStatic(data: any, params: any, h: Helpers): string;
  /** Optional: extend the default element (which renders `renderStatic`) with custom behaviour. */
  element?(kit: Kit): CustomElementConstructor;
  /** Sample params used by the contract checks, the parity check and the build. */
  samples?: unknown[];
}
