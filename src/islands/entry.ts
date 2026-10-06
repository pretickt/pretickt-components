/** The browser entry of every page: hydrate the islands once the document is parsed. `./client` stays free of side effects. */
import { hydrateIslands } from './client';

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void hydrateIslands());
  else void hydrateIslands();
}
