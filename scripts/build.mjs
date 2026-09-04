import { mkdir, copyFile, lstat, realpath, rm } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { checkSite, projectRoot } from './check.mjs';
const files=await checkSite();
const output=resolve(projectRoot,'dist');
// Rebuild generated output from the allowlist so renamed studio assets do not
// remain in a deployment. Refuse links or paths outside this project's dist.
try {
  const info=await lstat(output);
  if(!info.isDirectory() || info.isSymbolicLink() || relative(await realpath(projectRoot),await realpath(output))!=='dist') {
    throw new Error('Refusing to replace an unsafe build-output path.');
  }
  await rm(output,{recursive:true});
} catch(error) { if(error.code!=='ENOENT')throw error; }
for(const file of files){const target=resolve(output,file);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(projectRoot,file),target);}
await mkdir(resolve(output,'.openai'),{recursive:true});
await copyFile(resolve(projectRoot,'.openai/hosting.json'),resolve(output,'.openai/hosting.json'));
console.log(`Built ${files.length} public files in dist/. No runtime dependencies.`);
