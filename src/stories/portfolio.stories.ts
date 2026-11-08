/**
 * The portfolio page (Part B) on made-up facts and portfolios (src/stories/fake-portfolio.ts): the editor with nothing saved, with a portfolio and a
 * watchlist, and in a window that keeps nothing.
 */
import type { Provider } from '@angular/core';
import { PtPortfolioEditor } from '../site/portfolio/editor';
import { PT_PORTFOLIO_FILES, PT_PORTFOLIO_STORAGE } from '../site/portfolio/files';
import { PtPortfolioPage } from '../site/portfolio/page';
import { PORTFOLIO_KEY, type Stored } from '../site/portfolio/store';
import { DEMO_CLOSES, DEMO_FACTS, DEMO_PORTFOLIOS } from './fake-portfolio';
import { story } from './story';

const GROUP = 'Portfolio page';
const TODAY = '2026-10-01';
/** The page on the made-up files, its storage in memory (a story never touches the reader's own). */
function page(stored: Stored | null, saving = true): Provider[] {
  const m = new Map<string, string>(stored ? [[PORTFOLIO_KEY, JSON.stringify(stored)]] : []);
  const storage = { get length() { return m.size; }, clear: () => m.clear(), getItem: (k: string) => m.get(k) ?? null, key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k), setItem: (k: string, v: string) => { if (!saving) throw new Error('private window'); m.set(k, v); } } as Storage;
  return [{ provide: PT_PORTFOLIO_FILES, useValue: { facts: async () => DEMO_FACTS, closes: async (k: string) => DEMO_CLOSES.get(k) ?? null } }, { provide: PT_PORTFOLIO_STORAGE, useValue: () => storage }];
}

export const stories = [
  story(PtPortfolioPage, { name: 'The page · nothing saved: the example', group: GROUP, providers: page(null) }),
  story(PtPortfolioPage, { name: 'The page · a portfolio in shares, with purchase dates and a fund', group: GROUP, providers: page({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares, DEMO_PORTFOLIOS.watchlist] }) }),
  story(PtPortfolioPage, { name: 'The page · a watchlist', group: GROUP, providers: page({ v: 1, active: 'demo-watch', list: [DEMO_PORTFOLIOS.shares, DEMO_PORTFOLIOS.watchlist] }) }),
  story(PtPortfolioPage, { name: 'The page · a portfolio we cover under 80%', group: GROUP, providers: page({ v: 1, active: 'demo-low', list: [DEMO_PORTFOLIOS.low] }) }),
  story(PtPortfolioPage, { name: 'The page · all in one fund, looked through', group: GROUP, providers: page({ v: 1, active: 'demo-fund', list: [DEMO_PORTFOLIOS.fund] }) }),
  story(PtPortfolioPage, { name: 'The page · a private window', group: GROUP, providers: page(null, false) }),
  story(PtPortfolioEditor, { name: 'The editor · nothing saved yet', group: GROUP, inputs: { stored: { v: 1, active: null, list: [] }, facts: DEMO_FACTS, saving: true, today: TODAY } }),
  story(PtPortfolioEditor, { name: 'The editor · a portfolio and a watchlist', group: GROUP,
    inputs: { stored: { v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares, DEMO_PORTFOLIOS.watchlist] }, facts: DEMO_FACTS, saving: true, today: TODAY } }),
  story(PtPortfolioEditor, { name: 'The editor · a private window (nothing is saved)', group: GROUP, inputs: { stored: { v: 1, active: null, list: [] }, facts: DEMO_FACTS, saving: false, today: TODAY } }),
];
