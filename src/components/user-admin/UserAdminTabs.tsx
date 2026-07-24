import { Users, ShieldCheck, Wallet } from "lucide-react";
import { UserProfile } from "../../types";
import { UserAdminTabKey } from "./types";

interface Props {
  activeTab: UserAdminTabKey;
  onChange: (tab: UserAdminTabKey) => void;
  userProfile?: UserProfile | null;
}

export function UserAdminTabs({ activeTab, onChange, userProfile }: Props) {
  return (
    <div className="border-b border-slate-200/80 bg-white px-5 pt-2 pb-0 text-xs flex justify-between items-center shrink-0" id="user_admin_subtabs">
      <div className="flex gap-1 overflow-x-auto select-none">
        {[
          { id: "users", label: "Danh sách tài khoản", icon: Users },
          { id: "roles", label: "Vai trò & Phân quyền", icon: ShieldCheck },
          ...(userProfile?.role === "superadmin"
            ? [{ id: "balance", label: "Số dư người dùng", icon: Wallet }]
            : []),
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id as UserAdminTabKey)}
              className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${
                isActive
                  ? "bg-cyan-600 text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 font-semibold"
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
