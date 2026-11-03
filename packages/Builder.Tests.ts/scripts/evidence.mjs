/** Correlate preserved Vitest registrations to individual results and snapshot their inputs. */
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
import {loadCodeTrace,sourceHash,tracePath,codeGaps} from '@frenchexdev2/requirements-trace/code-trace';
import {checkCompatibility} from './check-compatibility.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=resolve(process.argv[2]??resolve(root,'test-results/latest'));
const config=process.env.RAC_TRACE_CONFIG??resolve(root,'../../.requirements.json');
const project=await loadCodeTrace(config);
const versions=await checkCompatibility();
const report=JSON.parse(await readFile(resolve(run,'tests.json'),'utf8'));
const spec=project.features;
const featureNames=new Map(spec.map(f=>[`Builder${f.key}Feature`,f]));
const inputs={},testEvidence=[],gaps=[];
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern=title=>new RegExp('^'+title.split(/%[sdifjoOc#%]/).map(escape).join('.*')+'$','s');
const ledger=JSON.parse(await readFile(resolve(root,'migration.json'),'utf8'));
const originalFiles=new Set(ledger.criteria.map(c=>c.file));
async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=resolve(dir,entry.name);if(entry.isDirectory())await visit(file);else if(entry.name.endsWith('.test.ts')){
 const text=await readFile(file,'utf8');inputs[tracePath(file)]=sourceHash(text);
 const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 const classes=new Map();
 function collect(node){if(ts.isClassDeclaration(node)&&node.name){const refs=[];for(const member of node.members)if(ts.canHaveDecorators(member))for(const dec of ts.getDecorators(member)??[]){const call=dec.expression;if(ts.isCallExpression(call)&&call.expression.getText(sf)==='Verifies'&&call.typeArguments?.length&&call.arguments.length){const feature=featureNames.get(call.typeArguments[0].getText(sf));const ac=call.arguments[0].text;if(!feature||!feature.acs.some(a=>a.name===ac))throw new Error(`Invalid AC reference in ${file}: ${ac}`);refs.push({featureId:feature.id,ac});}}classes.set(node.name.text,refs);}ts.forEachChild(node,collect);}collect(sf);
 const suite=report.testResults.find(s=>tracePath(s.name)===tracePath(file));
 function registrations(node){if(ts.isCallExpression(node)&&node.arguments.length>=2&&ts.isStringLiteral(node.arguments[0])){const callback=node.arguments[1];if(ts.isCallExpression(callback)&&ts.isPropertyAccessExpression(callback.expression)&&callback.expression.name.text==='bind'){
 const className=callback.expression.expression.expression?.expression?.getText(sf);
 const refs=classes.get(className);
 if(refs){const matches=(suite?.assertionResults??[]).filter(t=>pattern(node.arguments[0].text).test(t.title));if(!matches.length)gaps.push({file,title:node.arguments[0].text,reason:'no individual execution result'});for(const match of matches)for(const ref of refs)testEvidence.push({...ref,file:tracePath(file),test:match.fullName,status:match.status==='passed'?'passed':match.status==='pending'||match.status==='skipped'?'skipped':'failed'});}
 }}ts.forEachChild(node,registrations);}registrations(sf);
 if(originalFiles.has(relative(root,file).replaceAll('\\','/')))for(const test of suite?.assertionResults??[]){if(!testEvidence.some(ref=>ref.file===tracePath(file)&&ref.test===test.fullName))gaps.push({file,title:test.fullName,reason:'original testcase has no AC evidence binding'});}
}}}
await visit(resolve(root,'test'));
for(const file of ['package.json','vitest.config.ts','vitest.config.stryker.ts','stryker.conf.cjs',config])inputs[tracePath(resolve(root,file))]=sourceHash(await readFile(resolve(root,file),'utf8'));
const specFile=fileURLToPath(new URL('./specification.json',import.meta.resolve('@frenchexdev2/builder-requirements')));
inputs[tracePath(specFile)]=sourceHash(await readFile(specFile,'utf8'));
let coverage;try{coverage=JSON.parse(await readFile(resolve(run,'coverage/coverage-summary.json'),'utf8'));}catch{}
const runtimeCoverage={};
try{const raw=JSON.parse(await readFile(resolve(run,'coverage/coverage-final.json'),'utf8'));for(const [file,value] of Object.entries(raw)){const lines=new Set();for(const [id,count] of Object.entries(value.s)){if(count>0){const location=value.statementMap[id];for(let line=location.start.line;line<=location.end.line;line++)lines.add(line);}}runtimeCoverage[tracePath(file)]=[...lines].sort((a,b)=>a-b);}}catch{}
let mutation;try{const raw=JSON.parse(await readFile(resolve(run,'mutation/mutation-report.json'),'utf8'));const mutants=Object.values(raw.files).flatMap(f=>f.mutants);mutation={counts:Object.fromEntries([...new Set(mutants.map(m=>m.status))].map(status=>[status,mutants.filter(m=>m.status===status).length])),attributionAvailable:mutants.some(m=>m.coveredBy?.length||m.killedBy?.length),report:relative(root,resolve(run,'mutation/mutation-report.json'))};}catch{}
const snapshot=JSON.parse(await readFile(resolve(run,'source-snapshot.json'),'utf8'));
const changed=[];
for(const [file,hash] of Object.entries({...snapshot.inputs,...snapshot.sources})){let current;try{current=sourceHash(await readFile(file,'utf8'));}catch{}if(current!==hash)changed.push(file);}
const measuredCoverage=coverage?.total?.lines?.total>0;
const evidence={runId:process.env.TEST_RUN_ID??run.split(/[\\/]/).at(-1),versions,configurations:snapshot.inputs,inputs:snapshot.inputs,sources:snapshot.sources,tests:testEvidence,coverage,runtimeCoverage,mutation,complete:report.success&&measuredCoverage&&!gaps.length&&testEvidence.length>0&&!changed.length,executionGaps:gaps,changedInputs:changed};
await mkdir(run,{recursive:true});
await writeFile(resolve(run,'evidence.json'),JSON.stringify(evidence,null,2)+'\n','utf8');
await mkdir(resolve(root,'test-results'),{recursive:true});
await writeFile(resolve(root,'test-results/latest-evidence.json'),JSON.stringify(evidence,null,2)+'\n','utf8');
const result={...project,evidence,inputHashes:snapshot.inputs};
const absent=codeGaps(result).filter(g=>g.unprovedAcs.length);
await writeFile(resolve(run,'compliance.json'),JSON.stringify({gaps:absent,annotationDiagnostics:project.diagnostics,evidenceComplete:evidence.complete},null,2)+'\n','utf8');
const html=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const link=(file,line=1)=>pathToFileURL(file).href+'#L'+line;
const body=spec.map(f=>`<section id="${html(f.id)}"><h2>${html(f.id)}</h2><p>${f.requirement.declaration?`<a href="${html(link(f.requirement.declaration.file,f.requirement.declaration.line))}">${html(f.requirement.id)}</a>`:html(f.requirement.id)}: ${html(f.requirement.rationale)}</p><p>Status: ${html(f.requirement.status)}</p><h3>Declared implementation participation</h3><ul>${project.links.filter(l=>l.featureId===f.id).map(l=>`<li><a href="${html(link(l.file,l.start))}">${html(l.file)}:${l.start}</a> (${l.origin})</li>`).join('')}</ul><h3>Acceptance criteria and executed tests</h3><ul>${f.acs.map(ac=>`<li>${html(ac.name)} — ${testEvidence.filter(t=>t.featureId===f.id&&t.ac===ac.name).map(t=>`<a href="${html(link(t.file))}">${html(t.status+': '+t.test)}</a>`).join('; ')||'missing evidence'}</li>`).join('')}</ul></section>`).join('');
await writeFile(resolve(run,'trace.html'),`<!doctype html><meta charset="utf-8"><title>Builder requirements — ${html(evidence.runId)}</title><h1>Builder — traceability</h1><p>Declared participation, execution coverage and mutation results are separate evidence.</p><nav>${spec.map(f=>`<a href="#${html(f.id)}">${html(f.id)}</a>`).join(' | ')}</nav>${body}`,'utf8');
console.log(JSON.stringify({runId:evidence.runId,passedBindings:testEvidence.filter(t=>t.status==='passed').length,complete:evidence.complete,gaps:absent,registrationGaps:gaps},null,2));
if(!evidence.complete||absent.length||project.diagnostics.length)process.exitCode=1;
