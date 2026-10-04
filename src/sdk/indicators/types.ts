/** The bar every indicator reads. `close` is required; OHLCV fields are optional (close-only history). Oldest first. */
export type Bar = {
  date: string;
  close: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
};

/** price-series@1 points (`{t,o,h,l,c,v}`) as indicator bars. */
export const barsOf = (points: { t: string; o: number; h: number; l: number; c: number; v: number }[]): Bar[] =>
  points.map((p) => ({ date: p.t, open: p.o, high: p.h, low: p.l, close: p.c, volume: p.v }));
