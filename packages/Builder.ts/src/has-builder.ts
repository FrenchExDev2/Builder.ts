import type { Result, ValidationErrors } from '@frenchexdev2/result';

/** Rule evaluated against the constructed product; failures accumulate in order. */
export type ProductValidator<T extends object> = (
  product: Readonly<T>,
  signal?: AbortSignal,
) => Result<void, ValidationErrors> | PromiseLike<Result<void, ValidationErrors>>;

/** Generation name and runtime validators associated with a product class. */
export interface HasBuilderOptions<T extends object> {
  readonly name?: string;
  readonly validators?: readonly ProductValidator<T>[];
}

/** Constructor identity, accepting classes with arbitrary constructor parameters. */
export type ProductClass<T extends object> = abstract new (...args: never[]) => T;

type RegisteredValidator = ProductValidator<object>;
const validatorsByClass = new WeakMap<object, readonly RegisteredValidator[]>();

/**
 * Marks a class for BuilderGenerator and retains its validators without running them.
 * @param options Optional generated name (defaults to ClassNameBuilder) and rules.
 * @returns A standard class decorator; no legacy decorator metadata is required.
 */
// @rac-feature BUILDER-GENERATION
export function HasBuilder<T extends object>(options: HasBuilderOptions<T> = {}): (target: ProductClass<T>, context: ClassDecoratorContext) => void {
  const validators = Object.freeze([...(options.validators ?? [])]);
  return (target: ProductClass<T>, _context: ClassDecoratorContext): void => {
    if (validatorsByClass.has(target)) throw new TypeError('HasBuilder may only decorate a class once.');
    // Erase the registry type only at this boundary; lookup is by constructor identity.
    validatorsByClass.set(target, Object.freeze(validators.map(validator =>
      (product: Readonly<object>, signal?: AbortSignal) => validator(product as Readonly<T>, signal))));
  };
}

/** Internal typed lookup; only the exact decorated constructor owns these rules. */
// @rac-feature BUILDER-GENERATION
export function getProductValidators<T extends object>(target: ProductClass<T>): readonly ProductValidator<T>[] {
  return validatorsByClass.get(target) ?? [];
}
