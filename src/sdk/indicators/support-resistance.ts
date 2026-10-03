export interface SrLevel {
  price: number;
  distPct: number;
  touches: number;
  near: boolean;
  /**
   * What the level is MADE OF, which is not the same as where it sits today:
   * `ceiling` = built from swing highs, price failed here; `floor` = swing lows, price held here.
   */
  kind: 'ceiling' | 'floor' | 'mixed';
  /**
   * True when price now sits on the opposite side of what the level historically did — a ceiling
   * price has climbed above, or a floor it has fallen through. Classic polarity flip: it may well
   * act the other way now, but calling a freshly broken ceiling a "support" without saying so
   * misreads the chart. NVDA's 224 shelf was exactly this: one swing HIGH from 2026-06-01, with
   * the close 0.5% above it.
   */
  flipped: boolean;
}
export interface SupportResistance {
  current: number | null;
  resistances: SrLevel[];
  supports: SrLevel[];
}

interface Pivot {
  i: number;
  price: number;
  kind: 'high' | 'low';
}

/** Local highs/lows: index i is the max (high) or min (low) of closes[i-window … i+window]. */
export function swingPivots(closes: number[], window = 5): Pivot[] {
  const out: Pivot[] = [];
  for (let i = window; i < closes.length - window; i++) {
    const seg = closes.slice(i - window, i + window + 1);
    const v = closes[i];
    if (v === Math.max(...seg)) out.push({ i, price: v, kind: 'high' });
    else if (v === Math.min(...seg)) out.push({ i, price: v, kind: 'low' });
  }
  return out;
}

/**
 * Merge pivots within `tolPct` of the running cluster mean; touches = member count.
 * `maxSpanPct` caps the total cluster width (vs its mean): the running mean trails the
 * ascending scan, so without a cap dense pivot zones chain-merge into one blurred level
 * that can swallow a distinct shelf between two others (AMZN's ~230 zone).
 */
export function clusterLevels(
  pivots: { price: number; kind?: 'high' | 'low' }[],
  tolPct: number,
  maxSpanPct = Infinity,
): { price: number; touches: number; highs: number; lows: number }[] {
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const levels: {
    price: number;
    touches: number;
    highs: number;
    lows: number;
  }[] = [];
  let cluster: typeof sorted = [];
  const flush = () => {
    if (!cluster.length) return;
    const mean = cluster.reduce((a, b) => a + b.price, 0) / cluster.length;
    levels.push({
      price: mean,
      touches: cluster.length,
      // carried through, because WHAT a level is made of decides how it behaves
      highs: cluster.filter((c) => c.kind === 'high').length,
      lows: cluster.filter((c) => c.kind === 'low').length,
    });
    cluster = [];
  };
  for (const p of sorted) {
    if (!cluster.length) {
      cluster.push(p);
      continue;
    }
    const mean = cluster.reduce((a, b) => a + b.price, 0) / cluster.length;
    if (
      Math.abs(p.price - mean) / mean <= tolPct &&
      (p.price - cluster[0]!.price) / mean <= maxSpanPct
    )
      cluster.push(p);
    else {
      flush();
      cluster.push(p);
    }
  }
  flush();
  return levels;
}

/**
 * Swing-pivot support/resistance levels classified against the last close.
 * Levels merge at half of `tolPct` (with the full `tolPct` as span cap) so nearby-but-distinct
 * shelves stay separate; `tolPct` itself still drives the `near` flag.
 */
export function supportResistance(
  closes: number[],
  opts: {
    tolPct?: number;
    window?: number;
    maxEach?: number;
    mergeTolPct?: number;
    minTouches?: number;
  } = {},
): SupportResistance {
  const tolPct = opts.tolPct ?? 0.05;
  const mergeTolPct = opts.mergeTolPct ?? tolPct / 2;
  const window = opts.window ?? 5;
  const maxEach = opts.maxEach ?? 5;
  /** One pivot is an incident, not a shelf. NVDA's "support" at 224 rested on a single swing. */
  const minTouches = opts.minTouches ?? 2;
  const current = closes.length ? closes[closes.length - 1]! : null;
  if (current == null || closes.length < window * 2 + 1) {
    return { current, resistances: [], supports: [] };
  }
  const levels = clusterLevels(
    swingPivots(closes, window),
    mergeTolPct,
    tolPct,
  ).filter((l) => l.touches >= minTouches);
  const toLevel = (l: {
    price: number;
    touches: number;
    highs: number;
    lows: number;
  }): SrLevel => {
    const distPct = ((l.price - current) / current) * 100;
    const kind: SrLevel['kind'] =
      l.highs > l.lows ? 'ceiling' : l.lows > l.highs ? 'floor' : 'mixed';
    return {
      price: l.price,
      distPct,
      touches: l.touches,
      near: Math.abs(distPct) <= tolPct * 100,
      kind,
      // below price but built from highs = a ceiling just broken; above price but built from lows
      // = a floor just lost. Either way price is on the far side of what the level used to do.
      flipped:
        (l.price < current && kind === 'ceiling') ||
        (l.price > current && kind === 'floor'),
    };
  };
  const resistances = levels
    .filter((l) => l.price > current)
    .sort((a, b) => a.price - b.price)
    .slice(0, maxEach)
    .map(toLevel);
  const supports = levels
    .filter((l) => l.price < current)
    .sort((a, b) => b.price - a.price)
    .slice(0, maxEach)
    .map(toLevel);
  return { current, resistances, supports };
}
