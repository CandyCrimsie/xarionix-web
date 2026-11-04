import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import fs from 'node:fs';

// Browser failure snapshots can contain one-time invitation secrets or OAuth transactions.
// Keep them private to a local run; CI gets only test identity, status and duration.
export default class SafeReporter implements Reporter {
  private readonly results: { name: string; time: number; failed: boolean; skipped: boolean }[] =
    [];
  onTestEnd(test: TestCase, result: TestResult): void {
    const failed = !['passed', 'skipped'].includes(result.status);
    this.results.push({
      name: test.title,
      time: result.duration / 1000,
      failed,
      skipped: result.status === 'skipped',
    });
    process.stdout.write(
      `${failed ? 'FAIL' : result.status === 'skipped' ? 'SKIP' : 'PASS'} ${test.title}\n`,
    );
    if (failed) {
      // Allowlist a source location, never assertion values, DOM, URLs or request headers.
      const location = result.errors
        .map((error) => error.stack ?? '')
        .join('\n')
        .match(/console\.e2e\.ts:\d+:\d+/)?.[0];
      if (location) process.stdout.write(`Failure location: ${location}\n`);
    }
  }
  onEnd(result: FullResult): void {
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
      );
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync(
      'reports/console-e2e.xml',
      `<?xml version="1.0" encoding="utf-8"?><testsuite name="Console real integration" tests="${this.results.length}" failures="${this.results.filter((r) => r.failed).length}" skipped="${this.results.filter((r) => r.skipped).length}">${this.results.map((r) => `<testcase name="${escape(r.name)}" time="${r.time}">${r.failed ? '<failure message="Browser scenario failed. Private local diagnostics are deliberately excluded from CI artifacts."/>' : r.skipped ? '<skipped/>' : ''}</testcase>`).join('')}</testsuite>`,
    );
    process.stdout.write(`Console integration result: ${result.status}\n`);
  }
}
