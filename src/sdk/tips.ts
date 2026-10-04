/**
 * Tooltips for `[data-tip]` (JSON of label → value, built with `h.tip`), rendered as text only. The tip node is prepended before Lit's
 * markers, so a re-render (new HTML) never deletes it. Moving between the parts of one target keeps it shown and reports one hover.
 */
export function attachTips(el: HTMLElement, interact: (action: string) => void) {
  const tip = document.createElement('div');
  tip.className = 'pt-tip';
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  el.prepend(tip);
  let current: Element | null = null;
  const targetOf = (n: EventTarget | null) => {
    const t = (n as Element | null)?.closest?.('[data-tip]');
    return t && el.contains(t) ? t : null;
  };
  const show = (e: Event) => {
    const t = targetOf(e.target);
    if (!t || t === current) return;
    let o: Record<string, unknown>;
    try { o = JSON.parse(t.getAttribute('data-tip')!); } catch { return; }
    current = t;
    interact('hover');
    tip.replaceChildren(...Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => {
      const row = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = k;
      row.append(b, document.createTextNode(` ${String(v)}`));
      return row;
    }));
    const a = t.getBoundingClientRect();
    const h = el.getBoundingClientRect();
    tip.style.left = `${a.left - h.left + a.width / 2}px`;
    tip.style.top = `${a.top - h.top}px`;
    tip.hidden = false;
  };
  const hide = (e: Event) => {
    const t = targetOf(e.target);
    if (!t || targetOf((e as PointerEvent | FocusEvent).relatedTarget) === t) return; // still inside the same target
    current = null;
    tip.hidden = true;
  };
  el.addEventListener('pointerover', show);
  el.addEventListener('focusin', show);
  el.addEventListener('pointerout', hide);
  el.addEventListener('focusout', hide);
}
