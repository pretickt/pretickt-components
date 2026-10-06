/** Size budget of the browser files (bytes, minified). Every page loads the runtime (Vue included); then each component it shows. */
export const BUDGET = { runtime: 160_000, component: 32_000 } as const;

export function overBudget(kind: keyof typeof BUDGET, bytes: number): string | null {
  return bytes > BUDGET[kind] ? `${kind} bundle is ${bytes} bytes, over the ${BUDGET[kind]}-byte budget` : null;
}

/** The component sources: `pt-*.vue`. */
export const componentFiles = (names: string[]): string[] => names.filter((f) => /^pt-[a-z0-9-]+\.vue$/.test(f)).sort();
