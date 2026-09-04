import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { checkSite, projectRoot } from './check.mjs';
const files=await checkSite();
const output=resolve(projectRoot,'dist');
for(const file of files){const target=resolve(output,file);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(projectRoot,file),target);}
await mkdir(resolve(output,'.openai'),{recursive:true});
await copyFile(resolve(projectRoot,'.openai/hosting.json'),resolve(output,'.openai/hosting.json'));
console.log(`Built ${files.length} public files in dist/. No runtime dependencies.`);
