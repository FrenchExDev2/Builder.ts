/** Snapshot all execution inputs before starting the runner. */
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadCodeTrace,sourceHash,tracePath} from '@frenchexdev2/requirements-trace/code-trace';
import {checkCompatibility} from './check-compatibility.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=resolve(process.argv[2]);
const config=process.env.RAC_TRACE_CONFIG??resolve(root,'../../.requirements.json');
const project=await loadCodeTrace(config);
const inputs={};
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=resolve(dir,entry.name);if(entry.isDirectory())await walk(file);else if(/\.(?:[cm]?ts|[cm]?js|json)$/.test(entry.name))inputs[tracePath(file)]=sourceHash(await readFile(file,'utf8'));}}
await walk(resolve(root,'test'));
await walk(resolve(root,'scripts'));
for(const file of ['package.json','vitest.config.ts','vitest.config.stryker.ts','stryker.conf.cjs',config,fileURLToPath(new URL('./specification.json',import.meta.resolve('@frenchexdev2/builder-requirements')))])inputs[tracePath(resolve(root,file))]=sourceHash(await readFile(resolve(root,file),'utf8'));
for(const name of ['@frenchexdev2/builder','@frenchexdev2/builder-shared-kernel','@frenchexdev2/builder-requirements'])await walk(fileURLToPath(new URL('./',import.meta.resolve(name))));
await mkdir(run,{recursive:true});
await writeFile(resolve(run,'source-snapshot.json'),JSON.stringify({sources:project.sources,inputs,versions:await checkCompatibility()},null,2)+'\n','utf8');
console.log(JSON.stringify({sources:Object.keys(project.sources).length,inputs:Object.keys(inputs).length}));
