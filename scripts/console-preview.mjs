import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    root: { type: 'string' },
    config: { type: 'string' },
    port: { type: 'string' },
    core: { type: 'string' },
    erp: { type: 'string' },
  },
});
if (!values.root || !values.config || !values.port || !values.core)
  throw new Error('Specify root, public config, port and Core target');
const root = path.resolve(values.root),
  config = JSON.parse(fs.readFileSync(values.config, 'utf8')),
  core = new URL(values.core);
if (!['localhost', '127.0.0.1'].includes(core.hostname) || core.protocol !== 'http:')
  throw new Error('Preview accepts only a local disposable Core');
const erp = values.erp ? new URL(values.erp) : null;
if (erp && (!['localhost', '127.0.0.1'].includes(erp.hostname) || erp.protocol !== 'http:'))
  throw new Error('ERP fixture must be a local disposable service');
const issuer = new URL(config.issuer);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${issuer.origin}; frame-src ${issuer.origin}; img-src 'self' data: blob:; worker-src 'self'; font-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' ${issuer.origin}`,
  );
  if (url.pathname.startsWith('/core-api/') || (erp && url.pathname.startsWith('/api/v1/'))) {
    const target = url.pathname.startsWith('/core-api/') ? core : erp;
    const headers = { ...request.headers, host: target.host };
    delete headers.cookie;
    const upstream = http.request(
      new URL(url.pathname.replace(/^\/core-api/, '') + url.search, target),
      { method: request.method, headers },
      (result) => {
        response.writeHead(result.statusCode ?? 502, result.headers);
        result.pipe(response);
      },
    );
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end('Upstream unavailable');
    });
    request.pipe(upstream);
    request.on('aborted', () => upstream.destroy());
    response.on('close', () => upstream.destroy());
    return;
  }
  if (request.method !== 'GET') {
    response.writeHead(405);
    response.end();
    return;
  }
  if (url.pathname === '/console-config.json') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(config));
    return;
  }
  let filename;
  try {
    filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  if (
    (filename !== root && !filename.startsWith(root + path.sep)) ||
    url.pathname.split('/').some((p) => p.startsWith('.'))
  ) {
    response.writeHead(404);
    response.end();
    return;
  }
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile())
    filename = path.extname(url.pathname) ? '' : path.join(root, 'index.html');
  if (!filename) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.setHeader('Content-Type', mime[path.extname(filename)] ?? 'application/octet-stream');
  fs.createReadStream(filename).pipe(response);
});
server.listen(Number(values.port), '127.0.0.1', () =>
  process.stdout.write('Console preview ready on loopback\n'),
);
process.on('SIGTERM', () => server.close());
