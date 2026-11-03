import { BuilderFeatures, ParticipatesIn } from '@frenchexdev2/builder-shared-kernel';
import { failure, success, type Result } from '@frenchexdev2/result';
import { BuildContext } from './build-context.js';
import { Reference, type ReadonlyReference } from './reference.js';
import { BuildError, ValidationResult } from './validation-result.js';
import { waitFor } from './internal/wait-for.js';

/** Per-call graph ancestry and cooperative cancellation. */
export interface BuildOptions {
  readonly context?: BuildContext;
  readonly signal?: AbortSignal;
}

/** Async builder returning a deferred reference or a typed domain failure. */
export interface IBuilder<T extends NonNullable<unknown>, E extends Error = BuildError> {
  /** @param options Context for recursive calls and optional cancellation signal. */
  buildAsync(options?: BuildOptions): Promise<Result<ReadonlyReference<T>, E>>;
  /** Returns the same read-only handle before and after successful construction. */
  reference(): ReadonlyReference<T>;
}

/**
 * Validates, instantiates once per concurrent attempt and caches successful results.
 * Recursive calls with the same ancestry receive a deferred reference immediately.
 * Unexpected exceptions reject unchanged; domain failures remain Result values.
 */
@ParticipatesIn(BuilderFeatures.Construction, BuilderFeatures.Concurrency, BuilderFeatures.Cancellation)
export abstract class AbstractBuilder<T extends NonNullable<unknown>, E extends Error = BuildError>
implements IBuilder<T, E> {
  readonly #reference = new Reference<T>();
  #pending: Promise<Result<ReadonlyReference<T>, E>> | undefined;
  #cached: Result<ReadonlyReference<T>, E> | undefined;

  /** Returns the stable handle; only the builder owns its resolution capability. */
  reference(): ReadonlyReference<T> { return this.#reference; }

  /**
   * Shares an in-flight attempt, or starts a new one after a previous failure.
   * The initiating signal controls the shared attempt; follower signals cancel only
   * their own wait. Pass context through every recursive edge of a single graph.
   * @param options Optional ancestry and AbortSignal.
   */
  async buildAsync(options: BuildOptions = {}): Promise<Result<ReadonlyReference<T>, E>> {
    options.signal?.throwIfAborted();
    if (this.#cached !== undefined) return this.#cached;
    const context = options.context ?? new BuildContext();
    if (context.has(this)) return success(this.#reference);
    // @rac-feature BUILDER-CONCURRENCY
    if (this.#pending === undefined) {
      // Defer hooks until #pending is assigned, including synchronous/reentrant hooks.
      this.#pending = Promise.resolve().then(() => this.#build(context.enter(this), options.signal));
      const pending = this.#pending;
      void pending.then(
        () => { this.#pending = undefined; },
        () => { this.#pending = undefined; },
      );
    }
    return await waitFor(this.#pending, options.signal);
  }

  /** Throws if fluent configuration would mutate an active or successfully built instance. */
  protected ensureConfigurable(): void {
    if (this.#pending !== undefined || this.#cached !== undefined) {
      throw new Error('Cannot configure a builder while building or after success. Create a new builder.');
    }
  }

  /**
   * Runs all independent rules, adding every problem to validation.
   * @param validation Fresh accumulator for this attempt.
   * @param signal Initiating caller's cooperative cancellation signal.
   */
  protected abstract validateAsync(validation: ValidationResult, signal?: AbortSignal): PromiseLike<void> | void;

  /**
   * Creates a product after successful validation; expected failures are Result values.
   * @param context Ancestry to pass to nested builders.
   * @param signal Initiating caller's cooperative cancellation signal.
   */
  protected abstract instantiateAsync(context: BuildContext, signal?: AbortSignal):
    PromiseLike<Result<T, E>> | Result<T, E>;

  /** @param validation Converts all validation problems into the domain error type. */
  protected abstract buildException(validation: ValidationResult): E;

  /** Executes the two phases, checking cancellation before committing the product. */
  async #build(context: BuildContext, signal?: AbortSignal): Promise<Result<ReadonlyReference<T>, E>> {
    signal?.throwIfAborted();
    const validation = new ValidationResult();
    await this.validateAsync(validation, signal);
    signal?.throwIfAborted();
    if (!validation.isSuccess) return failure(this.buildException(validation));
    const result = await this.instantiateAsync(context, signal);
    signal?.throwIfAborted();
    if (result.isFailure) return failure(result.error);
    this.#reference.resolve(result.value);
    this.#cached = success(this.#reference);
    return this.#cached;
  }
}
