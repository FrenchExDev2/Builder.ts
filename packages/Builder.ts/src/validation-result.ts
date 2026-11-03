import { BuilderFeatures, ParticipatesIn } from '@frenchexdev2/builder-shared-kernel';
import { validationError, type ValidationError } from '@frenchexdev2/result';

/** Accumulates independent validation problems without throwing or stopping early. */
@ParticipatesIn(BuilderFeatures.Validation)
export class ValidationResult {
  readonly #errors: ValidationError[] = [];

  /** Whether every validation performed so far succeeded. */
  get isSuccess(): boolean { return this.#errors.length === 0; }

  /** Returns a frozen snapshot, preserving reporting order and duplicate problems. */
  get errors(): readonly ValidationError[] { return Object.freeze([...this.#errors]); }

  /**
   * Appends a problem and defensively copies its member names.
   * @param message Human-readable explanation.
   * @param memberNames Fields concerned by the problem.
   */
  addError(message: string, memberNames: readonly string[] = []): this {
    this.#errors.push(validationError(message, memberNames));
    return this;
  }

  /** @param errors Problems from other validators, appended in enumeration order. */
  addErrors(errors: Iterable<ValidationError>): this {
    for (const error of errors) this.addError(error.errorMessage, error.memberNames);
    return this;
  }
}

/** Default failure payload for invalid builder input. */
@ParticipatesIn(BuilderFeatures.Validation)
export class BuildError extends Error {
  readonly errors: readonly ValidationError[];

  /** @param validation Accumulated problems, copied into an immutable snapshot. */
  constructor(validation: ValidationResult) {
    const errors = validation.errors;
    super(errors.map(error => error.errorMessage).join('; '));
    this.name = 'BuildError';
    this.errors = errors;
  }
}
