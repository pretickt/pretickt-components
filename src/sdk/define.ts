import type { z } from 'zod';
import type { Manifest } from './types';

const TAG = /^pt-[a-z][a-z0-9-]*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

export function defineComponent<P extends z.ZodType>(m: Manifest<P>): Manifest<P> {
  if (!TAG.test(m.tag)) throw new Error(`invalid tag "${m.tag}": must match ${TAG}`);
  if (/-v\d+$/.test(m.tag)) throw new Error(`tag "${m.tag}" must not carry the major suffix; the host adds it`);
  if (!SEMVER.test(m.version)) throw new Error(`invalid version "${m.version}": must be semver x.y.z`);
  if (!m.need.question.trim()) throw new Error(`need.question is required`);
  if (m.uses.length) throw new Error(`composition (uses) is not supported yet`);
  return m;
}

export const majorOf = (version: string): number => Number(version.split('.')[0]);
export const elementName = (m: Pick<Manifest, 'tag' | 'version'>): string => `${m.tag}-v${majorOf(m.version)}`;
