import { dirname, join } from 'node:path';
import ts from 'typescript';
import { literalValue, signalInput } from './lint';

/** One input of a component, as the build, the catalogue and the checks read it. `default` is absent when there is none. */
export interface InputInfo { name: string; required: boolean; type: string; literals: (string | number)[]; default?: unknown }
export interface ComponentInputs { className: string; inputs: InputInfo[] }

/** Compiler options for reading components: the self imports point at the package's sources (as tsconfig.app.json does). */
export function componentsCompilerOptions(componentsRoot: string): ts.CompilerOptions {
  const src = (p: string) => [join(componentsRoot, p)];
  return {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.Preserve, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true,
    skipLibCheck: true, noEmit: true, experimentalDecorators: true, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [],
    paths: {
      '@pretickt/components/context': src('src/context/index.ts'), '@pretickt/components/ds': src('src/ds/index.ts'),
      '@pretickt/components/format': src('src/ds/format.ts'), '@pretickt/components/typologies': src('src/typologies/browser.ts'),
      '@pretickt/components/indicators': src('src/indicators/index.ts'), '@pretickt/components/api': src('src/api.ts'),
    },
  };
}

/** The repo root of this package (src/checks/inputs.ts → ../..). */
export const COMPONENTS_ROOT = dirname(dirname(dirname(new URL(import.meta.url).pathname)));

/** A program over component files (each one alone is enough: imports are followed). */
export const componentsProgram = (files: string[], root = COMPONENTS_ROOT) => ts.createProgram(files, componentsCompilerOptions(root));

/** The literal values of a type: the string and number members of a union (or the single literal). */
function literalsOf(t: ts.Type): (string | number)[] {
  const parts = t.isUnion() ? t.types : [t];
  return parts.flatMap((p) => (p.isStringLiteral() || p.isNumberLiteral() ? [p.value] : []));
}

/** The inputs of the exported @Component class of `file`: name, required, type (as the checker prints it), literals, default. */
export function readInputs(program: ts.Program, file: string): ComponentInputs {
  const sf = program.getSourceFile(file);
  if (!sf) throw new Error(`${file} is not in the program`);
  const checker = program.getTypeChecker();
  const cls = sf.statements.find((s): s is ts.ClassDeclaration => ts.isClassDeclaration(s) && !!ts.getDecorators(s)?.some((d) =>
    ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression) && d.expression.expression.text === 'Component'));
  if (!cls?.name) throw new Error(`${file}: no exported @Component class`);
  const inputs: InputInfo[] = [];
  for (const m of cls.members) {
    if (!ts.isPropertyDeclaration(m)) continue;
    const si = signalInput(m.initializer);
    if (!si) continue;
    const signalType = checker.getTypeAtLocation(m);
    const args = checker.getTypeArguments(signalType as ts.TypeReference);
    let value = args[0] ?? checker.getAnyType();
    if (value.isUnion()) {
      const kept = value.types.filter((t) => !(t.flags & ts.TypeFlags.Undefined));
      if (kept.length === 1) value = kept[0]!;
    }
    const first = si.required ? undefined : si.call.arguments[0];
    const def = first ? literalValue(first) : undefined;
    inputs.push({
      name: m.name.getText(sf), required: si.required,
      type: checker.typeToString(value, undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType),
      literals: literalsOf(value), ...(def ? { default: def.value } : {}),
    });
  }
  return { className: cls.name.text, inputs };
}
