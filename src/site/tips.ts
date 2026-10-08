/**
 * Tooltips for `[data-tip]` inside the page app (JSON of label → value, built with `tip()`), text only. The tip is one node in
 * `<body>`, fixed in the viewport — never inside markup Angular hydrates. `skip` leaves some targets to the pointer's hover card
 * (company links); the keyboard still gets their tooltip. A shown tooltip is a "hover" interaction of its placement.
 */
export function attachTips(root: HTMLElement, skip?: (target: Element) => boolean) {
  const doc = root.ownerDocument;
  const tip = doc.createElement('div');
  tip.className = 'pt-tip';
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  tip.style.position = 'fixed';
  doc.body.append(tip);
  let current: Element | null = null;
  const targetOf = (e: Event, n: EventTarget | null) => {
    const t = (n as Element | null)?.closest?.('[data-tip]');
    return t && root.contains(t) && !(e.type.startsWith('pointer') && skip?.(t)) ? t : null;
  };
  const hideNow = () => { current = null; tip.hidden = true; };
  const show = (e: Event) => {
    const t = targetOf(e, e.target);
    if (!t || t === current) return;
    let o: Record<string, unknown>;
    try { o = JSON.parse(t.getAttribute('data-tip')!) as Record<string, unknown>; } catch { return; }
    current = t;
    t.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'hover' } }));
    tip.replaceChildren(...Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => {
      const row = doc.createElement('div');
      const b = doc.createElement('b');
      b.textContent = k;
      row.append(b, doc.createTextNode(` ${String(v)}`));
      return row;
    }));
    const a = t.getBoundingClientRect();
    tip.style.left = `${a.left + a.width / 2}px`;
    tip.style.top = `${a.top}px`;
    tip.hidden = false;
  };
  const hide = (e: Event) => {
    const t = targetOf(e, e.target);
    if (!t || targetOf(e, (e as PointerEvent | FocusEvent).relatedTarget) === t) return; // still inside the same target
    hideNow();
  };
  root.addEventListener('pointerover', show);
  root.addEventListener('focusin', show);
  root.addEventListener('pointerout', hide);
  root.addEventListener('focusout', hide);
  doc.defaultView?.addEventListener('scroll', hideNow, { passive: true });
  return tip;
}
