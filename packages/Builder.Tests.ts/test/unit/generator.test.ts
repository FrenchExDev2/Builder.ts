import {builderSourceDirectory} from '../package-paths.js';
const testedSource=await builderSourceDirectory();
import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { BuilderGenerationFeature } from '@frenchexdev2/builder-requirements';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';
import ts from 'typescript';
import * as runtime from '@frenchexdev2/builder';
import * as results from '@frenchexdev2/result';
import type { GenerationContext } from '@frenchexdev2/ts-codegen-pipeline';
import { BuilderGenerator } from '@frenchexdev2/builder/generator';

/** Runs the generator against a fresh virtual consumer without executing model code. */
async function generate(source: string, configure?: (context: GenerationContext) => void, explicitRoot = true) {
  const root = path.join(process.cwd(), 'test-results/virtual-consumer');
  const project = new Project({ useInMemoryFileSystem: true, skipLoadingLibFiles: true, compilerOptions: explicitRoot ? { rootDir: path.join(root, 'src') } : {} });
  project.createSourceFile(path.join(root, 'src/models/user.ts'), source);
  const emitted = new Map<string, string>();
  const context: GenerationContext = {
    project, consumerPackageRoot: root, outDir: path.join(root, 'src/generated'), iteration: 0,
    delta: { emittedSinceStart: [], emittedLastIteration: [], filterEmittedSince: () => [] },
    logger: { info: () => {}, warn: () => {} },
    virtFs: {
      has: file => emitted.has(file), read: file => emitted.get(file)!, listEmitted: () => [],
      addSource: file => {
        const newOrChanged = emitted.get(file.relPath) !== file.contents;
        emitted.set(file.relPath, file.contents);
        return { newOrChanged };
      },
    },
  };
  configure?.(context);
  const generator = new BuilderGenerator();
  const result = await generator.execute(context);
  return { result, emitted, context, rerun: () => generator.execute(context) };
}

/** Evaluates the actual emitted JavaScript, resolving imports to the tested runtime. */
function evaluate(source: string, product?: object): Record<string, any> {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  expect(compiled.diagnostics).toEqual([]);
  const exports = {};
  const resolve = (specifier: string) => {
    if (specifier === '@frenchexdev2/builder') return runtime;
    if (specifier === '@frenchexdev2/result') return results;
    if (specifier.endsWith('/user.js')) return product;
    throw new Error(`Unexpected generated import: ${specifier}`);
  };
  new Function('require', 'exports', compiled.outputText)(resolve, exports);
  return exports;
}

/** Typechecks virtual companions with real installed package declarations and TypeScript libs. */
function typecheck(context: GenerationContext, emitted: Map<string, string>, contract = '') {
  const files = new Map(context.project.getSourceFiles().map(file => [path.normalize(file.getFilePath()), file.getFullText()]));
  for (const [relative, text] of emitted) files.set(path.join(context.outDir, relative), text);
  files.set(path.join(context.consumerPackageRoot, 'src/contract.ts'), contract);
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true, exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true,
    noUnusedLocals: true, noUnusedParameters: true, noEmit: true, skipLibCheck: true, types: [],
    baseUrl: process.cwd(), paths: { '@frenchexdev2/builder': [testedSource+'index.ts'] }, ignoreDeprecations: "6.0" as ts.CompilerOptions["ignoreDeprecations"],
  };
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host), exists = host.fileExists.bind(host), directory = host.directoryExists!.bind(host);
  host.readFile = file => files.get(path.normalize(file)) ?? read(file);
  host.fileExists = file => files.has(path.normalize(file)) || exists(file);
  host.directoryExists = dir => [...files.keys()].some(file => file.startsWith(path.normalize(dir) + path.sep)) || directory(dir);
  host.getSourceFile = (file, languageVersion) => {
    const text = host.readFile(file);
    return text === undefined ? undefined : ts.createSourceFile(file, text, languageVersion, true);
  };
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([...files.keys()], options, host));
  if (diagnostics.length) throw new Error(diagnostics.map(item => `${item.file?.fileName}: ${ts.flattenDiagnosticMessageText(item.messageText, '\n')}`).join('\n'));
}

describe('BuilderGenerator', () => {
  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase1 {
  @Verifies<BuilderGenerationFeature>('recognizesBoundPackageDecoratorsS')
  async verify(binding: any, marker: any) {
    const { result, emitted, rerun } = await generate(`${binding}
      const validators = [() => { throw new Error('Model code must not run'); }];
      @${marker}<User>({ name: 'UserBuilder', validators: validators })
      export class User { constructor(public readonly name: string) {} }
    `);
    expect(result.diagnostics).toEqual([]);
    expect([...emitted.keys()]).toEqual(['models/user/UserBuilder.generated.ts']);
    const generatedText=emitted.get('models/user/UserBuilder.generated.ts')!;
    const origin=JSON.parse(generatedText.split('\n').find(line=>line.startsWith('// @rac-generated '))!.slice('// @rac-generated '.length));
    expect(origin.source).toBe('../../../models/user.ts');
    expect(origin.generator).toBe('@frenchexdev2/builder/generator');
    expect(origin.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(origin.start).toBeGreaterThan(0);
    expect(origin.end).toBeGreaterThanOrEqual(origin.start);
    expect(generatedText).toContain('// @rac-feature BUILDER-GENERATION');
    expect((await rerun()).emittedSomething).toBe(false);
  }
}
it.each([
    ["import { HasBuilder } from '@frenchexdev2/builder';", 'HasBuilder'],
    ["import { HasBuilder as Build } from '@frenchexdev2/builder';", 'Build'],
    ["import * as Builders from '@frenchexdev2/builder';", 'Builders.HasBuilder'],
  ])('recognizes bound package decorators (%s)', new generatortesttsCase1().verify.bind(new generatortesttsCase1()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase2 {
  @Verifies<BuilderGenerationFeature>('doesNotConfuseAnUnrelatedSameNamedDecoratorWithThePackageExport')
  async verify() {
    const { result, emitted } = await generate(`
      import { HasBuilder } from 'another-package';
      @HasBuilder() export class User { constructor(public name: string) {} }
    `);
    expect(result.diagnostics).toEqual([]);
    expect(emitted.size).toBe(0);
  }
}
it('does not confuse an unrelated same-named decorator with the package export', new generatortesttsCase2().verify.bind(new generatortesttsCase2()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase3 {
  @Verifies<BuilderGenerationFeature>('supportsTheDefaultNameAndArgumentFreeClasses')
  async verify() {
    const { result, emitted } = await generate(`import { HasBuilder } from '@frenchexdev2/builder';
      @HasBuilder() export class Empty { readonly category = 'empty'; }
    `);
    expect(result.diagnostics).toEqual([]);
    expect([...emitted.keys()]).toEqual(['models/user/EmptyBuilder.generated.ts']);
  }
}
it('supports the default name and argument-free classes', new generatortesttsCase3().verify.bind(new generatortesttsCase3()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase4 {
  @Verifies<BuilderGenerationFeature>('rejectsIndirectRenamedExportsRatherThanEmittingAnInvalidNamedImport')
  async verify() {
    const { result, emitted } = await generate(`import { HasBuilder } from '@frenchexdev2/builder';
      @HasBuilder() class User {} export { User as PublicUser };
    `);
    expect(result.diagnostics.map(item => item.code)).toContain('BG001');
    expect(emitted.size).toBe(0);
  }
}
it('rejects indirect renamed exports rather than emitting an invalid named import', new generatortesttsCase4().verify.bind(new generatortesttsCase4()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase5 {
  @Verifies<BuilderGenerationFeature>('diagnosesUnsupportedDeclarationsBeforeEmittingS')
  async verify(declaration: any, code: any) {
    const { result, emitted } = await generate(`import { HasBuilder } from '@frenchexdev2/builder';
      @HasBuilder() export ${declaration}
    `);
    expect(result.diagnostics.map(item => item.code)).toContain(code);
    expect(result.diagnostics[0]?.start?.line).toBeGreaterThan(0);
    expect(emitted.size).toBe(0);
  }
}
it.each([
    ['abstract class User {}', 'BG001'],
    ['class User<T> {}', 'BG001'],
    ['default class User {}', 'BG001'],
    ['class User { private constructor() {} }', 'BG002'],
    ['class User { protected constructor() {} }', 'BG002'],
    ['class User { constructor(name: string); constructor(name: unknown) {} }', 'BG002'],
    ['class User { constructor(...names: string[]) {} }', 'BG002'],
    ['class User { constructor({ name }: {name: string}) {} }', 'BG002'],
    ['class User extends Date {}', 'BG002'],
    ['class User { constructor(validation: string) {} }', 'BG004'],
    ['class User { constructor(name: string, Name: string) {} }', 'BG004'],
  ])('diagnoses unsupported declarations before emitting: %s', new generatortesttsCase5().verify.bind(new generatortesttsCase5()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase6 {
  @Verifies<BuilderGenerationFeature>('rejectsUnsupportedDecoratorOptionsS')
  async verify(options: any) {
    const { result, emitted } = await generate(`import { HasBuilder } from '@frenchexdev2/builder';
      @HasBuilder(${options}) export class User {}
    `);
    expect(result.diagnostics.map(item => item.code)).toContain('BG003');
    expect(emitted.size).toBe(0);
  }
}
it.each(["{ name: '../Escaped' }", "{ name: 'class' }", "{ name: computed }", 'options', '{ ...options }'])('rejects unsupported decorator options: %s', new generatortesttsCase6().verify.bind(new generatortesttsCase6()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase7 {
  @Verifies<BuilderGenerationFeature>('diagnosesDuplicateClassAnnotations')
  async verify() {
    const { result } = await generate(`import { HasBuilder } from '@frenchexdev2/builder';
      @HasBuilder() @HasBuilder() export class User {}
    `);
    expect(result.diagnostics.map(item => item.code)).toContain('BG003');
  }
}
it('diagnoses duplicate class annotations', new generatortesttsCase7().verify.bind(new generatortesttsCase7()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase8 {
  @Verifies<BuilderGenerationFeature>('diagnosesDuplicateOutputPathsInsteadOfReplacingADifferentClass')
  async verify() {
    const { result, emitted } = await generate(`import { HasBuilder } from '@frenchexdev2/builder';
      @HasBuilder({ name: 'Shared' }) export class First {}
      @HasBuilder({ name: 'shared' }) export class Second {}
    `);
    expect(result.diagnostics.map(item => item.code)).toContain('BG004');
    expect(emitted.size).toBe(0);
  }
}
it('diagnoses duplicate output paths instead of replacing a different class', new generatortesttsCase8().verify.bind(new generatortesttsCase8()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase9 {
  @Verifies<BuilderGenerationFeature>('executesEmittedSettersRequiredSlotsDefaultsValidationAndLifecycleOnRealInstances')
  async verify() {
    const source = `import { HasBuilder } from '@frenchexdev2/builder';
      @HasBuilder() export class User {
        static constructions = 0;
        readonly category = 'user';
        constructor(public readonly name: string, public readonly maybe: string | undefined,
          public readonly role = 'reader', public readonly nickname?: string) { User.constructions++; }
        greet(): string { return 'Hello ' + this.name; }
      }`;
    const { result, emitted, context } = await generate(source);
    expect(result).toEqual({ emittedSomething: true, diagnostics: [] });
    const product = evaluate(source);
    const text = [...emitted.values()][0]!;
    const { UserBuilder } = evaluate(text, product);
    const builder = new UserBuilder();
    const missing = await builder.BuildAsync();
    expect(missing.error).toEqual([
      { errorMessage: 'Required constructor argument: name.', memberNames: ['name'] },
      { errorMessage: 'Required constructor argument: maybe.', memberNames: ['maybe'] },
    ]);
    expect(product.User.constructions).toBe(0);
    expect(builder.withName('Alice')).toBe(builder);
    expect((await builder.BuildAsync()).error).toEqual([{ errorMessage: 'Required constructor argument: maybe.', memberNames: ['maybe'] }]);
    expect((await new UserBuilder().withMaybe(undefined).BuildAsync()).error).toEqual([{ errorMessage: 'Required constructor argument: name.', memberNames: ['name'] }]);
    expect(builder.withMaybe(undefined)).toBe(builder);
    const pending = builder.BuildAsync();
    expect(() => builder.withRole('admin')).toThrow('Cannot configure');
    const built = await pending;
    expect(built.value).toBeInstanceOf(product.User);
    expect(built.value.greet()).toBe('Hello Alice');
    expect(built.value).toMatchObject({ name: 'Alice', maybe: undefined, role: 'reader', nickname: undefined });
    expect(await builder.buildAsync()).toBe(built);
    expect(product.User.constructions).toBe(1);
    expect(() => builder.withNickname('changed')).toThrow('Cannot configure');
    const custom = new UserBuilder().withName('Bob').withMaybe('value').withRole('writer').withNickname('B');
    expect((await custom.BuildAsync()).value).toMatchObject({ name: 'Bob', maybe: 'value', role: 'writer', nickname: 'B' });
    const failed = await new UserBuilder().withName('Bad').withMaybe(undefined)
      .withValidation(() => results.validationFailure(results.validationError('Business rule', ['name']))).BuildAsync();
    expect(failed.error).toEqual([{ errorMessage: 'Business rule', memberNames: ['name'] }]);
    const ast = context.project.createSourceFile(path.join(context.outDir, [...emitted.keys()][0]!), text);
    const generated = ast.getClassOrThrow('UserBuilder');
    expect(generated.getJsDocs().map(doc => doc.getDescription().trim())).toEqual(['Generated fluent constructor for User.']);
    expect(generated.getConstructors()[0]!.getJsDocs().map(doc => doc.getDescription().trim())).toEqual(['Associates the product class and its declared validation rules.']);
    for (const [method, argument] of [['withName', 'name'], ['withMaybe', 'maybe'], ['withRole', 'role'], ['withNickname', 'nickname']]) {
      const setter = generated.getMethodOrThrow(method!);
      expect(setter.getReturnTypeNodeOrThrow().getText()).toBe('this');
      expect(setter.getJsDocs()[0]!.getTags()[0]!.getText().trim()).toBe(`@param value Constructor argument ${argument}.`);
    }
    expect(generated.getMethodOrThrow('prepare').getJsDocs().map(doc => doc.getDescription().trim())).toEqual(['Captures the supplied arguments and reports every missing required argument.']);
    expect(text).toMatch(/^\/\/ <auto-generated>\n/);
    expect(text).toContain('// producer: frenchexdev.builder  iteration: ');
    expect(text).toContain('contentHash: sha256:');
    typecheck(context, emitted, `
      import { UserBuilder } from './generated/models/user/UserBuilder.generated.js';
      import type { User } from './models/user.js';
      import type { Result, ValidationErrors } from '@frenchexdev2/result';
      const b = new UserBuilder().withName('A').withMaybe(undefined).withRole(undefined).withNickname(undefined);
      const exact: Promise<Result<User, ValidationErrors>> = b.BuildAsync(); void exact;
      // @ts-expect-error Required string setter rejects a number.
      b.withName(123);
      // @ts-expect-error Constructor-only generation excludes other fields.
      b.withCategory('other');
    `);
  }
}
it('executes emitted setters, required slots, defaults, validation and lifecycle on real instances', new generatortesttsCase9().verify.bind(new generatortesttsCase9()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase10 {
  @Verifies<BuilderGenerationFeature>('compilesEveryInternalLookingPublicNameWithoutCollisionsAndHandlesNonleadingRequiredSlots')
  async verify() {
    const names = ['__Product', '__ValidatedBuilder', '__ProductFactory', '__Result', '__ValidationErrors', '__success', '__validationFailure', '__validationError'];
    const source = `import { HasBuilder } from '@frenchexdev2/builder';
      @HasBuilder() export class Empty {}
      @HasBuilder() export class Optional { constructor(public readonly name?: string) {} }
      ${names.map((name, index) => `@HasBuilder({ name: '${name}' }) export class Product${index} {
        constructor(public readonly value = 42, public readonly label: string) {}
      }`).join('\n')}`;
    const { result, emitted, context } = await generate(source);
    expect(result.diagnostics).toEqual([]);
    typecheck(context, emitted);
    const product = evaluate(source);
    for (const text of emitted.values()) {
      const exports = evaluate(text, product);
      const [name] = Object.keys(exports);
      const b = new exports[name!]();
      if (names.includes(name!)) {
        expect((await b.BuildAsync()).error).toEqual([{ errorMessage: 'Required constructor argument: label.', memberNames: ['label'] }]);
        expect((await b.withLabel('set').BuildAsync()).value).toMatchObject({ value: 42, label: 'set' });
      } else if (name === 'OptionalBuilder') {
        expect((await b.BuildAsync()).value.name).toBeUndefined();
        expect((await new exports[name]().withName('set').BuildAsync()).value.name).toBe('set');
      } else expect((await b.BuildAsync()).value).toBeInstanceOf(product.Empty);
    }
  }
}
it('compiles every internal-looking public name without collisions and handles nonleading required slots', new generatortesttsCase10().verify.bind(new generatortesttsCase10()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase11 {
  @Verifies<BuilderGenerationFeature>('providesActionableSourceLocatedDiagnosticsForSS')
  async verify(marker: any, declaration: any, code: any, message: any) {
    const { result, emitted, context } = await generate(`import { HasBuilder } from '@frenchexdev2/builder';\n${marker} ${declaration}`);
    expect(result.emittedSomething).toBe(false);
    expect(emitted.size).toBe(0);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ severity: 'error', code, message, producerId: 'frenchexdev.builder', file: context.project.getSourceFiles()[0]!.getFilePath(), start: { line: 2 } });
    expect(result.diagnostics[0]!.start!.column).toBeGreaterThan(0);
  }
}
it.each([
    ['@HasBuilder', 'export class User {}', 'BG003', 'Use @HasBuilder() or @HasBuilder({ name, validators }).'],
    ['@HasBuilder({}, {})', 'export class User {}', 'BG003', 'Use @HasBuilder() or @HasBuilder({ name, validators }).'],
    ['@HasBuilder(options)', 'export class User {}', 'BG003', 'HasBuilder options must be an object literal.'],
    ['@HasBuilder({ other: 1 })', 'export class User {}', 'BG003', 'Only explicit name and validators properties are supported; spreads and computed options are unsupported.'],
    ['@HasBuilder({ name })', 'export class User {}', 'BG003', 'Only explicit name and validators properties are supported; spreads and computed options are unsupported.'],
    ['@HasBuilder({ ["name"]: "B" })', 'export class User {}', 'BG003', 'Only explicit name and validators properties are supported; spreads and computed options are unsupported.'],
    ['@HasBuilder({ name: 3 })', 'export class User {}', 'BG003', 'The builder name must be a string literal.'],
    ['@HasBuilder({ name: "Bad-name" })', 'export class User {}', 'BG003', 'Invalid builder class name: "Bad-name".'],
    ['@HasBuilder({ name: "class" })', 'export class User {}', 'BG003', 'Invalid builder class name: "class".'],
    ['@HasBuilder()', 'class User {}', 'BG001', 'HasBuilder requires a named, directly exported, concrete, non-generic class (no default or ambient exports).'],
    ['@HasBuilder()', 'export declare class User {}', 'BG001', 'HasBuilder requires a named, directly exported, concrete, non-generic class (no default or ambient exports).'],
    ['@HasBuilder()', 'export default class {}', 'BG001', 'HasBuilder requires a named, directly exported, concrete, non-generic class (no default or ambient exports).'],
    ['@HasBuilder()', 'export class User { private constructor() {} }', 'BG002', 'Use one public constructor without overloads; derived classes need an explicit constructor.'],
    ['@HasBuilder()', 'export class User { constructor(...args: string[]) {} }', 'BG002', 'Constructor parameters must be named identifiers; rest and destructuring are unsupported.'],
    ['@HasBuilder()', 'export class User { constructor(validation: string) {} }', 'BG004', 'Generated method withValidation conflicts with another setter or the builder API.'],
    ['@HasBuilder() @HasBuilder()', 'export class User {}', 'BG003', 'HasBuilder may only decorate a class once.'],
  ])('provides actionable source-located diagnostics for %s %s', new generatortesttsCase11().verify.bind(new generatortesttsCase11()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase12 {
  @Verifies<BuilderGenerationFeature>('rejectsInvalidIdentifierJ')
  async verify(name: any) {
    const { result } = await generate(`import { HasBuilder } from '@frenchexdev2/builder'; @HasBuilder({ name: '${name}' }) export class User {}`);
    expect(result.diagnostics[0]?.code).toBe('BG003');
  }
}
it.each(['', '1Builder', 'Builder!', 'A\\nB', 'while'])('rejects invalid identifier %j', new generatortesttsCase12().verify.bind(new generatortesttsCase12()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase13 {
  @Verifies<BuilderGenerationFeature>('acceptsExplicitQuotedOptionsS')
  async verify(options: any) {
    const { result, emitted } = await generate(`import { HasBuilder } from '@frenchexdev2/builder'; @HasBuilder(${options}) export class User {}`);
    expect(result.diagnostics).toEqual([]);
    expect(emitted.size).toBe(1);
    const name = options.includes('Équipe') ? 'Équipe_$1' : options.includes('Builder') ? 'Builder' : 'UserBuilder';
    expect([...emitted.keys()]).toEqual([`models/user/${name}.generated.ts`]);
  }
}
it.each(["{ 'name': 'Équipe_$1' }", '{ "name": "Builder" }', String.raw`{ "na\u006de": "Builder" }`, "{ 'validators': rules }", '{ "validators": rules }'])('accepts explicit quoted options %s', new generatortesttsCase13().verify.bind(new generatortesttsCase13()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase14 {
  @Verifies<BuilderGenerationFeature>('ignoresDecoratorsWithoutThePackageBindingS')
  async verify(prefix: any) {
    const { result, emitted } = await generate(`${prefix} export class User {}`);
    expect(result).toEqual({ emittedSomething: false, diagnostics: [] });
    expect(emitted.size).toBe(0);
  }
}
it.each([
    `import * as Builders from 'another-package'; @Builders.HasBuilder()`,
    `import * as Builders from '@frenchexdev2/builder'; @Builders.Other()`,
    `import { Other as HasBuilder } from '@frenchexdev2/builder'; @HasBuilder()`,
    `import Builders from '@frenchexdev2/builder'; @Builders.HasBuilder()`,
    `const HasBuilder = () => {}; @HasBuilder()`,
    `const Builders = { HasBuilder() {} }; @Builders.HasBuilder()`,
    `@Unknown()`, `@Unknown.HasBuilder()`, `@(factory())`,
  ])('ignores decorators without the package binding: %s', new generatortesttsCase14().verify.bind(new generatortesttsCase14()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase15 {
  @Verifies<BuilderGenerationFeature>('ordersSourceEmissionsDeterministicallyAndPreservesChangesReportedByAnyOutput')
  async verify() {
    const source = `import { HasBuilder } from '@frenchexdev2/builder'; @HasBuilder() export class User {}`;
    const { result, emitted, context, rerun } = await generate(source, context => {
      context.project.createSourceFile(path.join(context.consumerPackageRoot, 'src/z.ts'), source.replace('User', 'Z'));
      context.project.createSourceFile(path.join(context.consumerPackageRoot, 'src/a.ts'), source.replace('User', 'A'));
    });
    expect(result.emittedSomething).toBe(true);
    expect([...emitted.keys()]).toEqual(['a/ABuilder.generated.ts', 'models/user/UserBuilder.generated.ts', 'z/ZBuilder.generated.ts']);
    expect((await rerun()).emittedSomething).toBe(false);
    context.project.getSourceFileOrThrow('a.ts').getClassOrThrow('A').addConstructor({ parameters: [{ name: 'changed', type: 'string' }] });
    expect((await rerun()).emittedSomething).toBe(true);
    expect(new BuilderGenerator().id).toBe('frenchexdev.builder');
  }
}
it('orders source emissions deterministically and preserves changes reported by any output', new generatortesttsCase15().verify.bind(new generatortesttsCase15()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase16 {
  @Verifies<BuilderGenerationFeature>('propagatesOutputDiagnosticsAndNeverShortCircuitsLaterOutputWrites')
  async verify() {
    const failure = { severity: 'error' as const, producerId: 'frenchexdev.builder', code: 'SG0010', message: 'Manually edited companion.' };
    const calls: string[] = [];
    const { result } = await generate(`import { HasBuilder } from '@frenchexdev2/builder'; @HasBuilder() export class A {} @HasBuilder() export class B {}`, context => {
      context.virtFs.addSource = file => { calls.push(file.relPath); return { newOrChanged: true, diagnostics: [failure] }; };
    });
    expect(calls).toEqual(['models/user/ABuilder.generated.ts', 'models/user/BBuilder.generated.ts']);
    expect(result).toEqual({ emittedSomething: true, diagnostics: [failure, failure] });
  }
}
it('propagates output diagnostics and never short-circuits later output writes', new generatortesttsCase16().verify.bind(new generatortesttsCase16()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase17 {
  @Verifies<BuilderGenerationFeature>('skipsDeclarationsGeneratedCompanionsAndSourcesOutsideTheConfiguredRoot')
  async verify() {
    const source = `import { HasBuilder } from '@frenchexdev2/builder'; @HasBuilder() export class User {}`;
    const { result, emitted } = await generate(source, context => {
      context.project.removeSourceFile(context.project.getSourceFiles()[0]!);
      for (const file of ['src/ignored.d.ts', 'src/model.generated.ts', 'external/model.ts', '../outside/model.ts']) {
        context.project.createSourceFile(path.resolve(context.consumerPackageRoot, file), source);
      }
      if (process.platform === 'win32') {
        const drive = path.parse(context.consumerPackageRoot).root[0] === 'Z' ? 'Y' : 'Z';
        context.project.createSourceFile(`${drive}:/external/model.ts`, source);
      }
    });
    expect(result).toEqual({ emittedSomething: false, diagnostics: [] });
    expect(emitted.size).toBe(0);
  }
}
it('skips declarations, generated companions and sources outside the configured root', new generatortesttsCase17().verify.bind(new generatortesttsCase17()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase18 {
  @Verifies<BuilderGenerationFeature>('usesModuleExtensionSCorrectlyAndAnchorsExtensionReplacementToTheFilename')
  async verify(extension: any) {
    const source = `import { HasBuilder } from '@frenchexdev2/builder'; @HasBuilder() export class User {}`;
    const { result, emitted } = await generate(source, context => {
      context.project.removeSourceFile(context.project.getSourceFiles()[0]!);
      context.project.createSourceFile(path.join(context.consumerPackageRoot, `src/folder.${extension}/user.${extension}`), source);
    });
    expect(result.diagnostics).toEqual([]);
    expect([...emitted.keys()]).toEqual([`folder.${extension}/user/UserBuilder.generated.ts`]);
    const code = [...emitted.values()][0]!;
    const ast = ts.createSourceFile('generated.ts', code, ts.ScriptTarget.Latest, true);
    const first = ast.statements[0] as ts.ImportDeclaration;
    expect((first.moduleSpecifier as ts.StringLiteral).text).toBe(`../../../folder.${extension}/user.${extension === 'mts' ? 'mjs' : extension === 'cts' ? 'cjs' : 'js'}`);
  }
}
it.each(['ts', 'tsx', 'mts', 'cts'])('uses module extension .%s correctly and anchors extension replacement to the filename', new generatortesttsCase18().verify.bind(new generatortesttsCase18()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase19 {
  @Verifies<BuilderGenerationFeature>('defaultsRootDirToSrcAndPrefixesSameDirectoryImportsWith')
  async verify() {
    const { result, emitted } = await generate(`import { HasBuilder } from '@frenchexdev2/builder'; @HasBuilder() export class User {}`, context => {
      const source = context.project.getSourceFiles()[0]!.getFullText();
      context.project.removeSourceFile(context.project.getSourceFiles()[0]!);
      context.project.createSourceFile(path.join(context.consumerPackageRoot, 'src/src.ts'), source);
      (context as { outDir: string }).outDir = context.consumerPackageRoot;
    }, false);
    expect(result.diagnostics).toEqual([]);
    expect([...emitted.keys()]).toEqual(['src/UserBuilder.generated.ts']);
    expect([...emitted.values()][0]).toContain('from "./src.js";');
  }
}
it('defaults rootDir to src and prefixes same-directory imports with ./', new generatortesttsCase19().verify.bind(new generatortesttsCase19()));

  
@FeatureTest(BuilderGenerationFeature)
class generatortesttsCase20 {
  @Verifies<BuilderGenerationFeature>('reportsTheCollidingOutputPathWithoutWritingPreviouslyValidEmissions')
  async verify() {
    const { result, emitted } = await generate(`import { HasBuilder } from '@frenchexdev2/builder';
      @HasBuilder({name: 'Shared'}) export class First {}
      @HasBuilder({name: 'shared'}) export class Second {}`);
    expect(result).toMatchObject({ emittedSomething: false, diagnostics: [{ severity: 'error', producerId: 'frenchexdev.builder', code: 'BG004', message: 'Duplicate generated path: models/user/shared.generated.ts.' }] });
    expect(emitted.size).toBe(0);
  }
}
it('reports the colliding output path without writing previously valid emissions', new generatortesttsCase20().verify.bind(new generatortesttsCase20()));
});
