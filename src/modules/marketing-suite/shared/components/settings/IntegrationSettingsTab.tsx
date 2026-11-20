import React from "react";
import CompanyChatResetCard from "./CompanyChatResetCard";
import LeadDestinationSettingsCard from "./LeadDestinationSettingsCard";
import TelegramOrderConfigCard from "./TelegramOrderConfigCard";
import SepayConfigCard from "./SepayConfigCard";
import type { UserProfile } from "../../types/index";

interface IntegrationSettingsTabProps {
  userProfile: UserProfile | null;
}

export default function IntegrationSettingsTab({ userProfile }: IntegrationSettingsTabProps) {
  const permissions = userProfile?.permissions ?? [];
  const canReadIntegrations = permissions.includes("*") || permissions.includes("social-integration:read");
  const canManageIntegrations = permissions.includes("*") || permissions.includes("social-integration:manage");
  const canResetChat = permissions.includes("*")
    || (permissions.includes("social-integration:manage") && permissions.includes("omni-inbox:manage"));
  return (
    <div className="space-y-3">
      {canReadIntegrations && userProfile?.companyCode && (
        <LeadDestinationSettingsCard key={userProfile.companyCode} canEdit={canManageIntegrations} />
      )}
      <TelegramOrderConfigCard userProfile={userProfile} />
      <SepayConfigCard userProfile={userProfile} />
      {canResetChat && userProfile?.companyCode && (
        <CompanyChatResetCard key={userProfile.companyCode} companyCode={userProfile.companyCode} companyName={userProfile.companyName} />
      )}
    </div>
  );
}

