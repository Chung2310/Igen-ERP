import { Plus, RefreshCw, Users } from "lucide-react";
import { CompanyProfile, UserProfile } from "../../types";

interface Props {
  userProfile?: UserProfile | null;
  companies: CompanyProfile[];
  selectedCompanyCode: string;
  onSelectedCompanyCodeChange: (value: string) => void;
  onOpenCompanyModal: () => void;
  onOpenCreateUserModal: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export function UserAdminHeader({
  userProfile,
  companies,
  selectedCompanyCode,
  onSelectedCompanyCodeChange,
  onOpenCompanyModal,
  onOpenCreateUserModal,
  onRefresh,
  loading,
}: Props) {
  return (
    <div className="flex shrink-0 flex-col justify-between gap-4 bg-white px-5 py-5 sm:flex-row sm:items-center sm:px-6" id="user_admin_header">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-cyan-50 p-2.5 text-cyan-700">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-800">
            Quản lý người dùng
          </h1>
          <p className="mt-1 text-sm text-slate-500">Tài khoản và vai trò trong hệ thống</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {userProfile?.role === "superadmin" && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Doanh nghiệp</span>
              <select
                value={selectedCompanyCode}
                onChange={(e) => onSelectedCompanyCodeChange(e.target.value)}
                className="min-h-10 cursor-pointer rounded-xl bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-cyan-200"
              >
                <option value="all">Tất cả doanh nghiệp</option>
                {companies.map((c) => (
                  <option key={c.id || c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onOpenCompanyModal}
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Đăng ký doanh nghiệp
            </button>
          </>
        )}
      </div>
    </div>
  );
}

