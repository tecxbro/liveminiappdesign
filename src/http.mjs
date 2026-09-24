import { readFile } from 'node:fs/promises';
import { CardError, assert } from './errors.mjs';
import { object } from './model.mjs';
import { secureEqual } from './service.mjs';
import { renderCard, escapeHTML } from '../public/card-template.mjs';
import { demoView, galleryHTML } from './demo.mjs';

const assets = new Map([
  ['/card.css', ['card.css', 'text/css; charset=utf-8']],
  ['/card-client.mjs', ['card-client.mjs', 'text/javascript; charset=utf-8']],
  ['/card-template.mjs', ['card-template.mjs', 'text/javascript; charset=utf-8']],
  ['/gallery.css', ['gallery.css', 'text/css; charset=utf-8']],
  ['/assets/study.png', ['assets/study.png', 'image/png']],
  ['/assets/hands.png', ['assets/hands.png', 'image/png']],
]);
function bearer(req) {
  const h = req.headers.authorization;
  return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : '';
}
export function pageHTML(view) {
  const data = JSON.stringify(view).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>Live task</title><meta property="og:title" content="Task progress"><meta property="og:description" content="Read-only task progress"><link rel="stylesheet" href="/card.css"></head><body><div id="card-root">${renderCard(view)}</div><script id="card-data" type="application/json">${data}</script><script type="module" src="/card-client.mjs"></script></body></html>`;
}
function security(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // No guessed iframe ancestor allowlist: the actual Spectrum host must be verified first.
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'");
}
function send(res, status, value, type = 'application/json; charset=utf-8', head = false) {
  res.statusCode = status; res.setHeader('Content-Type', type);
  res.end(head ? undefined : Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(value));
}
async function jsonBody(req) {
  assert((req.headers['content-type'] || '').split(';')[0].trim() === 'application/json', 'CONTENT_TYPE', 'Use application/json.', 415);
  assert(!req.headers['content-length'] || Number(req.headers['content-length']) <= 16_384, 'BODY_TOO_LARGE', 'Body must not exceed 16 KiB.', 413);
  const chunks = []; let size = 0;
  // Bounded incoming stream; on limit we stop consuming and the handler closes the connection.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    assert(size <= 16_384, 'BODY_TOO_LARGE', 'Body must not exceed 16 KiB.', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new CardError('INVALID_JSON', 'Body is not valid JSON.', 400); }
}

export function createHandler(service, config) {
  return async function handle(req, res) {
    security(res);
    try {
      const url = new URL(req.url || '/', config.baseUrl);
      let path = url.pathname;
      // Build Output API rewrite transports the original path to our one function.
      if (path === '/index' && url.searchParams.has('__path')) path = url.searchParams.get('__path');
      assert(path.startsWith('/') && !path.startsWith('//') && path.length <= 1024, 'INVALID_PATH', 'Invalid path.');
      const method = req.method || 'GET', isRead = method === 'GET' || method === 'HEAD';
      if (isRead && assets.has(path)) {
        const [file, type] = assets.get(path);
        const bytes = await readFile(new URL(`../public/${file}`, import.meta.url));
        return send(res, 200, bytes, type, method === 'HEAD');
      }
      if (isRead && path === '/health') return send(res, 200, { ok: true, app: 'live-task-cards', version: '1.0.0' }, undefined, method === 'HEAD');
      if (isRead && config.demos && (path === '/' || path === '/preview')) return send(res, 200, galleryHTML(), 'text/html; charset=utf-8', method === 'HEAD');
      const demo = /^\/demo\/([a-z]+)$/.exec(path);
      if (isRead && config.demos && demo) {
        const view = await demoView(demo[1]);
        assert(view, 'NOT_FOUND', 'Example not found.', 404);
        return send(res, 200, pageHTML(view), 'text/html; charset=utf-8', method === 'HEAD');
      }
      const page = /^\/(live-(?:[1-9]|10))\/([a-zA-Z0-9-]+)$/.exec(path);
      if (isRead && page) {
        const view = await service.view(page[1], page[2], url.searchParams.get('k') || '');
        return send(res, 200, pageHTML(view), 'text/html; charset=utf-8', method === 'HEAD');
      }
      const readView = /^\/api\/view\/(live-(?:[1-9]|10))\/([a-zA-Z0-9-]+)$/.exec(path);
      if (isRead && readView) return send(res, 200, await service.view(readView[1], readView[2], bearer(req)), undefined, method === 'HEAD');
      if (!path.startsWith('/api/')) return send(res, 404, '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/card.css"><title>Live task</title><body><div class="unavailable">This card is unavailable.</div></body></html>', 'text/html; charset=utf-8');
      // Only the trusted server-side publisher gets these operations. Read capabilities never write.
      assert(secureEqual(bearer(req), config.publisherToken), 'UNAUTHORIZED', 'Publisher authentication required.', 401);
      if (method === 'GET' && path === '/api/slots') return send(res, 200, await service.slots());
      if (method === 'GET' && path === '/api/doctor') {
        const slots = await service.slots();
        return send(res, 200, { ok: true, storage: config.store, slotLimit: 10,
          occupied: slots.filter(s => s.occupied).length, pendingPresentations: slots.filter(s => s.presentationPending).length,
          liveDeviceVerified: false, userActionCallbacks: false });
      }
      if (method === 'POST' && path === '/api/cards') return send(res, 201, await service.create(await jsonBody(req)));
      const card = /^\/api\/cards\/([a-zA-Z0-9-]+)(?:\/(presentation\/begin|presentation\/settle|release|discard))?$/.exec(path);
      if (card) {
        const [, id, action] = card;
        if (!action && method === 'GET') return send(res, 200, await service.get(id));
        if (!action && method === 'PUT') return send(res, 200, await service.update(id, await jsonBody(req)));
        if (method === 'POST' && action) {
          const body = await jsonBody(req);
          if (action === 'presentation/begin') return send(res, 200, await service.beginPresentation(id, body));
          if (action === 'presentation/settle') return send(res, 200, await service.settlePresentation(id, body));
          if (action === 'release') { object(body, 'release', ['expectedRevision']); return send(res, 200, await service.release(id, body.expectedRevision)); }
          if (action === 'discard') { object(body, 'discard', []); return send(res, 200, await service.discard(id)); }
        }
      }
      throw new CardError('NOT_FOUND', 'Operation does not exist.', 404);
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      const known = error instanceof CardError;
      if (!known) console.error('live-task-cards: internal request failure'); // Never log keys, URLs or request bodies.
      const status = known ? error.status : 500;
      if (status === 413) res.setHeader('Connection', 'close');
      send(res, status, { error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'Request failed. Check server configuration and storage.' } });
    }
  };
}
