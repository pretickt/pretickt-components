/** pt-alert-event on made-up data: the alert that fired, at the top of the company page (an email's `?alert=`). */
import { AE_AMD, AE_FIVE, AE_ONE } from '../alerts/event-mock';
import { PtAlertEvent } from '../site/alerts/event';
import { story } from './story';

const GROUP = 'Alerts · The alert on the company page (made-up data)';

export const stories = [
  story(PtAlertEvent, { name: "Romeo's example · AMD, a mega cap drops", inputs: { event: AE_AMD }, group: GROUP }),
  story(PtAlertEvent, { name: 'One condition · NVDA, news', inputs: { event: AE_ONE }, group: GROUP }),
  story(PtAlertEvent, { name: 'Five conditions · MU, one the page does not show', inputs: { event: AE_FIVE }, group: GROUP }),
];
