/** Size budget of the browser files (bytes, minified). Public pages load the host and every component they show. */
export const BUDGET = { host: 100_000, component: 32_000 } as const;

export function overBudget(kind: keyof typeof BUDGET, bytes: number): string | null {
  return bytes > BUDGET[kind] ? `${kind} bundle is ${bytes} bytes, over the ${BUDGET[kind]}-byte budget` : null;
}

/** The component sources: `pt-*.ts`, never their tests or the harness. */
export const componentFiles = (names: string[]): string[] => names.filter((f) => /^pt-[a-z0-9-]+\.ts$/.test(f)).sort();
