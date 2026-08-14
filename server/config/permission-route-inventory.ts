import fs from "node:fs";
import path from "node:path";
import { isCanonicalPermission, LEGACY_PERMISSION_MAP } from "./permission-catalog";

export type PermissionRouteDiagnosticKind = "missing-auth" | "missing-permission" | "unknown-permission";
export interface PermissionRouteDiagnostic { sourceFile: string; line: number; method: string; path: string; kind: PermissionRouteDiagnosticKind; message: string; }
export interface PermissionRouteRecord { sourceFile: string; line: number; method: string; path: string; router: string; mount: string; isMutation: boolean; hasAuthenticationGuard: boolean; permissionCodes: string[]; diagnostics: PermissionRouteDiagnostic[]; }

export interface PublicRouteException { sourceFile: string; router: string; mount: string; method: string; path: string; reason: string; }
/** Reviewed protocol exceptions. Keep each endpoint explicit and auditable. */
export const PUBLIC_ROUTE_EXCEPTIONS: readonly PublicRouteException[] = [
  { sourceFile: "server/router/google-drive.router.ts", router: "googleDriveRouter", mount: "/integrations/google-drive", method: "GET", path: "/callback", reason: "signed, expiring Google Drive OAuth callback state" },
  { sourceFile: "server/router/webhook.router.ts", router: "webhookRouter", mount: "/webhook", method: "POST", path: "/payment", reason: "signed payment-provider webhook" },
  { sourceFile: "server/modules/student-management/routes/webhook.routes.ts", router: "router", mount: "/webhook", method: "POST", path: "/payment", reason: "validated payment webhook" },
  { sourceFile: "server/modules/worker-management/routes/worker-qr-attendance.routes.ts", router: "workerQrAttendancePublicRoutes", mount: "/worker-management/qr-attendance", method: "POST", path: "/checkin", reason: "public QR attendance scan" },
  { sourceFile: "server/modules/worker-management/routes/worker-qr-attendance.routes.ts", router: "workerQrAttendancePublicRoutes", mount: "/worker-management/qr-attendance", method: "POST", path: "/device/forget", reason: "public QR attendance device flow" },
  { sourceFile: "server/modules/worker-management/routes/worker-qr-attendance.routes.ts", router: "workerQrAttendancePublicRoutes", mount: "/worker-management/qr-attendance", method: "GET", path: "/session-info", reason: "public QR attendance scan" },
  { sourceFile: "server/router/wallet.router.ts", router: "walletRouter", mount: "", method: "POST", path: "/webhook", reason: "signed PayOS webhook" },
] as const;

const lineAt = (source: string, offset: number) => source.slice(0, offset).split(/\r?\n/).length;
const isPublicException = (file: string, router: string, mount: string, method: string, routePath: string) => PUBLIC_ROUTE_EXCEPTIONS.some((item) => item.sourceFile === file && item.router === router && item.mount === mount && item.method === method && item.path === routePath);
const publicException = (file: string, router: string, mount: string, method: string, routePath: string) => PUBLIC_ROUTE_EXCEPTIONS.find((item) => item.sourceFile === file && item.router === router && item.mount === mount && item.method === method && item.path === routePath);

function permissionCodesFromMiddleware(middleware: string, constants: Readonly<Record<string, string[]>>): string[] {
  const codes: string[] = [];
  const resolve = (name: string) => Object.prototype.hasOwnProperty.call(constants, name) ? constants[name] : undefined;
  for (const match of middleware.matchAll(/require(?:Any)?Permission\s*\(([^)]*)\)/g)) {
    for (const value of match[1].matchAll(/["']([^"']+)["']/g)) codes.push(value[1]);
    for (const identifier of match[1].matchAll(/\b[A-Z][A-Z0-9_]*\b|\b[a-z][A-Za-z0-9_$]*\b/g)) { const values = resolve(identifier[0]); if (values) codes.push(...values); }
  }
  for (const identifier of middleware.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) { const values = resolve(identifier[0]); if (values) codes.push(...values); }
  // Resolve the common module permission table form without importing code:
  // `requireAnyPermission([...STUDENT_AREA_PERMISSIONS.batch.manage])`.
  for (const reference of middleware.matchAll(/\b[A-Z][A-Z0-9_]*_PERMISSIONS\.([A-Za-z_$][\w$]*)\.(read|manage)\b/g)) {
    const legacy = `${reference[1]}:${reference[2]}`;
    codes.push(LEGACY_PERMISSION_MAP[legacy] ?? legacy);
  }
  return [...new Set(codes)];
}
function middlewareTokens(args: string): string {
  const parts: string[] = []; let start = 0; let depth = 0; let quote = "";
  for (let i = 0; i < args.length; i += 1) { const c = args[i]; if (quote) { if (c === quote && args[i - 1] !== "\\") quote = ""; continue; } if (c === "\"" || c === "'") { quote = c; continue; } if (c === "(" || c === "[" || c === "{") depth += 1; if (c === ")" || c === "]" || c === "}") depth -= 1; if (c === "," && depth === 0) { parts.push(args.slice(start, i)); start = i + 1; } }
  parts.push(args.slice(start)); return parts.slice(0, -1).join(",");
}

/** Scan router source without importing or executing application code. */
export function scanPermissionRouteSource(source: string, sourceFile: string, constants: Readonly<Record<string, string[]>> = {}, context: { mounts?: Readonly<Record<string, string>> } = {}): PermissionRouteRecord[] {
  const records: PermissionRouteRecord[] = [];
  const routePattern = /\b[A-Za-z_$][\w$]*\.(get|post|put|patch|delete)\s*\(\s*(['"])([^'"]+)\2\s*,/gi;
  for (const match of source.matchAll(routePattern)) {
    const method = match[1].toUpperCase();
    const routePath = match[3];
    const router = match[0].split(".", 1)[0];
    const mount = context.mounts?.[router] ?? (sourceFile === "server/modules/student-management/routes/webhook.routes.ts" ? "/webhook" : "");
    const scopedConstants: Record<string, string[]> = { ...constants };
    const prefix = source.slice(0, match.index!);
    for (const declaration of prefix.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*["']([^"']+:[^"']+)["']/g)) scopedConstants[declaration[1]] = [declaration[2]];
    for (const alias of prefix.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*require(?:Any)?Permission\s*\(([^)]*)\)/g)) {
      const values = [...alias[2].matchAll(/["']([^"']+)["']/g)].map((value) => value[1]);
      for (const identifier of alias[2].matchAll(/\b[A-Z][A-Z0-9_]*\b/g)) if (scopedConstants[identifier[0]]) values.push(...scopedConstants[identifier[0]]);
      if (values.length) scopedConstants[alias[1]] = [...new Set(values)];
    }
    for (const alias of prefix.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>\s*require(?:Any)?Permission\s*\(([^)]*)\)/g)) {
      const values = permissionCodesFromMiddleware(`requirePermission(${alias[2]})`, scopedConstants);
      if (values.length) scopedConstants[alias[1]] = values;
    }
    // Resolve small named wrappers used by routers to keep middleware readable,
    // e.g. `const read = requirePermission("x")` followed by
    // `async function readGuard(...) { return read(req, res, next); }`.
    for (const wrapper of prefix.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{[\s\S]*?\breturn\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
      const values = scopedConstants[wrapper[2]];
      if (values?.length) scopedConstants[wrapper[1]] = values;
    }
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
    const middleware = middlewareTokens(remainder);
    const routerUseMiddleware = [...prefix.matchAll(new RegExp(`\\b${router}\\.use\\s*\\(([^;]*)`, "g"))].map((item) => item[1]).join(",");
    const permissionCodes = [...new Set([...permissionCodesFromMiddleware(middleware, scopedConstants), ...permissionCodesFromMiddleware(routerUseMiddleware, scopedConstants)])].map((code) => LEGACY_PERMISSION_MAP[code] ?? code);
    const hasPermissionGuard = /\brequirePermission\b|\brequireAnyPermission\b/.test(middleware);
    const hasInheritedPermissionGuard = /\brequirePermission\b|\brequireAnyPermission\b/.test(routerUseMiddleware) || Object.keys(scopedConstants).some((name) => new RegExp(`\\b${name}\\b`).test(routerUseMiddleware));
    const hasAuthenticationGuard = /\brequireAuth\b|\brequirePermission\b|\brequireAnyPermission\b|\bauthMiddleware\b|\badmin[A-Za-z]*AuthMiddleware\b/.test(middleware) || Object.keys(scopedConstants).some((name) => new RegExp(`\\b${name}\\b`).test(middleware)) || /\.use\s*\([^;]*\b(?:requireAuth|authMiddleware|admin[A-Za-z]*AuthMiddleware)\b/.test(source);
    const line = lineAt(source, match.index!);
    const exception = publicException(sourceFile, router, mount, method, routePath);
    const base = { sourceFile, line, method, path: routePath };
    const diagnostics: PermissionRouteDiagnostic[] = [];
    if (method !== "GET" && !isPublicException(sourceFile, router, mount, method, routePath)) {
      if (!hasAuthenticationGuard) diagnostics.push({ ...base, kind: "missing-auth", message: "Mutation route has no authentication guard." });
      if (permissionCodes.length === 0) diagnostics.push({ ...base, kind: hasPermissionGuard || hasInheritedPermissionGuard ? "unknown-permission" : "missing-permission", message: hasPermissionGuard || hasInheritedPermissionGuard ? "Permission guard uses an unresolved/non-canonical code." : "Mutation route has no canonical permission guard." });
    }
    for (const code of permissionCodes) if (!isCanonicalPermission(code)) diagnostics.push({ ...base, kind: "unknown-permission", message: `Unknown or non-canonical permission code: ${code}.` });
    records.push({ sourceFile, line, method, path: routePath, router, mount: mount || exception?.mount || "", isMutation: method !== "GET", hasAuthenticationGuard, permissionCodes, diagnostics });
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
  const definitions: Record<string, string[][]> = {};
  for (const file of constantFiles) for (const match of fs.readFileSync(file, "utf8").matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*([^;\n]+)/g)) {
    const values = [...match[2].matchAll(/["']([^"']+:[^"']+)["']/g)].map((value) => value[1]);
    if (values.length) (definitions[match[1]] ??= []).push(values);
  }
  const mounts: Record<string, string> = {};
  const indexFile = path.join(projectRoot, "server", "router", "index.ts");
  if (fs.existsSync(indexFile)) for (const match of fs.readFileSync(indexFile, "utf8").matchAll(/\.use\s*\(\s*["']([^"']+)["'][\s\S]*?,\s*([A-Za-z_$][\w$]*)\s*\)/g)) mounts[match[2]] = match[1];
  return files.flatMap((file) => {
    const source = fs.readFileSync(file, "utf8");
    const scoped: Record<string, string[]> = {};
    for (const imported of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'][^"']+["']/g)) for (const name of imported[1].split(",").map((part) => part.trim().split(/\s+as\s+/).pop()!)) {
      const values = definitions[name];
      if (values?.length === 1) scoped[name] = values[0];
    }
    return scanPermissionRouteSource(source, path.relative(projectRoot, file).replaceAll(path.sep, "/"), scoped, { mounts });
  });
}

export function permissionRouteDiagnostics(projectRoot = process.cwd()): PermissionRouteDiagnostic[] {
  return scanPermissionRouteInventory(projectRoot).flatMap((route) => route.diagnostics);
}
