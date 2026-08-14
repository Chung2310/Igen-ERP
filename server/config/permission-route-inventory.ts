import fs from "node:fs";
import path from "node:path";
import { isCanonicalPermission, LEGACY_PERMISSION_MAP } from "./permission-catalog";

export type PermissionRouteDiagnosticKind = "missing-auth" | "missing-permission" | "unknown-permission";

export interface PermissionRouteDiagnostic {
  sourceFile: string;
  line: number;
  method: string;
  path: string;
  kind: PermissionRouteDiagnosticKind;
  message: string;
}

export interface PermissionRouteRecord {
  sourceFile: string;
  line: number;
  method: string;
  path: string;
  isMutation: boolean;
  hasAuthenticationGuard: boolean;
  permissionCodes: string[];
  diagnostics: PermissionRouteDiagnostic[];
}

/** Deliberately small and reviewed list of endpoints that are public by protocol design. */
export const PUBLIC_ROUTE_EXCEPTIONS = [
  /\/webhooks?(?:\/|$)/i,
  /\/oauth(?:\/|$)/i,
  /\/callback(?:\/|$)/i,
  /\/qr(?:\/|$).*attendance/i,
] as const;

function isPublicException(routePath: string): boolean {
  return PUBLIC_ROUTE_EXCEPTIONS.some((pattern) => pattern.test(routePath));
}

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function permissionCodesFromMiddleware(middleware: string): string[] {
  const codes: string[] = [];
  const callPattern = /require(?:Any)?Permission\s*\(([^)]*)\)/g;
  for (const match of middleware.matchAll(callPattern)) {
    for (const value of match[1].matchAll(/['"]([^'"]+)['"]/g)) codes.push(value[1]);
  }
  return [...new Set(codes)];
}

/** Scan a router source string without importing/executing application code. */
export function scanPermissionRouteSource(source: string, sourceFile: string): PermissionRouteRecord[] {
  const records: PermissionRouteRecord[] = [];
  const routePattern = /\b[A-Za-z_$][\w$]*\.(get|post|put|patch|delete)\s*\(\s*(['"])([^'"]+)\2\s*,/gi;
  for (const match of source.matchAll(routePattern)) {
    const method = match[1].toUpperCase();
    const routePath = match[3];
    const start = match.index! + match[0].length;
    const remainder = source.slice(start, source.indexOf(";", start) < 0 ? source.length : source.indexOf(";", start));
    const permissionCodes = permissionCodesFromMiddleware(remainder);
    const hasAuthenticationGuard = /\brequireAuth\b|\brequirePermission\b|\brequireAnyPermission\b/.test(remainder);
    const diagnostics: PermissionRouteDiagnostic[] = [];
    const line = lineAt(source, match.index!);
    const base = { sourceFile, line, method, path: routePath };

    if (method !== "GET" && !isPublicException(routePath)) {
      if (!hasAuthenticationGuard) diagnostics.push({ ...base, kind: "missing-auth", message: "Mutation route has no authentication guard." });
      if (permissionCodes.length === 0) diagnostics.push({ ...base, kind: "missing-permission", message: "Mutation route has no canonical permission guard." });
    }
    for (const code of permissionCodes) {
      if (!isCanonicalPermission(code) && !LEGACY_PERMISSION_MAP[code]) {
        diagnostics.push({ ...base, kind: "unknown-permission", message: `Unknown permission code: ${code}.` });
      }
    }
    records.push({ sourceFile, line, method, path: routePath, isMutation: method !== "GET", hasAuthenticationGuard, permissionCodes, diagnostics });
  }
  return records;
}

function sourceFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

export function scanPermissionRouteInventory(projectRoot = process.cwd()): PermissionRouteRecord[] {
  const roots = [path.join(projectRoot, "server", "router"), path.join(projectRoot, "server", "modules")];
  return roots.flatMap(sourceFiles).flatMap((file) => scanPermissionRouteSource(fs.readFileSync(file, "utf8"), path.relative(projectRoot, file)));
}

export function permissionRouteDiagnostics(projectRoot = process.cwd()): PermissionRouteDiagnostic[] {
  return scanPermissionRouteInventory(projectRoot).flatMap((route) => route.diagnostics);
}
