import * as z from 'zod/mini';
import { defineComponent, type DataFor, type Helpers } from '../src/sdk';
import { Ticker, type MoveBreakdown } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-why-today',
  version: '1.0.0',
  need: {
    question: 'Why did this stock move today: the whole market, its sector, or something specific to the company?',
    evidence: [
      'DataForSEO: "why is <ticker> stock down today" family (launch/data/08c-serp-why-is-stock-down-today.json, 10a-why-moving-ticker.json)',
      'beta: news spike detector (market-relative story spikes, validated 1.92x abnormal move)',
    ],
  },
  params: z.object({ ticker: Ticker, window: z._default(z.enum(['1d', '5d', '1m']), '1d') }),
  user: [],
  uses: [],
  needs: (p) => ({ move: { t: 'move-breakdown@1', params: { ticker: p.ticker, window: p.window } } }),
});

export const samples = [{ ticker: 'NVDA' }, { ticker: 'BRK.B', window: '1m' }];

type Data = DataFor<{ move: MoveBreakdown }>;
const WINDOWS = [['1d', '1D'], ['5d', '5D'], ['1m', '1M']] as const;
const FLAT = 0.0005;

const verb = (v: number, h: Helpers) => (Math.abs(v) < FLAT ? 'was flat' : `${v > 0 ? 'rose' : 'fell'} ${h.pct(Math.abs(v)).replace('+', '')}`);
const when = (m: MoveBreakdown, h: Helpers) =>
  m.window === '1d' ? `on ${h.date(m.asOf)}` : `over the ${m.window === '5d' ? 'five sessions' : 'month'} to ${h.date(m.asOf)}`;
const dot = (s: number | null) => (s == null ? 'pt-dot-na' : s > 0.15 ? 'pt-dot-pos' : s < -0.15 ? 'pt-dot-neg' : 'pt-dot-flat');

function driverLine(m: MoveBreakdown, h: Helpers): string {
  if (Math.abs(m.ret) < FLAT) return '';
  if (m.driver === 'market') return 'Most of the move came from the market as a whole.';
  if (m.driver === 'sector') return 'Most of the move came from its sector.';
  return `Most of the move is specific to ${h.esc(m.ticker)}.`;
}

function bars(m: MoveBreakdown, h: Helpers): string {
  const parts = [['Market (SPY)', m.market], [m.sectorName ? `${m.sectorName} sector` : 'Sector', m.sector], [`${m.ticker} specific`, m.specific]] as const;
  const max = Math.max(...parts.map(([, v]) => Math.abs(v)), 1e-9);
  return `<div class="pt-bd">${parts.map(([label, v]) => {
    const w = Math.round((Math.abs(v) / max) * 50);
    const side = v < 0 ? `right:50%` : `left:50%`;
    return `<div class="pt-bd-row"><span class="pt-bd-k">${h.esc(label)}</span>` +
      `<span class="pt-bd-track"><span class="pt-bd-bar pt-bd-${h.toneOf(v, FLAT)}" style="${side};width:${w}%"></span></span>` +
      `<span class="pt-bd-v">${h.pct(v)}</span></div>`;
  }).join('')}</div>`;
}

function news(m: MoveBreakdown, h: Helpers): string {
  const n = m.news;
  const head = n.spike
    ? `<p class="pt-bd-news-head"><strong>News spike:</strong> ${n.today} stories, ${h.num(n.avg30 > 0 ? n.today / n.avg30 : 0, 1)}× the 30-day average.</p>`
    : `<p class="pt-bd-news-head">${n.today} ${n.today === 1 ? 'story' : 'stories'} on the day (30-day average ${h.num(n.avg30, 1)}).</p>`;
  const list = n.top.length
    ? `<ul class="pt-news">${n.top.map((s) => `<li class="pt-news-item"><span class="${dot(s.sentiment)}"></span>` +
      `<a href="${h.esc(s.url)}" target="_blank" rel="nofollow noopener noreferrer">${h.esc(s.title)}</a> <span class="pt-news-meta">${h.esc(s.site)}</span></li>`).join('')}</ul>`
    : '';
  return head + list;
}

export function renderStatic(data: Data, params: { ticker: string; window: string }, h: Helpers): string {
  const m = data.move;
  if (!m) return h.na();
  const lead = `${h.esc(m.name)} (${h.esc(m.ticker)}) ${verb(m.ret, h)} ${when(m, h)}.`;
  const ctx = `The market (SPY) ${verb(m.marketRet, h)}` + (m.sectorRet != null && m.sectorName ? `; ${h.esc(m.sectorName)} stocks ${verb(m.sectorRet, h)}` : '') + '.';
  const tabs = WINDOWS.map(([w, l]) => `<button type="button" data-set='{"window":"${w}"}' aria-pressed="${params.window === w}">${l}</button>`).join('');
  return `<section class="pt-why"><div class="pt-cal-head"><p class="pt-why-lead">${lead}</p><div class="pt-toggles">${tabs}</div></div>` +
    `<p class="pt-lede">${ctx} ${driverLine(m, h)}</p>${bars(m, h)}${news(m, h)}` +
    `<p class="pt-note">Market = SPY. Sector = equal-weight average of the tracked companies in the same sector, net of the market.</p></section>`;
}
