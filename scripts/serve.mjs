import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { checkSite, projectRoot } from './check.mjs';

const root = process.argv[2] ? resolve(process.argv[2]) : projectRoot;
const allowed = new Set(await checkSite(root));
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.jpeg': 'image/jpeg',
};

createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  try {
    let file = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1);
    if (!file || file.endsWith('/')) file += 'index.html';
    if (!allowed.has(file)) throw new Error('Not found');
    const content = await readFile(resolve(root, file));
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'text/plain; charset=utf-8',
      'Content-Length': content.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : 'Page not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
