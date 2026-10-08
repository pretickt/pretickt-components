/**
 * What rendered component HTML may not contain. Used by the contract (demo data) and by the platform on every real render, as a
 * second line after escaping: an escaping bug or a hostile component then yields "not available", not script in a page.
 * Escaped text cannot match these patterns (`<` and quotes are entities), so only real markup is judged.
 */
const RULES: [RegExp, string][] = [
  [/<\s*(script|style|iframe|frame|object|embed|applet|meta|link|base|form|input|textarea|foreignObject|template|portal)\b/i, 'forbidden element'],
  [/\son[a-z]+\s*=/i, 'event-handler attribute'],
  // Angular reads the page state and its event contract by id, first match in the document: a component's element there would
  // replace the state of the whole page app
  [/\sid\s*=\s*["']?(?:ng-state|ng-event-dispatch-contract)(?=["'\s>]|$)/i, 'id reserved for the page (Angular\'s state and event contract)'],
  [/\sdata-(?:pt|island|props)\s*=/i, 'data-island / data-props are reserved for the page'],
  [/\sstyle\s*=\s*["'][^"']*(?:url\s*\(|expression\s*\(|@import)/i, 'style with url()/expression()'],
];

const URL_ATTR = /\s((?:xlink:)?(?:href|src|srcset|action|formaction|poster|data|background|cite|ping))\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", sol: '/', bsol: '\\', colon: ':', tab: '\t', newline: '\n', period: '.' };

/** A URL attribute's value as the browser uses it: entities decoded, tabs/newlines/controls/spaces removed, "\" read as "/". */
function asBrowserReads(raw: string): string | null {
  let unknown = false;
  const decoded = raw.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z][a-z0-9]*));?/gi, (all, dec?: string, hex?: string, name?: string) => {
    if (dec || hex) return String.fromCodePoint(Math.min(Number.parseInt(dec ?? hex!, dec ? 10 : 16), 0x10ffff));
    const v = NAMED[name!.toLowerCase()];
    if (v === undefined) unknown = true;
    return v ?? all;
  });
  return unknown ? null : decoded.replace(/[\u0000-\u0020\u007f]+/g, '').replace(/\\/g, '/');
}
/** http(s), a site path (not "//"), a fragment, or a relative path; null = acceptable. */
function badUrl(raw: string): string | null {
  const u = asBrowserReads(raw);
  if (u === null) return 'URL with an entity a browser may decode';
  if (u.startsWith('//')) return 'protocol-relative URL';
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u)?.[1];
  return scheme && !/^https?$/i.test(scheme) ? 'non-http URL scheme' : null;
}

/** One line per broken rule, with the offending fragment. */
export function checkMarkup(html: string): string[] {
  const out = RULES.flatMap(([re, why]) => { const m = re.exec(html); return m ? [`${why} (${m[0].trim().slice(0, 40)})`] : []; });
  for (const m of html.matchAll(URL_ATTR)) {
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    const urls = /srcset/i.test(m[1]!) ? value.split(',').map((c) => c.trim().split(/\s+/)[0] ?? '') : [value];
    const why = urls.map(badUrl).find(Boolean);
    if (why) { out.push(`${why} (${m[0].trim().slice(0, 40)})`); break; }
  }
  return out;
}
