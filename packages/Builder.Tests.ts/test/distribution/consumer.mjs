/** Consume compiled public exports from a fixture outside node_modules, without instrumenting dependencies. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Builder,Reference} from '@frenchexdev2/builder';
import * as generator from '@frenchexdev2/builder/generator';
import {BuilderFeatures,getParticipation} from '@frenchexdev2/builder-shared-kernel';
import {BuilderConcurrencyFeature} from '@frenchexdev2/builder-requirements';

assert.ok(import.meta.resolve('@frenchexdev2/builder').replaceAll('\\','/').includes('/node_modules/'));
const product={name:'archive consumer'};
let attempts=0;
let release;
const gate=new Promise(resolve=>{release=resolve;});
const builder=Builder.create(async()=>{attempts++;await gate;return product;});
const reference=builder.reference();
assert.equal(reference.isResolved,false);
const first=builder.buildAsync(),second=builder.buildAsync();
release();
const results=await Promise.all([first,second]);
for(const result of results){assert.equal(result.isSuccess,true);assert.equal(result.value,reference);assert.equal(result.value.resolved(),product);}
assert.equal(attempts,1);
assert.equal((await builder.buildAsync()).value,reference);
assert.equal(attempts,1);
assert.equal(new Reference().resolve(false).resolved(),false);
const rejected=await Builder.create(()=>{throw new Error('Invalid input must prevent construction');}).withValidation(v=>v.addError('Required',['name'])).buildAsync();
assert.equal(rejected.isFailure,true);
assert.equal(rejected.error.message,'Required');
assert.ok(getParticipation(Builder).some(feature=>feature.id===BuilderFeatures.Construction.id));
assert.equal(new BuilderConcurrencyFeature().id,BuilderFeatures.Concurrency.id);
assert.ok(Object.keys(generator).length>0);
const summary={success:true,scope:'public compiled exports consumed outside node_modules',coverage:false,checks:['shared concurrent attempt','cached reference','validation before construction','primitive reference','participation metadata','specification identity','generator exports']};
await writeFile(new URL('./consumer-summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n','utf8');
console.log(JSON.stringify(summary));
