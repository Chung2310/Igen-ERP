import { useCallback, useEffect, useState } from "react";
import type { UserProfile } from "../../types";
import { authService } from "../../services/authService";
import { hrDepartmentService, type HrDepartment } from "../../services/hrDepartmentService";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { HrDepartmentManager } from "./HrDepartmentManager";

type Props = {
  companyCode: string;
  fetchUsers: () => Promise<void>;
  canManage?: boolean;
};

export default function HrDepartmentTab({ companyCode, fetchUsers, canManage = true }: Props) {
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [managerUsers, setManagerUsers] = useState<UserProfile[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managerError, setManagerError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDepartments = useCallback(async (showLoading = true) => {
    if (!companyCode) {
      setDepartments([]);
      setError("");
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      setDepartments(await hrDepartmentService.list(companyCode));
      setError("");
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Không thể tải danh sách phòng ban."));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [companyCode]);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    let active = true;
    if (!companyCode) {
      setManagerUsers([]);
      setManagerError("");
      setManagersLoading(false);
      return () => { active = false; };
    }

    setManagerUsers([]);
    setManagerError("");
    setManagersLoading(true);
    void authService.getUsersByCompany(companyCode)
      .then((users) => { if (active) setManagerUsers(users); })
      .catch((reason) => {
        if (!active) return;
        setManagerError(getApiErrorMessage(reason, "Không thể tải danh sách nhân sự để phân công."));
      })
      .finally(() => { if (active) setManagersLoading(false); });
    return () => { active = false; };
  }, [companyCode]);

  const handleChanged = async (refreshUsers = false) => {
    await loadDepartments(false);
    if (refreshUsers) await fetchUsers();
  };

  if (loading) {
    return <div role="status" className="text-pretty p-4 text-sm text-on-surface-variant sm:p-6">Đang tải danh sách phòng ban...</div>;
  }

  if (error) {
    return (
      <div className="m-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 sm:m-6">
        <p role="alert" className="text-pretty text-sm text-on-surface">{error}</p>
        <button type="button" onClick={() => void loadDepartments()} className="mt-3 rounded-lg border border-outline px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary">
          Thử tải lại
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-4 sm:p-6">
      {error && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error bg-error-container p-3 text-sm text-on-error-container">
          <p role="alert" className="text-pretty">Không thể làm mới danh sách phòng ban: {error}</p>
          <button type="button" onClick={() => void loadDepartments()} className="rounded-lg border border-error px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary">
            Tải lại danh sách
          </button>
        </div>
      )}
      <HrDepartmentManager
        presentation="inline"
        canManage={canManage}
        companyCode={companyCode}
        departments={departments}
        managers={managerUsers.map((user) => ({ id: user.uid, name: user.displayName || user.email || user.uid }))}
        managersLoading={managersLoading}
        managerError={managerError}
        onChanged={handleChanged}
      />
    </div>
  );
}
