import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export type SourceEvidence = { file: string; line: number; text: string };
const slash = (s: string) => s.replaceAll("\\", "/");
export function scanManualGuideSources(root = "src") {
  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = slash(path.join(dir, entry.name));
      if (entry.isDirectory()) walk(file);
      else if (/\.tsx?$/.test(file) && !/\.(test|spec)\./.test(file)) files.push(file);
    }
  }
  walk(root);
  const sources = files.map(file => {
    const text = fs.readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const labels: SourceEvidence[] = [];
    const endpoints: SourceEvidence[] = [];
    const imports: string[] = [];
    function addImport(spec: string) {
      if (!spec.startsWith(".")) return;
      const base = slash(path.normalize(path.join(path.dirname(file), spec)));
      const resolved = [base, base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"].find(candidate => files.includes(candidate));
      if (resolved) imports.push(resolved);
    }
    function visit(node: ts.Node) {
      const literal = ts.isStringLiteralLike(node) || ts.isJsxText(node) ? node.text.trim().replace(/\s+/g, " ") : "";
      const evidence = (value: string) => ({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, text: value });
      if (literal && /[À-ỹ]/u.test(literal) && literal.length < 200 && !literal.includes("className")) labels.push(evidence(literal));
      if (literal.startsWith("/") && !literal.includes(" ")) endpoints.push(evidence(literal.replace(/^\/api\/v1/, "").split("?")[0]));
      if (ts.isTemplateExpression(node)) {
        const value = node.head.text + node.templateSpans.map(span => ":param" + span.literal.text).join("");
        if (value.startsWith("/")) endpoints.push(evidence(value.replace(/^\/api\/v1/, "").split("?")[0]));
      }
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        addImport(node.moduleSpecifier.text);
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) addImport(node.arguments[0].text);
      if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) addImport(node.moduleSpecifier.text);
      ts.forEachChild(node, visit);
    }
    visit(ast);
    return { file, labels, endpoints, imports };
  });
  return sources;
}

export function reachableSourceFiles(sources: ReturnType<typeof scanManualGuideSources>, entry = "src/main.tsx") {
  const byFile = new Map(sources.map(s => [s.file, s]));
  const reached = new Set<string>();
  function visit(file: string) {
    if (reached.has(file)) return;
    reached.add(file);
    for (const imported of byFile.get(file)?.imports || []) visit(imported);
  }
  visit(entry);
  return reached;
}

export function endpointShape(value: string) {
  return value.replace(/:[A-Za-z_][\w]*(?:\?)?/g, ":param").replace(/\/$/, "");
}
