// Dev codemod: wraps user-facing string literals / JSX text in tr("...") and lists all keys.
// Usage: node scripts/i18n-wrap.mjs [--dry] <files...>
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const files = args.filter((a) => !a.startsWith('--'));
const ATTRS = new Set(['title', 'label', 'placeholder', 'aria-label', 'hint', 'body', 'confirmLabel', 'cancelLabel', 'desc']);
const PROPS = new Set(['label', 'title', 'body', 'confirmLabel', 'cancelLabel', 'placeholder']);
const CALLS = new Set(['toast', 'setErr', 'setError']);
const keys = new Set();
const manual = [];
const hasLetters = (s) => /[A-Za-z]{2,}/.test(s);
const norm = (s) => s.replace(/\s*\n\s*/g, ' ');
const libI18n = path.resolve('src/lib/i18n');

const inFunction = (n) => {
  for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true;
  return false;
};

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const lit = (node, s) => {
    keys.add(s);
    return `tr(${JSON.stringify(s)})`;
  };
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const start = node.getStart(sf);
      const end = node.getEnd();
      const text = src.slice(start, end);
      if (hasLetters(text) && !text.includes('&')) {
        const lead = text.match(/^\s*/)[0];
        const trail = text.match(/\s*$/)[0];
        const core = norm(text.slice(lead.length, text.length - trail.length));
        keys.add(core);
        edits.push([start, end, `${lead}{tr(${JSON.stringify(core)})}${trail}`]);
      }
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(sf);
      if (ATTRS.has(name) && hasLetters(node.initializer.text)) edits.push([node.initializer.getStart(sf), node.initializer.getEnd(), `{${lit(node, node.initializer.text)}}`]);
    } else if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer) && PROPS.has(node.name.getText(sf)) && hasLetters(node.initializer.text)) {
      if (inFunction(node)) edits.push([node.initializer.getStart(sf), node.initializer.getEnd(), lit(node, node.initializer.text)]);
      else {
        keys.add(node.initializer.text);
        manual.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} top-level "${node.initializer.text}"`);
      }
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && CALLS.has(node.expression.text) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && hasLetters(node.arguments[0].text)) {
      const a = node.arguments[0];
      edits.push([a.getStart(sf), a.getEnd(), lit(a, a.text)]);
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isStringLiteral(node.right) && hasLetters(node.right.text) && (ts.isElementAccessExpression(node.left) || ts.isPropertyAccessExpression(node.left)) && node.left.expression.getText(sf) === 'e') {
      edits.push([node.right.getStart(sf), node.right.getEnd(), lit(node.right, node.right.text)]);
    } else if (
      ts.isStringLiteral(node) &&
      /^[A-Z][a-z]/.test(node.text) &&
      ((ts.isConditionalExpression(node.parent) && node !== node.parent.condition) ||
        (ts.isBinaryExpression(node.parent) && node.parent.right === node && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.parent.operatorToken.kind)))
    ) {
      edits.push([node.getStart(sf), node.getEnd(), lit(node, node.text)]);
    } else if ((ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) && hasLetters(node.getText(sf)) && (ts.isJsxExpression(node.parent) || ts.isPropertyAssignment(node.parent) || ts.isCallExpression(node.parent))) {
      manual.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} template ${node.getText(sf).slice(0, 90)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!edits.length || dry) continue;
  let out = src;
  for (const [s, e, r] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + r + out.slice(e);
  if (!/import \{[^}]*\bt as tr\b[^}]*\} from '[^']*lib\/i18n'/.test(out)) {
    let rel = path.relative(path.dirname(path.resolve(file)), libI18n).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    const imports = [...out.matchAll(/^import [\s\S]*?;\s*$/gm)];
    const last = imports[imports.length - 1];
    const pos = last ? last.index + last[0].length : 0;
    out = out.slice(0, pos) + `\nimport { t as tr } from '${rel}';` + out.slice(pos);
  }
  fs.writeFileSync(file, out);
  console.log(`wrapped ${edits.length} in ${file}`);
}
fs.writeFileSync('scripts/i18n-keys.json', JSON.stringify([...keys].sort(), null, 1));
console.log(`\n${keys.size} keys\nMANUAL:\n` + manual.join('\n'));
