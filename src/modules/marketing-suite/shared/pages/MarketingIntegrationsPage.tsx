import { useState } from "react";
import { Sliders } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import CompanyIntegrationsTab from "../components/settings/CompanyIntegrationsTab";
import PersonalIntegrationsTab from "../components/settings/PersonalIntegrationsTab";
import "../marketing-workspace.css";

export default function MarketingIntegrationsPage() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState("company");
  return (
    <div className="marketing-workspace h-full flex flex-col font-sans overflow-y-auto pr-2 pb-6" id="marketing_integrations_container">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-indigo-650" aria-hidden="true" />
            Tích hợp & cấu hình
          </h1>
          <p className="text-xs text-gray-500 mt-1">Kết nối tài khoản và quản lý thiết lập Marketing.</p>
        </div>
        <nav className="flex flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 max-w-fit" aria-label="Phạm vi tích hợp Marketing">
          {[
            { id: "company", label: "MXH Doanh nghiệp" },
            { id: "personal", label: "MXH Cá nhân" },
          ].map((item) => (
            <button key={item.id} id={`marketing_integrations_${item.id}`} type="button"
              aria-pressed={tab === item.id} aria-controls="marketing_integrations_content"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${tab === item.id
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"}`}>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <section id="marketing_integrations_content" aria-labelledby={`marketing_integrations_${tab}`} className="min-w-0">
        {tab === "company" ? <CompanyIntegrationsTab userProfile={userProfile} /> : <PersonalIntegrationsTab />}
      </section>
    </div>
  );
}
