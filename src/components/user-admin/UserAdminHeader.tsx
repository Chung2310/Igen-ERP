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
  if (userProfile?.role !== "superadmin") return null;

  return (
    <div className="flex shrink-0 justify-end gap-3 border-b border-outline-variant bg-surface-container-lowest px-3 py-3" id="user_admin_header">
      <div className="flex flex-wrap items-center gap-2">
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
      </div>
    </div>
  );
}

