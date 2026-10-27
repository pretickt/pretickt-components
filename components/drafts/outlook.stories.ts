/** The earnings calendar with each event's possible outcome: four ways to put it in the row, the card that opens over it (made-up data). */
import { story } from '../../src/stories/story';
import { CPI, FED, KO, MSFT, OCTOBER, UPS, V_TONIGHT, WEEK } from './outlook-mock';
import { PtCalOutlook, PtOutlookCard } from './pt-cal-outlook';

const GROUP = 'Drafts · Earnings calendar with the possible outcome (made-up data)';
const n = OCTOBER.normal;

export const stories = [
  story(PtCalOutlook, { name: 'A · usual move (±%), the week of Oct 26', inputs: { data: WEEK, view: 'week' }, group: GROUP }),
  story(PtCalOutlook, { name: 'B · in market value (±$), the week', inputs: { data: WEEK, view: 'week', variant: 'dollars' }, group: GROUP }),
  story(PtCalOutlook, { name: 'C · record against the estimate (7/8 beat), the week', inputs: { data: WEEK, view: 'week', variant: 'record' }, group: GROUP }),
  story(PtCalOutlook, { name: 'D · price range ($lo–hi), the week', inputs: { data: WEEK, view: 'week', variant: 'range' }, group: GROUP }),
  story(PtCalOutlook, { name: 'A · the month page: October, what happened and what may', inputs: { data: OCTOBER }, group: GROUP }),
  story(PtCalOutlook, { name: 'B · the month page in market value', inputs: { data: OCTOBER, variant: 'dollars' }, group: GROUP }),
  story(PtOutlookCard, { name: 'Card · before a report (Microsoft, tomorrow)', inputs: { event: MSFT, normal: n }, group: GROUP }),
  story(PtOutlookCard, { name: 'Card · after it: a beat, and the stock fell (UPS)', inputs: { event: UPS, normal: n }, group: GROUP }),
  story(PtOutlookCard, { name: 'Card · reported tonight, trades tomorrow (Visa)', inputs: { event: V_TONIGHT, normal: n }, group: GROUP }),
  story(PtOutlookCard, { name: 'Card · in line, a small move (Coca-Cola)', inputs: { event: KO, normal: n }, group: GROUP }),
  story(PtOutlookCard, { name: 'Card · the Fed tomorrow (the market on Fed days)', inputs: { event: FED, normal: n }, group: GROUP }),
  story(PtOutlookCard, { name: 'Card · CPI, after the release', inputs: { event: CPI, normal: n }, group: GROUP }),
  story(PtOutlookCard, { name: 'Card · only 3 reports on file', inputs: { event: { ...MSFT, reactions: MSFT.reactions.slice(-3) }, normal: n }, group: GROUP }),
  story(PtCalOutlook, { name: 'Not available', inputs: { data: null }, group: GROUP }),
];
