import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative, resolve } from "node:path";

export interface AuditFinding {
  file: string;
  line: number;
  text: string;
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json"]);
const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-server",
  "docs",
  "logs",
  "uploads",
  "coverage",
]);
const RETIRED_MODULE_PATTERN = /modules[\\/]?(?:student-management|worker-management)/;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot).toLowerCase();
}

function isRuntimeSource(fileName: string): boolean {
  if (/\.(?:test|spec)\.[^.]+$/i.test(fileName)) return false;
  return SOURCE_EXTENSIONS.has(extensionOf(fileName));
}

function sourceFiles(rootDir: string): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;

      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile() && isRuntimeSource(entry.name)) {
        files.push(absolutePath);
      }
    }
  }

  if (statSync(rootDir).isDirectory()) visit(resolve(rootDir));
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

export function auditRetiredHrSurfaces(rootDir: string): AuditFinding[] {
  const absoluteRoot = resolve(rootDir);
  const findings: AuditFinding[] = [];

  for (const filePath of sourceFiles(absoluteRoot)) {
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((text, index) => {
      if (!RETIRED_MODULE_PATTERN.test(text)) return;
      findings.push({
        file: relative(absoluteRoot, filePath).replaceAll("\\", "/"),
        line: index + 1,
        text: text.trim(),
      });
    });
  }

  return findings.sort((left, right) => left.file.localeCompare(right.file, "en") || left.line - right.line);
}

function runCli(): void {
  const rootDir = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  const findings = auditRetiredHrSurfaces(rootDir);
  if (findings.length === 0) {
    process.stdout.write("No retired HR runtime surfaces found.\n");
    return;
  }

  for (const finding of findings) {
    process.stderr.write(`${finding.file}:${finding.line}: ${finding.text}\n`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
