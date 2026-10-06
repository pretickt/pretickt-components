import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Components import the package the way any author does (`@pretickt/components/ds`, …), also inside this repo: this resolves those
 * imports through the package's own `exports`, so the published components and the examples the generator shows are the same code.
 */
export function selfImports(): Plugin {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string; exports: Record<string, string | null> };
  return {
    name: 'pretickt-self-imports',
    enforce: 'pre',
    resolveId(id) {
      if (id !== pkg.name && !id.startsWith(`${pkg.name}/`)) return null;
      const target = pkg.exports[`.${id.slice(pkg.name.length)}`];
      return typeof target === 'string' ? join(root, target) : null;
    },
  };
}
