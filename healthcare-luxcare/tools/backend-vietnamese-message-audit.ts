import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface EnglishUserMessageFinding {
  file: string;
  line: number;
  text: string;
}

const excludedPath = (file: string) =>
  /(?:^|\/)(?:infrastructure|config|model|interface|scripts?|migrations?)(?:\/|$)/.test(file.replaceAll("\\", "/"))
  || /(?:\.test|\.spec)\.tsx?$/.test(file)
  || /server\/modules\/(?:student-management|worker-management)\//.test(file.replaceAll("\\", "/"))
  || /server\/(?:security\/crypto|socket-protection)\.ts$/.test(file.replaceAll("\\", "/"))
  || /server\/service\/(?:cloudinary|insightface|openrouter)\.service\.ts$/.test(file.replaceAll("\\", "/"));

const machineLiteral = (text: string) =>
  /^(?:OK|SUCCESS|ERROR|[A-Z][A-Z0-9_:.\/-]+)$/.test(text)
  || /^[a-z][a-z0-9_]+$/.test(text)
  || /^(?:GET|POST|PUT|PATCH|DELETE)\s/.test(text)
  || /^https?:\/\//.test(text);

const likelyEnglish = (text: string) => {
  if (machineLiteral(text) || /[À-ỹĐđ]/u.test(text)) return false;
  const words = text.match(/[A-Za-z]{2,}/g) ?? [];
  return words.length >= 2;
};

export function findEnglishUserMessages(file: string, source: string): EnglishUserMessageFinding[] {
  if (excludedPath(file)) return [];
  const findings: EnglishUserMessageFinding[] = [];
  const patterns = [
    /\bmessage\s*:\s*["'`]([^"'`\r\n]+)["'`]/g,
    /(?:throw\s+)?new\s+(?:[A-Za-z]+Error|Error)\s*\(\s*["'`]([^"'`\r\n]+)["'`]/g,
    /next\(\s*new\s+Error\s*\(\s*["'`]([^"'`\r\n]+)["'`]/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const text = match[1].trim();
      if (!likelyEnglish(text)) continue;
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      findings.push({ file, line, text });
    }
  }
  return findings.filter((finding, index, all) =>
    all.findIndex((item) => item.line === finding.line && item.text === finding.text) === index,
  );
}

const walk = (directory: string): string[] => readdirSync(directory).flatMap((name) => {
  const target = path.join(directory, name);
  return statSync(target).isDirectory() ? walk(target) : target.endsWith(".ts") ? [target] : [];
});

export function auditBackendMessages(root = path.resolve("server")): EnglishUserMessageFinding[] {
  return walk(root).flatMap((file) => findEnglishUserMessages(path.relative(process.cwd(), file), readFileSync(file, "utf8")));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const findings = auditBackendMessages();
  if (findings.length) {
    for (const finding of findings) console.error(`${finding.file}:${finding.line}: ${finding.text}`);
    console.error(`Found ${findings.length} English user-facing backend message candidate(s).`);
    process.exitCode = 1;
  } else {
    console.log("No English user-facing backend messages found.");
  }
}
