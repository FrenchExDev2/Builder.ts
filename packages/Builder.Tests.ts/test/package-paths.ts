import {realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
/** Only project sources outside node_modules may be tested or instrumented. */
export async function builderSourceDirectory(directory?:string){
 const source=await realpath(directory??process.env.BUILDER_SOURCE_DIRECTORY??fileURLToPath(new URL('../../Builder.ts/src/',import.meta.url)));
 if(source.split(/[\\/]/).some(part=>part.toLowerCase()==='node_modules'))throw new Error('Builder source tests and coverage must run outside node_modules. Use the project sources or extract the test archives into a separate workspace.');
 return source.replaceAll('\\','/').replace(/\/?$/,'/');
}
/** Public installed distribution root, independent of workspace folder names. */
export function builderPackageDirectory(){return fileURLToPath(new URL('../',import.meta.resolve('@frenchexdev2/builder')));}
