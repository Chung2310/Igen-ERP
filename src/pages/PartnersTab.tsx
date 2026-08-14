import React from "react";
import { useAuth } from "../context/AuthContext";
import { PartnersPage } from "../modules/student-management/pages/Partners/PartnersPage";
import WorkerPartnersTab from "./WorkerPartnersTab";

export function isLaborPartnerWorkspace(businessType: string | undefined): boolean {
  return businessType === "labor";
}

export default function PartnersTab() {
  const { userProfile, hasPermission } = useAuth();

  if (isLaborPartnerWorkspace(userProfile?.businessType)) {
    return <WorkerPartnersTab />;
  }

  const canManagePartners =
    userProfile?.role === "superadmin" ||
    userProfile?.role === "admin" ||
    hasPermission("relationship:manage");
  const selectedCenter =
    userProfile?.role === "superadmin"
      ? undefined
      : (userProfile as { centerId?: string } | undefined)?.centerId ||
        userProfile?.companyCode;

  return (
    <div className="h-full overflow-y-auto bg-white p-6">
      <PartnersPage
        selectedCenter={selectedCenter}
        canManagePartners={canManagePartners}
      />
    </div>
  );
}
