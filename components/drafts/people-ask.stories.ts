/** The pt-people-ask draft on made-up data: the company page's "what people ask", in its two looks, until its data has a pipeline. */
import { story } from '../../src/stories/story';
import { PA_KO, PA_MRNA, PA_NVDA, PA_NVDA_ALL, PA_ODFL } from './people-ask-mock';
import { PtPeopleAsk } from './pt-people-ask';

const GROUP = 'Drafts · What people ask, company page (made-up data)';

export const stories = [
  story(PtPeopleAsk, { name: 'A · FAQ · NVDA, a busy week', inputs: { data: PA_NVDA }, group: GROUP }),
  story(PtPeopleAsk, { name: 'A · FAQ · MRNA, the day of a drop', inputs: { data: PA_MRNA }, group: GROUP }),
  story(PtPeopleAsk, { name: 'A · FAQ · KO, a quiet week', inputs: { data: PA_KO }, group: GROUP }),
  story(PtPeopleAsk, { name: 'A · FAQ · ODFL, nobody talks about it', inputs: { data: PA_ODFL }, group: GROUP }),
  story(PtPeopleAsk, { name: 'A · FAQ · NVDA, every kind of question', inputs: { data: PA_NVDA_ALL }, group: GROUP }),
  story(PtPeopleAsk, { name: 'B · cards · NVDA, a busy week', inputs: { data: PA_NVDA, variant: 'cards' }, group: GROUP }),
  story(PtPeopleAsk, { name: 'B · cards · MRNA, the day of a drop', inputs: { data: PA_MRNA, variant: 'cards' }, group: GROUP }),
  story(PtPeopleAsk, { name: 'B · cards · KO, a quiet week', inputs: { data: PA_KO, variant: 'cards' }, group: GROUP }),
  story(PtPeopleAsk, { name: 'Not available', inputs: { data: null }, group: GROUP }),
];
