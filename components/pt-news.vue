<!--
  What is being said about this company right now, and is the tone positive or negative?
  @version 2.0.0
  @evidence "<ticker> news" long tail (marketing/ per-ticker SEO)
  @evidence beta: news list + attention chart on the company page
-->
<script setup lang="ts">
import { usePt } from '../src/context/pt';
import { SENTIMENT_FLAT } from '../src/typologies/values';
import { date, href, tip, tone } from '../src/ds/format';

const props = withDefaults(defineProps<{ ticker: string; limit?: number }>(), { limit: 20 });
const news = await usePt().news({ ticker: props.ticker, limit: props.limit });
const MOOD = { pos: 'positive', neg: 'negative', flat: 'neutral', na: 'not scored' } as const;
const DOT = { pos: 'pt-dot-pos', neg: 'pt-dot-neg', flat: 'pt-dot-flat', na: 'pt-dot-na' } as const;
</script>

<template>
  <p v-if="!news" class="pt-na">Data not available</p>
  <p v-else-if="!news.items.length" class="pt-na">No recent stories about {{ ticker }}.</p>
  <section v-else>
    <ul class="pt-news">
      <li v-for="s in news.items" :key="s.url" class="pt-news-item">
        <span :class="DOT[tone(s.sentiment, SENTIMENT_FLAT)]" :data-tip="tip({ Sentiment: MOOD[tone(s.sentiment, SENTIMENT_FLAT)] })"></span>
        <div>
          <a :href="href(s.url)" target="_blank" rel="nofollow noopener noreferrer">{{ s.title }}</a>
          <div class="pt-meta">{{ s.site }} · {{ date(s.publishedAt) }}</div>
        </div>
      </li>
    </ul>
    <p class="pt-note">Sentiment classified by AI from the headline (green positive, red negative). Links open the publisher.</p>
  </section>
</template>
