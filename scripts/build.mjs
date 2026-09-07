import { mkdir, copyFile, lstat, realpath, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { checkSite, projectRoot } from './check.mjs';

// Validate the source before replacing any generated output.
const files = await checkSite();
const assetVersions = new Map();
for (const file of files) {
  if (['.css', '.js'].includes(extname(file))) {
    const content = await readFile(resolve(projectRoot, file));
    assetVersions.set(file, createHash('sha256').update(content).digest('hex').slice(0, 12));
  }
}

function versionAssets(file, source) {
  // Changing the URL prevents a CDN or browser from combining new HTML with
  // an older cached stylesheet or script. Preserve relative paths and queries.
  return source.replace(/(<(?:link|script)\b[^>]*?\b(?:href|src)=)(["'])([^"']+)\2/gi, (match, prefix, quote, reference) => {
    const url = new URL(reference.replaceAll('&amp;', '&'), `https://site.invalid/${file}`);
    if (url.origin !== 'https://site.invalid') return match;
    const version = assetVersions.get(decodeURIComponent(url.pathname).slice(1));
    if (!version) return match;
    url.searchParams.set('v', version);
    const path = reference.split(/[?#]/)[0];
    const updated = `${path}${url.search}${url.hash}`.replaceAll('&', '&amp;');
    return `${prefix}${quote}${updated}${quote}`;
  });
}

const output = resolve(projectRoot, 'dist');
try {
  const info = await lstat(output);
  if (!info.isDirectory() || info.isSymbolicLink() || relative(await realpath(projectRoot), await realpath(output)) !== 'dist') {
    throw new Error('Refusing to replace an unsafe build-output path.');
  }
  await rm(output, { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

for (const file of files) {
  const target = resolve(output, file);
  await mkdir(dirname(target), { recursive: true });
  if (extname(file) === '.html') {
    const source = await readFile(resolve(projectRoot, file), 'utf8');
    await writeFile(target, versionAssets(file, source));
  } else {
    await copyFile(resolve(projectRoot, file), target);
  }
}
await checkSite(output);
console.log(`Built ${files.length} public files in dist/.`);
