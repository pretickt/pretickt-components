/**
 * The portfolio page (Part B) on made-up facts and portfolios (src/stories/fake-portfolio.ts): the editor with nothing saved, with a portfolio and a
 * watchlist, and in a window that keeps nothing.
 */
import { PtPortfolioEditor } from '../site/portfolio/editor';
import { DEMO_FACTS, DEMO_PORTFOLIOS } from './fake-portfolio';
import { story } from './story';

const GROUP = 'Portfolio page';
const TODAY = '2026-10-01';

export const stories = [
  story(PtPortfolioEditor, { name: 'The editor · nothing saved yet', group: GROUP, inputs: { stored: { v: 1, active: null, list: [] }, facts: DEMO_FACTS, saving: true, today: TODAY } }),
  story(PtPortfolioEditor, { name: 'The editor · a portfolio and a watchlist', group: GROUP,
    inputs: { stored: { v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares, DEMO_PORTFOLIOS.watchlist] }, facts: DEMO_FACTS, saving: true, today: TODAY } }),
  story(PtPortfolioEditor, { name: 'The editor · a private window (nothing is saved)', group: GROUP, inputs: { stored: { v: 1, active: null, list: [] }, facts: DEMO_FACTS, saving: false, today: TODAY } }),
];
