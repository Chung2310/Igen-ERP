import fs from "node:fs";
import path from "node:path";
import { isCanonicalPermission } from "./permission-catalog";

export type PermissionRouteDiagnosticKind = "missing-auth" | "missing-permission" | "unknown-permission";
export interface PermissionRouteDiagnostic { sourceFile: string; line: number; method: string; path: string; kind: PermissionRouteDiagnosticKind; message: string; }
export interface PermissionRouteRecord { sourceFile: string; line: number; method: string; path: string; router: string; mount: string; isMutation: boolean; hasAuthenticationGuard: boolean; permissionCodes: string[]; diagnostics: PermissionRouteDiagnostic[]; }

export interface PublicRouteException { sourceFile: string; mount: string; method: string; path: string; reason: string; }
/** Reviewed protocol exceptions. Keep each endpoint explicit and auditable. */
export const PUBLIC_ROUTE_EXCEPTIONS: readonly PublicRouteException[] = [
  { sourceFile: "server/router/webhook.router.ts", mount: "/webhook", method: "POST", path: "/payment", reason: "signed payment-provider webhook" },
  { sourceFile: "server/modules/student-management/routes/webhook.routes.ts", mount: "/student-management", method: "POST", path: "/payment", reason: "validated payment webhook" },
  { sourceFile: "server/modules/worker-management/routes/worker-qr-attendance.routes.ts", mount: "/worker-management/qr-attendance", method: "POST", path: "/checkin", reason: "public QR attendance scan" },
  { sourceFile: "server/modules/worker-management/routes/worker-qr-attendance.routes.ts", mount: "/worker-management/qr-attendance", method: "POST", path: "/device/forget", reason: "public QR attendance device flow" },
  { sourceFile: "server/modules/worker-management/routes/worker-qr-attendance.routes.ts", mount: "/worker-management/qr-attendance", method: "GET", path: "/session-info", reason: "public QR attendance scan" },
] as const;

const lineAt = (source: string, offset: number) => source.slice(0, offset).split(/\r?\n/).length;
const isPublicException = (file: string, method: string, routePath: string) => PUBLIC_ROUTE_EXCEPTIONS.some((item) => item.sourceFile === file && item.method === method && item.path === routePath);
const publicException = (file: string, method: string, routePath: string) => PUBLIC_ROUTE_EXCEPTIONS.find((item) => item.sourceFile === file && item.method === method && item.path === routePath);

function permissionCodesFromMiddleware(middleware: string, constants: Readonly<Record<string, string[]>>): string[] {
  const codes: string[] = [];
  const resolve = (name: string) => Object.prototype.hasOwnProperty.call(constants, name) ? constants[name] : undefined;
  for (const match of middleware.matchAll(/require(?:Any)?Permission\s*\(([^)]*)\)/g)) {
    for (const value of match[1].matchAll(/["']([^"']+)["']/g)) codes.push(value[1]);
    for (const identifier of match[1].matchAll(/\b[A-Z][A-Z0-9_]*\b|\b[a-z][A-Za-z0-9_$]*\b/g)) { const values = resolve(identifier[0]); if (values) codes.push(...values); }
  }
  for (const identifier of middleware.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) { const values = resolve(identifier[0]); if (values) codes.push(...values); }
  return [...new Set(codes)];
}

/** Scan router source without importing or executing application code. */
export function scanPermissionRouteSource(source: string, sourceFile: string, constants: Readonly<Record<string, string[]>> = {}, context: { mounts?: Readonly<Record<string, string>> } = {}): PermissionRouteRecord[] {
  const records: PermissionRouteRecord[] = [];
  const scopedConstants: Record<string, string[]> = { ...constants };
  for (const declaration of source.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*["']([^"']+:[^"']+)["']/g)) scopedConstants[declaration[1]] = [declaration[2]];
  for (const alias of source.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*require(?:Any)?Permission\s*\(([^)]*)\)/g)) {
    const values = [...alias[2].matchAll(/["']([^"']+)["']/g)].map((value) => value[1]);
    for (const identifier of alias[2].matchAll(/\b[A-Z][A-Z0-9_]*\b/g)) if (scopedConstants[identifier[0]]) values.push(...scopedConstants[identifier[0]]);
    if (values.length) scopedConstants[alias[1]] = [...new Set(values)];
  }
  const routePattern = /\b[A-Za-z_$][\w$]*\.(get|post|put|patch|delete)\s*\(\s*(['"])([^'"]+)\2\s*,/gi;
  for (const match of source.matchAll(routePattern)) {
    const method = match[1].toUpperCase();
    const routePath = match[3];
    const router = match[0].split(".", 1)[0];
    const open = source.indexOf("(", match.index!);
    let depth = 0; let quote = ""; let close = source.length - 1;
    for (let cursor = open; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (quote) { if (character === quote && source[cursor - 1] !== "\\") quote = ""; continue; }
      if (character === "\"" || character === "'") { quote = character; continue; }
      if (character === "(") depth += 1;
      if (character === ")" && --depth === 0) { close = cursor; break; }
    }
    const remainder = source.slice(match.index! + match[0].length, close);
    const permissionCodes = permissionCodesFromMiddleware(remainder, scopedConstants);
    const hasPermissionGuard = /\brequirePermission\b|\brequireAnyPermission\b/.test(remainder);
    const hasAuthenticationGuard = /\brequireAuth\b|\brequirePermission\b|\brequireAnyPermission\b/.test(remainder) || Object.keys(scopedConstants).some((name) => new RegExp(`\\b${name}\\b`).test(remainder)) || /\.use\s*\([^;]*\brequireAuth\b/.test(source);
    const line = lineAt(source, match.index!);
    const exception = publicException(sourceFile, method, routePath);
    const base = { sourceFile, line, method, path: routePath };
    const diagnostics: PermissionRouteDiagnostic[] = [];
    if (method !== "GET" && !isPublicException(sourceFile, method, routePath)) {
      if (!hasAuthenticationGuard) diagnostics.push({ ...base, kind: "missing-auth", message: "Mutation route has no authentication guard." });
      if (permissionCodes.length === 0) diagnostics.push({ ...base, kind: hasPermissionGuard ? "unknown-permission" : "missing-permission", message: hasPermissionGuard ? "Permission guard uses an unresolved/non-canonical code." : "Mutation route has no canonical permission guard." });
    }
    for (const code of permissionCodes) if (!isCanonicalPermission(code)) diagnostics.push({ ...base, kind: "unknown-permission", message: `Unknown or non-canonical permission code: ${code}.` });
    records.push({ sourceFile, line, method, path: routePath, router, mount: context.mounts?.[router] ?? exception?.mount ?? "", isMutation: method !== "GET", hasAuthenticationGuard, permissionCodes, diagnostics });
  }
  return records;
}

function sourceFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && (/router|routes/i.test(entry.name) || /[\\/]routes[\\/]/i.test(full)) ? [full] : [];
  });
}

function allTypeScriptFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return allTypeScriptFiles(full);
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

export function scanPermissionRouteInventory(projectRoot = process.cwd()): PermissionRouteRecord[] {
  const roots = [path.join(projectRoot, "server", "router"), path.join(projectRoot, "server", "modules")];
  const files = roots.flatMap(sourceFiles);
  const constantFiles = roots.flatMap(allTypeScriptFiles);
  const constants: Record<string, string[]> = {};
  for (const file of constantFiles) for (const match of fs.readFileSync(file, "utf8").matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*([^;\n]+)/g)) {
    const values = [...match[2].matchAll(/["']([^"']+:[^"']+)["']/g)].map((value) => value[1]);
    if (values.length) constants[match[1]] = values;
  }
  const mounts: Record<string, string> = {};
  const indexFile = path.join(projectRoot, "server", "router", "index.ts");
  if (fs.existsSync(indexFile)) for (const match of fs.readFileSync(indexFile, "utf8").matchAll(/\.use\s*\(\s*["']([^"']+)["'][\s\S]*?,\s*([A-Za-z_$][\w$]*)\s*\)/g)) mounts[match[2]] = match[1];
  return files.flatMap((file) => scanPermissionRouteSource(fs.readFileSync(file, "utf8"), path.relative(projectRoot, file).replaceAll(path.sep, "/"), constants, { mounts }));
}

export function permissionRouteDiagnostics(projectRoot = process.cwd()): PermissionRouteDiagnostic[] {
  return scanPermissionRouteInventory(projectRoot).flatMap((route) => route.diagnostics);
}
