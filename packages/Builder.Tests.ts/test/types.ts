import type { Result } from '@frenchexdev2/result';
import { AbstractBuilder, Builder, Reference, ValidationResult, type ReadonlyReference } from '@frenchexdev2/builder';

const builder = Builder.create(async () => ({ name: 'Alice' }));
const reference: ReadonlyReference<{ name: string }> = builder.reference();
void reference;
// @ts-expect-error Consumers cannot resolve a builder-owned handle.
builder.reference().resolve({ name: 'Bob' });
// @ts-expect-error Null cannot be a builder product.
Builder.create(() => null);
// @ts-expect-error A reference must hold a non-null value.
new Reference<undefined>();
// @ts-expect-error Factories must provide every mandatory product property.
Builder.create<{ name: string; email: string }>(() => ({ name: 'Alice' }));

class DomainError extends Error { readonly code = 'DOMAIN'; }
/** Compile-time contract for custom typed failures. */
abstract class TypedBuilder extends AbstractBuilder<{ name: string }, DomainError> {}
declare const typed: TypedBuilder;
const typedResult: Promise<Result<ReadonlyReference<{ name: string }>, DomainError>> = typed.buildAsync();
void typedResult;
void new ValidationResult();
