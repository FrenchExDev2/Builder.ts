import { HasBuilder } from '@frenchexdev2/builder';
import { success, validationError, validationFailure, type Result, type ValidationErrors } from '@frenchexdev2/result';

/** Checks a complete class instance, including its methods and constructor defaults. */
function validateUser(user: Readonly<User>): Result<void, ValidationErrors> {
  return user.email.includes('@')
    ? success()
    : validationFailure(validationError('A valid email is required', ['email']));
}

/** Product declaration: all fluent constructor methods are generated during the build. */
@HasBuilder<User>({ name: 'UserBuilder', validators: [validateUser] })
export class User {
  readonly kind = 'user';

  /** @param name Display name. @param email Contact address. @param role Access role, defaulting to reader. */
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly role = 'reader',
  ) {}

  /** Returns a greeting, demonstrating that the builder preserves the product prototype. */
  greet(): string { return `Bonjour ${this.name}`; }
}
