/** Check the dependency graph and preserved registrations without executing application modules. */
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
const packages=resolve(root,'packages');
const folders=['Builder.ts','Builder.SharedKernel.ts','Builder.Requirements.ts','Builder.Tests.ts'];
const manifests=new Map();
for(const folder of folders){const manifest=JSON.parse(await readFile(resolve(packages,folder,'package.json'),'utf8'));manifests.set(manifest.name,{folder,manifest});}
const active=new Set(),done=new Set();
function visit(name){if(active.has(name))throw new Error(`Dependency cycle: ${[...active,name].join(' -> ')}`);if(done.has(name))return;active.add(name);const item=manifests.get(name);for(const dependency of Object.keys({...item.manifest.dependencies,...item.manifest.peerDependencies,...item.manifest.optionalDependencies})){if(manifests.has(dependency))visit(dependency);}active.delete(name);done.add(name);}
for(const name of manifests.keys())visit(name);
const allowed={
 'Builder.ts':new Set(['@frenchexdev2/builder-shared-kernel','@frenchexdev2/result','@frenchexdev2/ts-codegen-pipeline']),
 'Builder.SharedKernel.ts':new Set(['@frenchexdev2/requirements-shared-kernel/participation']),
 'Builder.Requirements.ts':new Set(['@frenchexdev2/builder-shared-kernel','@frenchexdev2/requirements-shared-kernel']),
};
async function scan(folder,dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=resolve(dir,entry.name);if(entry.isDirectory())await scan(folder,file);else if(entry.name.endsWith('.ts')){const sf=ts.createSourceFile(file,await readFile(file,'utf8'),ts.ScriptTarget.Latest,true);for(const node of sf.statements){if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){const name=node.moduleSpecifier.text;if(name.startsWith('@frenchexdev2/')&&!allowed[folder].has(name))throw new Error(`Forbidden dependency in ${file}: ${name}`);if(folder==='Builder.ts'&&name==='@frenchexdev2/ts-codegen-pipeline'&&!file.replaceAll('\\','/').includes('/src/generator/'))throw new Error('Generation tooling imported by Builder runtime');}}}}}
for(const folder of Object.keys(allowed))await scan(folder,resolve(packages,folder,'src'));
const migration=JSON.parse(await readFile(resolve(packages,'Builder.Tests.ts/migration.json'),'utf8'));
let checked=0;
for(const criterion of migration.criteria){const file=resolve(packages,'Builder.Tests.ts',criterion.file);const sf=ts.createSourceFile(file,await readFile(file,'utf8'),ts.ScriptTarget.Latest,true);let found=false;function find(node){if(ts.isCallExpression(node)&&ts.isStringLiteral(node.arguments[0]??{})&&node.arguments[0].text===criterion.title)found=true;ts.forEachChild(node,find);}find(sf);if(!found)throw new Error(`Preserved registration missing: ${criterion.file} / ${criterion.title}`);checked++;}
const library=manifests.get('@frenchexdev2/builder').manifest;
if(Object.keys(library.scripts).some(name=>name.startsWith('test')))throw new Error('Library still owns a test runner');
console.log(JSON.stringify({projects:manifests.size,acyclic:true,allowedImports:true,preservedRegistrations:checked}));
