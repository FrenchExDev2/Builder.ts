import { fileURLToPath } from 'node:url';
import { defineConfig } from '@frenchexdev2/ts-codegen-pipeline';
import { BuilderGenerator } from '@frenchexdev2/builder/generator';

export default defineConfig({
  consumerPackageRoot: fileURLToPath(new URL('./generated-user/', import.meta.url)),
  tsconfigPath: './tsconfig.json',
  outDir: 'src/generated',
  generators: [new BuilderGenerator()],
});
