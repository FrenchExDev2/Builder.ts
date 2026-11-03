/** Typecheck the published suite using declarations resolved from installed packages. */
import ts from 'typescript';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=resolve(root,'test/tsconfig.json');
const loaded=ts.readConfigFile(file,ts.sys.readFile);
const options=ts.parseJsonConfigFileContent(loaded.config,ts.sys,resolve(root,'test'),{paths:{'@builder-internal/*':[fileURLToPath(new URL('../dist/*.d.ts',import.meta.resolve('@frenchexdev2/builder')))]}},file);
const diagnostics=[...(loaded.error?[loaded.error]:[]),...options.errors,...ts.getPreEmitDiagnostics(ts.createProgram(options.fileNames,options.options))];
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));process.exitCode=1;}
