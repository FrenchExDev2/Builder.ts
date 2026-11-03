import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { BuilderGenerationFeature } from '@frenchexdev2/builder-requirements';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {tmpdir} from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import ts from 'typescript';
import { runFixpoint, type SourceGenConfig } from '@frenchexdev2/ts-codegen-pipeline';
import { BuilderGenerator } from '@frenchexdev2/builder/generator';
import { validationError, validationFailure } from '@frenchexdev2/result';

const fixturePrefix = path.join(tmpdir(), 'builder-sourcegen-');
const fixtures: string[] = [];

afterEach(async () => {
  for (const directory of fixtures.splice(0)) {
    if (!path.resolve(directory).startsWith(fixturePrefix)) throw new Error('Unsafe fixture cleanup path.');
    await fs.rm(directory, { recursive: true, force: true });
  }
});

/** Prepares a consumer with no generated source and only explicit local package links. */
async function consumer(source: string): Promise<{ directory: string; config: SourceGenConfig }> {
  const directory = await fs.mkdtemp(fixturePrefix);
  fixtures.push(directory);
  await fs.mkdir(path.join(directory, 'src'), { recursive: true });
  await fs.mkdir(path.join(directory, 'node_modules', '@frenchexdev2'), { recursive: true });
  await fs.symlink(fileURLToPath(new URL('../', import.meta.resolve('@frenchexdev2/builder'))), path.join(directory, 'node_modules', '@frenchexdev2', 'builder'), 'junction');
  await fs.symlink(fileURLToPath(new URL('../', import.meta.resolve('@frenchexdev2/result'))), path.join(directory, 'node_modules', '@frenchexdev2', 'result'), 'junction');
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'builder-consumer-fixture', type: 'module' }), 'utf8');
  await fs.writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
      exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, noUnusedLocals: true,
      noUnusedParameters: true, verbatimModuleSyntax: true, noEmitOnError: true,
      rootDir: 'src', outDir: 'dist', types: [], lib: ['ES2022', 'DOM'],
    }, include: ['src/**/*.ts'],
  }), 'utf8');
  await fs.writeFile(path.join(directory, 'src', 'user.ts'), source, 'utf8');
  return {
    directory,
    config: { consumerPackageRoot: directory, tsconfigPath: './tsconfig.json', outDir: 'src/generated', generators: [new BuilderGenerator()] },
  };
}

/** Uses the real TypeScript compiler API; no unwrapped subprocess is launched by tests. */
async function compile(directory: string): Promise<void> {
  const configPath = path.join(directory, 'tsconfig.json');
  const loaded = ts.parseConfigFileTextToJson(configPath, await fs.readFile(configPath, 'utf8'));
  const config = ts.parseJsonConfigFileContent(loaded.config, ts.sys, directory);
  const program = ts.createProgram(config.fileNames, config.options);
  const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => directory, getNewLine: () => '\n',
  }));
  expect(program.emit().emitSkipped).toBe(false);
}

describe('generation pipeline', () => {
  
@FeatureTest(BuilderGenerationFeature)
class generationConsumerCase1 {
 @Verifies<BuilderGenerationFeature>('compilesAndExecutesConsumerWithClassValidation')
 async verify() {
    const { directory, config } = await consumer(`
      import { HasBuilder as AutoBuilder } from '@frenchexdev2/builder';
      import { success, validationError, validationFailure, type Result, type ValidationErrors } from '@frenchexdev2/result';
      export const constructorError = new Error('Constructor failed');
      function validateUser(user: Readonly<User>): Result<void, ValidationErrors> {
        return user.name === 'bad' ? validationFailure(validationError('Invalid name', ['name'])) : success();
      }
      @AutoBuilder<User>({ validators: [validateUser] })
      export class User {
        static constructions = 0;
        readonly category = 'user';
        constructor(public readonly name: string, public readonly maybe: string | undefined,
          public readonly role = 'reader', public readonly nickname?: string) {
          User.constructions++;
          if (name === 'explode') throw constructorError;
        }
        greet(): string { return 'Hello ' + this.name; }
      }
    `);
    expect(await fs.readdir(path.join(directory, 'src'))).toEqual(['user.ts']);
    expect((await runFixpoint(config)).ok).toBe(true);
    const generated = path.join(directory, 'src/generated/user/UserBuilder.generated.ts');
    const contents = await fs.readFile(generated, 'utf8');
    expect(contents).toContain('// @rac-generated ');
    expect(contents).toContain('BUILDER-GENERATION');
    const origin = JSON.parse(contents.split('\n').find(line => line.startsWith('// @rac-generated '))!.slice('// @rac-generated '.length));
    expect(origin.source).toBe('../../user.ts');
    expect(origin.generator).toBe('@frenchexdev2/builder/generator');
    expect(origin.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(origin.start).toBeGreaterThan(0);
    expect(origin.end).toBeGreaterThanOrEqual(origin.start);
    expect((await runFixpoint(config)).ok).toBe(true);
    expect(await fs.readFile(generated, 'utf8')).toBe(contents);
    expect((await runFixpoint(config, { verifyOnly: true })).ok).toBe(true);
    await fs.writeFile(path.join(directory, 'src', 'type-contract.ts'), `
      import { UserBuilder } from './generated/user/UserBuilder.generated.js';
      import type { User } from './user.js';
      import { success, type Result, type ValidationErrors } from '@frenchexdev2/result';
      const builder = new UserBuilder().withName('Alice').withMaybe(undefined).withRole(undefined).withNickname('Al');
      const result: Promise<Result<User, ValidationErrors>> = builder.BuildAsync();
      const alias: Promise<Result<User, ValidationErrors>> = builder.buildAsync();
      void result; void alias;
      builder.withValidation(user => { const name: string = user.name; void name; return success(); });
      // @ts-expect-error Constructor argument type must be preserved.
      builder.withName(123);
      // @ts-expect-error Properties outside the constructor do not generate setters.
      builder.withCategory('other');
      // @ts-expect-error Domain errors must be ValidationErrors, not strings.
      builder.withValidation(() => ({ isSuccess: false, isFailure: true, error: 'wrong' }));
    `, 'utf8');
    await compile(directory);
    const { User, constructorError } = await import(pathToFileURL(path.join(directory, 'dist/user.js')).href);
    const { UserBuilder } = await import(pathToFileURL(path.join(directory, 'dist/generated/user/UserBuilder.generated.js')).href);
    const missing = await new UserBuilder().BuildAsync();
    expect(missing.isFailure).toBe(true);
    expect(missing.error.flatMap((error: { memberNames: readonly string[] }) => error.memberNames)).toEqual(['name', 'maybe']);
    expect(User.constructions).toBe(0);
    const builder = new UserBuilder().withName('Alice').withMaybe(undefined);
    const built = await builder.BuildAsync();
    expect(built.value).toBeInstanceOf(User);
    expect(built.value.greet()).toBe('Hello Alice');
    expect(built.value.role).toBe('reader');
    expect(built.value.nickname).toBeUndefined();
    expect(built.value.maybe).toBeUndefined();
    expect(await builder.buildAsync()).toBe(built);
    expect(() => builder.withName('Changed')).toThrow('Cannot configure');
    const failure = await new UserBuilder().withName('bad').withMaybe(undefined)
      .withValidation(async () => validationFailure(validationError('Extra rule', ['role']))).BuildAsync();
    expect(failure.error.map((error: { errorMessage: string }) => error.errorMessage)).toEqual(['Invalid name', 'Extra rule']);
    await expect(new UserBuilder().withName('explode').withMaybe(undefined).BuildAsync()).rejects.toBe(constructorError);
  }
}
it('generates, typechecks, compiles and executes a clean consumer with real class validation', new generationConsumerCase1().verify.bind(new generationConsumerCase1()), 60_000);

  
@FeatureTest(BuilderGenerationFeature)
class generationConsumerCase2 {
 @Verifies<BuilderGenerationFeature>('preservesConstructorTypesDefaultsAndInternalNames')
 async verify() {
    const { directory, config } = await consumer(`
      import { HasBuilder } from '@frenchexdev2/builder';
      @HasBuilder() export class Empty { readonly category = 'empty'; }
      @HasBuilder({ name: '__Product' }) export class Optional { constructor(public readonly name?: string) {} }
      @HasBuilder() export class Defaults { constructor(public readonly value = 42, public readonly label: string) {} }
    `);
    expect((await runFixpoint(config)).ok).toBe(true);
    await compile(directory);
    const { EmptyBuilder } = await import(pathToFileURL(path.join(directory, 'dist/generated/user/EmptyBuilder.generated.js')).href);
    expect((await new EmptyBuilder().BuildAsync()).value.category).toBe('empty');
    const { __Product } = await import(pathToFileURL(path.join(directory, 'dist/generated/user/__Product.generated.js')).href);
    expect((await new __Product().BuildAsync()).value.name).toBeUndefined();
    const { DefaultsBuilder } = await import(pathToFileURL(path.join(directory, 'dist/generated/user/DefaultsBuilder.generated.js')).href);
    expect((await new DefaultsBuilder().withLabel('default').BuildAsync()).value.value).toBe(42);
  }
}
it('compiles zero-argument classes, optional-only constructors, defaults before required arguments and internal-looking builder names', new generationConsumerCase2().verify.bind(new generationConsumerCase2()), 60_000);

  
@FeatureTest(BuilderGenerationFeature)
class generationtesttsCase1 {
  @Verifies<BuilderGenerationFeature>('reportsHandEditedOutputsWithoutChangingThemInVerificationMode')
  async verify() {
    const { directory, config } = await consumer("import { HasBuilder } from '@frenchexdev2/builder'; @HasBuilder() export class User {}");
    expect((await runFixpoint(config)).ok).toBe(true);
    const file = path.join(directory, 'src/generated/user/UserBuilder.generated.ts');
    const edited = (await fs.readFile(file, 'utf8')) + '\n// manual edit\n';
    await fs.writeFile(file, edited, 'utf8');
    const outcome = await runFixpoint(config, { verifyOnly: true });
    expect(outcome.ok).toBe(false);
    expect(outcome.diagnostics.some(item => item.code === 'SG0010')).toBe(true);
    expect(await fs.readFile(file, 'utf8')).toBe(edited);
  }
}
it('reports hand-edited outputs without changing them in verification mode', new generationtesttsCase1().verify.bind(new generationtesttsCase1()));

  
@FeatureTest(BuilderGenerationFeature)
class generationtesttsCase2 {
  @Verifies<BuilderGenerationFeature>('doesNotWriteAValidCompanionWhenAnotherClassHasAnUnsupportedConstructor')
  async verify() {
    const { directory, config } = await consumer(`
      import { HasBuilder } from '@frenchexdev2/builder';
      @HasBuilder() export class Valid {}
      @HasBuilder() export class Invalid { private constructor() {} }
    `);
    const outcome = await runFixpoint(config);
    expect(outcome.ok).toBe(false);
    expect(outcome.diagnostics.some(item => item.code === 'BG002')).toBe(true);
    await expect(fs.stat(path.join(directory, 'src/generated'))).rejects.toMatchObject({ code: 'ENOENT' });
  }
}
it('does not write a valid companion when another class has an unsupported constructor', new generationtesttsCase2().verify.bind(new generationtesttsCase2()));
});
