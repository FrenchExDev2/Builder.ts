import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { satisfies } from 'semver';
/** Pure guard also used by negative conformance tests. */
export function assertPackageCompatibility(expected,versions){for(const [name,range] of Object.entries(expected)){if(!versions[name]||!satisfies(versions[name],range))throw new Error(`Incompatible ${name}@${versions[name]??'missing'}; expected ${range}`);}return versions;}
/** Reject unsupported combinations before registering any tests. */
export async function checkCompatibility() {
 const suite=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 const versions={};
 for(const [name,range] of Object.entries(suite.builderCompatibility)) {
  const entry=fileURLToPath(import.meta.resolve(name));
  const manifest=JSON.parse(await readFile(resolve(dirname(entry),'../package.json'),'utf8'));
  versions[name]=manifest.version;
 }
 return assertPackageCompatibility(suite.builderCompatibility,versions);
}
