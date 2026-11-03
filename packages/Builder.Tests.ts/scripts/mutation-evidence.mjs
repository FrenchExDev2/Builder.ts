/** Attribute mutants through actual Stryker test IDs and preserved individual AC bindings. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {aggregateByAc} from '@frenchexdev2/requirements-behavioral-check';
import {sourceHash} from '@frenchexdev2/requirements-trace/code-trace';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=resolve(process.argv[2]);
const report=JSON.parse(await readFile(resolve(run,'mutation/mutation-report.json'),'utf8'));
const evidence=JSON.parse(await readFile(resolve(root,'test-results/latest-evidence.json'),'utf8'));
const snapshot=JSON.parse(await readFile(resolve(run,'source-snapshot.json'),'utf8'));
const changed=[];for(const [file,hash] of Object.entries({...snapshot.sources,...snapshot.inputs})){let current;try{current=sourceHash(await readFile(file,'utf8'));}catch{}if(hash!==current)changed.push(file);}
const normalize=name=>name.replaceAll(' > ',' ').replaceAll(' › ',' ').replace(/\s+/g,' ').trim();
const mapped=new Map(),unmatched=[];
const parsed=[];
for(const [file,tests] of Object.entries(report.testFiles??{}))for(const test of tests.tests??[]){
 const candidates=evidence.tests.filter(ref=>ref.file.replaceAll('\\','/').endsWith(file.replaceAll('\\','/'))&&normalize(ref.test)===normalize(test.name));
 if(!candidates.length){unmatched.push({file,test:test.name});continue;}
 const className='Execution'+mapped.size;
 mapped.set(test.id,`${className} > verify`);
 const targets=Object.entries(report.files??{}).filter(([,entry])=>entry.mutants?.some(m=>m.coveredBy?.includes(test.id))).map(([file])=>({file,symbol:'runtime-covered'}));
 for(const ref of candidates)parsed.push({file,classes:[{className,featureClass:ref.featureId,methods:[{methodName:'verify',ac:ref.ac,targets}]}],warnings:[]});
}
const normalized={...report,testFiles:Object.fromEntries(Object.entries(report.testFiles??{}).map(([file,entry])=>[file,{...entry,tests:entry.tests?.map(test=>({...test,name:mapped.get(test.id)??test.name}))}]))};
const perAc=aggregateByAc(normalized,parsed,new Map(),{thresholdPercent:100});
const mutants=Object.values(report.files??{}).flatMap(f=>f.mutants??[]);
const counts=Object.fromEntries([...new Set(mutants.map(m=>m.status))].map(status=>[status,mutants.filter(m=>m.status===status).length]));
const denominator=(counts.Killed??0)+(counts.Timeout??0)+(counts.Survived??0)+(counts.NoCoverage??0);
const summary={counts,score:denominator?100*((counts.Killed??0)+(counts.Timeout??0))/denominator:null,perAc,
 unattributedAcs:[...new Set(evidence.tests.map(t=>t.featureId+'.'+t.ac))].filter(key=>!perAc.entries.some(entry=>entry.acId===key&&entry.relevantTotal>0)),
 unattributedMutants:mutants.filter(m=>!m.coveredBy?.some(id=>mapped.has(id))).length,unmatchedTests:unmatched,changedInputs:changed,
 evidenceState:changed.length?'stale':mapped.size?'attributed':'missing-attribution',
 note:'Global score counts unique mutants. Per-AC aggregation counts observations separately; no-targets is vacuous.'};
await writeFile(resolve(run,'mutation-evidence.json'),JSON.stringify(summary,null,2)+'\n','utf8');
if(!changed.length){evidence.mutation={...summary,runId:run.split(/[\\/]/).at(-1)};await writeFile(resolve(root,'test-results/latest-evidence.json'),JSON.stringify(evidence,null,2)+'\n','utf8');}
console.log(JSON.stringify({counts,score:summary.score,attributedAcs:perAc.entries.length,unattributedMutants:summary.unattributedMutants,changedInputs:changed},null,2));
if(changed.length)process.exitCode=1;
