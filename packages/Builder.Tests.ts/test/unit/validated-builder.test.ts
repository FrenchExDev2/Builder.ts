import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { BuilderValidationFeature } from '@frenchexdev2/builder-requirements';
import { describe, expect, it, vi } from 'vitest';
import { success, validationError, validationFailure, type Result, type ValidationErrors } from '@frenchexdev2/result';
import { HasBuilder, ValidatedBuilder, type ProductFactory, type ProductValidator } from '@frenchexdev2/builder';
import { getProductValidators } from '@builder-internal/has-builder';

/** Async gate allowing concurrency and cancellation tests without time-based assumptions. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

/** Creates an independent decorated class and a small test driver for the generated lifecycle. */
function fixture(validators: readonly ProductValidator<{ name: string }>[] = []) {
  class Product {
    /** @param name Test product state. */
    constructor(readonly name: string) {}
    /** Demonstrates preservation of the product prototype. */
    greet(): string { return this.name; }
  }
  // Standard decorator emission is exercised by the real tsc consumer tests.
  // Apply the marker directly here to avoid the test runner's decorator transform.
  HasBuilder<Product>({ validators })(Product, {
    kind: 'class', name: 'Product', metadata: undefined, addInitializer: () => {},
  });
  class TestBuilder extends ValidatedBuilder<Product> {
    name = 'Alice';
    creations = 0;
    factory: ProductFactory<Product> = () => { this.creations++; return new Product(this.name); };
    /** Associates the decorated product. */
    constructor() { super(Product); }
    /** @param value Sets test input while respecting the generated setter guard. */
    withName(value: string): this { this.ensureConfigurable(); this.name = value; return this; }
    /** Supplies the factory; generated builders additionally check mandatory argument slots. */
    protected override prepare(): Result<ProductFactory<Product>, ValidationErrors> { return success(this.factory); }
  }
  return { Product, TestBuilder };
}

describe('ValidatedBuilder', () => {
  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase1 {
  @Verifies<BuilderValidationFeature>('returnsTheInstanceDirectlyPreservesItsPrototypeAndSharesCachedSuccessAcrossAliases')
  async verify() {
    const { Product, TestBuilder } = fixture();
    const builder = new TestBuilder();
    const first: Result<InstanceType<typeof Product>, ValidationErrors> = await builder.BuildAsync();
    expect(first.isSuccess).toBe(true);
    expect(first.valueOrThrow()).toBeInstanceOf(Product);
    expect(first.valueOrThrow().greet()).toBe('Alice');
    expect(Object.isFrozen(first.valueOrThrow())).toBe(false);
    expect(await builder.buildAsync()).toBe(first);
    expect(builder.creations).toBe(1);
    expect(() => builder.withValidation(() => success())).toThrow('Cannot configure a builder while building or after success. Create a new builder.');
  }
}
it('returns the instance directly, preserves its prototype and shares cached success across aliases', new validatedbuildertesttsCase1().verify.bind(new validatedbuildertesttsCase1()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase2 {
  @Verifies<BuilderValidationFeature>('accumulatesEveryClassAndFluentFailureInDeclarationOrderOnTheSameInstance')
  async verify() {
    const seen: object[] = [];
    const order: string[] = [];
    const { TestBuilder } = fixture([
      product => { seen.push(product); order.push('class1'); return validationFailure(validationError('First', ['name'])); },
      async product => { seen.push(product); order.push('class2'); return validationFailure(validationError('Second')); },
    ]);
    const result = await new TestBuilder().withValidation(async product => {
      seen.push(product); order.push('fluent');
      return validationFailure([validationError('Third'), validationError('Fourth')]);
    }).BuildAsync();
    expect(result.isFailure).toBe(true);
    if (result.isSuccess) throw new Error('Expected validation failure');
    expect(result.error.map(error => error.errorMessage)).toEqual(['First', 'Second', 'Third', 'Fourth']);
    expect(Object.isFrozen(result.error)).toBe(true);
    expect(order).toEqual(['class1', 'class2', 'fluent']);
    expect(new Set(seen).size).toBe(1);
  }
}
it('accumulates every class and fluent failure in declaration order on the same instance', new validatedbuildertesttsCase2().verify.bind(new validatedbuildertesttsCase2()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase3 {
  @Verifies<BuilderValidationFeature>('copiesTheDecoratorValidatorListAndDoesNotExecuteValidatorsAtDecorationTime')
  async verify() {
    const validator = vi.fn(() => success());
    const rules = [validator];
    const { TestBuilder } = fixture(rules);
    rules.splice(0);
    expect(validator).not.toHaveBeenCalled();
    await new TestBuilder().BuildAsync();
    expect(validator).toHaveBeenCalledTimes(1);
  }
}
it('copies the decorator validator list and does not execute validators at decoration time', new validatedbuildertesttsCase3().verify.bind(new validatedbuildertesttsCase3()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase4 {
  @Verifies<BuilderValidationFeature>('supportsAnArgumentFreeStandardDecorator')
  async verify() {
    class Product {}
    HasBuilder()(Product, { kind: 'class', name: 'Product', metadata: undefined, addInitializer: () => {} });
    class TestBuilder extends ValidatedBuilder<Product> {
      constructor() { super(Product); }
      protected override prepare(): Result<ProductFactory<Product>, ValidationErrors> { return success(() => new Product()); }
    }
    expect((await new TestBuilder().BuildAsync()).valueOrThrow()).toBeInstanceOf(Product);
  }
}
it('supports an argument-free standard decorator', new validatedbuildertesttsCase4().verify.bind(new validatedbuildertesttsCase4()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase5 {
  @Verifies<BuilderValidationFeature>('rejectsDuplicateRuntimeDecorationWithoutOverwritingTheRegisteredRules')
  verify() {
    class Product {}
    const context: ClassDecoratorContext = { kind: 'class', name: 'Product', metadata: undefined, addInitializer: () => {} };
    const validator = vi.fn(() => success());
    HasBuilder({ validators: [validator] })(Product, context);
    expect(() => HasBuilder()(Product, context)).toThrow(new TypeError('HasBuilder may only decorate a class once.'));
    expect(getProductValidators(Product)).toHaveLength(1);
    getProductValidators(Product)[0]!({});
    expect(validator).toHaveBeenCalledTimes(1);
  }
}
it('rejects duplicate runtime decoration without overwriting the registered rules', new validatedbuildertesttsCase5().verify.bind(new validatedbuildertesttsCase5()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase6 {
  @Verifies<BuilderValidationFeature>('doesNotInheritValidatorsFromAnAncestorOrAnUnrelatedUndecoratedConstructor')
  verify() {
    class Parent {}
    class Child extends Parent {}
    class Plain {}
    HasBuilder({ validators: [() => success()] })(Parent, { kind: 'class', name: 'Parent', metadata: undefined, addInitializer: () => {} });
    expect(getProductValidators(Child)).toEqual([]);
    expect(getProductValidators(Plain)).toEqual([]);
  }
}
it('does not inherit validators from an ancestor or an unrelated undecorated constructor', new validatedbuildertesttsCase6().verify.bind(new validatedbuildertesttsCase6()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase7 {
  @Verifies<BuilderValidationFeature>('doesNotCacheAValidationFailureAndAllowsExplicitCorrection')
  async verify() {
    const { TestBuilder } = fixture([product => product.name
      ? success()
      : validationFailure(validationError('Required', ['name']))]);
    const builder = new TestBuilder().withName('');
    expect((await builder.BuildAsync()).isFailure).toBe(true);
    expect((await builder.withName('Corrected').BuildAsync()).isSuccess).toBe(true);
    expect(builder.creations).toBe(2);
  }
}
it('does not cache a validation failure and allows explicit correction', new validatedbuildertesttsCase7().verify.bind(new validatedbuildertesttsCase7()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase8 {
  @Verifies<BuilderValidationFeature>('sharesOneConstructionAndValidationAcrossConcurrentCalls')
  async verify() {
    const gate = deferred<void>();
    const validate = vi.fn(async () => { await gate.promise; return success(); });
    const { TestBuilder } = fixture([validate]);
    const builder = new TestBuilder();
    const calls = [builder.BuildAsync(), builder.buildAsync(), builder.BuildAsync()];
    expect(() => builder.withName('Changed')).toThrow('Cannot configure');
    expect(() => builder.withValidation(() => success())).toThrow('Cannot configure');
    gate.resolve();
    const results = await Promise.all(calls);
    expect(new Set(results).size).toBe(1);
    expect(builder.creations).toBe(1);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(() => builder.withName('Changed')).toThrow('Cannot configure');
  }
}
it('shares one construction and validation across concurrent calls', new validatedbuildertesttsCase8().verify.bind(new validatedbuildertesttsCase8()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase9 {
  @Verifies<BuilderValidationFeature>('preservesFactoryExceptionsAndPermitsALaterExplicitAttempt')
  async verify() {
    const { Product, TestBuilder } = fixture();
    const builder = new TestBuilder();
    const error = new TypeError('Constructor bug');
    builder.factory = () => { throw error; };
    await expect(builder.BuildAsync()).rejects.toBe(error);
    builder.factory = () => new Product('Recovered');
    expect((await builder.BuildAsync()).valueOrThrow().name).toBe('Recovered');
  }
}
it('preserves factory exceptions and permits a later explicit attempt', new validatedbuildertesttsCase9().verify.bind(new validatedbuildertesttsCase9()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase10 {
  @Verifies<BuilderValidationFeature>('preservesValidationExceptionsAndSkipsSubsequentRules')
  async verify() {
    const error = new Error('Validator bug');
    const later = vi.fn(() => success());
    const { TestBuilder } = fixture([() => { throw error; }, later]);
    await expect(new TestBuilder().BuildAsync()).rejects.toBe(error);
    expect(later).not.toHaveBeenCalled();
  }
}
it('preserves validation exceptions and skips subsequent rules', new validatedbuildertesttsCase10().verify.bind(new validatedbuildertesttsCase10()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase11 {
  @Verifies<BuilderValidationFeature>('doesNotStartOrReturnACachedProductForAnAlreadyAbortedCall')
  async verify() {
    const { TestBuilder } = fixture();
    const builder = new TestBuilder();
    const controller = new AbortController();
    controller.abort('Stopped');
    await expect(builder.BuildAsync({ signal: controller.signal })).rejects.toBe('Stopped');
    expect(builder.creations).toBe(0);
    await builder.BuildAsync();
    await expect(builder.BuildAsync({ signal: controller.signal })).rejects.toBe('Stopped');
  }
}
it('does not start or return a cached product for an already-aborted call', new validatedbuildertesttsCase11().verify.bind(new validatedbuildertesttsCase11()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase12 {
  @Verifies<BuilderValidationFeature>('cancelsAFollowerIndependentlyAndRemovesItsListener')
  async verify() {
    const gate = deferred<void>();
    const { TestBuilder } = fixture([async () => { await gate.promise; return success(); }]);
    const builder = new TestBuilder();
    const owner = builder.BuildAsync();
    const followerController = new AbortController();
    const remove = vi.spyOn(followerController.signal, 'removeEventListener');
    const follower = builder.BuildAsync({ signal: followerController.signal });
    const rejected = expect(follower).rejects.toBe('Follower stopped');
    followerController.abort('Follower stopped');
    await rejected;
    gate.resolve();
    const built = await owner;
    expect(built.isSuccess).toBe(true);
    expect(await builder.BuildAsync()).toBe(built);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  }
}
it('cancels a follower independently and removes its listener', new validatedbuildertesttsCase12().verify.bind(new validatedbuildertesttsCase12()));

  
@FeatureTest(BuilderValidationFeature)
class validatedbuildertesttsCase13 {
  @Verifies<BuilderValidationFeature>('passesInitiatingCancellationThroughRulesAndNeverCachesACancelledCandidate')
  async verify() {
    const gate = deferred<void>();
    const entered = deferred<void>();
    const controller = new AbortController();
    const validate = vi.fn(async () => { entered.resolve(); await gate.promise; return success(); });
    const { TestBuilder } = fixture([validate]);
    const builder = new TestBuilder();
    const owner = builder.BuildAsync({ signal: controller.signal });
    const follower = builder.BuildAsync();
    const results = Promise.allSettled([owner, follower]);
    await entered.promise;
    controller.abort('Owner stopped');
    gate.resolve();
    expect(await results).toEqual([
      { status: 'rejected', reason: 'Owner stopped' }, { status: 'rejected', reason: 'Owner stopped' },
    ]);
    expect(validate).toHaveBeenCalledWith(expect.anything(), controller.signal);
    expect((await builder.BuildAsync()).isSuccess).toBe(true);
    expect(builder.creations).toBe(2);
  }
}
it('passes initiating cancellation through rules and never caches a cancelled candidate', new validatedbuildertesttsCase13().verify.bind(new validatedbuildertesttsCase13()));
});
