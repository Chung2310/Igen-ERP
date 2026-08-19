import type { NextFunction, Response } from "express";
import type { ModuleKey } from "../config/module-keys";
import { filterModulesForBusinessType, resolveBusinessType } from "../config/business-types";
import { CompanyModel } from "../model/company.model";
import { ModuleSettings } from "../modules/student-management/models/module-settings.model";

const CACHE_TTL_MS = 60_000;
type CompanyModuleState = { exists: boolean; modules: string[] | undefined; businessType: unknown };
const moduleCache = new Map<string, CompanyModuleState & { expiresAt: number }>();

export function clearModuleCache(companyCode?: string): void {
  if (companyCode) moduleCache.delete(companyCode.toUpperCase());
  else moduleCache.clear();
}

export function resolveModuleAccess(
  user: { role?: string; companyCode?: string } | undefined,
  key: ModuleKey,
  enabledModules: string[] | undefined,
  companyExists = true,
  businessTypeInput?: unknown
): boolean {
  if (user?.role === "superadmin") return true;
  if (!user?.companyCode || !companyExists) return false;
  const enabledBusinessModules = filterModulesForBusinessType(enabledModules, resolveBusinessType(businessTypeInput));
  return enabledBusinessModules.includes(key);
}

export async function getModuleStateForCompany(companyCode: string): Promise<CompanyModuleState> {
  const code = companyCode.toUpperCase();
  const cached = moduleCache.get(code);
  if (cached && cached.expiresAt > Date.now()) {
    return { exists: cached.exists, modules: cached.modules, businessType: cached.businessType };
  }

  const company = await CompanyModel.findOne({ code }).select("enabledModules businessType").lean();
  const legacyEntityPreset = company && !company.businessType
    ? (await ModuleSettings.findOne({ tenantId: code }).select("entityPreset").lean())?.entityPreset
    : undefined;
  const state = { exists: Boolean(company), modules: company?.enabledModules, businessType: resolveBusinessType(company?.businessType, legacyEntityPreset) };
  moduleCache.set(code, { ...state, expiresAt: Date.now() + CACHE_TTL_MS });
  return state;
}

/** Backward-compatible data accessor; authorization must use the state-aware guard above. */
export async function getEnabledModulesForCompany(companyCode: string): Promise<string[] | undefined> {
  return (await getModuleStateForCompany(companyCode)).modules;
}

/** Must run after authentication has populated req.user. */
export function requireModule(key: ModuleKey) {
  const moduleAccessGuard = async (req: any, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (user?.role === "superadmin") return next();

      if (!user?.companyCode) {
        return res.status(403).json({ status: "error", message: "Không xác định được doanh nghiệp." });
      }

      const state = await getModuleStateForCompany(user.companyCode);
      if (resolveModuleAccess(user, key, state.modules, state.exists, state.businessType)) return next();
      console.log(`[requireModule BLOCKED] Path: ${req.originalUrl}, Key: ${key}, UserCompany: ${user.companyCode}`);
      return res.status(403).json({
        status: "error",
        message: "Phân hệ chưa được kích hoạt cho doanh nghiệp của bạn.",
      });
    } catch (error) {
      return next(error);
    }
  };
  (moduleAccessGuard as typeof moduleAccessGuard & { moduleKey: ModuleKey }).moduleKey = key;
  return moduleAccessGuard;
}
