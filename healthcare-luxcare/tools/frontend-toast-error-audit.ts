import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ToastErrorRule = "browser-alert" | "inline-alert-role" | "inline-error-value" | "inline-error-copy";

export type ToastErrorViolation = {
  file: string;
  rule: ToastErrorRule;
};

export function findToastErrorViolations(file: string, source: string): ToastErrorViolation[] {
  const violations: ToastErrorViolation[] = [];
  const add = (rule: ToastErrorRule) => violations.push({ file, rule });

  if (/\b(?:window\.)?alert\s*\(/.test(source)) add("browser-alert");
  if (!file.replaceAll("\\", "/").endsWith("/pages/Toast.tsx") && /role\s*=\s*["']alert["']/.test(source)) {
    add("inline-alert-role");
  }
  if (
    /\{\s*(?:error|[A-Za-z]\w*Error)\s*(?:&&|\?)/.test(source) ||
    />\s*\{(?:error|[A-Za-z]\w*Error)\}\s*</.test(source)
  ) {
    add("inline-error-value");
  }
  const inlineCopies = [...source.matchAll(/<[^>]+className=["'][^"']*(?:text|bg|border)-(?:red|rose)-[^"']*["'][^>]*>([^<]*(?:Đã xảy ra lỗi|Lỗi |thất bại)[^<]*)/gi)]
    .map((match) => match[1].trim())
    .filter((copy) => copy !== "Lỗi kết nối");
  if (inlineCopies.length > 0) {
    add("inline-error-copy");
  }
  return violations;
}

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [target] : [];
  });
}

export function auditFrontend(root = path.resolve("src")): ToastErrorViolation[] {
  return sourceFiles(root).flatMap((file) => findToastErrorViolations(path.relative(process.cwd(), file), fs.readFileSync(file, "utf8")));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const violations = auditFrontend();
  if (violations.length > 0) {
    for (const violation of violations) console.error(`${violation.file}: ${violation.rule}`);
    process.exitCode = 1;
  } else {
    console.log("Toast error audit passed: no browser alerts or inline user-facing error messages found.");
  }
}
