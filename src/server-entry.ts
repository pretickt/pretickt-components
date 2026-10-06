/// <reference types="vite/client" />
/** The server bundle (dist/server/index.js) the platform's generator imports: every component by tag, and the island renderer. */
import type { Component } from 'vue';

const modules = import.meta.glob<{ default: Component }>('../components/pt-*.vue', { eager: true });
export const components: Record<string, Component> = Object.fromEntries(
  Object.entries(modules).map(([path, m]) => [path.slice(path.lastIndexOf('/') + 1, -'.vue'.length), m.default]));

export { renderIsland, type IslandResult } from './islands/server';
export { islandMarkup, type PageData } from './islands/page';
export { checkMarkup } from './checks/markup';
export { needKey, stableStringify, type Need } from './api';
