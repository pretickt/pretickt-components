/** Size budget of the browser files (bytes, minified). Every page loads the main bundle (Angular, the page runtime); then each component it shows. */
// main: 243,500 until 2026-11-11, +100 for pt-answer's `start` (the week's and the day's earnings pages: its binding in the page template) (Romeo, 2026-11-11: «OK al tetto del bundle a 243.600 byte»)
// main: 243,600 until 2026-11-13, +300 for pt-daily, a new registry component — the daily card on the company page; measured 243,880 (Romeo, 2026-11-13: «ok per il tetto, aumenta», up to 244,800)
// page: 50,000 until 2026-11-09, +4,000 for the paste read by the site's AI
export const BUDGET = { main: 243_900, component: 32_000, page: 54_000 } as const;

export function overBudget(kind: keyof typeof BUDGET, bytes: number): string | null {
  return bytes > BUDGET[kind] ? `${kind} bundle is ${bytes} bytes, over the ${BUDGET[kind]}-byte budget` : null;
}

/** The component sources: `pt-*.ts`, never their specs. */
export const componentFiles = (names: string[]): string[] => names.filter((f) => /^pt-[a-z0-9-]+\.ts$/.test(f)).sort();
