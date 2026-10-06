/**
 * A component's catalogue entry lives in the leading comment of its file:
 *
 *   <!--
 *     The market question it answers (one or more lines).
 *     @version 1.2.0
 *     @evidence where the need comes from (repeatable)
 *   -->
 */
export type ComponentMeta =
  | { ok: true; question: string; version: string; major: number; evidence: string[] }
  | { ok: false; errors: string[] };

export function readComponentMeta(source: string): ComponentMeta {
  const m = /^\s*<!--([\s\S]*?)-->/.exec(source);
  if (!m) return { ok: false, errors: ['the file must start with a <!-- … --> comment: the question, @version, @evidence'] };
  const lines = m[1]!.split('\n').map((l) => l.trim()).filter(Boolean);
  const question = lines.filter((l) => !l.startsWith('@')).join(' ');
  const tag = (name: string) => lines.filter((l) => l.startsWith(`@${name} `) || l === `@${name}`).map((l) => l.slice(name.length + 1).trim());
  const version = tag('version')[0] ?? '';
  const evidence = tag('evidence').filter(Boolean);
  const errors = [
    ...(question ? [] : ['the question it answers (first lines of the comment)']),
    ...(/^\d+\.\d+\.\d+$/.test(version) ? [] : ['@version must be semver x.y.z']),
    ...(evidence.length ? [] : ['at least one @evidence line']),
  ];
  return errors.length ? { ok: false, errors } : { ok: true, question, version, major: Number(version.split('.')[0]), evidence };
}
