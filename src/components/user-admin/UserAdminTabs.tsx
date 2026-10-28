import { Users, ShieldCheck } from "lucide-react";
import { ModuleNavigation, ModuleNavigationButton } from "../common/ModuleNavigation";
import { UserProfile } from "../../types";
import { UserAdminTabKey } from "./types";

interface Props {
  activeTab: UserAdminTabKey;
  onChange: (tab: UserAdminTabKey) => void;
  userProfile?: UserProfile | null;
}

export function UserAdminTabs({ activeTab, onChange }: Props) {
  return (
    <ModuleNavigation label="Mục Quản lý người dùng" activeValue={activeTab} id="user_admin_subtabs">
      {[
        { id: "users", label: "Danh sách tài khoản", icon: Users },
        { id: "roles", label: "Vai trò và phân quyền", icon: ShieldCheck },
      ].map(tab => <ModuleNavigationButton key={tab.id} active={activeTab === tab.id} icon={<tab.icon />} onClick={() => onChange(tab.id as UserAdminTabKey)}>{tab.label}</ModuleNavigationButton>)}
    </ModuleNavigation>
  );
}
