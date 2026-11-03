import { BuilderFeatures, ParticipatesIn } from '@frenchexdev2/builder-shared-kernel';
import { success, type Result } from '@frenchexdev2/result';
import { AbstractBuilder } from './abstract-builder.js';
import type { BuildContext } from './build-context.js';
import { BuildError, ValidationResult } from './validation-result.js';

/** Factory receiving the ancestry and cooperative cancellation signal for nested builds. */
export type BuildFactory<T extends NonNullable<unknown>> =
  (context: BuildContext, signal?: AbortSignal) => T | PromiseLike<T>;

/** Independent validation rule; add errors rather than throwing for invalid input. */
export type BuildValidator = (validation: ValidationResult, signal?: AbortSignal) => void | PromiseLike<void>;

/** Fluent factory-based builder for products using the default BuildError. */
@ParticipatesIn(BuilderFeatures.Construction, BuilderFeatures.Validation)
export class Builder<T extends NonNullable<unknown>> extends AbstractBuilder<T> {
  readonly #factory: BuildFactory<T>;
  readonly #validators: BuildValidator[] = [];

  /** @param factory Constructs the complete product after all validators succeed. */
  constructor(factory: BuildFactory<T>) { super(); this.#factory = factory; }

  /** @param factory Infers the product type from a synchronous or asynchronous factory. */
  static create<T extends NonNullable<unknown>>(factory: BuildFactory<T>): Builder<T> {
    return new Builder(factory);
  }

  /** @param validator Appends an independent rule, evaluated in registration order. */
  withValidation(validator: BuildValidator): this {
    this.ensureConfigurable();
    this.#validators.push(validator);
    return this;
  }

  /** Executes every registered rule; cancellation and unexpected exceptions propagate. */
  protected override async validateAsync(validation: ValidationResult, signal?: AbortSignal): Promise<void> {
    for (const validator of this.#validators) {
      signal?.throwIfAborted();
      await validator(validation, signal);
    }
  }

  /** Awaits the factory and wraps its product in a successful Result. */
  protected override async instantiateAsync(context: BuildContext, signal?: AbortSignal): Promise<Result<T, BuildError>> {
    return success(await this.#factory(context, signal));
  }

  /** Converts accumulated validation problems into the default error payload. */
  protected override buildException(validation: ValidationResult): BuildError { return new BuildError(validation); }
}
