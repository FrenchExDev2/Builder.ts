#!/usr/bin/env node
import {checkCompatibility} from './check-compatibility.mjs';
import {mkdir,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
/** Run project tests only; installed packages are consumed by an external smoke fixture. */
try {
 const versions=await checkCompatibility();
 if(process.argv.includes('--check'))console.log(JSON.stringify({compatible:true,versions},null,2));
 else{
  const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
  if(root.split(/[\\/]/).some(part=>part.toLowerCase()==='node_modules'))throw new Error('Do not run tests from node_modules. Extract the suite into packages/Builder.Tests.ts alongside the Builder project sources.');
  const run=resolve(process.env.BUILDER_TEST_OUTPUT??resolve(root,'test-results',new Date().toISOString().replaceAll(':','-')));
  await mkdir(run,{recursive:true});
  process.env.TEST_RUN_ID=run.split(/[\\/]/).at(-1);
  process.argv[2]=run;
  await import('./snapshot.mjs');
  const {startVitest}=await import('vitest/node');
  const ctx=await startVitest('test',[],{root,config:resolve(root,'vitest.config.ts'),run:true,watch:false,coverage:{enabled:true,reportsDirectory:resolve(run,'coverage')},reporters:['default','json'],outputFile:{json:resolve(run,'tests.json')}});
  await ctx?.close();
  await import('./evidence.mjs');
 }
} catch(error){console.error(error.message);process.exitCode=1;}
