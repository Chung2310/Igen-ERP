import { useState } from "react";
import { Building2, UserRound } from "lucide-react";
import { ModuleNavigation, ModuleNavigationButton } from "../../../../components/common/ModuleNavigation";
import { useAuth } from "../context/AuthContext";
import CompanyIntegrationsTab from "../components/settings/CompanyIntegrationsTab";
import PersonalIntegrationsTab from "../components/settings/PersonalIntegrationsTab";
import "../marketing-workspace.css";

export default function MarketingIntegrationsPage() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("company");
  return (
    <div className="marketing-workspace flex h-full min-h-0 flex-col bg-surface font-sans" id="marketing_integrations_container">
      <h1 className="sr-only text-balance">Tích hợp & cấu hình</h1>
      <ModuleNavigation label="Phạm vi tích hợp Marketing" activeValue={tab}>
        {[
          { id: "company", label: "MXH Doanh nghiệp", icon: Building2 },
          { id: "personal", label: "MXH Cá nhân", icon: UserRound },
        ].map(item => <ModuleNavigationButton key={item.id} id={`marketing_integrations_${item.id}`} active={tab === item.id} icon={<item.icon />} aria-pressed={tab === item.id} aria-controls="marketing_integrations_content" onClick={() => setTab(item.id)}>{item.label}</ModuleNavigationButton>)}
      </ModuleNavigation>
      <section id="marketing_integrations_content" aria-labelledby={`marketing_integrations_${tab}`} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-6">
        {tab === "company" ? <CompanyIntegrationsTab userProfile={userProfile} /> : <PersonalIntegrationsTab />}
      </section>
    </div>
  );
}
