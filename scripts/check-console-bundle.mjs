import fs from 'node:fs';
import path from 'node:path';
const root = 'dist/xarionix-console/browser';
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Build Console first');
const config = JSON.parse(fs.readFileSync(path.join(root, 'console-config.json'), 'utf8'));
if (config.development !== false)
  throw new Error('Production Console must not contain development configuration');
for (const name of fs.readdirSync(root)) {
  if (!name.endsWith('.js') && !name.endsWith('.html')) continue;
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  if (/new Function\(|\beval\(/.test(text))
    throw new Error('CSP-incompatible code in Console bundle');
  if (/client_secret["']?\s*:\s*["'][A-Za-z0-9_-]{16,}/.test(text))
    throw new Error('Possible embedded client secret');
  if (/app-login|app-setup|app-auth-layout/.test(text))
    throw new Error('Legacy password/setup UI entered the unified OIDC bundle');
}
if (/onload=|onerror=/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')))
  throw new Error('Critical CSS generated an inline event handler incompatible with CSP');
console.log('Unified production bundle: CSP, secret and legacy login isolation passed');
