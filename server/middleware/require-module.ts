import type { NextFunction, Response } from "express";
import type { ModuleKey } from "../config/module-keys";
import { CompanyModel } from "../model/company.model";

const CACHE_TTL_MS = 60_000;
const moduleCache = new Map<string, { modules: string[] | undefined; expiresAt: number }>();

export function clearModuleCache(companyCode?: string): void {
  if (companyCode) moduleCache.delete(companyCode.toUpperCase());
  else moduleCache.clear();
}

export function resolveModuleAccess(
  user: { role?: string; companyCode?: string } | undefined,
  key: ModuleKey,
  enabledModules: string[] | undefined
): boolean {
  if (user?.role === "superadmin") return true;
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}

export async function getEnabledModulesForCompany(companyCode: string): Promise<string[] | undefined> {
  const code = companyCode.toUpperCase();
  const cached = moduleCache.get(code);
  if (cached && cached.expiresAt > Date.now()) return cached.modules;

  const company = await CompanyModel.findOne({ code }).select("enabledModules").lean();
  const modules = company?.enabledModules;
  moduleCache.set(code, { modules, expiresAt: Date.now() + CACHE_TTL_MS });
  return modules;
}

/** Must run after authentication has populated req.user. */
export function requireModule(key: ModuleKey) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (user?.role === "superadmin" || !user?.companyCode) return next();

      const modules = await getEnabledModulesForCompany(user.companyCode);
      if (resolveModuleAccess(user, key, modules)) return next();

      return res.status(403).json({
        status: "error",
        message: "Module chưa được kích hoạt cho doanh nghiệp của bạn.",
      });
    } catch (error) {
      return next(error);
    }
  };
}
