/** The pt-alert-event draft on made-up data: the alert that fired, at the top of the company page, until alert-event@1 has a pipeline. */
import { story } from '../../src/stories/story';
import { AE_AMD, AE_FIVE, AE_ONE } from './alert-event-mock';
import { PtAlertEvent } from './pt-alert-event';

const GROUP = 'Drafts · The alert on the company page (made-up data)';

export const stories = [
  story(PtAlertEvent, { name: "Romeo's example · AMD, a mega cap drops", inputs: { event: AE_AMD }, group: GROUP }),
  story(PtAlertEvent, { name: 'One condition · NVDA, news', inputs: { event: AE_ONE }, group: GROUP }),
  story(PtAlertEvent, { name: 'Five conditions · MU, one the page does not show', inputs: { event: AE_FIVE }, group: GROUP }),
];
