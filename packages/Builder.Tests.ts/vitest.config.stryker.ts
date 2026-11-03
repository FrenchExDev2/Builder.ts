import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import {standardProductionTransform} from './test/standard-transform.js';
import {builderSourceDirectory} from './test/package-paths.js';
const source=await builderSourceDirectory();
export default defineConfig({
 plugins:[standardProductionTransform()],
 resolve:{alias:[{find:/^@frenchexdev2\/builder\/generator$/,replacement:source+'generator/index.ts'},{find:/^@frenchexdev2\/builder$/,replacement:source+'index.ts'},{find:/^@builder-internal\//,replacement:source}]},
 test:{root:fileURLToPath(new URL('./',import.meta.url)),globals:false,include:['test/unit/builder.test.ts','test/unit/validated-builder.test.ts','test/unit/wait-for.test.ts','test/unit/generator.test.ts'],coverage:{enabled:false},maxWorkers:1,fileParallelism:false},
});
