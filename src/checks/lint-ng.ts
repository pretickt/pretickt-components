import ts from 'typescript';
import { lintCss } from './lint';

/** The only modules a component may import. */
export const ALLOWED_IMPORTS = new Set(['@angular/core', '@pretickt/components/context', '@pretickt/components/ds', '@pretickt/components/format',
  '@pretickt/components/typologies', '@pretickt/components/indicators']);

/** Code (strings and comments blanked out), line by line. */
const RULES: [RegExp, string][] = [
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/, 'no data access of your own: ask Pt'],
  [/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/, 'no storage or cookies'],
  [/(?<![.\w$])(window|document|globalThis)\s*[.[]|\bself\.(?:top|parent|opener)\b/, 'no globals: the component renders on the server too'],
  [/\b(eval|Function)\s*\(|new\s+Function\b|\bimport\s*\(/, 'no code from strings, no dynamic import'],
  [/\bDate\.now\s*\(|new\s+Date\s*\(\s*\)|Math\.random\s*\(/, 'deterministic only: no clock, no randomness ("today" is the payload asOf)'],
  [/\bIntl\b|\.toLocale\w*\s*\(/, 'no Intl / toLocale*: use @pretickt/components/format (the same text on server and browser)'],
  [/postMessage\b/, 'no messaging'],
  [/\bimport\s*\.\s*meta\b/, 'no import.meta: the compiler would read files for it'],
  [/\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/, 'never write HTML: Angular escapes text, links go through href()'],
  [/\b(?:DomSanitizer|bypassSecurityTrust\w*|Renderer2|DOCUMENT)\b/, 'no DOM access of your own: the template and the design system do it (an ElementRef from viewChild may read and focus)'],
];
/** Template (the inline literal), line by line. */
const TEMPLATE_RULES: [RegExp, string][] = [
  [/(?:\[|bind-)(?:attr\.)?(?:inner|outer)HTML\b/i, 'never write HTML: Angular escapes text, links go through href()'],
  [/<\s*(script|style|iframe|object|embed|link|base|meta|form)\b/i, 'no such element in a component (and no <style>: use styles)'],
];
const FORBIDDEN_META = new Map([
  ['templateUrl', 'templateUrl — the template is inline: the whole component is this file'],
  ['styleUrl', 'styleUrl — styles are inline: the whole component is this file'],
  ['styleUrls', 'styleUrls — styles are inline: the whole component is this file'],
  ['providers', 'providers — a component gets its data from Pt, provided by the page'],
  ['viewProviders', 'viewProviders — a component gets its data from Pt, provided by the page'],
  ['encapsulation', "encapsulation — a component's styles stay its own"],
]);

/** Blank every string, template literal and comment (same length, newlines kept), so the code rules see code only. */
function blankLiterals(source: string): string {
  const out = source.split('');
  const scanner = ts.createScanner(ts.ScriptTarget.ES2022, false, ts.LanguageVariant.Standard, source);
  const blank = (from: number, to: number) => { for (let i = from; i < to; i++) if (out[i] !== '\n') out[i] = ' '; };
  for (let k = scanner.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = scanner.scan()) {
    if (k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral || k === ts.SyntaxKind.TemplateHead
      || k === ts.SyntaxKind.SingleLineCommentTrivia || k === ts.SyntaxKind.MultiLineCommentTrivia) blank(scanner.getTokenStart() + (k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral ? 1 : 0), scanner.getTextPos() - (k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral ? 1 : 0));
  }
  return out.join('');
}

/** A literal JSON-able value (string, number, boolean, null, arrays and objects of them), or undefined when it is anything else. */
export function literalValue(node: ts.Expression): { value: unknown } | undefined {
  if (ts.isStringLiteralLike(node)) return { value: node.text };
  if (ts.isNumericLiteral(node)) return { value: Number(node.text) };
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return { value: -Number(node.operand.text) };
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { value: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { value: false };
  if (node.kind === ts.SyntaxKind.NullKeyword) return { value: null };
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) return literalValue(node.expression);
  if (ts.isArrayLiteralExpression(node)) {
    const items = node.elements.map((e) => literalValue(e));
    return items.every(Boolean) ? { value: items.map((i) => i!.value) } : undefined;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const o: Record<string, unknown> = {};
    for (const p of node.properties) {
      if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) return undefined;
      const v = literalValue(p.initializer);
      if (!v) return undefined;
      o[p.name.text] = v.value;
    }
    return { value: o };
  }
  return undefined;
}

/** `input(…)`, `input.required(…)`, `model(…)`, `model.required(…)`: the call, its kind and whether it is required. */
export function signalInput(node: ts.Expression | undefined): { call: ts.CallExpression; required: boolean } | null {
  if (!node || !ts.isCallExpression(node)) return null;
  const e = node.expression;
  if (ts.isIdentifier(e) && (e.text === 'input' || e.text === 'model')) return { call: node, required: false };
  if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && (e.expression.text === 'input' || e.expression.text === 'model') && e.name.text === 'required') return { call: node, required: true };
  return null;
}

/**
 * The lint of a component file (`components/pt-*.ts`, or a draft): its imports, the code rules, its one standalone component (the
 * selector is `tag`, template and styles inline, no providers or encapsulation), literal input defaults without alias or transform,
 * the template and CSS rules. Feedback for authors and the generator — the sandbox and the checks contain untrusted code.
 */
export function lintComponent(source: string, tag: string): string[] {
  const out: [number, string][] = [];
  const sf = ts.createSourceFile('component.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const at = (n: ts.Node, why: string) => out.push([lineOf(n.getStart(sf)), why]);

  for (const st of sf.statements) {
    if ((ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
      const spec = st.moduleSpecifier.text;
      if (!ALLOWED_IMPORTS.has(spec)) at(st, `import "${spec}" is not allowed (only ${[...ALLOWED_IMPORTS].join(', ')})`);
    }
  }
  blankLiterals(source).split('\n').forEach((text, i) => {
    for (const [re, why] of RULES) { const m = re.exec(text); if (m) out.push([i + 1, `${m[0].trim()} — ${why}`]); }
    if (/^\s*\/\/\/\s*<reference\b/.test(source.split('\n')[i] ?? '')) out.push([i + 1, '/// <reference> — no triple-slash references']);
  });

  const components: ts.ClassDeclaration[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isClassDeclaration(n) && ts.getDecorators(n)?.some((d) => ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression) && d.expression.expression.text === 'Component')) components.push(n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!components.length) out.push([1, 'no component: one exported standalone @Component class']);
  if (components.length > 1) at(components[1]!, 'one component per file');
  const cls = components[0];
  if (cls) {
    if (!cls.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) at(cls, 'the component class must be exported');
    const deco = ts.getDecorators(cls)!.find((d) => ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression) && d.expression.expression.text === 'Component')!;
    const arg = (deco.expression as ts.CallExpression).arguments[0];
    if (!arg || !ts.isObjectLiteralExpression(arg)) at(deco, '@Component({ … }) takes one object literal');
    else {
      for (const p of arg.properties) {
        const name = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : '';
        if (FORBIDDEN_META.has(name)) at(p, FORBIDDEN_META.get(name)!);
        if (!ts.isPropertyAssignment(p)) continue;
        const v = p.initializer;
        if (name === 'standalone' && v.kind === ts.SyntaxKind.FalseKeyword) at(p, 'standalone: false — components are standalone');
        if (name === 'selector') {
          const sel = ts.isStringLiteralLike(v) ? v.text : '';
          if (sel !== tag) at(p, `selector "${sel}" must be the tag "${tag}"`);
        }
        if (name === 'template') {
          if (!ts.isNoSubstitutionTemplateLiteral(v) && !ts.isStringLiteral(v)) at(p, 'template must be one literal (no expressions, no concatenation)');
          else {
            const from = lineOf(v.getStart(sf)) - 1;
            v.text.split('\n').forEach((text, i) => {
              for (const [re, why] of TEMPLATE_RULES) for (const m of text.matchAll(new RegExp(re.source, 'gi'))) out.push([from + i + 1, `${m[0].trim()} — ${why}`]);
            });
          }
        }
        if (name === 'styles') {
          const list = ts.isArrayLiteralExpression(v) ? [...v.elements] : [v];
          for (const s of list) {
            if (!ts.isNoSubstitutionTemplateLiteral(s) && !ts.isStringLiteral(s)) { at(s, 'styles must be literals'); continue; }
            for (const line of lintCss(s.text, lineOf(s.getStart(sf)) - 1)) { const [n, ...rest] = line.split(': '); out.push([Number(n), rest.join(': ')]); }
          }
        }
      }
    }
    for (const m of cls.members) {
      if (!ts.isPropertyDeclaration(m)) continue;
      const si = signalInput(m.initializer);
      if (!si) continue;
      const name = m.name.getText(sf);
      const [first, options] = si.required ? [undefined, si.call.arguments[0]] : [si.call.arguments[0], si.call.arguments[1]];
      if (first && !literalValue(first)) at(m, `input ${name}: its default must be a literal (the page passes it when a placement does not give the prop)`);
      if (options && ts.isObjectLiteralExpression(options)) {
        for (const o of options.properties) {
          const k = o.name?.getText(sf);
          if (k === 'alias' || k === 'transform') at(m, `input ${name}: no ${k} (the page binds inputs by their name, as given)`);
        }
      }
    }
  }
  return out.sort((a, b) => a[0] - b[0]).map(([n, m]) => `${n}: ${m}`);
}
