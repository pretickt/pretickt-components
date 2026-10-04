/**
 * What rendered component HTML may not contain. Used by the contract (demo data) and by the platform on every real render, as a
 * second line after escaping: an escaping bug or a hostile component then yields "not available", not script in a page.
 * Escaped text cannot match these patterns (`<` and quotes are entities), so only real markup is judged.
 */
const RULES: [RegExp, string][] = [
  [/<\s*(script|style|iframe|frame|object|embed|applet|meta|link|base|form|input|textarea|foreignObject|template|portal)\b/i, 'forbidden element'],
  [/\son[a-z]+\s*=/i, 'event-handler attribute'],
  [/\s(?:xlink:)?(?:href|src|action|formaction)\s*=\s*["']?\s*(?!https?:|\/(?!\/)|#)[a-z][a-z0-9+.-]*:/i, 'non-http URL scheme'],
  [/\s(?:xlink:)?href\s*=\s*["']?\s*\/\//i, 'protocol-relative URL'],
  [/\sid\s*=\s*["']?pt-data\b/i, 'id reserved for page data'],
  [/\sdata-pt\s*=/i, 'data-pt is reserved for the host'],
  [/\sstyle\s*=\s*["'][^"']*(?:url\s*\(|expression\s*\(|@import)/i, 'style with url()/expression()'],
];

/** One line per broken rule, with the offending fragment. */
export function checkMarkup(html: string): string[] {
  return RULES.flatMap(([re, why]) => { const m = re.exec(html); return m ? [`${why} (${m[0].trim().slice(0, 40)})`] : []; });
}
