import ts from 'typescript';
import {fileURLToPath} from 'node:url';
import {builderSourceDirectory} from './package-paths.js';
const production=await builderSourceDirectory();
const tests=fileURLToPath(new URL('./',import.meta.url)).replaceAll('\\','/');
/** Compile standard production decorators independently of legacy RaC test declarations. */
export function standardProductionTransform(){
 return {name:'builder-standard-decorators',enforce:'pre' as const,
  transform(code:string,id:string){
   const file=id.split('?')[0]!.replaceAll('\\','/');
   const standard=file.startsWith(production);
   if((!standard&&!file.startsWith(tests))||!file.endsWith('.ts'))return;
   const output=ts.transpileModule(code,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,experimentalDecorators:!standard,sourceMap:true,inlineSources:true}});
   const map=output.sourceMapText?JSON.parse(output.sourceMapText):null;
   return {code:output.outputText,map};
  }
 };
}
