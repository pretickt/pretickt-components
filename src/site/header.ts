/**
 * The site header's behaviour, on the markup the generator writes (`form.pt-search`, `details.pt-menu`): company search over a
 * static index (`/search.json`, fetched on the first focus) and the sector menu closing on Escape or a click outside. Without this
 * the header still works: the menu is a `<details>`, the search a form to /stocks/.
 */
import { stockHref } from '../ds/format';

export type Company = readonly [ticker: string, name: string];
const MAX = 8;
const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Ticker exact, then ticker prefix, then a word of the name that starts with the query, then the name anywhere; at most `max`. */
export function rankCompanies(rows: readonly Company[], query: string, max = MAX): Company[] {
  const q = fold(query);
  if (!q) return [];
  const rank = ([t, n]: Company): number => {
    const ft = fold(t);
    if (ft === q) return 0;
    if (ft.startsWith(q)) return 1;
    if (words(n).some((w) => w.startsWith(q))) return 2;
    return fold(n).includes(q) ? 3 : -1;
  };
  return rows.map((r, i) => ({ r, k: rank(r), i })).filter((x) => x.k >= 0).sort((a, b) => a.k - b.k || a.i - b.i).slice(0, max).map((x) => x.r);
}

export interface HeaderOptions {
  /** The build the index belongs to (a new build fetches a new index). */
  buildId: string;
  fetch?: (url: string) => Promise<Response>;
  navigate?: (href: string) => void;
}

export function attachHeader(doc: Document, o: HeaderOptions): void {
  const menu = doc.querySelector<HTMLDetailsElement>('details.pt-menu');
  const form = doc.querySelector<HTMLFormElement>('form.pt-search');
  const input = form?.querySelector<HTMLInputElement>('input[type="search"]');
  const list = form?.querySelector<HTMLElement>('.pt-search-list');
  const go = o.navigate ?? ((href: string) => doc.location.assign(href));
  const closeMenu = () => { if (menu) menu.open = false; };
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  doc.addEventListener('click', (e) => {
    const t = e.target as Node | null;
    if (menu && t && !menu.contains(t)) closeMenu();
    if (form && t && !form.contains(t)) close();
  });
  if (!form || !input || !list) return;

  let index: readonly Company[] | null = null;
  let loading: Promise<void> | null = null;
  let shown: Company[] = [];
  let active = -1;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');
  list.setAttribute('role', 'listbox');

  const load = () => (loading ??= (o.fetch ?? ((u: string) => fetch(u)))(`/search.json?v=${encodeURIComponent(o.buildId)}`)
    .then((r) => r.json() as Promise<{ rows: Company[] }>).then((j) => { index = j.rows; }).catch(() => { index = null; }));
  function close() {
    list!.hidden = true;
    input!.setAttribute('aria-expanded', 'false');
    input!.removeAttribute('aria-activedescendant');
    active = -1;
  }
  const mark = () => {
    list.querySelectorAll('[role="option"]').forEach((el, i) => el.setAttribute('aria-selected', String(i === active)));
    const el = list.querySelectorAll('[role="option"]')[active];
    if (el) input.setAttribute('aria-activedescendant', el.id); else input.removeAttribute('aria-activedescendant');
  };
  const render = () => {
    shown = index ? rankCompanies(index, input.value) : [];
    active = -1;
    list.replaceChildren(...shown.map(([t, n], i) => {
      const a = doc.createElement('a');
      a.id = `${list.id}-${i}`;
      a.className = 'pt-search-opt';
      a.href = stockHref(t);
      a.setAttribute('role', 'option');
      a.setAttribute('aria-selected', 'false');
      const b = doc.createElement('strong');
      b.textContent = t;
      const s = doc.createElement('span');
      s.textContent = n;
      a.append(b, ' ', s);
      return a;
    }));
    if (shown.length) { list.hidden = false; input.setAttribute('aria-expanded', 'true'); } else close();
    mark();
  };
  /** Counted once per page by the beacon (`data-beacon` on the form), then the hub opens. */
  const open = (i: number) => {
    const c = shown[i];
    if (!c) return;
    form.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'search' } }));
    go(stockHref(c[0]));
  };

  input.addEventListener('focus', () => { void load(); });
  input.addEventListener('input', () => { void load().then(render); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!shown.length) return;
      e.preventDefault();
      active = e.key === 'ArrowDown' ? Math.min(active + 1, shown.length - 1) : Math.max(active - 1, 0);
      mark();
    } else if (e.key === 'Enter') {
      if (!shown.length) return; // a plain form: /stocks/
      e.preventDefault();
      open(Math.max(active, 0));
    } else if (e.key === 'Escape') close();
  });
  list.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('[role="option"]');
    if (!a) return;
    e.preventDefault();
    open([...list.children].indexOf(a));
  });
}
