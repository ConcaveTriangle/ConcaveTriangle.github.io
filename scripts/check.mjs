import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
export async function publicFiles(root=projectRoot){
  const files=['index.html','index.css','site.js','profile.jpeg','CNAME','.nojekyll',
    'studios/halvorsen/index.html','studios/attractors/index.html',
    'studios/attractors/styles.css','studios/attractors/js/attractors.js','studios/attractors/js/app.js'];
  for(const dir of ['projects','research'])for(const entry of await readdir(resolve(root,dir)))if(entry.endsWith('.html'))files.push(`${dir}/${entry}`);
  return files;
}
export async function checkSite(root=projectRoot){
  const files=await publicFiles(root), html=new Map(), errors=[], external=new Set();let localLinks=0;
  for(const file of files){await stat(resolve(root,file));if(extname(file)==='.html')html.set(resolve(root,file),await readFile(resolve(root,file),'utf8'));}
  for(const [file,source] of html){
    if((source.match(/<h1\b/g)||[]).length!==1)errors.push(`${file}: expected one h1`);
    if(!/<title>[^<]+<\/title>/.test(source)||!/<meta name="description"/.test(source))errors.push(`${file}: missing page metadata`);
    const ids=[...source.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);if(new Set(ids).size!==ids.length)errors.push(`${file}: duplicate element IDs`);
    for(const img of source.matchAll(/<img\b[^>]*>/g))if(!/\balt="[^"]*"/.test(img[0]))errors.push(`${file}: image missing alt text`);
    for(const m of source.matchAll(/<(?:a|link|script|img)\b[^>]*?\b(?:href|src)="([^"]*)"/g)){
      const ref=m[1].replaceAll('&amp;','&');
      if(!ref||ref==='#'||/^javascript:/i.test(ref)){errors.push(`${file}: empty or placeholder link`);continue;}
      if(/^https?:/.test(ref)){external.add(ref);continue;}if(/^mailto:/.test(ref))continue;
      const [beforeHash,hash]=ref.split('#');const pathname=beforeHash.split('?')[0];const target=pathname?resolve(dirname(file),decodeURIComponent(pathname)):file;
      try{await stat(target);localLinks++;}catch{errors.push(`${file}: missing local target ${ref}`);continue;}
      if(hash && html.has(target) && !new RegExp(`\\bid=["']${hash}["']`).test(html.get(target)))errors.push(`${file}: missing anchor ${ref}`);
    }
  }
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(`Checked ${html.size} pages, ${localLinks} local links/assets, and ${external.size} distinct external URLs. No missing targets or placeholder links.`);
  return files;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await checkSite(process.argv[2]?resolve(process.argv[2]):projectRoot);
