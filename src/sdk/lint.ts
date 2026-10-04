import ts from 'typescript';

export interface Violation { rule: string; message: string; line: number }
interface Rule { rule: string; message: string }

/** Bare specifiers a component may import. The admin sandbox bundles generated components against the same list. */
export const ALLOWED_IMPORTS: ReadonlySet<string> = new Set(['zod/mini', '@pretickt/components/sdk', '@pretickt/components/typologies', '@pretickt/components/indicators']);
/** In-repo components import the same three entry points by relative path — an allow-list, so a new SDK file stays closed. */
const IN_REPO = /^(\.\.\/)+src\/(sdk|sdk\/indicators|typologies)$/;

const network = (n: string): Rule => ({ rule: 'network', message: `${n} is not allowed: components never access data` });
const clock = (n: string): Rule => ({ rule: 'nondeterministic', message: `${n} reads the clock or randomness` });
const locale = (n: string): Rule => ({ rule: 'nondeterministic', message: `${n} is locale-dependent and missing in QuickJS` });
const storage = (n: string): Rule => ({ rule: 'storage', message: `${n} is not allowed` });

/** Identifiers that may not be referenced at all. */
const IDENT: Record<string, Rule> = {
  fetch: network('fetch'), XMLHttpRequest: network('XMLHttpRequest'), WebSocket: network('WebSocket'),
  EventSource: network('EventSource'), importScripts: network('importScripts'),
  localStorage: storage('localStorage'), sessionStorage: storage('sessionStorage'), indexedDB: storage('indexedDB'), caches: storage('caches'),
  eval: { rule: 'eval', message: 'eval is not allowed' }, Function: { rule: 'eval', message: 'Function is not allowed' },
  Intl: { rule: 'nondeterministic', message: 'Intl is not available in QuickJS and is locale-dependent' },
  customElements: { rule: 'define', message: 'components never define elements; the host does' },
  performance: clock('performance'), crypto: clock('crypto'),
};

/** Property names flagged on any object (`*.x`) or on a given one (`obj.x`). */
const MEMBER: Record<string, Rule> = {
  '*.cookie': { rule: 'storage', message: 'cookies are not allowed' },
  '*.sendBeacon': network('sendBeacon'),
  '*.postMessage': { rule: 'frame', message: 'postMessage is not allowed' },
  '*.toLocaleString': locale('toLocaleString'), '*.toLocaleDateString': locale('toLocaleDateString'),
  '*.toLocaleTimeString': locale('toLocaleTimeString'), '*.toLocaleUpperCase': locale('toLocaleUpperCase'),
  '*.toLocaleLowerCase': locale('toLocaleLowerCase'), '*.localeCompare': locale('localeCompare'),
  'Date.now': clock('Date.now()'), 'Math.random': clock('Math.random()'),
};
/** The page's globals: reaching storage, network or other frames through them is the same as naming them. */
const GLOBAL_OBJ = new Set(['window', 'globalThis', 'self', 'document', 'navigator']);
const FRAME = new Set(['top', 'parent', 'opener', 'frames']);

export function lintSource(source: string, fileName = 'component.ts'): Violation[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const out: Violation[] = [];
  const add = (node: ts.Node, r: Rule) => out.push({ ...r, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });

  const checkSpecifier = (st: ts.ImportDeclaration | ts.ExportDeclaration) => {
    if (!st.moduleSpecifier) return;
    const spec = (st.moduleSpecifier as ts.StringLiteral).text;
    if (!ALLOWED_IMPORTS.has(spec) && !IN_REPO.test(spec)) add(st, { rule: 'import', message: `import from "${spec}" is not allowed` });
    // `with { type: 'text' }` would make a bundler inline arbitrary files as strings
    if (st.attributes) add(st, { rule: 'import', message: 'import attributes are not allowed' });
  };
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) { checkSpecifier(st); continue; }
    if (ts.isImportEqualsDeclaration(st)) { add(st, { rule: 'import', message: '`import x = require(...)` is not allowed' }); continue; }
    if (ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isFunctionDeclaration(st)) continue;
    if (ts.isVariableStatement(st) && st.declarationList.flags & ts.NodeFlags.Const) continue;
    add(st, { rule: 'side-effect', message: 'only imports, exports, const declarations, functions and types are allowed at the top level' });
  }

  const isRef = (id: ts.Identifier) => {
    const p = id.parent;
    if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
    if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p)) && p.name === id) return false;
    if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p) || ts.isBindingElement(p)) && p.name === id) return false;
    if (ts.isImportSpecifier(p) || ts.isImportClause(p)) return false;
    return true;
  };
  const isDate = (e: ts.Expression) => ts.isIdentifier(e) && e.text === 'Date';

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node, { rule: 'dynamic-import', message: 'dynamic import() is not allowed' });
    if (ts.isIdentifier(node) && isRef(node) && Object.hasOwn(IDENT, node.text)) add(node, IDENT[node.text]!);
    if (ts.isPropertyAccessExpression(node)) {
      const name = node.name.text;
      const obj = ts.isIdentifier(node.expression) ? node.expression.text : '';
      const r = (obj && Object.hasOwn(MEMBER, `${obj}.${name}`) ? MEMBER[`${obj}.${name}`] : undefined)
        ?? (Object.hasOwn(MEMBER, `*.${name}`) ? MEMBER[`*.${name}`] : undefined);
      if (r) add(node, r);
      if (GLOBAL_OBJ.has(obj) && Object.hasOwn(IDENT, name)) add(node, { ...IDENT[name]!, message: `${obj}.${name} is not allowed` });
      if (GLOBAL_OBJ.has(obj) && FRAME.has(name)) add(node, { rule: 'frame', message: `${obj}.${name} is not allowed` });
    }
    // Date() and new Date() without an argument both read the clock; new Date(iso) is fine
    if (ts.isNewExpression(node) && isDate(node.expression) && !node.arguments?.length) add(node, clock('new Date() without an argument'));
    if (ts.isCallExpression(node) && isDate(node.expression)) add(node, clock('Date()'));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
