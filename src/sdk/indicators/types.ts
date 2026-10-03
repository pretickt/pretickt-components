/** Close-only bar. `close` stays REQUIRED; the OHLCV fields are optional additions. */
export type Bar = {
  date: string;
  close: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
};

/** A bar with a complete adjusted OHLC. `volume` may be missing on pre-backfill history. */
export interface OhlcBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}
