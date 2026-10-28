/** The home drafts (H1, H2, H4, H5 of the summary) on made-up data: what they show until their data has a pipeline. */
import { story } from '../../src/stories/story';
import { ASKED, BOARD, HOT, ODDS } from './mock';
import { PtAsked } from './pt-asked';
import { PtHot } from './pt-hot';
import { PtOdds } from './pt-odds';
import { PtQualityStrip } from './pt-quality-strip';

const GROUP = 'Drafts · the new home (made-up data)';

export const stories = [
  story(PtHot, { name: 'H1 · a busy day', inputs: { data: HOT }, group: GROUP }),
  story(PtHot, { name: 'H1 · one stock everywhere', group: GROUP, inputs: { data: { ...HOT, rows: HOT.rows.map((r) => (r.ticker === 'NKE' ? { ...r, mentions: 900, usual: 14 } : r)) } } }),
  story(PtHot, { name: 'H1 · a quiet day', group: GROUP, inputs: { data: { ...HOT, rows: [] } } }),
  story(PtHot, { name: 'H1 · stale counts (the pulse stopped on Friday)', group: GROUP, inputs: { data: { ...HOT, asOf: '2026-10-23', time: '16:30', stale: true } } }),
  story(PtHot, { name: 'H1 · not available', inputs: { data: null }, group: GROUP }),
  story(PtAsked, { name: 'H2 · this week\'s questions', inputs: { data: ASKED }, group: GROUP }),
  story(PtAsked, { name: 'H2 · two questions', inputs: { data: { ...ASKED, items: ASKED.items.slice(0, 2) } }, group: GROUP }),
  story(PtAsked, { name: 'H2 · not available', inputs: { data: null }, group: GROUP }),
  story(PtOdds, { name: 'H4 · earnings week with the odds', inputs: { data: ODDS }, group: GROUP }),
  story(PtOdds, { name: 'H4 · a light week', inputs: { data: { ...ODDS, items: ODDS.items.filter((_, i) => i % 4 === 0) } }, group: GROUP }),
  story(PtOdds, { name: 'H4 · not available', inputs: { data: null }, group: GROUP }),
  story(PtQualityStrip, { name: 'H5 · the week on the six questions', inputs: { data: BOARD }, group: GROUP }),
  story(PtQualityStrip, { name: 'H5 · a quiet week', inputs: { data: { ...BOARD, items: [] } }, group: GROUP }),
  story(PtQualityStrip, { name: 'H5 · not available', inputs: { data: null }, group: GROUP }),
];
