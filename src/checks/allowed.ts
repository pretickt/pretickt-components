/** The only modules a component may import (no dependencies: tools that only need the list load nothing else). */
export const ALLOWED_IMPORTS = new Set(['@angular/core', '@pretickt/components/context', '@pretickt/components/ds', '@pretickt/components/format',
  '@pretickt/components/typologies', '@pretickt/components/indicators', '@pretickt/components/alerts',
  // PtFollow (the bell), its own entry: in the context barrel it would sit in every page's main bundle
  '@pretickt/components/follow']);
