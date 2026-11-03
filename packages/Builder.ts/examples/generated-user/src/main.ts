import { success, validationError, validationFailure, type Result, type ValidationErrors } from '@frenchexdev2/result';
import { User } from './user.js';
import { UserBuilder } from './generated/user/UserBuilder.generated.js';

/** Builds a user with class-level and instance-level Result validators. */
export async function createUser(): Promise<Result<User, ValidationErrors>> {
  return await new UserBuilder()
    .withName('Stéphane')
    .withEmail('stephane@example.com')
    .withValidation(async user => user.name.trim()
      ? success()
      : validationFailure(validationError('Name is required', ['name'])))
    .BuildAsync();
}

const result = await createUser();
if (result.isFailure) throw new Error(result.error.map(error => error.errorMessage).join('; '));
if (!(result.value instanceof User)) throw new TypeError('The product must retain its class prototype.');
console.log(`${result.value.greet()} | role=${result.value.role}`);
