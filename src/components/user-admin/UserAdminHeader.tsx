import { Plus } from "lucide-react";
import { CompanyProfile, UserProfile } from "../../types";
import { primaryCreateButtonClass } from "../common/primaryCreateButton";
import { StyledSelect } from "../common/StyledSelect";

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
    <div className="flex shrink-0 flex-col justify-between gap-3 border-b border-outline-variant bg-surface-container-lowest px-3 py-3 sm:flex-row sm:items-center" id="user_admin_header">
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="h-5 w-1 shrink-0 rounded-full bg-primary" />
        <h1 className="text-balance text-lg font-semibold text-on-surface">Quản lý người dùng</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {userProfile?.role === "superadmin" && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-normal text-on-surface-variant">Doanh nghiệp</span>
              <StyledSelect
                ariaLabel="Doanh nghiệp"
                value={selectedCompanyCode}
                onChange={onSelectedCompanyCodeChange}
                options={[{ value: "all", label: "Tất cả doanh nghiệp" }, ...companies.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))]}
                appearance="erp"
                className="min-h-9 rounded-md sm:min-w-48"
              />
            </div>

            <button
              type="button"
              onClick={onOpenCompanyModal}
              className={`${primaryCreateButtonClass} user-admin-create-button min-h-9`}
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

