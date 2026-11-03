import { BuilderFeatures, ParticipatesIn } from '@frenchexdev2/builder-shared-kernel';
/** Immutable ancestry for one recursive build path; sibling paths stay independent. */
@ParticipatesIn(BuilderFeatures.References)
export class BuildContext {
  readonly #ancestors: ReadonlySet<object>;

  /** @param ancestors Builder identities already present in the current path. */
  constructor(ancestors?: Iterable<object>) { this.#ancestors = new Set(ancestors); }

  /** @param builder Identity to check for a recursive back-reference. */
  has(builder: object): boolean { return this.#ancestors.has(builder); }

  /** @param builder Builder to append to a new child path without mutating this path. */
  enter(builder: object): BuildContext { return new BuildContext([...this.#ancestors, builder]); }
}
