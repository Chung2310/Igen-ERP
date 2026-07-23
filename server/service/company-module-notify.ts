export type CompanyModuleNotifyDeps = {
  clearModuleCache: (companyCode?: string) => void;
  emitToCompany: (companyCode: string, eventName: string, data: any) => void | Promise<void>;
};

/** Shared by every route that changes a company's enabledModules so clients stay in sync. */
export async function notifyCompanyModulesChanged(
  companyCode: string,
  enabledModules: string[],
  deps: CompanyModuleNotifyDeps,
  logContext: string
): Promise<void> {
  deps.clearModuleCache(companyCode);
  try {
    await deps.emitToCompany(companyCode, "company_modules_updated", { companyCode, enabledModules });
  } catch (error) {
    console.error(`[${logContext}] Realtime delivery failed for ${companyCode}:`, error);
  }
}
