/** Emit portable metadata from canonical declarations; never execute Builder implementation. */
import ts from 'typescript';
import { readFile, writeFile } from 'node:fs/promises';
import * as declarations from '../dist/index.js';
import {BuilderFeatures,BuilderFeatureRetirements,checkFeatureEvolution} from '@frenchexdev2/builder-shared-kernel';
const previous=JSON.parse(await readFile(new URL('../provenance/feature-identities.json',import.meta.url),'utf8'));
const evolutionErrors=checkFeatureEvolution(previous,Object.values(BuilderFeatures),BuilderFeatureRetirements);
if(evolutionErrors.length)throw new Error(evolutionErrors.join('\n'));
const source=await readFile(new URL('../src/index.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('index.ts',source,ts.ScriptTarget.Latest,true);
const features=[];
for(const node of ast.statements) {
 if(!ts.isClassDeclaration(node)||!node.name||!node.heritageClauses?.some(clause=>clause.types.some(type=>type.expression.getText(ast)==='Feature')))continue;
 const name=node.name.text, feature=new declarations[name]();
 const satisfies=(ts.getDecorators(node)??[]).map(d=>d.expression).find(e=>ts.isCallExpression(e)&&e.expression.getText(ast)==='Satisfies');
 if(!satisfies||satisfies.arguments.length!==1)throw new Error(`Expected explicit requirement link on ${name}`);
 const requirement=new declarations[satisfies.arguments[0].getText(ast)]();
 const requirementNode=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text===satisfies.arguments[0].getText(ast));
 const identity=Object.entries(BuilderFeatures).find(([,reference])=>reference.id===feature.id);
 if(!identity)throw new Error(`Unknown business feature identity: ${feature.id}`);
 features.push({id:feature.id,key:identity[0],title:feature.title,...identity[1],declaration:{file:'../src/index.ts',line:ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1},
  requirement:{id:requirement.id,rationale:requirement.rationale.claim,status:requirement.status,provenance:JSON.stringify(requirement.source),declaration:{file:'../src/index.ts',line:ast.getLineAndCharacterOfPosition(requirementNode.getStart(ast)).line+1}},
  acs:node.members.filter(ts.isMethodDeclaration).map(method=>({name:method.name.getText(ast),title:ts.getJSDocCommentsAndTags(method).map(c=>c.comment??'').join(' '),file:'src/index.ts',line:ast.getLineAndCharacterOfPosition(method.getStart(ast)).line+1}))});
}
if(features.length!==Object.keys(BuilderFeatures).length)throw new Error('Every business feature must have exactly one specification');
await writeFile(new URL('../dist/specification.json',import.meta.url),JSON.stringify(features,null,2)+'\n','utf8');
