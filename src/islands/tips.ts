/**
 * Tooltips for `[data-tip]` (JSON of label → value, built with `tip()`), rendered as text only; `skip` leaves some targets out (company
 * links, when their card opens instead). The tip node lives in the island
 * wrapper, outside the Vue container, so hydration and re-renders never touch it. Moving between the parts of one target keeps it
 * shown and reports one hover.
 */
export function attachTips(island: HTMLElement, interact: (action: string) => void, skip?: (target: Element) => boolean) {
  const tip = island.ownerDocument.createElement('div');
  tip.className = 'pt-tip';
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  island.append(tip);
  let current: Element | null = null;
  const targetOf = (n: EventTarget | null) => {
    const t = (n as Element | null)?.closest?.('[data-tip]');
    return t && island.contains(t) && !skip?.(t) ? t : null; // skipped: a company link whose card replaces its tooltip
  };
  const show = (e: Event) => {
    const t = targetOf(e.target);
    if (!t || t === current) return;
    let o: Record<string, unknown>;
    try { o = JSON.parse(t.getAttribute('data-tip')!); } catch { return; }
    current = t;
    interact('hover');
    tip.replaceChildren(...Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => {
      const row = island.ownerDocument.createElement('div');
      const b = island.ownerDocument.createElement('b');
      b.textContent = k;
      row.append(b, island.ownerDocument.createTextNode(` ${String(v)}`));
      return row;
    }));
    const a = t.getBoundingClientRect();
    const r = island.getBoundingClientRect();
    tip.style.left = `${a.left - r.left + a.width / 2}px`;
    tip.style.top = `${a.top - r.top}px`;
    tip.hidden = false;
  };
  const hide = (e: Event) => {
    const t = targetOf(e.target);
    if (!t || targetOf((e as PointerEvent | FocusEvent).relatedTarget) === t) return; // still inside the same target
    current = null;
    tip.hidden = true;
  };
  island.addEventListener('pointerover', show);
  island.addEventListener('focusin', show);
  island.addEventListener('pointerout', hide);
  island.addEventListener('focusout', hide);
}
