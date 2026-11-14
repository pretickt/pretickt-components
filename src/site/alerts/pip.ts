import type { LiveDay, LiveQuote } from '@pretickt/components/context';
import { money, pct, plainName } from '@pretickt/components/format';
import type { FollowFile } from '@pretickt/components/typologies';

/**
 * The floating window of the followed companies (Romeo, 2026-11-14: «c'è un pip per le aziende monitorate che mostra anche le variazioni
 * in allarme, si può attivare dalla pagina»; spec 2026-11-14-follow-alerts-design.md, part 3): Document Picture-in-Picture, drawn with plain
 * DOM (no Angular in the other window), the site's stylesheet linked. One row per followed company: name, the 15-minute delayed price and
 * the day's move, the night's alerts and the ones the day's price lights; a badge the day adds flashes. Only whole files are read.
 */
type Tone = 'pos' | 'neg' | 'flat';
export interface Chip { label: string; tone: Tone }
interface PipApi { requestWindow(o: { width: number; height: number }): Promise<Window> }

const NEAR = 0.02, BIG = 0.05;

/** Only where the browser has Document Picture-in-Picture (Chrome and Edge on a desktop). */
export const canFloat = (win: Window): boolean => !!(win as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;

/** What the day's price lights: a move of 5% or more, a support broken or within 2%, a resistance passed or within 2%. */
export function liveChips(q: Pick<LiveQuote, 'p' | 'pc'> | null, levels: { s?: number; r?: number } | undefined): Chip[] {
  if (!q || !(q.p > 0)) return [];
  const out: Chip[] = [], move = q.pc > 0 ? q.p / q.pc - 1 : 0;
  if (Math.abs(move) >= BIG) out.push({ label: `${move > 0 ? '+' : '-'}${(Math.abs(move) * 100).toFixed(1)}% today`, tone: move > 0 ? 'pos' : 'neg' });
  const s = levels?.s, r = levels?.r;
  if (s != null) { if (q.p < s) out.push({ label: 'Below support', tone: 'neg' }); else if (q.p <= s * (1 + NEAR)) out.push({ label: 'Near support', tone: 'flat' }); }
  if (r != null) { if (q.p > r) out.push({ label: 'Above resistance', tone: 'pos' }); else if (q.p >= r * (1 - NEAR)) out.push({ label: 'Near resistance', tone: 'flat' }); }
  return out;
}

/**
 * Opens the window and keeps it current: `load` reads today's intraday file (whole), every `everyMs` while it is open (0: never by itself).
 * `refresh` reads it again now; `stop` ends the polling (the window closing does too).
 */
export async function openFloating(win: Window, o: { follows: readonly string[]; file: FollowFile | null; load: () => Promise<LiveDay | null>; everyMs: number }):
  Promise<{ refresh(): Promise<void>; stop(): void }> {
  const pip = await (win as unknown as { documentPictureInPicture: PipApi }).documentPictureInPicture.requestWindow({ width: 340, height: 480 });
  const doc = pip.document;
  const css = doc.createElement('link');
  css.rel = 'stylesheet';
  css.href = `${win.location.origin}/ds.css`;
  doc.head.append(css);
  doc.title = 'pretickt · following';
  doc.body.className = 'pt-pip';
  const list = doc.createElement('div');
  const head = doc.createElement('p');
  head.className = 'pt-pip-head pt-meta';
  doc.body.append(head, list);
  const shown = new Map<string, Set<string>>();
  const el = (tag: string, cls: string, text?: string) => { const e = doc.createElement(tag); e.className = cls; if (text != null) e.textContent = text; return e; };

  const draw = (day: LiveDay | null) => {
    head.textContent = day ? `Following · ${day.closed ? 'closed' : day.time} · prices 15 min delayed` : 'Following · last close';
    list.replaceChildren(...o.follows.map((t) => {
      const c = o.file?.companies[t], q = day?.q[t] ?? null;
      const night: Chip[] = (c?.alerts ?? []).filter((a) => a.session === o.file?.asOf).map((a) => ({ label: `${a.label}${a.value ? ` ${a.value}` : ''}`, tone: a.tone === 'na' ? 'flat' : a.tone }));
      const chips = [...night, ...liveChips(q, c?.levels)], before = shown.get(t);
      shown.set(t, new Set(chips.map((x) => x.label)));
      const row = el('div', 'pt-pip-row');
      const top = el('div', 'pt-pip-top');
      top.append(el('span', 'pt-pip-name', plainName(c?.name ?? t)), el('span', 'pt-pip-tk pt-meta', t));
      if (q) top.append(el('span', 'pt-pip-px', money(q.p)), el('span', `pt-pip-chg pt-t-${q.r > 0 ? 'pos' : q.r < 0 ? 'neg' : 'flat'}`, pct(q.r)));
      const badges = el('div', 'pt-pip-chips');
      for (const x of chips) {
        const b = el('span', `pt-pip-chip pt-follow-chip pt-follow-${x.tone}`, x.label);
        if (before && !before.has(x.label)) { b.classList.add('pt-pip-new'); setTimeout(() => b.classList.remove('pt-pip-new'), 3000); }
        badges.append(b);
      }
      row.append(top, badges);
      return row;
    }));
  };
  const refresh = async () => { draw(await o.load().catch(() => null)); };
  await refresh();
  const timer = o.everyMs > 0 ? setInterval(() => { void refresh(); }, o.everyMs) : null;
  const stop = () => { if (timer) clearInterval(timer); };
  pip.addEventListener('pagehide', stop);
  return { refresh, stop };
}
