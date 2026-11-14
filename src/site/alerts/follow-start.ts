import { type ApplicationRef, type ComponentRef, createComponent, createEnvironmentInjector, type EnvironmentInjector } from '@angular/core';
import { PtFollow, type FollowPress } from '@pretickt/components/follow';
import { panelPosition } from '../cards';
import type { PageModel } from '../model';
import { BARS_EVERY_MS } from '@pretickt/components/context';
import { liveSource } from '../live';
import { followBackend, PT_FOLLOW_EMAIL, PT_FOLLOW_FLOAT, type FollowBackend } from './follow-backend';
import { canFloat, openFloating } from './pip';
import { PtFollowPanel } from './follow-panel';
import { turnstileCheck } from './turnstile';
import { fetchFollowFile, PtFollowing } from './following';

const WIDTH = 320;

/**
 * A page with the bells (FOLLOW_ENABLED), once rendered: a bell's press opens its company's panel under it (or wherever it fits), in a host of
 * its own at the end of the body. Escape, a click outside it or the same bell again closes it, and the focus goes back to the bell. Loaded
 * only on such pages (src/site/page.ts), so none of it weighs on the main bundle.
 */
export function startFollow(doc: Document, appRef: ApplicationRef, root: EnvironmentInjector, page: PageModel, given?: FollowBackend): void {
  // the email (part 2): where the email alerts are on (their API and human check), the panel offers it and a linked browser tells the
  // server each change; elsewhere following stays in the browser
  const backend = given ?? (page.alerts ? followBackend(page.api) : null);
  const follow = root.get(PtFollow), win = doc.defaultView;
  const providers = [
    ...(backend && (page.turnstile || given) ? [{ provide: PT_FOLLOW_EMAIL, useValue: { backend, check: page.turnstile ? turnstileCheck(page.turnstile) : null } }] : []),
    // the floating window (part 3): the followed companies with today's delayed prices, where the browser can open one
    ...(win && canFloat(win) ? [{ provide: PT_FOLLOW_FLOAT, useValue: { open: async () => {
      const file = await fetchFollowFile().catch(() => null);
      await openFloating(win, { follows: follow.follows(), file, load: async () => (await liveSource(page.live)?.load()) ?? null, everyMs: BARS_EVERY_MS }).catch(() => undefined);
    } } }] : []),
  ];
  const env = providers.length ? createEnvironmentInjector(providers, root) : root;
  if (backend) follow.listenChanges((c) => {
    const l = follow.link();
    if (l) backend.manage(l.token, { op: 'follow', ticker: c.ticker, on: c.on }).then((st) => { if (st === null) follow.setLink(null); }, () => { /* the next visit to /alerts/ sends the whole list */ });
  });
  let open: { ref: ComponentRef<PtFollowPanel>; host: HTMLElement; ticker: string; back: HTMLElement | null } | null = null;

  const close = (focusBack: boolean) => {
    if (!open) return;
    const { ref, host, back } = open;
    open = null;
    appRef.detachView(ref.hostView);
    ref.destroy();
    host.remove();
    if (focusBack && back?.isConnected) back.focus();
  };
  const show = (p: FollowPress) => {
    const same = open?.ticker === p.ticker;
    close(false);
    if (same) return; // the same bell again: closed
    const back = doc.activeElement instanceof (win?.HTMLElement ?? HTMLElement) ? (doc.activeElement as HTMLElement) : null;
    const host = doc.createElement('div');
    host.className = 'pt-follow-panel';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-label', `Alerts for ${p.name}`);
    doc.body.append(host);
    const ref = createComponent(PtFollowPanel, { environmentInjector: env, hostElement: host });
    ref.setInput('ticker', p.ticker);
    ref.setInput('name', p.name);
    ref.setInput('alerts', p.alerts);
    appRef.attachView(ref.hostView);
    ref.changeDetectorRef.detectChanges();
    const pos = panelPosition(p.rect, Math.min(WIDTH, (win?.innerWidth ?? WIDTH) - 16), host.offsetHeight, win?.innerWidth ?? WIDTH, win?.innerHeight ?? 600);
    host.style.left = `${pos.x}px`;
    host.style.top = `${pos.y}px`;
    if (pos.maxHeight != null) host.style.maxHeight = `${pos.maxHeight}px`;
    open = { ref, host, ticker: p.ticker, back };
    host.querySelector<HTMLElement>('.pt-follow-switch')?.focus();
  };

  follow.listen(show);
  // /alerts/: the companies this browser follows, in the page's place for them
  const list = doc.querySelector('[data-pt-following]');
  if (list) {
    const el = doc.createElement('pt-following');
    list.replaceChildren(el);
    appRef.attachView(createComponent(PtFollowing, { environmentInjector: env, hostElement: el }).hostView);
  }
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) close(true); });
  doc.addEventListener('click', (e) => { if (open && !open.host.contains(e.target as Node)) close(false); });
}
