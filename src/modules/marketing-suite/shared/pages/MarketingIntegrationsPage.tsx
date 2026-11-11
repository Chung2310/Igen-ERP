import { Component, useState, type ReactNode } from "react";
import { Building2, SlidersHorizontal, UserRound } from "lucide-react";
import { ModuleNavigation, ModuleNavigationButton } from "../../../../components/common/ModuleNavigation";
import { useAuth } from "../context/AuthContext";
import CompanyIntegrationsTab from "../components/settings/CompanyIntegrationsTab";
import PersonalIntegrationsTab from "../components/settings/PersonalIntegrationsTab";
import IntegrationSettingsTab from "../components/settings/IntegrationSettingsTab";
import "../marketing-workspace.css";
import "../marketing-integrations.css";

class IntegrationErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Marketing integrations render failed:", error);
  }

  render() {
    if (this.state.error) return <div role="alert" className="m-4 rounded-md border border-outline-variant bg-surface-container-lowest p-4 text-on-surface">
      <h2 className="text-balance text-sm font-semibold">Không thể hiển thị cấu hình tích hợp</h2>
      <p className="mt-2 text-pretty text-xs text-on-surface-variant">{this.state.error.message}</p>
      <button type="button" onClick={() => this.setState({ error: null })} className="mt-3 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Thử lại</button>
    </div>;
    return this.props.children;
  }
}

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
          { id: "integrations", label: "Cấu hình tích hợp", icon: SlidersHorizontal },
        ].map(item => <ModuleNavigationButton key={item.id} id={`marketing_integrations_${item.id}`} active={tab === item.id} icon={<item.icon />} aria-pressed={tab === item.id} aria-controls="marketing_integrations_content" onClick={() => setTab(item.id)}>{item.label}</ModuleNavigationButton>)}
      </ModuleNavigation>
      <section id="marketing_integrations_content" aria-labelledby={`marketing_integrations_${tab}`} className="marketing-integrations-content min-h-0 min-w-0 flex-1 overflow-y-auto bg-surface">
        <IntegrationErrorBoundary key={tab}>
          {tab === "company" && <CompanyIntegrationsTab userProfile={userProfile} />}
          {tab === "personal" && <PersonalIntegrationsTab />}
          {tab === "integrations" && <IntegrationSettingsTab userProfile={userProfile} />}
        </IntegrationErrorBoundary>
      </section>
    </div>
  );
}
