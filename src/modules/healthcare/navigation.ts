import { HEALTHCARE_SUB_TAB_ROUTES, subTabToSlug, type HealthcareTab } from "../../router/subTabRoutes";
import { tabToPath } from "../../seo/seo-config";

export type HealthcareLocation = { tab: HealthcareTab; patientId?: string; recordId?: string };
export const healthcarePath = tabToPath("QUẢN LÝ Y TẾ");

export function healthcareHref({ tab, patientId, recordId }: HealthcareLocation, branchId: string) {
  const params = new URLSearchParams({ sub: subTabToSlug("QUẢN LÝ Y TẾ", tab) });
  if (patientId || recordId) params.set("branch", branchId);
  if (patientId) params.set("patientId", patientId);
  if (recordId) params.set("id", recordId);
  return `${healthcarePath}?${params}`;
}

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

export function readHealthcareLocation(search: string, branchId: string, canRead: (tab: HealthcareTab) => boolean): HealthcareLocation {
  const params = new URLSearchParams(search);
  const tab = HEALTHCARE_SUB_TAB_ROUTES.find(route => route.slug === params.get("sub"))?.value;
  if (!tab || !canRead(tab)) return { tab: "patients" };
  if (tab === "settings" || params.get("branch") !== branchId) return { tab };
  const patientId = params.get("patientId") || "";
  const recordId = params.get("id") || "";
  return {
    tab,
    patientId: uuid.test(patientId) ? patientId : undefined,
    recordId: tab !== "patients" && uuid.test(recordId) ? recordId : undefined,
  };
}
