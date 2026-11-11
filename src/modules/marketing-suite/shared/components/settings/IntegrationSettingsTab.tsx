import React from "react";
import TelegramOrderConfigCard from "./TelegramOrderConfigCard";
import SepayConfigCard from "./SepayConfigCard";
import type { UserProfile } from "../../types/index";

interface IntegrationSettingsTabProps {
  userProfile: UserProfile | null;
}

export default function IntegrationSettingsTab({ userProfile }: IntegrationSettingsTabProps) {
  return (
    <div className="space-y-3">
      <TelegramOrderConfigCard userProfile={userProfile} />
      <SepayConfigCard userProfile={userProfile} />
    </div>
  );
}

