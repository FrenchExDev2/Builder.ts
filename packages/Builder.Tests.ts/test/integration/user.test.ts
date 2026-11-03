import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { BuilderValidationFeature } from '@frenchexdev2/builder-requirements';
import { expect, it } from 'vitest';
const {UserBuilder}=await import(new URL('../examples/user.ts',import.meta.resolve('@frenchexdev2/builder')).href);


@FeatureTest(BuilderValidationFeature)
class usertesttsCase1 {
  @Verifies<BuilderValidationFeature>('buildsAValidatedImmutableUserThroughADomainSpecificFluentAPI')
  async verify() {
  const builder = new UserBuilder().withName('Stéphane').withEmail('stephane@example.com');
  const user = (await builder.buildAsync()).valueOrThrow().resolved();
  expect(user).toEqual({ name: 'Stéphane', email: 'stephane@example.com' });
  expect(Object.isFrozen(user)).toBe(true);
  expect(() => builder.withName('Changed')).toThrow('Cannot configure');
}
}
it('builds a validated immutable user through a domain-specific fluent API', new usertesttsCase1().verify.bind(new usertesttsCase1()));


@FeatureTest(BuilderValidationFeature)
class usertesttsCase2 {
  @Verifies<BuilderValidationFeature>('returnsAllInvalidUserFieldsAndSupportsCorrectingThemExplicitly')
  async verify() {
  const builder = new UserBuilder();
  const invalid = await builder.buildAsync();
  expect(invalid.isFailure).toBe(true);
  if (invalid.isSuccess) throw new Error('Expected failure');
  expect(invalid.error.errors.flatMap((error: {memberNames: readonly string[]}) => error.memberNames)).toEqual(['name', 'email']);
  expect((await builder.withName('Alice').withEmail('alice@example.com').buildAsync()).isSuccess).toBe(true);
}
}
it('returns all invalid user fields and supports correcting them explicitly', new usertesttsCase2().verify.bind(new usertesttsCase2()));
