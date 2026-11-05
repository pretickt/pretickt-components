/** Size budget of the browser files (bytes, minified). Every page loads the main bundle (Angular, the page runtime); then each component it shows. */
export const BUDGET = { main: 243_500, component: 32_000 } as const;

export function overBudget(kind: keyof typeof BUDGET, bytes: number): string | null {
  return bytes > BUDGET[kind] ? `${kind} bundle is ${bytes} bytes, over the ${BUDGET[kind]}-byte budget` : null;
}

/** The component sources: `pt-*.ts`, never their specs. */
export const componentFiles = (names: string[]): string[] => names.filter((f) => /^pt-[a-z0-9-]+\.ts$/.test(f)).sort();
