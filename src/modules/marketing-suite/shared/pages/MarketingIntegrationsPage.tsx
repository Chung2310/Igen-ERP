import { useState } from "react";
import { Building2, Settings, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import CompanyIntegrationsTab from "../components/settings/CompanyIntegrationsTab";
import PersonalIntegrationsTab from "../components/settings/PersonalIntegrationsTab";
import "./marketing-integrations.css";

export default function MarketingIntegrationsPage() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("company");
  return (
    <div className="marketing-integrations-ui h-full min-h-0 overflow-y-auto pb-6 font-sans" id="marketing_integrations_container">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-brand-primary">
              <Settings className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Tích hợp & cấu hình</h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">Kết nối tài khoản và quản lý thiết lập Marketing.</p>
            </div>
          </div>
          <nav className="flex w-full min-w-0 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-fit" aria-label="Phạm vi tích hợp Marketing">
            {[
              { id: "company", label: "Doanh nghiệp", icon: Building2 },
              { id: "personal", label: "Cá nhân", icon: UserRound },
            ].map((item) => {
              const isActive = tab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  id={`marketing_integrations_${item.id}`}
                  type="button"
                  aria-pressed={isActive}
                  aria-controls="marketing_integrations_content"
                  onClick={() => setTab(item.id)}
                  className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${isActive
                    ? "bg-white text-brand-primary shadow-sm"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-800"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </header>
        <section
          id="marketing_integrations_content"
          aria-labelledby={`marketing_integrations_${tab}`}
          className="min-w-0"
        >
          {tab === "company" ? <CompanyIntegrationsTab userProfile={userProfile} /> : <PersonalIntegrationsTab />}
        </section>
      </div>
    </div>
  );
}
