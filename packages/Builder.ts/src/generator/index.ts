import { BuilderFeatures, ParticipatesIn } from '@frenchexdev2/builder-shared-kernel';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { failure, success, type Result } from '@frenchexdev2/result';
import { withBanner, type Diagnostic, type GenerationContext, type GenerationResult, type SourceGenerator } from '@frenchexdev2/ts-codegen-pipeline';
import type { ClassDeclaration, Decorator, Identifier, ImportDeclaration, ImportSpecifier, NamespaceImport, Node, ObjectLiteralExpression, PropertyAccessExpression, PropertyAssignment, StringLiteral } from 'ts-morph';

const runtimePackage = '@frenchexdev2/builder';
const producerId = 'frenchexdev.builder';

/** Narrows AST nodes without importing ts-morph into the generator's runtime graph. */
function kind<T extends Node>(node: Node, name: string): node is T {
  return node.getKindName() === name;
}

/** Recognizes the package export by its import binding, including local aliases. */
function isHasBuilder(decorator: Decorator): boolean {
  const expression = decorator.getCallExpression()?.getExpression() ?? decorator.getExpression();
  if (kind<Identifier>(expression, 'Identifier')) {
    const declaration = expression.getSymbol()?.getDeclarations()[0];
    if (!declaration) return false;
    return kind<ImportSpecifier>(declaration, 'ImportSpecifier') &&
      declaration.getName() === 'HasBuilder' &&
      declaration.getImportDeclaration().getModuleSpecifierValue() === runtimePackage;
  }
  if (kind<PropertyAccessExpression>(expression, 'PropertyAccessExpression') && expression.getName() === 'HasBuilder') {
    const declaration = expression.getExpression().getSymbol()?.getDeclarations()[0];
    if (!declaration) return false;
    return kind<NamespaceImport>(declaration, 'NamespaceImport') &&
      (declaration.getParentOrThrow().getParentOrThrow() as ImportDeclaration).getModuleSpecifierValue() === runtimePackage;
  }
  return false;
}

/** Emits source-located failures through the pipeline's existing pre-commit gate. */
function diagnostic(node: Node, code: string, message: string): Diagnostic {
  const position = node.getSourceFile().getLineAndColumnAtPos(node.getStart());
  return { severity: 'error', code, message, producerId, file: node.getSourceFile().getFilePath(), start: position };
}

/** Names forbidden as class bindings in strict-mode TypeScript modules. */
const reservedNames = new Set(('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await arguments eval any unknown never number bigint boolean string symbol object undefined').split(' '));

/** Checks an explicit generated name without evaluating any decorator expressions. */
function validName(name: string): boolean {
  return /^[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*$/u.test(name) && !reservedNames.has(name);
}

/** Reads only the literal name option; validator expressions remain runtime metadata. */
function builderName(cls: ClassDeclaration, decorator: Decorator): Result<string, Diagnostic> {
  const call = decorator.getCallExpression();
  if (!call || call.getArguments().length > 1) {
    return failure(diagnostic(decorator, 'BG003', 'Use @HasBuilder() or @HasBuilder({ name, validators }).'));
  }
  const options = call.getArguments()[0];
  if (options === undefined) return success(`${cls.getName()}Builder`);
  if (!kind<ObjectLiteralExpression>(options, 'ObjectLiteralExpression')) {
    return failure(diagnostic(options, 'BG003', 'HasBuilder options must be an object literal.'));
  }
  let name = `${cls.getName()}Builder`;
  for (const property of options.getProperties()) {
    if (!kind<PropertyAssignment>(property, 'PropertyAssignment')) {
      return failure(diagnostic(property, 'BG003', 'Only explicit name and validators properties are supported; spreads and computed options are unsupported.'));
    }
    const key = property.getNameNode();
    const keyName = kind<StringLiteral>(key, 'StringLiteral') ? key.getLiteralValue() : key.getText();
    if (!['name', 'validators'].includes(keyName)) {
      return failure(diagnostic(property, 'BG003', 'Only explicit name and validators properties are supported; spreads and computed options are unsupported.'));
    }
    if (keyName !== 'name') continue;
    const value = property.getInitializerOrThrow();
    if (!kind<StringLiteral>(value, 'StringLiteral')) {
      return failure(diagnostic(property, 'BG003', 'The builder name must be a string literal.'));
    }
    name = value.getLiteralValue();
  }
  if (!validName(name)) {
    return failure(diagnostic(decorator, 'BG003', `Invalid builder class name: ${JSON.stringify(name)}.`));
  }
  return success(name);
}

/** One constructor parameter and the generated fluent setter associated with it. */
interface Parameter {
  readonly name: string;
  readonly setter: string;
  readonly required: boolean;
}

/** Validates the supported class/constructor shape before emitting any companion. */
function parameters(cls: ClassDeclaration, diagnostics: Diagnostic[]): readonly Parameter[] | undefined {
  if (!cls.getModifiers().some(modifier => modifier.getText() === 'export') || cls.isDefaultExport() || cls.isAbstract() || cls.getTypeParameters().length > 0 || cls.getModifiers().some(modifier => modifier.getText() === 'declare')) {
    diagnostics.push(diagnostic(cls, 'BG001', 'HasBuilder requires a named, directly exported, concrete, non-generic class (no default or ambient exports).'));
    return undefined;
  }
  const constructor = cls.getConstructors()[0];
  if (constructor ? constructor.getOverloads().length > 0 || constructor.getScope() !== 'public' : cls.getExtends()) {
    diagnostics.push(diagnostic(cls, 'BG002', 'Use one public constructor without overloads; derived classes need an explicit constructor.'));
    return undefined;
  }
  const output: Parameter[] = [];
  const setters = new Set(['withValidation']);
  for (const parameter of constructor?.getParameters() ?? []) {
    if (!kind<Identifier>(parameter.getNameNode(), 'Identifier') || parameter.isRestParameter()) {
      diagnostics.push(diagnostic(parameter, 'BG002', 'Constructor parameters must be named identifiers; rest and destructuring are unsupported.'));
      return undefined;
    }
    const name = parameter.getName();
    const setter = `with${name[0]!.toUpperCase()}${name.slice(1)}`;
    if (setters.has(setter)) {
      diagnostics.push(diagnostic(parameter, 'BG004', `Generated method ${setter} conflicts with another setter or the builder API.`));
      return undefined;
    }
    setters.add(setter);
    output.push({ name, setter, required: !parameter.hasQuestionToken() && !parameter.hasInitializer() });
  }
  return output;
}

/** Emits typed constructor slots, preserving the original constructor's parameter types. */
function emit(cls: ClassDeclaration, name: string, params: readonly Parameter[], importPath: string): string {
  // Each internal binding extends the public name, so it cannot equal that name.
  const alias = (base: string): string => `${name}${base}`;
  const product = alias('__Product');
  const base = alias('__ValidatedBuilder');
  const factory = alias('__ProductFactory');
  const result = alias('__Result');
  const errorsType = alias('__ValidationErrors');
  const success = alias('__success');
  const fail = alias('__validationFailure');
  const problem = alias('__validationError');
  const required = params.map((parameter, index) => ({ ...parameter, index })).filter(parameter => parameter.required);
  const lines = [
    `import { ${cls.getName()} as ${product} } from ${JSON.stringify(importPath)};`,
    `import { ValidatedBuilder as ${base}, type ProductFactory as ${factory} } from '${runtimePackage}';`,
    `import { success as ${success}, ${required.length ? `validationFailure as ${fail}, validationError as ${problem}, ` : ''}type Result as ${result}, type ValidationErrors as ${errorsType} } from '@frenchexdev2/result';`,
    '',
    `/** Generated fluent constructor for ${cls.getName()}. */`,
    `export class ${name} extends ${base}<${product}> {`,
  ];
  params.forEach((_parameter, index) => {
    lines.push(`  #arg${index}: { readonly set: false } | { readonly set: true; readonly value: ConstructorParameters<typeof ${product}>[${index}] } = { set: false };`);
  });
  lines.push('', '  /** Associates the product class and its declared validation rules. */', `  constructor() { super(${product}); }`);
  params.forEach((parameter, index) => {
    lines.push('', `  /** @param value Constructor argument ${parameter.name}. */`, `  ${parameter.setter}(value: ConstructorParameters<typeof ${product}>[${index}]): this {`, '    this.ensureConfigurable();', `    this.#arg${index} = { set: true, value };`, '    return this;', '  }');
  });
  lines.push('', '  /** Captures the supplied arguments and reports every missing required argument. */', `  protected override prepare(): ${result}<${factory}<${product}>, ${errorsType}> {`);
  params.forEach((_parameter, index) => { lines.push(`    const arg${index} = this.#arg${index};`); });
  if (required.length) {
    lines.push(`    if (${required.map(parameter => `!arg${parameter.index}.set`).join(' || ')}) {`, '      const errors = [];');
    for (const parameter of required) {
      lines.push(`      if (!arg${parameter.index}.set) errors.push(${problem}(${JSON.stringify(`Required constructor argument: ${parameter.name}.`)}, [${JSON.stringify(parameter.name)}]));`);
    }
    lines.push(`      return ${fail}(errors);`, '    }');
  }
  const args = params.map((parameter, index) => parameter.required ? `arg${index}.value` : `arg${index}.set ? arg${index}.value : undefined`);
  lines.push(`    return ${success}(() => new ${product}(${args.join(', ')}));`, '  }', '}', '');
  return lines.join('\n');
}

/** Source generator emitting complete validated builders from HasBuilder classes. */
@ParticipatesIn(BuilderFeatures.Generation)
export class BuilderGenerator implements SourceGenerator {
  readonly id = producerId;

  /** @param context Consumer AST and the pipeline-owned virtual output filesystem. */
  async execute(context: GenerationContext): Promise<GenerationResult> {
    const diagnostics: Diagnostic[] = [];
    const sources = context.project.getSourceFiles().sort((a, b) => a.getFilePath().localeCompare(b.getFilePath(), 'en'));
    const root = path.resolve(context.project.getCompilerOptions().rootDir ?? path.join(context.consumerPackageRoot, 'src'));
    const emissions: { relPath: string; contents: string }[] = [];
    const paths = new Set<string>();
    for (const source of sources) {
      const relative = path.relative(root, source.getFilePath());
      if (source.isDeclarationFile() || source.getFilePath().endsWith('.generated.ts') || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) continue;
      for (const cls of source.getClasses()) {
        const markers = cls.getDecorators().filter(isHasBuilder);
        if (markers.length === 0) continue;
        if (markers.length !== 1) {
          diagnostics.push(diagnostic(cls, 'BG003', 'HasBuilder may only decorate a class once.'));
          continue;
        }
        const params = parameters(cls, diagnostics);
        if (params === undefined) continue;
        const named = builderName(cls, markers[0]!);
        if (named.isFailure) { diagnostics.push(named.error); continue; }
        const name = named.value;
        const modulePath = relative.replace(/\.(?:[cm]?ts|tsx)$/, '');
        const relPath = path.join(modulePath, `${name}.generated.ts`).replace(/\\/g, '/');
        if (Array.from(paths).some(existing => existing.localeCompare(relPath, 'en', { sensitivity: 'accent' }) === 0)) {
          diagnostics.push(diagnostic(cls, 'BG004', `Duplicate generated path: ${relPath}.`));
          continue;
        }
        paths.add(relPath);
        let importPath = path.relative(path.dirname(path.join(context.outDir, relPath)), source.getFilePath()).replace(/\\/g, '/').replace(/\.mts$/, '.mjs').replace(/\.cts$/, '.cjs').replace(/\.(?:ts|tsx)$/, '.js');
        if (!importPath.startsWith('.')) importPath = `./${importPath}`;
        // TextEncoder explicitly produces UTF-8 bytes; no default encoding participates in the fingerprint.
        const origin = { source: path.relative(path.dirname(path.join(context.outDir, relPath)), source.getFilePath()).replace(/\\/g, '/'), start: cls.getStartLineNumber(), end: cls.getEndLineNumber(), sourceHash: createHash('sha256').update(new TextEncoder().encode(source.getFullText())).digest('hex'), generator: '@frenchexdev2/builder/generator' };
        const body = emit(cls, name, params, importPath);
        const annotated = `// @rac-generated ${JSON.stringify(origin)}\n${body.replace('export class ', '// @rac-feature BUILDER-GENERATION\nexport class ')}`;
        emissions.push({ relPath, contents: withBanner(annotated, { producerId }) });
      }
    }
    if (diagnostics.length) return { emittedSomething: false, diagnostics };
    let emittedSomething = false;
    for (const emission of emissions) {
      const result = context.virtFs.addSource({ ...emission, producerId });
      diagnostics.push(...(result.diagnostics ?? []));
      emittedSomething ||= result.newOrChanged;
    }
    return { emittedSomething, diagnostics };
  }
}
