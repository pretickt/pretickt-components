import type { Need } from '../api';

/** What the generator embeds in each page's <head> (script#pt-data) and the host reads back. */
export interface PageData { buildId: string; api: string; data: Record<string, unknown>; components: Record<string, string> }
/** One mount, in a component's data-pt attribute: component id, params, and the page-data key of each need. */
export interface Mount { c: string; p: unknown; k: Record<string, string> }
export { needPath, typologyInPath } from '../api';
