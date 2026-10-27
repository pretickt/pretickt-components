/** Every component's stories, in the index's order. A component without stories fails stories.spec.ts. */
import { stories as answer } from '../../components/pt-answer.stories';
import { stories as calendar } from '../../components/pt-calendar.stories';
import { stories as companyCard } from '../../components/pt-company-card.stories';
import { stories as feed } from '../../components/pt-feed.stories';
import { stories as drafts } from '../../components/drafts/home.stories';
import { stories as value } from '../../components/drafts/value.stories';
import { stories as peopleAsk } from '../../components/drafts/people-ask.stories';
import { stories as outlook } from '../../components/drafts/outlook.stories';
import { stories as financials } from '../../components/pt-financials.stories';
import { stories as insiders } from '../../components/pt-insiders.stories';
import { stories as logoMap } from '../../components/pt-logo-map.stories';
import { stories as metric } from '../../components/pt-metric.stories';
import { stories as movers } from '../../components/pt-movers.stories';
import { stories as news } from '../../components/pt-news.stories';
import { stories as priceEvents } from '../../components/pt-price-events.stories';
import { stories as priceTarget } from '../../components/pt-price-target.stories';
import { stories as quality } from '../../components/pt-quality.stories';
import { stories as screen } from '../../components/pt-screen.stories';
import { stories as whyToday } from '../../components/pt-why-today.stories';
import type { StoryConfiguration } from './story';

export const STORIES: StoryConfiguration[] = [
  ...companyCard, ...answer, ...quality, ...whyToday, ...priceTarget, ...priceEvents, ...metric, ...financials, ...insiders, ...news,
  ...screen, ...calendar, ...movers, ...logoMap, ...feed, ...value, ...peopleAsk, ...outlook, ...drafts,
];
