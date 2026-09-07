import { readFile, readdir, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, extname, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://site.invalid';

export async function publicFiles(root = projectRoot) {
  const files = [
    'index.html', 'index.css', 'site.js', 'profile.jpeg', 'CNAME', '.nojekyll',
    'studios/halvorsen/index.html', 'studios/attractors/index.html',
    'studios/attractors/styles.css', 'studios/attractors/js/attractors.js',
    'studios/attractors/js/app.js',
  ];
  for (const directory of ['projects', 'research']) {
    const entries = await readdir(resolve(root, directory), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.endsWith('.html')) files.push(`${directory}/${entry.name}`);
    }
  }
  return files;
}

export async function checkSite(root = projectRoot) {
  const files = await publicFiles(root);
  const allowed = new Set(files);
  const contents = new Map();
  const anchors = new Map();
  const errors = [];
  const external = new Set();
  const realRoot = await realpath(root);
  let localLinks = 0;

  for (const file of files) {
    const path = resolve(root, file);
    const info = await lstat(path);
    const actual = relative(realRoot, await realpath(path));
    if (!info.isFile() || info.isSymbolicLink() || actual === '..' || actual.startsWith(`..${sep}`) || isAbsolute(actual)) {
      throw new Error(`Public file must be a regular file inside the site: ${file}`);
    }
    if (!['.html', '.css'].includes(extname(file))) continue;
    const source = await readFile(path, 'utf8');
    contents.set(file, source);
    if (extname(file) !== '.html') continue;
    const ids = [...source.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
    anchors.set(file, new Set(ids));
    if (new Set(ids).size !== ids.length) errors.push(`${file}: duplicate element IDs`);
    if ((source.match(/<h1\b/gi) || []).length !== 1) errors.push(`${file}: expected one h1`);
    if (!/<title>[^<]+<\/title>/i.test(source) || !/<meta\b[^>]*name=["']description["']/i.test(source)) {
      errors.push(`${file}: missing page title or description`);
    }
    for (const image of source.matchAll(/<img\b[^>]*>/gi)) {
      if (!/\balt=["'][^"']*["']/i.test(image[0])) errors.push(`${file}: image missing alt text`);
    }
  }

  function checkReference(file, reference) {
    const ref = reference.replaceAll('&amp;', '&').trim();
    if (!ref || ref === '#' || /^javascript:/i.test(ref)) {
      errors.push(`${file}: empty or placeholder link`);
      return;
    }
    if (/^(mailto:|tel:|data:)/i.test(ref)) return;
    try {
      const url = new URL(ref, `${origin}/${file}`);
      if (url.origin !== origin) {
        if (!/^https?:$/.test(url.protocol)) errors.push(`${file}: unsupported URL ${ref}`);
        else external.add(url.href);
        return;
      }
      let target = decodeURIComponent(url.pathname).slice(1);
      if (!target || target.endsWith('/')) target += 'index.html';
      // Check the deployment manifest, not just the working tree. This also
      // catches filename-case mismatches on Windows before deployment to Linux.
      if (!allowed.has(target)) {
        errors.push(`${file}: local target is missing from the public build: ${ref}`);
        return;
      }
      localLinks++;
      if (url.hash && anchors.has(target) && !anchors.get(target).has(decodeURIComponent(url.hash.slice(1)))) {
        errors.push(`${file}: missing anchor ${ref}`);
      }
    } catch {
      errors.push(`${file}: invalid URL ${ref}`);
    }
  }

  for (const [file, source] of contents) {
    if (extname(file) === '.html') {
      for (const tag of source.matchAll(/<(?:a|link|script|img)\b[^>]*>/gi)) {
        for (const attribute of tag[0].matchAll(/\b(?:href|src)=["']([^"']*)["']/gi)) {
          checkReference(file, attribute[1]);
        }
      }
    } else {
      for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
        if (!match[1].startsWith('#')) checkReference(file, match[1]);
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Checked ${anchors.size} pages and ${localLinks} local links/assets. ${external.size} external URLs found (not fetched).`);
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkSite(process.argv[2] ? resolve(process.argv[2]) : projectRoot);
}
