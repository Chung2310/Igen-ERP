import { Users, ShieldCheck } from "lucide-react";
import { UserProfile } from "../../types";
import { UserAdminTabKey } from "./types";

interface Props {
  activeTab: UserAdminTabKey;
  onChange: (tab: UserAdminTabKey) => void;
  userProfile?: UserProfile | null;
}

export function UserAdminTabs({ activeTab, onChange, userProfile }: Props) {
  return (
    <div className="flex shrink-0 items-center bg-white px-5 pb-3 sm:px-6" id="user_admin_subtabs">
      <div className="flex gap-1 overflow-x-auto select-none">
        {[
          { id: "users", label: "Danh sách tài khoản", icon: Users },
          { id: "roles", label: "Vai trò và phân quyền", icon: ShieldCheck },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id as UserAdminTabKey)}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-cyan-600 text-white"
                  : "text-slate-600 hover:bg-cyan-50 hover:text-cyan-700"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
