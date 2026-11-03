import { Feature, Requirement, Priority, Satisfies, type ACResult } from '@frenchexdev2/requirements-shared-kernel';
import { BuilderFeatures } from '@frenchexdev2/builder-shared-kernel';

/** Retrospective requirement grounded in the preserved contract; stakeholder approval is not inferred. */
export abstract class BuilderConstructionRequirement extends Requirement {
 readonly id = 'REQ-BUILDER-CONSTRUCTION';
 readonly title = "Construct products asynchronously while preserving typed failures, identity and explicit retry semantics.";
 readonly priority = Priority.High;
 readonly status = 'Draft' as const;
 readonly kind = 'Functional' as const;
 readonly statement = { pattern: 'ubiquitous', response: this.title };
 readonly rationale = { kind: 'observed-contract', claim: this.title, evidence: [] };
 readonly fitCriteria = [{ kind: 'unit-test' as const, describes: this.title, binds: ["reportsUnresolvedStateAndRefusesPrematureAccess","retainsIdentityAndRefusesASecondResolution","supportsTheNonNullValueJ","rejectsNullishValuesFromUntypedConsumersJ","accumulatesAllErrorsWithFrozenDefensiveSnapshots","preservesUnexpectedFactoryExceptionsAndClearsTheFailedAttempt","blocksConfigurationDuringConstructionAndAfterSuccess"] }];
 readonly verificationMethod = 'Test';
 readonly source = { type: 'reverse-engineering', documents: 'Builder.ts/README.md; Builder.ts/src; Builder.Tests.ts/test', date: '2026-11-03' };
 readonly risk = { level: 'High', ifNotMet: 'The existing Builder consumer contract is broken.' };
}

@Satisfies(BuilderConstructionRequirement)
export abstract class BuilderConstructionFeature extends Feature {
 readonly id = BuilderFeatures.Construction.id;
 readonly title = "Construct products asynchronously while preserving typed failures, identity and explicit retry semantics.";
 readonly priority = Priority.High;
 /** reports unresolved state and refuses premature access */
 abstract reportsUnresolvedStateAndRefusesPrematureAccess(): ACResult;
 /** retains identity and refuses a second resolution */
 abstract retainsIdentityAndRefusesASecondResolution(): ACResult;
 /** supports the non-null value %j */
 abstract supportsTheNonNullValueJ(): ACResult;
 /** rejects nullish values from untyped consumers (%j) */
 abstract rejectsNullishValuesFromUntypedConsumersJ(): ACResult;
 /** accumulates all errors with frozen defensive snapshots */
 abstract accumulatesAllErrorsWithFrozenDefensiveSnapshots(): ACResult;
 /** preserves unexpected factory exceptions and clears the failed attempt */
 abstract preservesUnexpectedFactoryExceptionsAndClearsTheFailedAttempt(): ACResult;
 /** blocks configuration during construction and after success */
 abstract blocksConfigurationDuringConstructionAndAfterSuccess(): ACResult;
}

/** Retrospective requirement grounded in the preserved contract; stakeholder approval is not inferred. */
export abstract class BuilderValidationRequirement extends Requirement {
 readonly id = 'REQ-BUILDER-VALIDATION';
 readonly title = "Report independent validation failures together without hiding unexpected exceptions.";
 readonly priority = Priority.High;
 readonly status = 'Draft' as const;
 readonly kind = 'Functional' as const;
 readonly statement = { pattern: 'ubiquitous', response: this.title };
 readonly rationale = { kind: 'observed-contract', claim: this.title, evidence: [] };
 readonly fitCriteria = [{ kind: 'unit-test' as const, describes: this.title, binds: ["executesEverySyncAsyncValidatorInOrderAndSkipsInvalidConstruction","sharesValidationAndInstantiationBetweenConcurrentCallers","allowsAnExplicitAttemptAfterValidationFailure","preservesValidatorExceptionsWithoutInstantiating","passesTheInitiatingSignalThroughValidationAndFactoryHooks","checksCancellationAfterValidationBeforeInstantiating","preservesTypedDomainFailuresAndPermitsALaterExplicitBuild","returnsTheInstanceDirectlyPreservesItsPrototypeAndSharesCachedSuccessAcrossAliases","accumulatesEveryClassAndFluentFailureInDeclarationOrderOnTheSameInstance","copiesTheDecoratorValidatorListAndDoesNotExecuteValidatorsAtDecorationTime","supportsAnArgumentFreeStandardDecorator","rejectsDuplicateRuntimeDecorationWithoutOverwritingTheRegisteredRules","doesNotInheritValidatorsFromAnAncestorOrAnUnrelatedUndecoratedConstructor","doesNotCacheAValidationFailureAndAllowsExplicitCorrection","sharesOneConstructionAndValidationAcrossConcurrentCalls","preservesFactoryExceptionsAndPermitsALaterExplicitAttempt","preservesValidationExceptionsAndSkipsSubsequentRules","doesNotStartOrReturnACachedProductForAnAlreadyAbortedCall","cancelsAFollowerIndependentlyAndRemovesItsListener","passesInitiatingCancellationThroughRulesAndNeverCachesACancelledCandidate","buildsAValidatedImmutableUserThroughADomainSpecificFluentAPI","returnsAllInvalidUserFieldsAndSupportsCorrectingThemExplicitly"] }];
 readonly verificationMethod = 'Test';
 readonly source = { type: 'reverse-engineering', documents: 'Builder.ts/README.md; Builder.ts/src; Builder.Tests.ts/test', date: '2026-11-03' };
 readonly risk = { level: 'High', ifNotMet: 'The existing Builder consumer contract is broken.' };
}

@Satisfies(BuilderValidationRequirement)
export abstract class BuilderValidationFeature extends Feature {
 readonly id = BuilderFeatures.Validation.id;
 readonly title = "Report independent validation failures together without hiding unexpected exceptions.";
 readonly priority = Priority.High;
 /** executes every sync/async validator in order and skips invalid construction */
 abstract executesEverySyncAsyncValidatorInOrderAndSkipsInvalidConstruction(): ACResult;
 /** shares validation and instantiation between concurrent callers */
 abstract sharesValidationAndInstantiationBetweenConcurrentCallers(): ACResult;
 /** allows an explicit attempt after validation failure */
 abstract allowsAnExplicitAttemptAfterValidationFailure(): ACResult;
 /** preserves validator exceptions without instantiating */
 abstract preservesValidatorExceptionsWithoutInstantiating(): ACResult;
 /** passes the initiating signal through validation and factory hooks */
 abstract passesTheInitiatingSignalThroughValidationAndFactoryHooks(): ACResult;
 /** checks cancellation after validation before instantiating */
 abstract checksCancellationAfterValidationBeforeInstantiating(): ACResult;
 /** preserves typed domain failures and permits a later explicit build */
 abstract preservesTypedDomainFailuresAndPermitsALaterExplicitBuild(): ACResult;
 /** returns the instance directly, preserves its prototype and shares cached success across aliases */
 abstract returnsTheInstanceDirectlyPreservesItsPrototypeAndSharesCachedSuccessAcrossAliases(): ACResult;
 /** accumulates every class and fluent failure in declaration order on the same instance */
 abstract accumulatesEveryClassAndFluentFailureInDeclarationOrderOnTheSameInstance(): ACResult;
 /** copies the decorator validator list and does not execute validators at decoration time */
 abstract copiesTheDecoratorValidatorListAndDoesNotExecuteValidatorsAtDecorationTime(): ACResult;
 /** supports an argument-free standard decorator */
 abstract supportsAnArgumentFreeStandardDecorator(): ACResult;
 /** rejects duplicate runtime decoration without overwriting the registered rules */
 abstract rejectsDuplicateRuntimeDecorationWithoutOverwritingTheRegisteredRules(): ACResult;
 /** does not inherit validators from an ancestor or an unrelated undecorated constructor */
 abstract doesNotInheritValidatorsFromAnAncestorOrAnUnrelatedUndecoratedConstructor(): ACResult;
 /** does not cache a validation failure and allows explicit correction */
 abstract doesNotCacheAValidationFailureAndAllowsExplicitCorrection(): ACResult;
 /** shares one construction and validation across concurrent calls */
 abstract sharesOneConstructionAndValidationAcrossConcurrentCalls(): ACResult;
 /** preserves factory exceptions and permits a later explicit attempt */
 abstract preservesFactoryExceptionsAndPermitsALaterExplicitAttempt(): ACResult;
 /** preserves validation exceptions and skips subsequent rules */
 abstract preservesValidationExceptionsAndSkipsSubsequentRules(): ACResult;
 /** does not start or return a cached product for an already-aborted call */
 abstract doesNotStartOrReturnACachedProductForAnAlreadyAbortedCall(): ACResult;
 /** cancels a follower independently and removes its listener */
 abstract cancelsAFollowerIndependentlyAndRemovesItsListener(): ACResult;
 /** passes initiating cancellation through rules and never caches a cancelled candidate */
 abstract passesInitiatingCancellationThroughRulesAndNeverCachesACancelledCandidate(): ACResult;
 /** builds a validated immutable user through a domain-specific fluent API */
 abstract buildsAValidatedImmutableUserThroughADomainSpecificFluentAPI(): ACResult;
 /** returns all invalid user fields and supports correcting them explicitly */
 abstract returnsAllInvalidUserFieldsAndSupportsCorrectingThemExplicitly(): ACResult;
}

/** Retrospective requirement grounded in the preserved contract; stakeholder approval is not inferred. */
export abstract class BuilderReferencesRequirement extends Requirement {
 readonly id = 'REQ-BUILDER-REFERENCES';
 readonly title = "Construct connected and cyclic graphs without losing identity or recursively deadlocking.";
 readonly priority = Priority.High;
 readonly status = 'Draft' as const;
 readonly kind = 'Functional' as const;
 readonly statement = { pattern: 'ubiquitous', response: this.title };
 readonly rationale = { kind: 'observed-contract', claim: this.title, evidence: [] };
 readonly fitCriteria = [{ kind: 'unit-test' as const, describes: this.title, binds: ["keepsSiblingAncestryIndependent","infersAsyncProductsAndCachesTheSameResultAndReference","resolvesACyclicGraphThroughDeferredReferencesWithoutRecursionOrDeadlock","waitsForASharedChildInParallelSiblingPaths"] }];
 readonly verificationMethod = 'Test';
 readonly source = { type: 'reverse-engineering', documents: 'Builder.ts/README.md; Builder.ts/src; Builder.Tests.ts/test', date: '2026-11-03' };
 readonly risk = { level: 'High', ifNotMet: 'The existing Builder consumer contract is broken.' };
}

@Satisfies(BuilderReferencesRequirement)
export abstract class BuilderReferencesFeature extends Feature {
 readonly id = BuilderFeatures.References.id;
 readonly title = "Construct connected and cyclic graphs without losing identity or recursively deadlocking.";
 readonly priority = Priority.High;
 /** keeps sibling ancestry independent */
 abstract keepsSiblingAncestryIndependent(): ACResult;
 /** infers async products and caches the same result and reference */
 abstract infersAsyncProductsAndCachesTheSameResultAndReference(): ACResult;
 /** resolves a cyclic graph through deferred references without recursion or deadlock */
 abstract resolvesACyclicGraphThroughDeferredReferencesWithoutRecursionOrDeadlock(): ACResult;
 /** waits for a shared child in parallel sibling paths */
 abstract waitsForASharedChildInParallelSiblingPaths(): ACResult;
}

/** Retrospective requirement grounded in the preserved contract; stakeholder approval is not inferred. */
export abstract class BuilderConcurrencyRequirement extends Requirement {
 readonly id = 'REQ-BUILDER-CONCURRENCY';
 readonly title = "Concurrent consumers must share one construction attempt and observe the same successful product.";
 readonly priority = Priority.High;
 readonly status = 'Draft' as const;
 readonly kind = 'Functional' as const;
 readonly statement = { pattern: 'ubiquitous', response: this.title };
 readonly rationale = { kind: 'observed-contract', claim: this.title, evidence: [] };
 readonly fitCriteria = [{ kind: 'unit-test' as const, describes: this.title, binds: ["sharesConstructionAttempt"] }];
 readonly verificationMethod = 'Test';
 readonly source = { type: 'reverse-engineering', documents: 'Builder.ts/README.md; Builder.ts/src; Builder.Tests.ts/test', date: '2026-11-03' };
 readonly risk = { level: 'High', ifNotMet: 'The existing Builder consumer contract is broken.' };
}

@Satisfies(BuilderConcurrencyRequirement)
export abstract class BuilderConcurrencyFeature extends Feature {
 /** Concurrent callers share a single validation and construction attempt. */
 abstract sharesConstructionAttempt(): ACResult;
 readonly id = BuilderFeatures.Concurrency.id;
 readonly title = "Concurrent consumers must share one construction attempt and observe the same successful product.";
 readonly priority = Priority.High;

}

/** Retrospective requirement grounded in the preserved contract; stakeholder approval is not inferred. */
export abstract class BuilderCancellationRequirement extends Requirement {
 readonly id = 'REQ-BUILDER-CANCELLATION';
 readonly title = "Allow cooperative initiating cancellation and independent cancellation of a follower wait.";
 readonly priority = Priority.High;
 readonly status = 'Draft' as const;
 readonly kind = 'Functional' as const;
 readonly statement = { pattern: 'ubiquitous', response: this.title };
 readonly rationale = { kind: 'observed-contract', claim: this.title, evidence: [] };
 readonly fitCriteria = [{ kind: 'unit-test' as const, describes: this.title, binds: ["rejectsAlreadyAbortedCallsWithoutStartingOrReturningACachedProduct","cancelsAFollowerWithoutCancellingTheSharedConstruction","removesAFollowerCancellationListenerOnCompletion","removesAFollowerCancellationListenerOnRejection","doesNotCommitAProductWhenTheInitiatingSignalAbortsDuringIO","rejectsAnAlreadyAbortedWaitEvenWhenTheWorkHasAlreadySucceeded","releasesTheAbortListenerImmediatelyWhenCancellingWorkThatStaysPending"] }];
 readonly verificationMethod = 'Test';
 readonly source = { type: 'reverse-engineering', documents: 'Builder.ts/README.md; Builder.ts/src; Builder.Tests.ts/test', date: '2026-11-03' };
 readonly risk = { level: 'High', ifNotMet: 'The existing Builder consumer contract is broken.' };
}

@Satisfies(BuilderCancellationRequirement)
export abstract class BuilderCancellationFeature extends Feature {
 readonly id = BuilderFeatures.Cancellation.id;
 readonly title = "Allow cooperative initiating cancellation and independent cancellation of a follower wait.";
 readonly priority = Priority.High;
 /** rejects already aborted calls without starting or returning a cached product */
 abstract rejectsAlreadyAbortedCallsWithoutStartingOrReturningACachedProduct(): ACResult;
 /** cancels a follower without cancelling the shared construction */
 abstract cancelsAFollowerWithoutCancellingTheSharedConstruction(): ACResult;
 /** removes a follower cancellation listener on completion */
 abstract removesAFollowerCancellationListenerOnCompletion(): ACResult;
 /** removes a follower cancellation listener on rejection */
 abstract removesAFollowerCancellationListenerOnRejection(): ACResult;
 /** does not commit a product when the initiating signal aborts during I/O */
 abstract doesNotCommitAProductWhenTheInitiatingSignalAbortsDuringIO(): ACResult;
 /** rejects an already aborted wait even when the work has already succeeded */
 abstract rejectsAnAlreadyAbortedWaitEvenWhenTheWorkHasAlreadySucceeded(): ACResult;
 /** releases the abort listener immediately when cancelling work that stays pending */
 abstract releasesTheAbortListenerImmediatelyWhenCancellingWorkThatStaysPending(): ACResult;
}

/** Retrospective requirement grounded in the preserved contract; stakeholder approval is not inferred. */
export abstract class BuilderGenerationRequirement extends Requirement {
 readonly id = 'REQ-BUILDER-GENERATION';
 readonly title = "Generate deterministic typed fluent builders without executing model code or emitting invalid companions.";
 readonly priority = Priority.High;
 readonly status = 'Draft' as const;
 readonly kind = 'Functional' as const;
 readonly statement = { pattern: 'ubiquitous', response: this.title };
 readonly rationale = { kind: 'observed-contract', claim: this.title, evidence: [] };
 readonly fitCriteria = [{ kind: 'unit-test' as const, describes: this.title, binds: ["recognizesBoundPackageDecoratorsS","doesNotConfuseAnUnrelatedSameNamedDecoratorWithThePackageExport","supportsTheDefaultNameAndArgumentFreeClasses","rejectsIndirectRenamedExportsRatherThanEmittingAnInvalidNamedImport","diagnosesUnsupportedDeclarationsBeforeEmittingS","rejectsUnsupportedDecoratorOptionsS","diagnosesDuplicateClassAnnotations","diagnosesDuplicateOutputPathsInsteadOfReplacingADifferentClass","executesEmittedSettersRequiredSlotsDefaultsValidationAndLifecycleOnRealInstances","compilesEveryInternalLookingPublicNameWithoutCollisionsAndHandlesNonleadingRequiredSlots","providesActionableSourceLocatedDiagnosticsForSS","rejectsInvalidIdentifierJ","acceptsExplicitQuotedOptionsS","ignoresDecoratorsWithoutThePackageBindingS","ordersSourceEmissionsDeterministicallyAndPreservesChangesReportedByAnyOutput","propagatesOutputDiagnosticsAndNeverShortCircuitsLaterOutputWrites","skipsDeclarationsGeneratedCompanionsAndSourcesOutsideTheConfiguredRoot","usesModuleExtensionSCorrectlyAndAnchorsExtensionReplacementToTheFilename","defaultsRootDirToSrcAndPrefixesSameDirectoryImportsWith","reportsTheCollidingOutputPathWithoutWritingPreviouslyValidEmissions","reportsHandEditedOutputsWithoutChangingThemInVerificationMode","doesNotWriteAValidCompanionWhenAnotherClassHasAnUnsupportedConstructor","compilesAndExecutesConsumerWithClassValidation","preservesConstructorTypesDefaultsAndInternalNames"] }];
 readonly verificationMethod = 'Test';
 readonly source = { type: 'reverse-engineering', documents: 'Builder.ts/README.md; Builder.ts/src; Builder.Tests.ts/test', date: '2026-11-03' };
 readonly risk = { level: 'High', ifNotMet: 'The existing Builder consumer contract is broken.' };
}

@Satisfies(BuilderGenerationRequirement)
export abstract class BuilderGenerationFeature extends Feature {
 /** The installed generator produces a typed, executable consumer with real class validation. */
 abstract compilesAndExecutesConsumerWithClassValidation(): ACResult;
 /** Generated constructors preserve required and optional slots, defaults and collision-safe names. */
 abstract preservesConstructorTypesDefaultsAndInternalNames(): ACResult;
 readonly id = BuilderFeatures.Generation.id;
 readonly title = "Generate deterministic typed fluent builders without executing model code or emitting invalid companions.";
 readonly priority = Priority.High;
 /** recognizes bound package decorators (%s) */
 abstract recognizesBoundPackageDecoratorsS(): ACResult;
 /** does not confuse an unrelated same-named decorator with the package export */
 abstract doesNotConfuseAnUnrelatedSameNamedDecoratorWithThePackageExport(): ACResult;
 /** supports the default name and argument-free classes */
 abstract supportsTheDefaultNameAndArgumentFreeClasses(): ACResult;
 /** rejects indirect renamed exports rather than emitting an invalid named import */
 abstract rejectsIndirectRenamedExportsRatherThanEmittingAnInvalidNamedImport(): ACResult;
 /** diagnoses unsupported declarations before emitting: %s */
 abstract diagnosesUnsupportedDeclarationsBeforeEmittingS(): ACResult;
 /** rejects unsupported decorator options: %s */
 abstract rejectsUnsupportedDecoratorOptionsS(): ACResult;
 /** diagnoses duplicate class annotations */
 abstract diagnosesDuplicateClassAnnotations(): ACResult;
 /** diagnoses duplicate output paths instead of replacing a different class */
 abstract diagnosesDuplicateOutputPathsInsteadOfReplacingADifferentClass(): ACResult;
 /** executes emitted setters, required slots, defaults, validation and lifecycle on real instances */
 abstract executesEmittedSettersRequiredSlotsDefaultsValidationAndLifecycleOnRealInstances(): ACResult;
 /** compiles every internal-looking public name without collisions and handles nonleading required slots */
 abstract compilesEveryInternalLookingPublicNameWithoutCollisionsAndHandlesNonleadingRequiredSlots(): ACResult;
 /** provides actionable source-located diagnostics for %s %s */
 abstract providesActionableSourceLocatedDiagnosticsForSS(): ACResult;
 /** rejects invalid identifier %j */
 abstract rejectsInvalidIdentifierJ(): ACResult;
 /** accepts explicit quoted options %s */
 abstract acceptsExplicitQuotedOptionsS(): ACResult;
 /** ignores decorators without the package binding: %s */
 abstract ignoresDecoratorsWithoutThePackageBindingS(): ACResult;
 /** orders source emissions deterministically and preserves changes reported by any output */
 abstract ordersSourceEmissionsDeterministicallyAndPreservesChangesReportedByAnyOutput(): ACResult;
 /** propagates output diagnostics and never short-circuits later output writes */
 abstract propagatesOutputDiagnosticsAndNeverShortCircuitsLaterOutputWrites(): ACResult;
 /** skips declarations, generated companions and sources outside the configured root */
 abstract skipsDeclarationsGeneratedCompanionsAndSourcesOutsideTheConfiguredRoot(): ACResult;
 /** uses module extension .%s correctly and anchors extension replacement to the filename */
 abstract usesModuleExtensionSCorrectlyAndAnchorsExtensionReplacementToTheFilename(): ACResult;
 /** defaults rootDir to src and prefixes same-directory imports with ./ */
 abstract defaultsRootDirToSrcAndPrefixesSameDirectoryImportsWith(): ACResult;
 /** reports the colliding output path without writing previously valid emissions */
 abstract reportsTheCollidingOutputPathWithoutWritingPreviouslyValidEmissions(): ACResult;
 /** reports hand-edited outputs without changing them in verification mode */
 abstract reportsHandEditedOutputsWithoutChangingThemInVerificationMode(): ACResult;
 /** does not write a valid companion when another class has an unsupported constructor */
 abstract doesNotWriteAValidCompanionWhenAnotherClassHasAnUnsupportedConstructor(): ACResult;
}

/** Retrospective requirement grounded in the preserved contract; stakeholder approval is not inferred. */
export abstract class BuilderDistributionRequirement extends Requirement {
 readonly id = 'REQ-BUILDER-DISTRIBUTION';
 readonly title = "Allow consumers to use the public ESM package independently of its development checkout.";
 readonly priority = Priority.High;
 readonly status = 'Draft' as const;
 readonly kind = 'Functional' as const;
 readonly statement = { pattern: 'ubiquitous', response: this.title };
 readonly rationale = { kind: 'observed-contract', claim: this.title, evidence: [] };
 readonly fitCriteria = [{ kind: 'unit-test' as const, describes: this.title, binds: ["loadsThePublicESMExportAndConstructsAProductFromTheCompiledDistribution"] }];
 readonly verificationMethod = 'Test';
 readonly source = { type: 'reverse-engineering', documents: 'Builder.ts/README.md; Builder.ts/src; Builder.Tests.ts/test', date: '2026-11-03' };
 readonly risk = { level: 'High', ifNotMet: 'The existing Builder consumer contract is broken.' };
}

@Satisfies(BuilderDistributionRequirement)
export abstract class BuilderDistributionFeature extends Feature {
 readonly id = BuilderFeatures.Distribution.id;
 readonly title = "Allow consumers to use the public ESM package independently of its development checkout.";
 readonly priority = Priority.High;
 /** loads the public ESM export and constructs a product from the compiled distribution */
 abstract loadsThePublicESMExportAndConstructsAProductFromTheCompiledDistribution(): ACResult;
}

