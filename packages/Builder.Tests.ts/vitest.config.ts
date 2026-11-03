import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import {standardProductionTransform} from './test/standard-transform.js';
import {builderSourceDirectory} from './test/package-paths.js';
/** Legacy RaC declarations are isolated from standard production decorators. */
const source=await builderSourceDirectory();
export default defineConfig({
 plugins:[standardProductionTransform()],
 test:{globals:false,environment:'node',testTimeout:60_000,hookTimeout:60_000,maxWorkers:2,server:{deps:{inline:[/@frenchexdev2[\\/](builder|builder-tests)/]}},
 projects:[
  {extends:true,resolve:{alias:[{find:/^@frenchexdev2\/builder\/generator$/,replacement:source+'generator/index.ts'},{find:/^@frenchexdev2\/builder$/,replacement:source+'index.ts'},{find:/^@builder-internal\//,replacement:source}]},test:{name:'source',include:['test/unit/**/*.test.ts']}},
  {extends:true,test:{name:'distribution',include:['test/integration/**/*.test.ts']}},
 ],
 coverage:{provider:'v8',allowExternal:true,include:[source+'**/*.ts'],exclude:['**/node_modules/**','**/src/index.ts'],reporter:['json-summary','json','html','text']}},
});
