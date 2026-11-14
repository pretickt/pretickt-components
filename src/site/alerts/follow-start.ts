import { type ApplicationRef, type ComponentRef, createComponent, createEnvironmentInjector, type EnvironmentInjector } from '@angular/core';
import { PtFollow, type FollowPress } from '@pretickt/components/follow';
import { panelPosition } from '../cards';
import type { PageModel } from '../model';
import { followBackend, PT_FOLLOW_EMAIL, type FollowBackend } from './follow-backend';
import { PtFollowPanel } from './follow-panel';
import { turnstileCheck } from './turnstile';
import { PtFollowing } from './following';

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
  const env = backend && (page.turnstile || given)
    ? createEnvironmentInjector([{ provide: PT_FOLLOW_EMAIL, useValue: { backend, check: page.turnstile ? turnstileCheck(page.turnstile) : null } }], root)
    : root;
  const follow = env.get(PtFollow), win = doc.defaultView;
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
