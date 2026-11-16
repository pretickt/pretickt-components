/** pt-click-box on made-up notes: what the reader clicked, at the top of the company page; `compact` is the hover card's block. */
import { PtClickBox } from '../site/context/box';
import { CTX_DIVIDEND, CTX_EARNINGS_AHEAD, CTX_EARNINGS_OUT } from '../site/context/mock';
import { story } from './story';

const GROUP = 'Click context · The box on the company page (made-up data)';

export const stories = [
  story(PtClickBox, { name: 'Earnings calendar · NVDA before its report', inputs: { note: CTX_EARNINGS_AHEAD }, group: GROUP }),
  story(PtClickBox, { name: 'Earnings · NVDA after its report (from the home)', inputs: { note: CTX_EARNINGS_OUT }, group: GROUP }),
  story(PtClickBox, { name: 'Dividend calendar · KO', inputs: { note: CTX_DIVIDEND }, group: GROUP }),
  story(PtClickBox, { name: 'Compact (the hover card) · NVDA before its report', inputs: { note: CTX_EARNINGS_AHEAD, compact: true }, group: GROUP }),
];
