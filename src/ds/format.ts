/**
 * How numbers, dates and links look on pretickt — part of the design system, the same in every component. Deterministic (no Intl,
 * no clock): the build and the browser produce the same text, so hydration never mismatches. Nothing here escapes: Angular escapes
 * what a template prints (text and attributes).
 */
import type { MetricItem, TONES } from '../typologies';

export type Tone = (typeof TONES)[number];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** A formatted magnitude that rounds to zero carries no sign: never "-$0.00" or "+0.0%". */
const isZero = (formatted: string) => Number(formatted.replace(/,/g, '')) === 0;

export function num(v: number | null | undefined, digits = 2): string {
  if (!finite(v)) return '—';
  const s = Math.abs(v).toFixed(digits);
  const [i, d] = s.split('.');
  const neg = v < 0 && !isZero(s);
  return (neg ? '-' : '') + group(i!) + (d ? `.${d}` : '');
}

/** `v` is a fraction: 0.123 → "+12.3%". */
export function pct(v: number | null | undefined, digits = 1): string {
  if (!finite(v)) return '—';
  const s = num(v * 100, digits);
  return (v > 0 && !isZero(s) ? '+' : '') + s + '%';
}

/** `v` is a fraction shown as a level, without a plus sign: 0.123 → "12.3%" (margins, yields, shares). */
export function level(v: number | null | undefined, digits = 1): string {
  return finite(v) ? `${num(v * 100, digits)}%` : '—';
}

/** Dollars: `compact` → "$1.05B", `signed` → "+$200M"; never "-$0". */
export function usd(v: number | null | undefined, o: { compact?: boolean; signed?: boolean; digits?: number } = {}): string {
  if (!finite(v)) return '—';
  const s = o.compact ? compact(Math.abs(v)) : num(Math.abs(v), o.digits ?? 2);
  const sign = isZero(s.replace(/[A-Z]$/, '')) ? '' : v < 0 ? '-' : o.signed && v > 0 ? '+' : '';
  return `${sign}$${s}`;
}

/** Currencies a listed company may report in: the sign before an amount (a space after letters) and the English name. A fixed table, not
 *  Intl: the server and the browser must print the same text. Unknown codes print as "XYZ 1B" and are named by their code. */
const CURRENCIES: Record<string, [sign: string, name: string]> = {
  USD: ['$', 'US Dollar'], EUR: ['€', 'Euro'], CNY: ['CN¥', 'Chinese Yuan'], GBP: ['£', 'British Pound'], JPY: ['¥', 'Japanese Yen'],
  CHF: ['CHF ', 'Swiss Franc'], CAD: ['CA$', 'Canadian Dollar'], AUD: ['A$', 'Australian Dollar'], HKD: ['HK$', 'Hong Kong Dollar'],
  TWD: ['NT$', 'New Taiwan Dollar'], KRW: ['₩', 'South Korean Won'], INR: ['₹', 'Indian Rupee'], BRL: ['R$', 'Brazilian Real'],
  MXN: ['MX$', 'Mexican Peso'], DKK: ['DKK ', 'Danish Krone'], SEK: ['SEK ', 'Swedish Krona'], NOK: ['NOK ', 'Norwegian Krone'],
  ILS: ['₪', 'Israeli New Shekel'], SGD: ['SGD ', 'Singapore Dollar'], ZAR: ['ZAR ', 'South African Rand'],
};

/** An amount in the currency a company reports in (ISO code; none = dollars), formatted as `usd` formats dollars: "CN¥112B", "-€250M". */
export function cash(v: number | null | undefined, currency: string | null | undefined, o: { compact?: boolean; signed?: boolean; digits?: number } = {}): string {
  const s = usd(v, o);
  return !currency || currency === 'USD' || s === '—' ? s : s.replace('$', CURRENCIES[currency]?.[0] ?? `${currency} `);
}

/** A currency's English name: "EUR" → "Euro" (its code when unknown). */
export const currencyName = (code: string): string => CURRENCIES[code]?.[1] ?? code;

export function money(v: number | null | undefined, digits = 2): string {
  return usd(v, { digits });
}

/** A cash amount with 2 to 4 decimals, as declared (dividends): 0.2625 → "$0.2625", 0.5 → "$0.50". */
export function amount(v: number | null | undefined): string {
  return usd(v, { digits: 4 }).replace(/(\.\d\d\d*?)0+$/, '$1');
}

const UNITS: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K'], [1, '']];
export function compact(v: number | null | undefined): string {
  if (!finite(v)) return '—';
  const a = Math.abs(v);
  let i = UNITS.findIndex(([d]) => a >= d);
  if (i < 0) i = UNITS.length - 1;
  const digitsAt = (j: number) => (UNITS[j]![1] === '' || a / UNITS[j]![0] >= 100 ? 0 : 2);
  // rounding can carry into the next unit: 999,999 is "1M", not "1,000K"
  if (i > 0 && Number((a / UNITS[i]![0]).toFixed(digitsAt(i))) >= 1000) i--;
  const [div, suf] = UNITS[i]!;
  const digits = digitsAt(i);
  const s = num(v / div, digits);
  return (digits ? s.replace(/\.?0+$/, '') : s) + suf;
}

/** "2026-03" (or a full date) → "Mar 26": the label of a month on a time axis. */
export function month(ym: string): string {
  return /^\d{4}-\d{2}/.test(ym) ? `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}` : String(ym);
}

export function date(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso))) return String(iso ?? ''); // never "Jan NaN, 2026"
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

/** "2026-10-30" → "Oct 30": a day on a strip whose year the context gives (the feed's cards). */
export function dayMonth(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso))) return String(iso ?? '');
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
}

export function tone(v: number | null | undefined, flatBand = 0): Tone {
  if (!finite(v)) return 'na';
  if (Math.abs(v) <= flatBand) return 'flat';
  return v > 0 ? 'pos' : 'neg';
}

/** A safe href: absolute http(s) or a site path ("/…", not "//host"); any other scheme (javascript:, data:, …) becomes "#". */
export function href(url: string | null | undefined): string {
  const u = String(url ?? '').trim();
  return /^(https?:\/\/|\/(?![/\\]))[^\s"'<>\\]*$/i.test(u) ? u : '#'; // browsers read "\" as "/": "/\host" is another site
}

/** The site path of a company's page. */
export function stockHref(ticker: string): string {
  return href(`/stocks/${String(ticker).toLowerCase()}/`);
}

// legal suffixes and share classes at the end of a provider name; "Company"/"Co." go with their "and"/"&", "plc" with its "&"
// ("Carnival Corporation & plc") (the generator's shortName)
const SUFFIX = /(?:(?:\s+(?:and|&))?,?\s+(?:Company|Co\.)|,?\s+(?:&\s+)?(?:plc|Plc|PLC)|,?\s+(?:Inc\.?|Incorporated|Corporation|Corp\.?|Ltd\.?|Limited|Public Limited Company|N\.V\.|S\.A\.|L\.P\.)|\s+Class [A-C](?: Common Stock)?|\s+Common Stock|\s+American Depositary Shares|\s+Ordinary Shares)$/;

/**
 * The name the press and the AI answers use where the provider's, once its suffixes are gone, is not it: the case ("NVIDIA"), the
 * brand ("Meta Platforms"), the short form ("Honeywell International"). Keyed by the name without its suffixes. Read against the 517
 * companies of www on 2026-10-31; a company that is not here keeps the suffix rule's name.
 */
export const COMMON_NAMES: Readonly<Record<string, string>> = {
  'Abbott Laboratories': 'Abbott', 'Advanced Micro Devices': 'AMD', 'Agilent Technologies': 'Agilent', 'Akamai Technologies': 'Akamai',
  'Alnylam Pharmaceuticals': 'Alnylam', 'Altria Group': 'Altria', 'Amazon.com': 'Amazon', 'American International Group': 'AIG',
  AMETEK: 'Ametek', 'Apollo Global Management': 'Apollo', 'Arch Capital Group': 'Arch Capital', 'Arm Holdings': 'Arm', 'ASML Holding': 'ASML',
  'Automatic Data Processing': 'ADP', 'Axon Enterprise': 'Axon', 'Bank of New York Mellon': 'BNY', 'Baxter International': 'Baxter',
  'Becton, Dickinson': 'Becton Dickinson', 'Broadridge Financial Solutions': 'Broadridge', 'Bunge Global': 'Bunge',
  'C.H. Robinson Worldwide': 'C.H. Robinson', 'Cadence Design Systems': 'Cadence', 'Capital One Financial': 'Capital One',
  'Carrier Global': 'Carrier', "Casey's General Stores": "Casey's", 'CBRE Group': 'CBRE', 'Cboe Global Markets': 'Cboe',
  'CF Industries Holdings': 'CF Industries', 'Charles River Laboratories International': 'Charles River Laboratories',
  'Charter Communications': 'Charter', 'Chipotle Mexican Grill': 'Chipotle', 'Cisco Systems': 'Cisco', 'Coinbase Global': 'Coinbase',
  'Cognizant Technology Solutions': 'Cognizant', 'Consolidated Edison': 'Con Edison', 'Costco Wholesale': 'Costco', 'CrowdStrike Holdings': 'CrowdStrike',
  'Darden Restaurants': 'Darden', 'Deckers Outdoor': 'Deckers', 'Dell Technologies': 'Dell', DexCom: 'Dexcom', 'Digital Realty Trust': 'Digital Realty',
  'DuPont de Nemours': 'DuPont', 'EMCOR Group': 'Emcor', 'Estée Lauder Companies': 'Estée Lauder', 'Expedia Group': 'Expedia',
  'Expeditors International of Washington': 'Expeditors', 'Exxonmobil Holdings': 'ExxonMobil', 'FactSet Research Systems': 'FactSet',
  'FedEx Freight Holding': 'FedEx Freight', 'Fidelity National Information Services': 'FIS', 'Fifth Third Bancorp': 'Fifth Third',
  'Ford Motor': 'Ford', 'GE HealthCare Technologies': 'GE HealthCare', 'Generac Holdings': 'Generac', 'Gilead Sciences': 'Gilead',
  'Goldman Sachs Group': 'Goldman Sachs', 'Healthpeak Properties': 'Healthpeak', 'Hilton Worldwide Holdings': 'Hilton',
  'Honeywell International': 'Honeywell', 'Huntington Ingalls Industries': 'Huntington Ingalls', 'IDEXX Laboratories': 'Idexx Laboratories',
  'Interactive Brokers Group': 'Interactive Brokers', 'International Business Machines': 'IBM', 'International Flavors & Fragrances': 'IFF',
  'IQVIA Holdings': 'IQVIA', 'J.B. Hunt Transport Services': 'J.B. Hunt', 'Jack Henry & Associates': 'Jack Henry', 'Jacobs Solutions': 'Jacobs',
  'Johnson Controls International': 'Johnson Controls', 'Keysight Technologies': 'Keysight', 'L3Harris Technologies': 'L3Harris',
  'Labcorp Holdings': 'Labcorp', 'Leidos Holdings': 'Leidos', 'Lennox International': 'Lennox', 'Live Nation Entertainment': 'Live Nation',
  "Lowe's Companies": "Lowe's", 'Lululemon Athletica': 'Lululemon', 'Lumentum Holdings': 'Lumentum', 'LyondellBasell Industries': 'LyondellBasell',
  'Marriott International': 'Marriott', 'Marsh & McLennan Companies': 'Marsh McLennan', 'Marvell Technology': 'Marvell', 'Meta Platforms': 'Meta',
  'Mettler-Toledo International': 'Mettler-Toledo', 'MGM Resorts International': 'MGM Resorts', 'Micron Technology': 'Micron',
  'Mondelez International': 'Mondelez', 'Nebius Group': 'Nebius', News: 'News Corp', NIKE: 'Nike', 'Norwegian Cruise Line Holdings': 'Norwegian Cruise Line',
  NVIDIA: 'Nvidia', "O'Reilly Automotive": "O'Reilly", 'Occidental Petroleum': 'Occidental', 'Omnicom Group': 'Omnicom', ONEOK: 'Oneok',
  'Otis Worldwide': 'Otis', PACCAR: 'Paccar', 'Palantir Technologies': 'Palantir', 'PayPal Holdings': 'PayPal', 'Philip Morris International': 'Philip Morris',
  'PNC Financial Services Group': 'PNC', 'Principal Financial Group': 'Principal Financial', QUALCOMM: 'Qualcomm', 'Raymond James Financial': 'Raymond James',
  'Regeneron Pharmaceuticals': 'Regeneron', 'Robinhood Markets': 'Robinhood', 'Rocket Lab USA': 'Rocket Lab', 'Roper Technologies': 'Roper',
  'Ross Stores': 'Ross', 'Royal Caribbean Cruises': 'Royal Caribbean', 'Seagate Technology Holdings': 'Seagate', 'Skyworks Solutions': 'Skyworks',
  Slb: 'SLB', Southern: 'Southern Company', 'Space Exploration Technologies': 'SpaceX', STERIS: 'Steris', 'T-Mobile US': 'T-Mobile',
  'T. Rowe Price Group': 'T. Rowe Price', 'Take-Two Interactive Software': 'Take-Two', 'Teledyne Technologies': 'Teledyne',
  'Thermo Fisher Scientific': 'Thermo Fisher', 'TJX Companies': 'TJX', 'TKO Group Holdings': 'TKO', 'Trane Technologies': 'Trane',
  'TransDigm Group': 'TransDigm', 'Travelers Companies': 'Travelers', 'Uber Technologies': 'Uber', 'United Airlines Holdings': 'United Airlines',
  'United Parcel Service': 'UPS', 'UnitedHealth Group': 'UnitedHealth', 'Valero Energy': 'Valero', 'Veeva Systems': 'Veeva',
  'Verisk Analytics': 'Verisk', 'Verizon Communications': 'Verizon', 'Vertex Pharmaceuticals': 'Vertex', 'Vertiv Holdings Co': 'Vertiv',
  'W.W. Grainger': 'Grainger', 'Walt Disney': 'Disney', 'Westinghouse Air Brake Technologies': 'Wabtec', 'Williams Companies': 'Williams',
  'Zimmer Biomet Holdings': 'Zimmer Biomet',
};

/**
 * A company's name as people search it and the press writes it: the legal suffixes go ("Apple Inc." → "Apple", "The Coca-Cola
 * Company" → "Coca-Cola"), then the common name where the provider's is not it ("NVIDIA Corporation" → "Nvidia", "Meta Platforms,
 * Inc." → "Meta"). Every name a component prints goes through it; the ticker stays beside it ("Nvidia NVDA", `named`).
 */
export function plainName(name: string): string {
  const plain = withoutSuffixes(name);
  return COMMON_NAMES[plain] ?? plain;
}

/** The provider's name without its legal suffixes, share classes and leading "The" ("NVIDIA Corporation" → "NVIDIA"): the first step of plainName. */
export function withoutSuffixes(name: string): string {
  let n = name.trim();
  for (let prev = ''; prev !== n;) { prev = n; const next = n.replace(SUFFIX, ''); if (next) n = next; }
  return n.replace(/^The\s+/, '') || n;
}

/**
 * "Nvidia NVDA": the common name with the ticker beside it, no parentheses (Romeo, 2026-10-31); the name alone when it is the ticker
 * in other letters ("Meta", "AMD", "RTX").
 */
export function named(name: string | null | undefined, ticker: string): string {
  const n = plainName(name || ticker);
  return n.toUpperCase() === ticker.toUpperCase() ? n : `${n} ${ticker}`;
}

/** A company a sentence names, drawn as a link to its page with its logo beside the name (PtMention, PtSay): its card opens on hover. */
export interface Mention { ticker: string; name: string | null; logo: string | null }
/** A sentence in parts: its text, and the companies it names. */
export type Said = (string | Mention)[];

/** A company to name in a sentence: its ticker, its provider name (plainName makes it common) and its logo, the site's file. */
export const mention = (ticker: string, name?: string | null, logo?: string | null): Mention => ({ ticker, name: name ?? null, logo: logo ?? null });
export const isMention = (p: unknown): p is Mention => typeof p === 'object' && p !== null && !Array.isArray(p) && 'ticker' in p;

/**
 * A sentence with the companies it names: say`The target for ${mention('NVDA', name, logo)} is ${money(x)}.` A mention stays a mention,
 * a sentence in parts is spread in, anything else becomes text; neighbouring text is merged.
 */
export function say(strings: TemplateStringsArray, ...values: unknown[]): Said {
  const out: Said = [];
  const push = (p: string | Mention) => {
    if (isMention(p)) { out.push(p); return; }
    if (!p) return;
    const last = out.at(-1);
    if (typeof last === 'string') out[out.length - 1] = last + p; else out.push(p);
  };
  strings.forEach((s, i) => {
    push(s);
    if (i >= values.length) return;
    const v = values[i];
    if (Array.isArray(v)) for (const p of v as Said) push(p); else push(isMention(v) ? v : String(v));
  });
  return out;
}

/** The sentence as text, each company by its common name and ticker ("Nvidia NVDA"): what a search engine reads. */
export const saidText = (s: Said): string => s.map((p) => (typeof p === 'string' ? p : named(p.name, p.ticker))).join('');

/** "a", "a and b", "a, b and c", over sentences in parts. */
export function andSaid(xs: Said[]): Said {
  if (xs.length < 2) return xs[0] ?? [];
  return say`${xs.slice(0, -1).flatMap((x, i) => (i ? [', ', ...x] : x))} and ${xs.at(-1)!}`;
}

/**
 * A question's address on the page, from its words: "Who is dumping Nvidia stock?" → "who-is-dumping-nvidia-stock". A component
 * prefixes it with its own name (`value-…`), so another placement can link to the answer instead of giving a second one.
 */
export function faqId(question: string): string {
  return question.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}

/** The JSON a `data-tip` attribute carries; the island runtime shows it as a tooltip (label → value rows). */
export function tip(o: Record<string, string | number | null>): string {
  return JSON.stringify(o);
}

/** A badge is a metric@1 item (fields documented on `MetricItem`): build one from any data and draw it with PtBadge. */
export type Badge = MetricItem;

/** The text of a badge's value, by unit. */
export function badgeValue(b: Pick<Badge, 'text' | 'value' | 'unit'>): string {
  if (b.text) return b.text;
  if (b.value == null || !Number.isFinite(b.value)) return '—';
  switch (b.unit) {
    case 'x': return `${num(b.value, 1)}x`;
    case '%': return pct(b.value);
    case '$': return money(b.value);
    case '$c': return usd(b.value, { compact: true });
    case 'd': return `${num(b.value, 0)}d`;
    default: return num(b.value);
  }
}

/** An id usable in SVG (`url(#…)`): letters, digits and dashes only. */
export const svgId = (s: string): string => s.replace(/[^A-Za-z0-9-]/g, '-');
