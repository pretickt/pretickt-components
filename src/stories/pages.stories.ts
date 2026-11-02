/**
 * The pages before they are published (Romeo, 2026-10-31): the company page, the home and a sector with the companies' common names,
 * the two new pages (/market-map, /trending), and every company's name before and after. Each page mirrors what
 * pretickt-platform's plant/src/generate/pages.ts builds today, with what changes marked new: the parts are this repository's
 * components on www's data (live, through the dev proxy) and the drafts on their made-up data. The head above each page is what the
 * layout would write, the FAQPage read from the questions the page shows.
 */
import { Component, input } from '@angular/core';
import type { ManageState } from '../alerts/token';
import { AE_AMD } from '../alerts/event-mock';
import { PtAlertManage } from '../site/alerts/manage';
import { fakeAlerts } from './fake-alerts';
import { named, plainName } from '@pretickt/components/format';
import { METRIC_GROUPS, type MetricKey, type ScreenList, type Sector } from '@pretickt/components/typologies';
import { HOT } from '../../components/drafts/mock';
import { PA_NVDA_HUB } from '../../components/drafts/people-ask-mock';
import { PtHot } from '../../components/drafts/pt-hot';
import { PtPeopleAsk, type PeopleAsk } from '../../components/drafts/pt-people-ask';
import { PtValue } from '../../components/pt-value';
import { PtAnswer } from '../../components/pt-answer';
import { PtCalendar } from '../../components/pt-calendar';
import { PtCompanyCard } from '../../components/pt-company-card';
import { PtFinancials } from '../../components/pt-financials';
import { PtLogoMap } from '../../components/pt-logo-map';
import { PtMetric } from '../../components/pt-metric';
import { PtMovers } from '../../components/pt-movers';
import { PtNews } from '../../components/pt-news';
import { PtPriceEvents } from '../../components/pt-price-events';
import { PtPriceTarget } from '../../components/pt-price-target';
import { PtScreen } from '../../components/pt-screen';
import { PtWhyToday } from '../../components/pt-why-today';
import { fitTitle, PtPagePreview, PtPreviewNames, type PreviewPage, type PreviewSection } from './page-preview';
import { demo, story } from './story';

const UNIVERSE = 'S&P 500 and Nasdaq-100';
const HOME = { label: 'Home', href: '/' };
const GROUP = 'Pages · before publishing (www not changed)';
const NVDA_DRAFTS = { value: true, ask: PA_NVDA_HUB };
/** pt-value's made-up NVDA until www serves value@1 (the release of its nightly). */
const NVDA_VALUE = { 'value@1': demo('value@1', { ticker: 'NVDA' }) };

/** pages.ts MARKET_LISTS: slug, screen list, nav label, h1. */
const MARKET_LISTS: [string, ScreenList, string, string][] = [
  ['biggest-losers', 'biggest_losers', 'Biggest losers', 'Biggest stock losers today'],
  ['biggest-gainers', 'biggest_gainers', 'Biggest gainers', 'Biggest stock gainers today'],
  ['52-week-lows', '52w_low', '52-week lows', 'Stocks at 52-week lows'],
  ['52-week-highs', '52w_high', '52-week highs', 'Stocks at 52-week highs'],
  ['undervalued-stocks', 'undervalued', 'Undervalued', 'Undervalued stocks'],
  ['insider-buying', 'insider_buying', 'Insider buying', 'Stocks insiders are buying'],
  ['most-active', 'most_active', 'Most active', 'Most active stocks today'],
];
/** pages.ts LIST_NAV, with the two new pages. */
const LIST_NAV = [
  { href: '/earnings-calendar/', label: 'Earnings calendar' }, { href: '/dividend-calendar/', label: 'Dividend calendar' },
  ...MARKET_LISTS.map(([slug, , label]) => ({ href: `/markets/${slug}/`, label })),
  { href: '/market-map/', label: 'Stock market heat map', isNew: true }, { href: '/trending/', label: 'Trending stocks', isNew: true },
  { href: '/stocks/', label: 'All stocks' },
];
const sectorPath = (s: Sector) => `/sectors/${s.toLowerCase().replace(/\s+/g, '-')}/`;
const hub = (t: string) => `/stocks/${t.toLowerCase()}/`;
const metric = (ticker: string, metrics: readonly MetricKey[]) => ({ c: PtMetric, inputs: { ticker, metrics } });
const SUBPAGES = [['value', 'Value'], ['why-moving', 'Why it moved'], ['price-target', 'Price target'], ['peers', 'Peers'], ['financials', 'Financials'],
  ['news', 'News'], ['insiders', 'Insiders']] as const;

/** The NYSE week the home looks forward to: the first weekday from today (the generator's nextSession of the last close). */
function weekStart(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** A question the generator answers itself, in its own markup, marked for the FAQPage like a placement's. */
const qa = (q: string, a: string) => `<div class="pv-qa" data-faq><h3 data-faq-q>${q}</h3><p data-faq-a>${a}</p></div>`;
const prose = (title: string, body: string) => `<section class="pt-section pt-prose"><h2 class="pt-section-title">${title}</h2>${body}</section>`;

/**
 * The company page (pages.ts tickerHub) with the common name in its title, h1 and crumbs, the legal name kept in the lede; and the
 * two new sections, when the drafts have data for the company: "is it a good stock to buy" (pt-value) after the targets and what
 * people ask (pt-people-ask) at the end, whose questions pt-value answers link to pt-value's answers.
 */
/**
 * pt-value's own page (the platform's pages.ts, subpage 'value'): the searched question in the title and the h1 (with the ticker; the
 * component asks it with the common name), the company card, the whole component; its questions as FAQPage data (the generator's faqLd).
 */
export function valuePage(t: string, legal: string, sector: Sector): PreviewPage {
  const name = plainName(legal), n = named(legal, t);
  return {
    path: `${hub(t)}value/`,
    title: fitTitle(`Is ${name} (${t}) a good stock to buy?`, `Is ${t} a good stock to buy?`),
    description: `Is ${name} a good stock to buy? Six questions — demand, moat, profits, delivery, risks and valuation — answered with ${name}'s numbers and its competitors', each with its date. As of {date}.`,
    h1: `Is ${t} a good stock to buy?`,
    lede: `${legal} · end-of-day data as of {date}`,
    crumbs: [HOME, { label: sector, href: sectorPath(sector) }, { label: n, href: hub(t) }, { label: 'Value' }],
    nav: [{ href: hub(t), label: 'Overview' }, ...SUBPAGES.map(([s, label]) => ({ href: `${hub(t)}${s}/`, label }))],
    sections: [
      { id: 'card', items: [{ c: PtCompanyCard, inputs: { ticker: t } }] },
      { id: 'value', isNew: true, note: 'pt-value, its own page', items: [{ c: PtValue, inputs: { ticker: t } }] },
    ],
  };
}

export function companyPage(t: string, legal: string, sector: Sector, drafts: { value?: boolean; ask?: PeopleAsk } = {}): PreviewPage {
  const n = named(legal, t);
  return {
    path: hub(t),
    title: fitTitle(`${n} stock: forecast, price target, earnings`, `${n} stock forecast and price target`, `${n} stock forecast`, `${t} stock: forecast, price target, earnings`),
    description: (`${n} stock forecast: analyst price targets, why it moved, next earnings, insider trades and technicals. Data as of {date}.`),
    h1: `${n} stock`,
    lede: `${legal} · ${sector} · end-of-day data as of {date}`,
    crumbs: [HOME, { label: sector, href: sectorPath(sector) }, { label: n }],
    nav: [{ href: hub(t), label: 'Overview' }, ...SUBPAGES.map(([s, label]) => ({ href: `${hub(t)}${s}/`, label }))],
    sections: [
      { id: 'card', items: [{ c: PtCompanyCard, inputs: { ticker: t } }] },
      { id: 'answer', items: [{ c: PtAnswer, inputs: { topic: 'forecast', ticker: t } }] },
      { id: 'targets', title: 'Analyst price targets', items: [{ c: PtPriceTarget, inputs: { ticker: t } }] },
      ...(drafts.value ? [{ id: 'value', isNew: true, note: 'pt-value in its compact form: the full one is its own page, /stocks/<t>/value/', items: [{ c: PtValue, inputs: { ticker: t, compact: true } }] }] : []),
      { id: 'snapshot', title: 'Snapshot', items: [metric(t, METRIC_GROUPS.snapshot)] },
      { id: 'why', title: 'Why it moved', items: [{ c: PtWhyToday, inputs: { ticker: t, window: '1d' } }] },
      { id: 'price', title: 'Price and events', items: [{ c: PtPriceEvents, inputs: { ticker: t, range: '1y' } }] },
      { id: 'technicals', title: 'Technicals', items: [metric(t, METRIC_GROUPS.technicals)] },
      { id: 'financials', title: 'Revenue and free cash flow', items: [{ c: PtFinancials, inputs: { ticker: t, periods: 8 } }] },
      { id: 'peers', title: 'Peers', items: [{ c: PtScreen, inputs: { peersOf: t, limit: 8 } }] },
      { id: 'news', title: 'Latest news', items: [{ c: PtNews, inputs: { ticker: t, limit: 5 } }] },
      ...(drafts.ask ? [{ id: 'people-ask', title: `What people ask about ${plainName(legal)}`, isNew: true,
        note: 'pt-people-ask, made-up questions until the pulse feeds it', items: [{ c: PtPeopleAsk, inputs: { data: drafts.ask } }] }] : []),
    ],
  };
}

/** The home (pages.ts homePage) with the two new blocks first: the heat map and the trending stocks, each linking its new page. */
export function homePage(): PreviewPage {
  const start = weekStart(), month = start.slice(0, 7);
  const week = (kind: 'earnings' | 'dividend') => ({ c: PtCalendar, inputs: { month, kind, view: 'week', start } });
  return {
    path: '/', site: true,
    title: fitTitle('pretickt: why stocks move, price targets, earnings'),
    description: ('Why stocks moved, analyst targets, earnings and dividend calendars, market movers and insider buying for S&P 500 and Nasdaq-100 companies.'),
    h1: 'Why stocks move, price targets and earnings',
    lede: `${UNIVERSE} · end-of-day data as of {date}`,
    nav: LIST_NAV,
    sections: [
      { id: 'moves', title: 'Ongoing moves', items: [{ c: PtMovers, inputs: { sort: 'cap' } }] },
      { id: 'earnings', title: 'Earnings', more: { href: '/earnings-calendar/', label: 'Full calendar' }, items: [week('earnings')] },
      { id: 'dividends', title: 'Ex-dividend dates', more: { href: '/dividend-calendar/', label: 'Full calendar' }, items: [week('dividend')] },
      ...MARKET_LISTS.map(([slug, list, , h1]): PreviewSection => ({ id: slug, title: h1, more: { href: `/markets/${slug}/`, label: 'See all' },
        items: [{ c: PtScreen, inputs: { list, limit: 5 } }] })),
      { id: 'all-stocks', title: `Every ${UNIVERSE} stock`, more: { href: '/stocks/', label: 'All stocks' }, items: [] },
      // Romeo, 2026-11-01: "mettiamo alla fine della home la heat map del mercato delle mega caps"
      { id: 'mega-caps', title: 'Mega-cap stocks heat map', more: { href: '/market-map/', label: 'All the heat maps' }, isNew: true,
        items: [{ c: PtLogoMap, inputs: { lens: 'mega' } }] },
    ],
  };
}

/** The sectors by their weight in the market, the largest first (the strip of /market-map; the generator orders them by its data). */
const SECTORS_BY_SIZE: Sector[] = ['Technology', 'Financial Services', 'Communication Services', 'Consumer Cyclical', 'Healthcare', 'Industrials',
  'Consumer Defensive', 'Energy', 'Utilities', 'Real Estate', 'Basic Materials'];

/** A sector (pages.ts sectorPage) with its own heat map after the answer. */
export function sectorPage(s: Sector): PreviewPage {
  return {
    path: sectorPath(s),
    title: fitTitle(`${s} stocks: today's movers and all companies`, `${s} stocks: movers and all companies`, `${s} stocks`),
    description: (`${s} stocks in the ${UNIVERSE}: today's movers, 52-week lows and highs, undervalued stocks and insider buying. {date}.`),
    h1: `${s} stocks`,
    lede: `${UNIVERSE} companies · end-of-day data as of {date}`,
    crumbs: [HOME, { label: 'Sectors', href: '/sectors/' }, { label: s }],
    sections: [
      { id: 'answer', items: [{ c: PtAnswer, inputs: { topic: 'list', list: 'largest', sector: s } }] },
      { id: 'map', title: `${s} stocks heat map`, isNew: true, items: [{ c: PtLogoMap, inputs: { sector: s } }] },
      ...MARKET_LISTS.map(([slug, list, , h1]): PreviewSection => ({ id: slug, title: h1, items: [{ c: PtScreen, inputs: { list, sector: s, limit: 5 } }] })),
      { id: 'all', title: `All ${s} stocks`, items: [{ c: PtScreen, inputs: { list: 'largest', sector: s, limit: 20 } }] },
    ],
  };
}

/** /market-map: the searched name in the title and h1 (DataForSEO round 13: 33,400 searches a month, 2% with an AI Overview). */
export function marketMapPage(): PreviewPage {
  return {
    path: '/market-map/',
    title: fitTitle('Stock Market Heat Map Today: S&P 500 and Nasdaq-100 by Sector', 'Stock Market Heat Map Today by Sector', 'Stock Market Heat Map Today'),
    description: (`Stock market heat map: the 100 largest ${UNIVERSE} stocks by sector, sized by market value, colored by the day's move. As of {date}.`),
    h1: 'Stock market heat map',
    lede: `The 100 largest ${UNIVERSE} companies · end-of-day data as of {date}`,
    crumbs: [HOME, { label: 'Stock market heat map' }],
    nav: LIST_NAV,
    sections: [
      { id: 'map', items: [{ c: PtLogoMap, inputs: {} }] },
      { id: 'mega-caps', title: 'Mega-cap stocks heat map', isNew: true, items: [{ c: PtLogoMap, inputs: { lens: 'mega' } }] },
      { id: 'social', title: 'Social heat map', isNew: true, note: 'the pulse\'s counts, from the nightly after its release', items: [{ c: PtLogoMap, inputs: { lens: 'social' } }] },
      { id: 'news', title: 'News heat map', isNew: true, items: [{ c: PtLogoMap, inputs: { lens: 'news' } }] },
      { id: 'sectors', title: 'Sector heat maps', isNew: true, strip: true,
        items: SECTORS_BY_SIZE.map((s) => ({ c: PtLogoMap, inputs: { sector: s, form: 'card' } })) },
      { id: 'largest', title: 'Largest companies by market value', more: { href: '/stocks/', label: 'All stocks' }, items: [{ c: PtScreen, inputs: { list: 'largest', limit: 20 } }] },
    ],
    outro: prose('The heat map, explained',
      qa('How do you read a stock market heat map?', 'Each tile is a company, sized by its market value and colored by the day’s move: green rose, red fell, '
        + 'and the deeper the color, the larger the move. The tiles are grouped by sector.')
      + qa('Which companies are on the map?', `The 100 largest ${UNIVERSE} companies by market value at the last close. Each sector page has a map of its own sector.`)
      + qa('How often is the map updated?', 'Every night after the close, with the end-of-day data; the company pages show the day’s prices 15 minutes late while the market is open.')),
  };
}

/** /trending: what the AI answers cite trackers for, with a fixed address, the time and the counts (round 13: altindex.com in 6 of 6). */
export function trendingPage(): PreviewPage {
  return {
    path: '/trending/',
    title: fitTitle('Trending Stocks Today: Most Talked About on Reddit and X', 'Trending Stocks on Reddit and X Today', 'Trending Stocks Today'),
    description: (`The most talked about ${UNIVERSE} stocks on Reddit and X in the last 24 hours, counted every 30 minutes, against each company's usual day.`),
    h1: 'Trending stocks on Reddit and X today',
    lede: `The most talked about ${UNIVERSE} stocks in the last 24 hours, counted every 30 minutes`,
    crumbs: [HOME, { label: 'Trending stocks' }],
    nav: LIST_NAV,
    sections: [{ id: 'trending', isNew: true, note: 'pt-hot, made-up counts until the pulse feeds it', items: [{ c: PtHot, inputs: { data: HOT, head: false, rank: 15 } }] }],
    outro: prose('How the counts work',
      qa('How does pretickt count the posts?', `Every 30 minutes it reads the newest posts and comments of ten investing subreddits (r/stocks, r/wallstreetbets, `
        + `r/investing and seven more) and of twelve market accounts on X, and counts those that name an ${UNIVERSE} company over the last 24 hours.`)
      + qa('What does “3× its usual” mean?', 'The posts of the last 24 hours against the company’s average day over the four weeks before: 3× is three times '
        + 'as many as on a usual day.')),
  };
}

/** /alerts/: the alerts' page — confirm and manage from an email's link (noindex; the manage part is the page app's). */
export function alertsPage(): PreviewPage {
  return {
    path: '/alerts/', title: 'Your alerts | pretickt', description: 'Confirm, pause, edit or delete the email alerts you set on pretickt.',
    h1: 'Your alerts', lede: 'The email alerts you set on pretickt: confirm them, pause them, change them', crumbs: [HOME, { label: 'Your alerts' }],
    sections: [{ id: 'alerts', isNew: true, note: 'made-up alerts until the platform has them', items: [{ c: PtAlertManage }] }],
  };
}

@Component({ selector: 'pt-preview-company', imports: [PtPagePreview], template: '<pt-page-preview [page]="page()" />' })
export class PtPreviewCompany { readonly page = input.required<PreviewPage>(); }
@Component({ selector: 'pt-preview-home', imports: [PtPagePreview], template: '<pt-page-preview [page]="page()" />' })
export class PtPreviewHome { readonly page = input.required<PreviewPage>(); }
@Component({ selector: 'pt-preview-sector', imports: [PtPagePreview], template: '<pt-page-preview [page]="page()" />' })
export class PtPreviewSector { readonly page = input.required<PreviewPage>(); }
@Component({ selector: 'pt-preview-market-map', imports: [PtPagePreview], template: '<pt-page-preview [page]="page()" />' })
export class PtPreviewMarketMap { readonly page = input.required<PreviewPage>(); }
@Component({ selector: 'pt-preview-trending', imports: [PtPagePreview], template: '<pt-page-preview [page]="page()" />' })
export class PtPreviewTrending { readonly page = input.required<PreviewPage>(); }

@Component({ selector: 'pt-preview-alerts', imports: [PtPagePreview], template: '<pt-page-preview [page]="page()" />' })
export class PtPreviewAlerts { readonly page = input.required<PreviewPage>(); }

const ALERT_STATE = { email: 'r•••@example.com', status: 'active' as const, weekly: false, confirmed: { id: 'r1', now: ['AMD'] },
  rules: [{ id: 'r1', name: 'Mega-cap drops', status: 'active' as const, rule: { v: 1 as const, all: [{ c: 'session-move' as const, p: { dir: 'down', pct: 5 } },
    { c: 'below-average' as const, p: { dir: 'below', pct: 15, days: '50' } }, { c: 'mega-caps' as const, p: {} }] } }] } as ManageState;

export const stories = [
  story(PtPreviewCompany, { name: 'AMD with alerts: a bell under every section, the alert an email opened on top (www data, made-up alert)', live: true,
    group: GROUP, providers: fakeAlerts(), inputs: { page: { ...companyPage('AMD', 'Advanced Micro Devices, Inc.', 'Technology'), alerts: true, alertEvent: AE_AMD } } }),
  story(PtPreviewAlerts, { name: '/alerts/: the page a confirmation link opens (made-up alerts)', group: GROUP, inputs: { page: alertsPage() },
    providers: fakeAlerts({ landing: { alert: null, token: 'demo', action: 'confirm' }, state: ALERT_STATE }) }),
  story(PtPreviewCompany, { name: 'NVDA: common name, pt-value and what people ask, FAQPage (www data, made-up drafts)', live: true, group: GROUP,
    data: NVDA_VALUE, inputs: { page: companyPage('NVDA', 'NVIDIA Corporation', 'Technology', NVDA_DRAFTS) } }),
  story(PtPreviewCompany, { name: 'NVDA: pt-value\'s own page, /stocks/nvda/value/ (made-up pt-value, www data for the rest)', live: true, group: GROUP,
    data: NVDA_VALUE, inputs: { page: valuePage('NVDA', 'NVIDIA Corporation', 'Technology') } }),
  story(PtPreviewCompany, { name: 'META: today\'s page with the common name only (www data)', live: true, group: GROUP,
    inputs: { page: companyPage('META', 'Meta Platforms, Inc.', 'Communication Services') } }),
  story(PtPreviewCompany, { name: 'NVDA on the demo data (the check)', inputs: { page: companyPage('NVDA', 'NVIDIA Corporation', 'Technology', NVDA_DRAFTS) }, group: GROUP }),
  story(PtPreviewHome, { name: 'Home: the mega-cap heat map at the end (www data)', inputs: { page: homePage() }, live: true, group: GROUP }),
  story(PtPreviewSector, { name: 'Technology: its heat map, common names (www data)', inputs: { page: sectorPage('Technology') }, live: true, group: GROUP }),
  story(PtPreviewMarketMap, { name: '/market-map: the heat maps — market, mega caps, the sectors in a strip (www data)', inputs: { page: marketMapPage() }, live: true, group: GROUP }),
  story(PtPreviewTrending, { name: '/trending: the new page (made-up counts)', inputs: { page: trendingPage() }, live: true, group: GROUP }),
  story(PtPreviewNames, { name: 'Every company: the name today and the common name (www list)', live: true, group: GROUP }),
];
