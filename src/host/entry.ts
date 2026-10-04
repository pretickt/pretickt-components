/** The browser bundle's entry: boots the page. `./browser` itself stays free of side effects. */
import { boot } from './browser';

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void boot());
  else void boot();
}
