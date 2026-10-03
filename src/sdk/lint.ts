import ts from 'typescript';

export interface Violation { rule: string; message: string; line: number }

const ALLOWED_IMPORTS = new Set(['zod/mini', '@pretickt/components/sdk', '@pretickt/components/typologies', '@pretickt/components/indicators']);
/** In-repo components may import the lean SDK and the typologies — never the build tools or DOM-only modules. */
const IN_REPO = /^(\.\.\/)+src\/(sdk|typologies)(\/(?!tools|element|parity|lint|contract)[\w./-]*)?$/;
const NETWORK = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts']);
const STORAGE = new Set(['localStorage', 'sessionStorage', 'indexedDB', 'caches']);
const GLOBAL_OBJ = new Set(['window', 'globalThis', 'self', 'document', 'navigator']);
const LOCALE = new Set(['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']);

export function lintSource(source: string, fileName = 'component.ts'): Violation[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const out: Violation[] = [];
  const add = (node: ts.Node, rule: string, message: string) =>
    out.push({ rule, message, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });

  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      const spec = (st.moduleSpecifier as ts.StringLiteral).text;
      if (!ALLOWED_IMPORTS.has(spec) && !IN_REPO.test(spec)) add(st, 'import', `import from "${spec}" is not allowed`);
      continue;
    }
    if (ts.isExportDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isFunctionDeclaration(st)) continue;
    if (ts.isVariableStatement(st) && st.declarationList.flags & ts.NodeFlags.Const) continue;
    add(st, 'side-effect', 'only imports, exports, const declarations, functions and types are allowed at the top level');
  }

  const isRef = (id: ts.Identifier) => {
    const p = id.parent;
    if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
    if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p)) && p.name === id) return false;
    if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p) || ts.isBindingElement(p)) && p.name === id) return false;
    if (ts.isImportSpecifier(p) || ts.isImportClause(p)) return false;
    return true;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node, 'dynamic-import', 'dynamic import() is not allowed');
    if (ts.isIdentifier(node) && isRef(node)) {
      const n = node.text;
      if (NETWORK.has(n)) add(node, 'network', `${n} is not allowed: components never access data`);
      if (STORAGE.has(n)) add(node, 'storage', `${n} is not allowed`);
      if (n === 'eval' || n === 'Function') add(node, 'eval', `${n} is not allowed`);
      if (n === 'Intl') add(node, 'nondeterministic', 'Intl is not available in QuickJS and is locale-dependent');
      if (n === 'customElements') add(node, 'define', 'components never define elements; the host does');
    }
    if (ts.isPropertyAccessExpression(node)) {
      const obj = node.expression;
      const name = node.name.text;
      const objName = ts.isIdentifier(obj) ? obj.text : '';
      if (name === 'cookie') add(node, 'storage', 'cookies are not allowed');
      if (name === 'sendBeacon') add(node, 'network', 'sendBeacon is not allowed');
      if (GLOBAL_OBJ.has(objName) && STORAGE.has(name)) add(node, 'storage', `${objName}.${name} is not allowed`);
      if (GLOBAL_OBJ.has(objName) && NETWORK.has(name)) add(node, 'network', `${objName}.${name} is not allowed`);
      if (GLOBAL_OBJ.has(objName) && ['top', 'parent', 'opener', 'frames'].includes(name)) add(node, 'frame', `${objName}.${name} is not allowed`);
      if (name === 'postMessage') add(node, 'frame', 'postMessage is not allowed');
      if (objName === 'Date' && name === 'now') add(node, 'nondeterministic', 'Date.now() is not allowed');
      if (objName === 'Math' && name === 'random') add(node, 'nondeterministic', 'Math.random() is not allowed');
      if (LOCALE.has(name)) add(node, 'nondeterministic', `${name} is locale-dependent and missing in QuickJS`);
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Date' && !node.arguments?.length)
      add(node, 'nondeterministic', 'new Date() without an argument reads the clock');
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
