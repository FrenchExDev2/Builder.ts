import { featureReference } from '@frenchexdev2/requirements-shared-kernel/participation';

export { ParticipatesIn, getParticipation, type FeatureReference } from '@frenchexdev2/requirements-shared-kernel/participation';
export { checkFeatureEvolution, type FeatureRetirement } from '@frenchexdev2/requirements-shared-kernel/participation';

/** Explicit tombstones for previously published feature identities; never silently delete an identity. */
export const BuilderFeatureRetirements = Object.freeze({});

/** Builder's canonical feature identities. No acceptance criteria or test implementation lives here. */
export const BuilderFeatures = Object.freeze({
  Construction: featureReference('BUILDER-CONSTRUCTION'),
  Validation: featureReference('BUILDER-VALIDATION'),
  References: featureReference('BUILDER-REFERENCES'),
  Concurrency: featureReference('BUILDER-CONCURRENCY'),
  Cancellation: featureReference('BUILDER-CANCELLATION'),
  Generation: featureReference('BUILDER-GENERATION'),
  Distribution: featureReference('BUILDER-DISTRIBUTION'),
});
