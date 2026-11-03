import { success, type Result } from '@frenchexdev2/result';
import { AbstractBuilder, BuildError, ValidationResult } from '@frenchexdev2/builder';

/** Immutable product created only after all required fields are valid. */
export interface User { readonly name: string; readonly email: string }

/** Domain-specific fluent API built on the shared asynchronous lifecycle. */
export class UserBuilder extends AbstractBuilder<User> {
  #name = '';
  #email = '';

  /** @param name Display name to validate at build time. */
  withName(name: string): this { this.ensureConfigurable(); this.#name = name; return this; }

  /** @param email Email to validate at build time. */
  withEmail(email: string): this { this.ensureConfigurable(); this.#email = email; return this; }

  /** Accumulates every independent input problem. */
  protected override async validateAsync(validation: ValidationResult): Promise<void> {
    if (!this.#name.trim()) validation.addError('Name is required', ['name']);
    if (!this.#email.includes('@')) validation.addError('A valid email is required', ['email']);
  }

  /** Produces an immutable snapshot of the fluent configuration. */
  protected override async instantiateAsync(): Promise<Result<User, BuildError>> {
    return success(Object.freeze({ name: this.#name, email: this.#email }));
  }

  /** Preserves the full list of field validation errors. */
  protected override buildException(validation: ValidationResult): BuildError { return new BuildError(validation); }
}
