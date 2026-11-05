/** pt-company-header: the box on a company's main page and, low, on its sub-pages. */
import { story } from '../src/stories/story';
import { PtCompanyHeader } from './pt-company-header';

export const stories = [
  story(PtCompanyHeader, { name: 'Full: the main page (demo)', inputs: { ticker: 'NVDA' } }),
  story(PtCompanyHeader, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
];
