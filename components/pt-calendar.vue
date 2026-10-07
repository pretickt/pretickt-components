<!--
  Which companies report earnings (or go ex-dividend) this month — or in the coming week — and which market-wide dates (Fed, CPI,
  jobs) fall around them?
  @version 2.2.0
  @evidence DataForSEO: "earnings calendar" ~153k searches/month, SERP without AI overview (reports/Funzioni pretickt da tenere e aggiungere.md)
  @evidence DataForSEO: "dividend calendar" in launch/data/08c-serp-dividend-calendar.json
  @evidence beta: events-calendar month grid (pretickt-frontend/src/app/home/events-calendar.ts); stockanalysis.com earnings calendar
-->
<script lang="ts">
import type { EventItem } from '@pretickt/components/typologies';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);
const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => { const list = m.get(k); if (list) list.push(v); else m.set(k, [v]); };

export const addDays = (d: string, n: number): string => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
/** 0 = Sunday … 6 = Saturday. */
export const weekdayOf = weekday;

/** The Monday of the week a reader looks forward to: the week of the first weekday after the latest session `asOf`. */
export function comingWeek(asOf: string): string {
  let d = addDays(asOf, 1);
  while (weekday(d) === 0 || weekday(d) === 6) d = addDays(d, 1);
  return addDays(d, -((weekday(d) + 6) % 7));
}

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

/** The five sessions (Mon–Fri) of the week starting `start`, with their events. */
export function buildWeek(start: string, items: EventItem[], asOf: string): Cell[] {
  return Array.from({ length: 5 }, (_, i) => {
    const date = addDays(start, i);
    const day = items.filter((e) => e.date === date);
    return { date, day: Number(date.slice(8)), inMonth: true, isAsOf: date === asOf, items: day.filter(isCompany), macro: day.filter((e): e is Macro => e.kind === 'macro') };
  });
}
export { isCompany };
</script>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { usePt } from '@pretickt/components/context';
import { PtLogo } from '@pretickt/components/ds';
import { amount, date, num, stockHref, tip } from '@pretickt/components/format';

type Kind = 'earnings' | 'dividend';
/** `month`: the month grid with every report listed below it; `week`: the coming week's five sessions (compact, the home page). */
const props = withDefaults(defineProps<{ month: string; kind?: Kind; view?: 'month' | 'week' }>(), { kind: 'earnings', view: 'month' });
const view = computed(() => props.view);
const pt = usePt();
const CAP = 4;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const load = (m: string) => pt.events({ scope: { by: 'universe', month: m }, kinds: [props.kind, 'macro'] });

const month = ref(props.month);
const events = ref(await load(month.value));
const loading = ref(false);
async function go(m: string) {
  close();
  loading.value = true;
  const next = await load(m);
  month.value = m;           // the month on screen changes with its data, never before
  events.value = next;
  loading.value = false;
}

/** The events of the week starting `start`, from the month(s) it spans. */
async function weekOf(start: string): Promise<EventItem[]> {
  const months = [...new Set([start.slice(0, 7), addDays(start, 4).slice(0, 7)])];
  const got = await Promise.all(months.map(load));
  const end = addDays(start, 4);
  return got.flatMap((e) => e?.items ?? []).filter((e) => e.date >= start && e.date <= end && (e.kind === 'macro' || e.kind === props.kind));
}
const weekStart = ref(props.view === 'week' && events.value ? comingWeek(events.value.asOf) : '');
const weekItems = ref(weekStart.value ? await weekOf(weekStart.value) : []);
async function goWeek(delta: number) {
  close();
  loading.value = true;
  const start = addDays(weekStart.value, 7 * delta);
  const items = await weekOf(start);
  weekStart.value = start;   // the week on screen changes with its data
  weekItems.value = items;
  loading.value = false;
}
const week = computed(() => (weekStart.value ? buildWeek(weekStart.value, weekItems.value, events.value?.asOf ?? '') : []));

// "+N more": the whole day over its cell (as Google Calendar), outside the grid so nothing clips it; ×, Escape or a click outside close it
const POP_W = 224;
const openDay = ref<string | null>(null);
const popAt = ref({ left: 0, top: 0 });
let popEl: HTMLElement | null = null, opener: HTMLElement | null = null;
const popRef = (el: unknown) => { popEl = (el as HTMLElement | null) ?? null; };
/** Closes the day box and gives the focus back to the "+N more" that opened it. */
function close() {
  if (!openDay.value) return;
  openDay.value = null;
  opener?.focus();
}
const openCell = computed(() => (view.value === 'week' ? week.value : cal.value.weeks.flat()).find((c) => c.date === openDay.value) ?? null);
function more(d: string, e: Event) {
  opener = e.currentTarget as HTMLElement;
  const cell = opener.closest('.pt-cal-day');
  const box = cell?.closest('.pt-cal');
  if (cell && box) {
    const c = cell.getBoundingClientRect(), b = box.getBoundingClientRect();
    popAt.value = { left: Math.max(0, Math.min(c.left - b.left, b.width - POP_W)), top: c.top - b.top };
  }
  openDay.value = d;
}
watch(openDay, async (d) => { if (d) { await nextTick(); popEl?.focus(); } });

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
      <h2 class="pt-section-title">{{ view === 'week' ? `Week of ${date(weekStart)}` : cal.label }}</h2>
      <div v-if="view === 'week'" class="pt-cal-nav">
        <button type="button" @click="goWeek(-1)">← Previous week</button>
        <button type="button" @click="goWeek(1)">Next week →</button>
      </div>
      <div v-else class="pt-cal-nav">
        <button type="button" @click="go(prev)">← {{ prev }}</button>
        <button type="button" @click="go(next)">{{ next }} →</button>
      </div>
    </div>
    <div class="pt-cal-grid" :class="{ 'pt-cal-week': view === 'week' }">
      <template v-if="view === 'week'"><div v-for="(c, i) in week" :key="`d${c.date}`" class="pt-cal-dow">{{ DOW[i] }} {{ c.day }}</div></template>
      <template v-else><div v-for="d in DOW" :key="d" class="pt-cal-dow">{{ d }}</div></template>
      <div v-for="c in view === 'week' ? week : cal.weeks.flat()" :key="c.date" :class="['pt-cal-day', { 'pt-cal-out': !c.inMonth, 'pt-cal-asof': c.isAsOf }]">
        <div v-if="view !== 'week'">{{ c.day }}</div>
        <div v-for="(e, i) in c.macro" :key="`m${i}`" class="pt-cal-macro" :data-tip="macroTip(e)">{{ e.meta.label }}</div>
        <a v-for="e in c.items.slice(0, CAP)" :key="`${e.kind}${e.ticker}`" class="pt-cal-ev" :href="stockHref(e.ticker)" :data-tip="chipTip(e)"><span class="pt-cal-who"><PtLogo :ticker="e.ticker" :src="e.logo" :size="14" />{{ e.ticker }}</span><span class="pt-cal-time">{{ tag(e) }}</span></a>
        <button v-if="c.items.length > CAP" type="button" class="pt-cal-more" @click="more(c.date, $event)">+{{ c.items.length - CAP }} more</button>
      </div>
    </div>
    <div v-if="openCell" class="pt-cal-backdrop" @click="close"></div>
    <div v-if="openCell" :ref="popRef" class="pt-cal-pop" :style="{ left: `${popAt.left}px`, top: `${popAt.top}px` }" role="dialog"
      :aria-label="`Events on ${date(openCell.date)}`" tabindex="-1" @keydown.esc="close">
      <div class="pt-cal-pop-head"><span>{{ DOW[(weekdayOf(openCell.date) + 6) % 7] }}</span> <b>{{ openCell.day }}</b><button type="button" class="pt-cal-pop-x" aria-label="Close" @click="close">×</button></div>
      <div v-for="(e, i) in openCell.macro" :key="`pm${i}`" class="pt-cal-macro" :data-tip="macroTip(e)">{{ e.meta.label }}</div>
      <a v-for="e in openCell.items" :key="`p${e.kind}${e.ticker}`" class="pt-cal-ev" :href="stockHref(e.ticker)" :data-tip="chipTip(e)"><span class="pt-cal-who"><PtLogo :ticker="e.ticker" :src="e.logo" :size="14" />{{ e.ticker }}</span><span class="pt-cal-time">{{ tag(e) }}</span></a>
    </div>
    <template v-if="view === 'week'">
      <p v-if="!weekItems.length" class="pt-lede">No {{ kind === 'dividend' ? 'ex-dividend dates' : 'earnings reports' }} scheduled this week in the tracked universe yet.</p>
    </template>
    <ol v-else-if="listed.length" class="pt-cal-list">
      <li v-for="c in listed" :key="c.date">
        <span class="pt-cal-list-day">{{ date(c.date) }}</span>
        <template v-for="(e, i) in [...c.macro, ...c.items]" :key="i">{{ i ? ', ' : ' ' }}<strong v-if="e.kind === 'macro'">{{ e.meta.label }}</strong><template v-if="e.kind === 'macro'"> ({{ e.meta.event }})</template><a v-else class="pt-co" :href="stockHref(e.ticker)"><PtLogo :ticker="e.ticker" :src="e.logo" :size="16" />{{ e.name }} ({{ e.ticker }}){{ tag(e) ? ` ${tag(e)}` : '' }}</a></template>
      </li>
    </ol>
    <p v-else class="pt-lede">No {{ kind === 'dividend' ? 'ex-dividend dates' : 'earnings reports' }} scheduled for {{ cal.label }} in the tracked universe yet.</p>
  </section>
</template>
