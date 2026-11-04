import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const result = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8' });
if (result.error) throw result.error;
let audit;
try {
  audit = JSON.parse(result.stdout);
} catch {
  throw new Error('Dependency audit unavailable; refusing a false pass');
}
if (audit.error) throw new Error('Dependency audit failed; retry when the registry is available');
const allowed = 'https://github.com/advisories/GHSA-mrhx-c7xc-m3w5';
const exceptionExpires = Date.parse('2026-11-18T00:00:00Z');
const failures = [];
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
for (const [name, item] of Object.entries(audit.vulnerabilities ?? {})) {
  if (!['high', 'critical'].includes(item.severity)) continue;
  // Narrow, time-bounded tooling-only exception: Zod 3 is required by the existing Spartan generator.
  const explained =
    (name === 'zod' && item.via.every((v) => typeof v === 'object' && v.url === allowed)) ||
    (name === '@spartan-ng/cli' &&
      item.via.includes('zod') &&
      item.via.every(
        (v) =>
          typeof v === 'string' &&
          (v === 'zod' || ['info', 'low', 'moderate'].includes(audit.vulnerabilities[v]?.severity)),
      ));
  const toolingOnly =
    item.nodes?.length &&
    item.nodes.every(
      (node) =>
        lock.packages[node]?.dev === true &&
        (name === 'zod'
          ? node === 'node_modules/@spartan-ng/cli/node_modules/zod'
          : node === 'node_modules/@spartan-ng/cli'),
    );
  if (item.severity === 'critical' || !toolingOnly || !explained || Date.now() >= exceptionExpires)
    failures.push(name);
}
const production = spawnSync('npm', ['audit', '--omit=dev', '--audit-level=high', '--json'], {
  encoding: 'utf8',
});
if (production.status !== 0) failures.push('production dependency audit');
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync(
  'reports/console-dependency-audit.json',
  JSON.stringify(
    {
      counts: audit.metadata?.vulnerabilities,
      exception: {
        advisory: allowed,
        scope: 'Spartan generator Zod 3 only; not shipped in browser',
        expires: '2026-11-18',
      },
      failures,
    },
    null,
    2,
  ),
);
if (failures.length) throw new Error('Dependency security gate failed: ' + failures.join(', '));
console.log(
  'Production dependency audit passed; documented generator exception remains until 2026-11-18',
);
