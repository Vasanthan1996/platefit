// Local development server: serves the front end from ./public (or ./dist after a build)
// and the API from /api/v1. No dependencies. Run `npm run dev`.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './scripts/env.js';

const root = path.dirname(fileURLToPath(import.meta.url));
loadEnv(root);
const { handleNode, getRuntime } = await import('./api/_lib/runtime.js');

const STATIC = process.argv.includes('--dist') ? path.join(root, 'dist') : path.join(root, 'public');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };

function serveFile(res, file) {
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/v1/')) {
      return await handleNode(req, res, url.pathname.slice('/api/v1/'.length), Object.fromEntries(url.searchParams.entries()));
    }
    const safe = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = path.join(STATIC, safe);
    if (!file.startsWith(STATIC)) { res.writeHead(400); return res.end('Bad path'); }
    const isFile = (f) => fs.existsSync(f) && fs.statSync(f).isFile();
    const hit = [file, `${file}.html`, path.join(file, 'index.html')].find(isFile); // cleanUrls, like Vercel
    if (hit) return serveFile(res, hit);
    if (path.extname(safe)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    return serveFile(res, path.join(STATIC, 'index.html')); // SPA fallback
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Server error');
  }
});

server.listen(PORT, () => {
  const { mode, problem } = getRuntime();
  console.log(`PlateFit running at http://localhost:${PORT}  (data: ${mode}${problem ? ` - ${problem}` : ''})`);
  if (mode === 'memory') console.log('Using the in-memory store: data resets when the server stops. Add Google Sheets variables to .env to persist.');
});
