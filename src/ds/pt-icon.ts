import { Component, computed, input } from '@angular/core';
import { ICON_PATHS } from './icons';

/** The path of an icon of the design system's set, or null (an unknown name, never prototype keys). */
export const iconPath = (name: string | null | undefined): string | null =>
  name && Object.hasOwn(ICON_PATHS, name) ? ICON_PATHS[name]! : null;

/** One icon by name (calendar target trend-up trend-down alert peak) on an svg: `@if (iconPath(n)) { <svg [ptIcon]="n"></svg> }`. */
@Component({
  selector: 'svg[ptIcon]',
  host: { class: 'pt-icon', viewBox: '0 0 16 16', 'aria-hidden': 'true' },
  template: `@if (d(); as path) {<svg:path [attr.d]="path" />}`,
})
export class PtIcon {
  readonly name = input<string | null | undefined>(null, { alias: 'ptIcon' });
  protected readonly d = computed(() => iconPath(this.name()));
}
