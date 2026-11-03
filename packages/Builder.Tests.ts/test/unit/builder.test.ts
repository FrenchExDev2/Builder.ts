import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { BuilderConcurrencyFeature, BuilderConstructionFeature, BuilderReferencesFeature, BuilderValidationFeature, BuilderCancellationFeature } from '@frenchexdev2/builder-requirements';
import { describe, expect, it, vi } from 'vitest';
import { failure, success, type Result } from '@frenchexdev2/result';
import {
  AbstractBuilder, BuildContext, BuildError, Builder, Reference, ValidationResult,
  type ReadonlyReference,
} from '@frenchexdev2/builder';

/** Controlled async boundary, without timers or timing assumptions. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('Reference', () => {
  
@FeatureTest(BuilderConstructionFeature)
class buildertesttsCase1 {
  @Verifies<BuilderConstructionFeature>('reportsUnresolvedStateAndRefusesPrematureAccess')
  verify() {
    const reference = new Reference<object>();
    expect(reference.isResolved).toBe(false);
    expect(reference.tryResolved()).toBeUndefined();
    expect(() => reference.resolved()).toThrow(ReferenceError);
    expect(() => reference.resolved()).toThrow('The reference is not resolved.');
  }
}
it('reports unresolved state and refuses premature access', new buildertesttsCase1().verify.bind(new buildertesttsCase1()));

  
@FeatureTest(BuilderConstructionFeature)
class buildertesttsCase2 {
  @Verifies<BuilderConstructionFeature>('retainsIdentityAndRefusesASecondResolution')
  verify() {
    const product = {};
    const reference = new Reference<object>();
    expect(reference.resolve(product)).toBe(reference);
    expect(reference.isResolved).toBe(true);
    expect(reference.tryResolved()).toBe(product);
    expect(reference.resolved()).toBe(product);
    expect(() => reference.resolve(product)).toThrow(ReferenceError);
    expect(() => reference.resolve(product)).toThrow('The reference is already resolved.');
  }
}
it('retains identity and refuses a second resolution', new buildertesttsCase2().verify.bind(new buildertesttsCase2()));

  
@FeatureTest(BuilderConstructionFeature)
class buildertesttsCase3 {
  @Verifies<BuilderConstructionFeature>('supportsTheNonNullValueJ')
  verify(value: any) {
    expect(new Reference<typeof value>().resolve(value).resolved()).toBe(value);
  }
}
it.each([0, false, ''])('supports the non-null value %j', new buildertesttsCase3().verify.bind(new buildertesttsCase3()));

  
@FeatureTest(BuilderConstructionFeature)
class buildertesttsCase4 {
  @Verifies<BuilderConstructionFeature>('rejectsNullishValuesFromUntypedConsumersJ')
  verify(value: null | undefined) {
    const reference = new Reference<object>();
    // @ts-expect-error JavaScript callers can bypass the non-null generic constraint.
    expect(() => reference.resolve(value)).toThrow(TypeError);
    // @ts-expect-error Runtime diagnostics are also part of the JavaScript API.
    expect(() => reference.resolve(value)).toThrow('A reference requires a non-null value.');
    expect(reference.isResolved).toBe(false);
  }
}
it.each([null, undefined])('rejects nullish values from untyped consumers (%j)', new buildertesttsCase4().verify.bind(new buildertesttsCase4()));
});

describe('validation and ancestry', () => {
  
@FeatureTest(BuilderConstructionFeature)
class buildertesttsCase5 {
  @Verifies<BuilderConstructionFeature>('accumulatesAllErrorsWithFrozenDefensiveSnapshots')
  verify() {
    const validation = new ValidationResult();
    const members = ['email'];
    const before = validation.errors;
    expect(validation.isSuccess).toBe(true);
    expect(validation.addError('Required', members)).toBe(validation);
    members.push('name');
    expect(validation.addErrors([{ errorMessage: 'Invalid', memberNames: ['age'] }])).toBe(validation);
    expect(validation.isSuccess).toBe(false);
    expect(before).toEqual([]);
    expect(validation.errors).toEqual([
      { errorMessage: 'Required', memberNames: ['email'] },
      { errorMessage: 'Invalid', memberNames: ['age'] },
    ]);
    expect(Object.isFrozen(validation.errors)).toBe(true);
    expect(Object.isFrozen(validation.errors[0])).toBe(true);
    expect(Object.isFrozen(validation.errors[0]?.memberNames)).toBe(true);
    const error = new BuildError(validation);
    validation.addError('Later');
    expect(validation.errors[2]).toEqual({ errorMessage: 'Later', memberNames: [] });
    expect(error.name).toBe('BuildError');
    expect(error.message).toBe('Required; Invalid');
    expect(error.errors).toHaveLength(2);
  }
}
it('accumulates all errors with frozen defensive snapshots', new buildertesttsCase5().verify.bind(new buildertesttsCase5()));

  
@FeatureTest(BuilderReferencesFeature)
class buildertesttsCase6 {
  @Verifies<BuilderReferencesFeature>('keepsSiblingAncestryIndependent')
  verify() {
    const root = new BuildContext();
    const a = {};
    const b = {};
    const left = root.enter(a);
    const right = root.enter(b);
    expect(root.has(a)).toBe(false);
    expect(left.has(a)).toBe(true);
    expect(left.has(b)).toBe(false);
    expect(right.has(b)).toBe(true);
    expect(right.has(a)).toBe(false);
  }
}
it('keeps sibling ancestry independent', new buildertesttsCase6().verify.bind(new buildertesttsCase6()));
});

describe('Builder', () => {
  
@FeatureTest(BuilderReferencesFeature)
class buildertesttsCase7 {
  @Verifies<BuilderReferencesFeature>('infersAsyncProductsAndCachesTheSameResultAndReference')
  async verify() {
    const product = Object.freeze({ name: 'Alice' });
    const factory = vi.fn(async () => product);
    const builder = Builder.create(factory);
    const reference = builder.reference();
    const first = await builder.buildAsync();
    expect(first.isSuccess).toBe(true);
    expect(first.valueOrThrow()).toBe(reference);
    expect(reference.resolved()).toBe(product);
    expect(await builder.buildAsync()).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  }
}
it('infers async products and caches the same result and reference', new buildertesttsCase7().verify.bind(new buildertesttsCase7()));

  
@FeatureTest(BuilderValidationFeature)
class buildertesttsCase8 {
  @Verifies<BuilderValidationFeature>('executesEverySyncAsyncValidatorInOrderAndSkipsInvalidConstruction')
  async verify() {
    const order: string[] = [];
    const factory = vi.fn(() => ({}));
    const builder = Builder.create(factory)
      .withValidation(validation => { order.push('email'); validation.addError('Email required', ['email']); })
      .withValidation(async validation => { order.push('name'); validation.addError('Name required', ['name']); });
    const result = await builder.buildAsync();
    expect(order).toEqual(['email', 'name']);
    expect(result.isFailure).toBe(true);
    if (result.isSuccess) throw new Error('Expected validation failure');
    expect(result.error).toBeInstanceOf(BuildError);
    expect(result.error.errors).toHaveLength(2);
    expect(factory).not.toHaveBeenCalled();
    expect(builder.reference().isResolved).toBe(false);
  }
}
it('executes every sync/async validator in order and skips invalid construction', new buildertesttsCase8().verify.bind(new buildertesttsCase8()));

  
@FeatureTest(BuilderValidationFeature)
class buildertesttsCase9 {
  @Verifies<BuilderConcurrencyFeature>('sharesConstructionAttempt')
  @Verifies<BuilderValidationFeature>('sharesValidationAndInstantiationBetweenConcurrentCallers')
  async verify() {
    const gate = deferred<object>();
    const factory = vi.fn(() => gate.promise);
    const validator = vi.fn(() => {});
    const builder = new Builder(factory).withValidation(validator);
    const attempts = Array.from({ length: 20 }, () => builder.buildAsync());
    const product = {};
    gate.resolve(product);
    const results = await Promise.all(attempts);
    expect(new Set(results).size).toBe(1);
    expect(results[0]?.valueOrThrow().resolved()).toBe(product);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(validator).toHaveBeenCalledTimes(1);
  }
}
it('shares validation and instantiation between concurrent callers', new buildertesttsCase9().verify.bind(new buildertesttsCase9()));

  
@FeatureTest(BuilderValidationFeature)
class buildertesttsCase10 {
  @Verifies<BuilderValidationFeature>('allowsAnExplicitAttemptAfterValidationFailure')
  async verify() {
    let valid = false;
    const validator = vi.fn((validation: ValidationResult) => { if (!valid) validation.addError('Invalid'); });
    const builder = Builder.create(() => ({})).withValidation(validator);
    expect((await builder.buildAsync()).isFailure).toBe(true);
    valid = true;
    builder.withValidation(() => {});
    expect((await builder.buildAsync()).isSuccess).toBe(true);
    expect(validator).toHaveBeenCalledTimes(2);
  }
}
it('allows an explicit attempt after validation failure', new buildertesttsCase10().verify.bind(new buildertesttsCase10()));

  
@FeatureTest(BuilderConstructionFeature)
class buildertesttsCase11 {
  @Verifies<BuilderConstructionFeature>('preservesUnexpectedFactoryExceptionsAndClearsTheFailedAttempt')
  async verify() {
    const error = new TypeError('Bug');
    const factory = vi.fn<() => object>().mockImplementationOnce(() => { throw error; }).mockReturnValue({});
    const builder = Builder.create(factory);
    await expect(builder.buildAsync()).rejects.toBe(error);
    expect(builder.reference().isResolved).toBe(false);
    expect((await builder.buildAsync()).isSuccess).toBe(true);
  }
}
it('preserves unexpected factory exceptions and clears the failed attempt', new buildertesttsCase11().verify.bind(new buildertesttsCase11()));

  
@FeatureTest(BuilderValidationFeature)
class buildertesttsCase12 {
  @Verifies<BuilderValidationFeature>('preservesValidatorExceptionsWithoutInstantiating')
  async verify() {
    const error = new Error('Validator bug');
    const factory = vi.fn(() => ({}));
    const builder = Builder.create(factory).withValidation(() => { throw error; });
    await expect(builder.buildAsync()).rejects.toBe(error);
    expect(factory).not.toHaveBeenCalled();
  }
}
it('preserves validator exceptions without instantiating', new buildertesttsCase12().verify.bind(new buildertesttsCase12()));

  
@FeatureTest(BuilderConstructionFeature)
class buildertesttsCase13 {
  @Verifies<BuilderConstructionFeature>('blocksConfigurationDuringConstructionAndAfterSuccess')
  async verify() {
    const gate = deferred<object>();
    const builder = Builder.create(() => gate.promise);
    const attempt = builder.buildAsync();
    expect(() => builder.withValidation(() => {})).toThrow('Cannot configure');
    gate.resolve({});
    await attempt;
    expect(() => builder.withValidation(() => {})).toThrow('Cannot configure');
  }
}
it('blocks configuration during construction and after success', new buildertesttsCase13().verify.bind(new buildertesttsCase13()));

  
@FeatureTest(BuilderCancellationFeature)
class buildertesttsCase14 {
  @Verifies<BuilderCancellationFeature>('rejectsAlreadyAbortedCallsWithoutStartingOrReturningACachedProduct')
  async verify() {
    const controller = new AbortController();
    const reason = new Error('Stop');
    controller.abort(reason);
    const factory = vi.fn(() => ({}));
    const builder = Builder.create(factory);
    await expect(builder.buildAsync({ signal: controller.signal })).rejects.toBe(reason);
    expect(factory).not.toHaveBeenCalled();
    await builder.buildAsync();
    await expect(builder.buildAsync({ signal: controller.signal })).rejects.toBe(reason);
  }
}
it('rejects already aborted calls without starting or returning a cached product', new buildertesttsCase14().verify.bind(new buildertesttsCase14()));

  
@FeatureTest(BuilderCancellationFeature)
class buildertesttsCase15 {
  @Verifies<BuilderCancellationFeature>('cancelsAFollowerWithoutCancellingTheSharedConstruction')
  async verify() {
    const gate = deferred<object>();
    const builder = Builder.create(() => gate.promise);
    const owner = builder.buildAsync();
    const controller = new AbortController();
    const follower = builder.buildAsync({ signal: controller.signal });
    const observed = expect(follower).rejects.toBe('Follower cancelled');
    controller.abort('Follower cancelled');
    await observed;
    gate.resolve({});
    expect((await owner).isSuccess).toBe(true);
    expect((await builder.buildAsync()).isSuccess).toBe(true);
  }
}
it('cancels a follower without cancelling the shared construction', new buildertesttsCase15().verify.bind(new buildertesttsCase15()));

  
@FeatureTest(BuilderCancellationFeature)
class buildertesttsCase16 {
  @Verifies<BuilderCancellationFeature>('removesAFollowerCancellationListenerOnCompletion')
  async verify() {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    expect((await Builder.create(() => ({})).buildAsync({ signal: controller.signal })).isSuccess).toBe(true);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  }
}
it('removes a follower cancellation listener on completion', new buildertesttsCase16().verify.bind(new buildertesttsCase16()));

  
@FeatureTest(BuilderCancellationFeature)
class buildertesttsCase17 {
  @Verifies<BuilderCancellationFeature>('removesAFollowerCancellationListenerOnRejection')
  async verify() {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const gate = deferred<object>();
    const builder = Builder.create(() => gate.promise);
    const owner = builder.buildAsync();
    const follower = builder.buildAsync({ signal: controller.signal });
    const observed = Promise.allSettled([owner, follower]);
    const error = new Error('I/O failure');
    gate.reject(error);
    expect(await observed).toEqual([
      { status: 'rejected', reason: error }, { status: 'rejected', reason: error },
    ]);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  }
}
it('removes a follower cancellation listener on rejection', new buildertesttsCase17().verify.bind(new buildertesttsCase17()));

  
@FeatureTest(BuilderValidationFeature)
class buildertesttsCase18 {
  @Verifies<BuilderValidationFeature>('passesTheInitiatingSignalThroughValidationAndFactoryHooks')
  async verify() {
    const controller = new AbortController();
    const validator = vi.fn(() => {});
    const factory = vi.fn(() => ({}));
    const builder = Builder.create(factory).withValidation(validator);
    await builder.buildAsync({ signal: controller.signal });
    expect(validator).toHaveBeenCalledWith(expect.any(ValidationResult), controller.signal);
    expect(factory).toHaveBeenCalledWith(expect.any(BuildContext), controller.signal);
  }
}
it('passes the initiating signal through validation and factory hooks', new buildertesttsCase18().verify.bind(new buildertesttsCase18()));

  
@FeatureTest(BuilderCancellationFeature)
class buildertesttsCase19 {
  @Verifies<BuilderCancellationFeature>('doesNotCommitAProductWhenTheInitiatingSignalAbortsDuringIO')
  async verify() {
    const entered = deferred<void>();
    const gate = deferred<object>();
    const controller = new AbortController();
    const builder = Builder.create(() => { entered.resolve(); return gate.promise; });
    const owner = builder.buildAsync({ signal: controller.signal });
    const follower = builder.buildAsync();
    const observed = Promise.allSettled([owner, follower]);
    await entered.promise;
    controller.abort('Owner cancelled');
    gate.resolve({});
    expect(await observed).toEqual([
      { status: 'rejected', reason: 'Owner cancelled' }, { status: 'rejected', reason: 'Owner cancelled' },
    ]);
    expect(builder.reference().isResolved).toBe(false);
    expect((await builder.buildAsync()).isSuccess).toBe(true);
  }
}
it('does not commit a product when the initiating signal aborts during I/O', new buildertesttsCase19().verify.bind(new buildertesttsCase19()));

  
@FeatureTest(BuilderValidationFeature)
class buildertesttsCase20 {
  @Verifies<BuilderValidationFeature>('checksCancellationAfterValidationBeforeInstantiating')
  async verify() {
    const controller = new AbortController();
    const factory = vi.fn(() => ({}));
    const builder = Builder.create(factory).withValidation(() => { controller.abort('Stop'); });
    await expect(builder.buildAsync({ signal: controller.signal })).rejects.toBe('Stop');
    expect(factory).not.toHaveBeenCalled();
  }
}
it('checks cancellation after validation before instantiating', new buildertesttsCase20().verify.bind(new buildertesttsCase20()));
});

describe('typed builders and graphs', () => {
  
@FeatureTest(BuilderValidationFeature)
class buildertesttsCase21 {
  @Verifies<BuilderValidationFeature>('preservesTypedDomainFailuresAndPermitsALaterExplicitBuild')
  async verify() {
    class DomainError extends Error { readonly code = 'DOMAIN'; }
    const expected = new DomainError('Unavailable');
    class DomainBuilder extends AbstractBuilder<object, DomainError> {
      attempts = 0;
      invalid = false;
      protected override validateAsync(validation: ValidationResult): void {
        if (this.invalid) validation.addError('Invalid');
      }
      protected override instantiateAsync(): Result<object, DomainError> {
        return ++this.attempts === 1 ? failure(expected) : success({});
      }
      protected override buildException(): DomainError { return new DomainError('Invalid input'); }
    }
    const builder = new DomainBuilder();
    const failed = await builder.buildAsync();
    expect(failed.isFailure && failed.error).toBe(expected);
    expect(builder.reference().isResolved).toBe(false);
    expect((await builder.buildAsync()).isSuccess).toBe(true);
    const invalid = new DomainBuilder();
    invalid.invalid = true;
    const validation = await invalid.buildAsync();
    expect(validation.isFailure && validation.error.code).toBe('DOMAIN');
    expect(invalid.attempts).toBe(0);
  }
}
it('preserves typed domain failures and permits a later explicit build', new buildertesttsCase21().verify.bind(new buildertesttsCase21()));

  
@FeatureTest(BuilderReferencesFeature)
class buildertesttsCase22 {
  @Verifies<BuilderReferencesFeature>('resolvesACyclicGraphThroughDeferredReferencesWithoutRecursionOrDeadlock')
  async verify() {
    interface Parent { readonly child: Child }
    interface Child { readonly parent: ReadonlyReference<Parent> }
    let parent!: Builder<Parent>;
    const child = Builder.create<Child>(async context => ({
      parent: (await parent.buildAsync({ context })).valueOrThrow(),
    }));
    parent = Builder.create<Parent>(async context => ({
      child: (await child.buildAsync({ context })).valueOrThrow().resolved(),
    }));
    const product = (await parent.buildAsync()).valueOrThrow().resolved();
    expect(product.child.parent.resolved()).toBe(product);
  }
}
it('resolves a cyclic graph through deferred references without recursion or deadlock', new buildertesttsCase22().verify.bind(new buildertesttsCase22()));

  
@FeatureTest(BuilderReferencesFeature)
class buildertesttsCase23 {
  @Verifies<BuilderReferencesFeature>('waitsForASharedChildInParallelSiblingPaths')
  async verify() {
    const gate = deferred<{ id: number }>();
    const factory = vi.fn(() => gate.promise);
    const child = Builder.create(factory);
    const parent = Builder.create(async context => {
      const results = await Promise.all([child.buildAsync({ context }), child.buildAsync({ context })]);
      return results.map(result => result.valueOrThrow().resolved());
    });
    const attempt = parent.buildAsync();
    gate.resolve({ id: 1 });
    const product = (await attempt).valueOrThrow().resolved();
    expect(product[0]).toBe(product[1]);
    expect(factory).toHaveBeenCalledTimes(1);
  }
}
it('waits for a shared child in parallel sibling paths', new buildertesttsCase23().verify.bind(new buildertesttsCase23()));
});
