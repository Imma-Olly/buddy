// A static file server for local play: `npm start`, then open the URL.
//
// The game is plain files — GitHub Pages serves them as-is — but ES modules
// won't load over file://, so you need a server of some kind to try it locally.
//
// Local means local: it binds the loopback interface, because "a dev server"
// that answers on the LAN is handing the whole working tree to the coffee shop.

import { createServer } from 'node:http';
import { createReadStream, realpathSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 8000);
const HOST = process.env.HOST ?? '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * Map a request path to a file inside ROOT, or null if it doesn't resolve to
 * one. Everything that can throw on hostile input lives in here: a request must
 * never be able to take the process down.
 */
function resolve(pathname) {
  let rel;
  try {
    rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  } catch {
    return null; // "/%", and anything else that isn't valid percent-encoding
  }

  let file = join(ROOT, rel === '/' ? 'index.html' : rel);

  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    // Resolve symlinks before the containment check: startsWith on the
    // unresolved path is lexical, so a link inside the tree pointing out of it
    // would otherwise be served.
    file = realpathSync(file);
  } catch {
    return null;
  }

  return file === ROOT || file.startsWith(ROOT + '/') ? file : null;
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = resolve(url.pathname);

  if (!file) {
    res.writeHead(404).end('Not found');
    return;
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(PORT, HOST, () => {
  console.log(`bee-dle running at http://localhost:${PORT} 🐝`);
});
