import { BuilderFeatures, ParticipatesIn } from '@frenchexdev2/builder-shared-kernel';
/** Read-only handle to an object that may still be under construction. */
export interface ReadonlyReference<T extends NonNullable<unknown>> {
  readonly isResolved: boolean;
  /** Returns the object when available, otherwise undefined. */
  tryResolved(): T | undefined;
  /** Returns the object, throwing ReferenceError if construction is incomplete. */
  resolved(): T;
}

/** A write-once reference, usable for deferred links in cyclic object graphs. */
@ParticipatesIn(BuilderFeatures.References)
export class Reference<T extends NonNullable<unknown>> implements ReadonlyReference<T> {
  #value: T | undefined;

  /** Whether a value has been assigned. */
  get isResolved(): boolean { return this.#value !== undefined; }

  /**
   * Resolves this handle exactly once. Values are neither copied nor frozen.
   * @param value Non-null object or primitive to retain by identity.
   * @throws TypeError for nullish values; ReferenceError on a second assignment.
   */
  resolve(value: T): this {
    if (value === null || value === undefined) throw new TypeError('A reference requires a non-null value.');
    if (this.isResolved) throw new ReferenceError('The reference is already resolved.');
    this.#value = value;
    return this;
  }

  /** Returns the current value, or undefined for an unresolved handle. */
  tryResolved(): T | undefined { return this.#value; }

  /** @throws ReferenceError when construction has not successfully completed. */
  resolved(): T {
    if (this.#value === undefined) throw new ReferenceError('The reference is not resolved.');
    return this.#value;
  }
}
