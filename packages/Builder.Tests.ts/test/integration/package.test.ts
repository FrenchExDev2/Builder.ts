import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { BuilderDistributionFeature } from '@frenchexdev2/builder-requirements';
import { expect, it } from 'vitest';
import { Builder } from '@frenchexdev2/builder';


@FeatureTest(BuilderDistributionFeature)
class packagetesttsCase1 {
  @Verifies<BuilderDistributionFeature>('loadsThePublicESMExportAndConstructsAProductFromTheCompiledDistribution')
  async verify() {
  const product = Object.freeze({ name: 'Distribution' });
  const result = await Builder.create(async () => product).buildAsync();
  expect(result.isSuccess).toBe(true);
  expect(result.valueOrThrow().resolved()).toBe(product);
}
}
it('loads the public ESM export and constructs a product from the compiled distribution', new packagetesttsCase1().verify.bind(new packagetesttsCase1()));
