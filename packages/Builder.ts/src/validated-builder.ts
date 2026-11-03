import { BuilderFeatures, ParticipatesIn } from '@frenchexdev2/builder-shared-kernel';
import { combine, success, validationFailure, type Result, type ValidationErrors } from '@frenchexdev2/result';
import { getProductValidators, type ProductClass, type ProductValidator } from './has-builder.js';
import { waitFor } from './internal/wait-for.js';

/** Cancellation options for builders returning the validated product directly. */
export interface ValidatedBuildOptions { readonly signal?: AbortSignal }

/** Product construction delayed until required constructor arguments are present. */
export type ProductFactory<T extends object> = () => T | PromiseLike<T>;

/**
 * Lifecycle for generated builders: required arguments, construction, all rules, cache.
 * Products retain their class prototype. Only successful outcomes are cached.
 */
@ParticipatesIn(BuilderFeatures.Validation, BuilderFeatures.Concurrency, BuilderFeatures.Cancellation)
export abstract class ValidatedBuilder<T extends object> {
  readonly #classValidators: readonly ProductValidator<T>[];
  readonly #validators: ProductValidator<T>[] = [];
  #pending: Promise<Result<T, ValidationErrors>> | undefined;
  #cached: Result<T, ValidationErrors> | undefined;

  /** @param productClass Constructor whose HasBuilder validators should run first. */
  protected constructor(productClass: ProductClass<T>) {
    this.#classValidators = getProductValidators(productClass);
  }

  /** @param validator Appends an instance-specific rule after the class rules. */
  withValidation(validator: ProductValidator<T>): this {
    this.ensureConfigurable();
    this.#validators.push(validator);
    return this;
  }

  /** @param options Initiator cancellation controls the attempt; followers cancel only their wait. */
  async buildAsync(options: ValidatedBuildOptions = {}): Promise<Result<T, ValidationErrors>> {
    options.signal?.throwIfAborted();
    if (this.#cached !== undefined) return this.#cached;
    // @rac-feature BUILDER-CONCURRENCY
    if (this.#pending === undefined) {
      this.#pending = Promise.resolve().then(() => this.#build(options.signal));
      void this.#pending.then(
        () => { this.#pending = undefined; },
        () => { this.#pending = undefined; },
      );
    }
    return await waitFor(this.#pending, options.signal);
  }

  /** @param options Alias sharing exactly the same lifecycle as buildAsync. */
  async BuildAsync(options: ValidatedBuildOptions = {}): Promise<Result<T, ValidationErrors>> {
    return await this.buildAsync(options);
  }

  /** Prevents fluent changes while an attempt runs or after a successful build. */
  protected ensureConfigurable(): void {
    if (this.#pending !== undefined || this.#cached !== undefined) {
      throw new Error('Cannot configure a builder while building or after success. Create a new builder.');
    }
  }

  /** Captures constructor inputs or reports every missing mandatory parameter. */
  protected abstract prepare(): Result<ProductFactory<T>, ValidationErrors>;

  /** Runs construction and every validation rule before publishing a successful product. */
  async #build(signal?: AbortSignal): Promise<Result<T, ValidationErrors>> {
    signal?.throwIfAborted();
    const prepared = this.prepare();
    if (prepared.isFailure) return validationFailure(prepared.error);
    const product = await prepared.value();
    signal?.throwIfAborted();
    const validations: Result<void, ValidationErrors>[] = [];
    for (const validator of [...this.#classValidators, ...this.#validators]) {
      signal?.throwIfAborted();
      validations.push(await validator(product, signal));
      signal?.throwIfAborted();
    }
    const validation = combine(...validations);
    if (validation.isFailure) return validationFailure(validation.error);
    this.#cached = success(product);
    return this.#cached;
  }
}
