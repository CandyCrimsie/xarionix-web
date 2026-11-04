import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve('projects/xarionix-console/src');
const errors = [];
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
for (const filename of files(root)) {
  if (filename.endsWith('.spec.ts') || filename.endsWith('test-setup.ts')) continue;
  const text = fs.readFileSync(filename, 'utf8');
  if (
    /\[innerHTML\]|bypassSecurityTrust|\beval\s*\(|new\s+Function\s*\(|window\.(alert|confirm|prompt)\s*\(/.test(
      text,
    )
  )
    errors.push(`${filename}: unsafe browser primitive`);
  if (/<(select|textarea|input|button)\b/.test(text)) {
    for (const match of text.matchAll(/<(select|textarea|input|button)\b[^>]*>/g))
      if (!/hlm(Input|Textarea|Btn|Select|Sidebar|Tabs|Dropdown|Collapsible)/.test(match[0]))
        errors.push(`${filename}: standard control without Spartan: ${match[1]}`);
  }
  if (!filename.endsWith('.ts')) continue;
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  function inspect(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const name = node.moduleSpecifier.text;
      if (
        name.startsWith('.') &&
        path.resolve(path.dirname(filename), name).startsWith(path.resolve('src'))
      )
        errors.push(`${filename}: ERP import`);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      !ts.isStringLiteral(node.arguments[0])
    )
      errors.push(`${filename}: runtime import`);
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression.getText(source),
        method = node.expression.name.text;
      if (receiver === 'console' && ['log', 'error', 'warn', 'debug', 'info'].includes(method))
        errors.push(`${filename}: browser console may leak API/auth state`);
      if (
        receiver === 'localStorage' &&
        ['setItem', 'getItem'].includes(method) &&
        node.arguments[0]?.getText(source) !== "'xarionix.console.theme'"
      )
        errors.push(`${filename}: unexpected persistent storage`);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}
const angular = JSON.parse(fs.readFileSync('angular.json', 'utf8'));
const erp = angular.projects['xarionix-web'],
  consoleApp = angular.projects['xarionix-console'];
if (erp.sourceRoot !== 'src' || consoleApp.sourceRoot !== 'projects/xarionix-console/src')
  errors.push('ERP/Console source isolation changed');
if (erp.architect.serve.options.proxyConfig !== 'src/proxy.conf.json')
  errors.push('ERP proxy changed');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Console isolation, standard controls and browser trust boundaries passed');
