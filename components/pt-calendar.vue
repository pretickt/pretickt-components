<!--
  Which companies report earnings (or go ex-dividend) this month, and which market-wide dates (Fed, CPI, jobs) fall around them?
  @version 2.0.0
  @evidence DataForSEO: "earnings calendar" ~153k searches/month, SERP without AI overview (reports/Funzioni pretickt da tenere e aggiungere.md)
  @evidence DataForSEO: "dividend calendar" in launch/data/08c-serp-dividend-calendar.json
  @evidence beta: events-calendar month grid (pretickt-frontend/src/app/home/events-calendar.ts); stockanalysis.com earnings calendar
-->
<script lang="ts">
import type { EventItem } from '@pretickt/components/typologies';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);
const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => { const list = m.get(k); if (list) list.push(v); else m.set(k, [v]); };

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return iso(y!, m! - 1 + delta, 1).slice(0, 7);
}

type Company = Exclude<EventItem, { kind: 'macro' }>;
type Macro = Extract<EventItem, { kind: 'macro' }>;
/** Unknown future kinds may lack a ticker: those are skipped rather than breaking the page. */
const isCompany = (e: EventItem): e is Company => e.kind !== 'macro' && typeof (e as { ticker?: unknown }).ticker === 'string';
export interface Cell { date: string; day: number; inMonth: boolean; isAsOf: boolean; items: Company[]; macro: Macro[] }

/** Monday-first weeks for `month`; `asOf` (latest session) is highlighted instead of a clock-based "today". */
export function buildMonth(month: string, items: EventItem[], asOf: string) {
  const [y, m] = month.split('-').map(Number);
  const m0 = m! - 1;
  const byDay = new Map<string, Company[]>();
  const macroByDay = new Map<string, Macro[]>();
  for (const e of items) {
    if (e.kind === 'macro') push(macroByDay, e.date, e);
    else if (isCompany(e)) push(byDay, e.date, e);
  }
  const lead = (new Date(Date.UTC(y!, m0, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y!, m0 + 1, 0)).getUTCDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  const cells: Cell[] = Array.from({ length: total }, (_, i) => {
    const date = iso(y!, m0, 1 - lead + i);
    return { date, day: Number(date.slice(8)), inMonth: date.slice(0, 7) === month, isAsOf: date === asOf, items: byDay.get(date) ?? [], macro: macroByDay.get(date) ?? [] };
  });
  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { month, label: `${MONTHS[m0]} ${y}`, weeks };
}
export { isCompany };
</script>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePt } from '@pretickt/components/context';
import { amount, date, num, stockHref, tip } from '@pretickt/components/format';

type Kind = 'earnings' | 'dividend';
const props = withDefaults(defineProps<{ month: string; kind?: Kind }>(), { kind: 'earnings' });
const pt = usePt();
const CAP = 4;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const month = ref(props.month);
const events = ref(await pt.events({ scope: { by: 'universe', month: month.value }, kinds: [props.kind, 'macro'] }));
const loading = ref(false);
async function go(m: string) {
  month.value = m;
  loading.value = true;
  events.value = await pt.events({ scope: { by: 'universe', month: m }, kinds: [props.kind, 'macro'] });
  loading.value = false;
}

const time = (e: EventItem) => (e.kind === 'earnings' && e.meta.time ? e.meta.time.toUpperCase() : '');
/** Short per-event suffix: report time for earnings, cash amount for dividends. */
const tag = (e: EventItem) => (e.kind === 'dividend' ? amount(e.meta.amount) : time(e));
const macroTip = (e: Macro) => tip({ [e.meta.label]: e.meta.event, Date: date(e.date), Impact: e.meta.impact });
const chipTip = (e: Company) => tip({
  [e.ticker]: e.name, Date: date(e.date), Time: time(e) || null,
  'EPS est.': e.kind === 'earnings' && e.meta.epsEst != null ? num(e.meta.epsEst) : null,
  ...(e.kind === 'dividend' ? { Dividend: amount(e.meta.amount), 'Pay date': e.meta.payDate ? date(e.meta.payDate) : null } : {}),
});

const cal = computed(() => {
  const items = (events.value?.items ?? []).filter((e) => e.date.startsWith(month.value) && (e.kind === 'macro' || (isCompany(e) && e.kind === props.kind)));
  return buildMonth(month.value, items, events.value?.asOf ?? '');
});
const prev = computed(() => shiftMonth(month.value, -1));
const next = computed(() => shiftMonth(month.value, 1));
// the full list, from the same day groups as the grid: nothing hides behind the cap
const listed = computed(() => cal.value.weeks.flat().filter((c) => c.inMonth && (c.macro.length || c.items.length)));
</script>

<template>
  <p v-if="!events" class="pt-na">Data not available</p>
  <section v-else class="pt-cal" :class="{ 'pt-busy': loading }">
    <div class="pt-head">
      <h2 class="pt-section-title">{{ cal.label }}</h2>
      <div class="pt-cal-nav">
        <button type="button" @click="go(prev)">← {{ prev }}</button>
        <button type="button" @click="go(next)">{{ next }} →</button>
      </div>
    </div>
    <div class="pt-cal-grid">
      <div v-for="d in DOW" :key="d" class="pt-cal-dow">{{ d }}</div>
      <div v-for="c in cal.weeks.flat()" :key="c.date" :class="['pt-cal-day', { 'pt-cal-out': !c.inMonth, 'pt-cal-asof': c.isAsOf }]">
        <div>{{ c.day }}</div>
        <div v-for="(e, i) in c.macro" :key="`m${i}`" class="pt-cal-macro" :data-tip="macroTip(e)">{{ e.meta.label }}</div>
        <a v-for="e in c.items.slice(0, CAP)" :key="`${e.kind}${e.ticker}`" class="pt-cal-ev" :href="stockHref(e.ticker)" :data-tip="chipTip(e)">
          {{ e.ticker }}<span class="pt-cal-time">{{ tag(e) }}</span>
        </a>
        <div v-if="c.items.length > CAP" class="pt-cal-more">+{{ c.items.length - CAP }} more</div>
      </div>
    </div>
    <ol v-if="listed.length" class="pt-cal-list">
      <li v-for="c in listed" :key="c.date">
        <span class="pt-cal-list-day">{{ date(c.date) }}</span>
        <template v-for="(e, i) in [...c.macro, ...c.items]" :key="i">{{ i ? ', ' : ' ' }}<strong v-if="e.kind === 'macro'">{{ e.meta.label }}</strong><template v-if="e.kind === 'macro'"> ({{ e.meta.event }})</template><a v-else :href="stockHref(e.ticker)">{{ e.name }} ({{ e.ticker }}){{ tag(e) ? ` ${tag(e)}` : '' }}</a></template>
      </li>
    </ol>
    <p v-else class="pt-lede">No {{ kind === 'dividend' ? 'ex-dividend dates' : 'earnings reports' }} scheduled for {{ cal.label }} in the tracked universe yet.</p>
  </section>
</template>
