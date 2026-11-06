import React, { useEffect, useMemo, useState } from "react";
import { Scan, Search, Trash2, UserCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/authService";
import {
  deleteFaceEnrollment,
  enrollFace,
  getFaceEnrollmentStatus,
} from "../../services/faceManagementService";
import type { UserProfile } from "../../types/common";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { ConfirmDialog } from "../common/ConfirmDialog";
import FaceEnrollmentCameraModal from "./FaceEnrollmentCameraModal";

type EnrollmentState = "loading" | "registered" | "unregistered" | "unavailable";

export default function FaceRecognitionSettingsTab() {
  const { userProfile } = useAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [statuses, setStatuses] = useState<Record<string, EnrollmentState>>({});
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [enrollTarget, setEnrollTarget] = useState<UserProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const list = userProfile?.role === "superadmin"
          ? await authService.getAllUsers()
          : userProfile?.companyCode
            ? await authService.getUsersByCompany(userProfile.companyCode)
            : await authService.getColleagues();
        if (cancelled) return;
        const visible = list.filter(u => u.role !== "superadmin");
        setEmployees(visible);
        setStatuses(Object.fromEntries(visible.map(u => [u.uid, "loading" as EnrollmentState])));
        visible.forEach(u => {
          getFaceEnrollmentStatus(u.uid)
            .then(status => {
              if (!cancelled) {
                setStatuses(prev => ({
                  ...prev,
                  [u.uid]: status.registered ? "registered" : "unregistered",
                }));
              }
            })
            .catch(() => {
              if (!cancelled) {
                setStatuses(prev => ({ ...prev, [u.uid]: "unavailable" }));
              }
            });
        });
      } catch (error) {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(error, "Không thể tải danh sách nhân viên."));
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [userProfile?.role, userProfile?.companyCode]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter(u =>
      (u.displayName || "").toLowerCase().includes(query) ||
      (u.email || "").toLowerCase().includes(query),
    );
  }, [employees, search]);

  const handleEnroll = async (image: Blob) => {
    if (!enrollTarget) return;
    try {
      await enrollFace(enrollTarget.uid, image);
      setStatuses(prev => ({ ...prev, [enrollTarget.uid]: "registered" }));
      toast.success(`Đã khởi tạo nhận diện khuôn mặt cho ${enrollTarget.displayName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Khởi tạo nhận diện thất bại.");
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFaceEnrollment(deleteTarget.uid);
      setStatuses(prev => ({ ...prev, [deleteTarget.uid]: "unregistered" }));
      toast.success(`Đã xóa dữ liệu khuôn mặt của ${deleteTarget.displayName}.`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xóa dữ liệu khuôn mặt thất bại.");
    } finally {
      setDeleting(false);
    }
  };

  const statusBadge = (state: EnrollmentState | undefined) => {
    switch (state) {
      case "registered":
        return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Đã khởi tạo</span>;
      case "unregistered":
        return <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-normal text-slate-600">Chưa khởi tạo</span>;
      case "unavailable":
        return <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-normal text-rose-600">Không kiểm tra được</span>;
      default:
        return <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-normal text-slate-500">Đang kiểm tra...</span>;
    }
  };

  return (
    <section className="settings-face-card rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-sm sm:p-5">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-balance text-sm font-semibold text-on-surface">
          <Scan className="size-4 text-primary" aria-hidden="true" />
          Nhận diện khuôn mặt chấm công
        </h2>
        <p className="mt-1 text-pretty text-xs leading-5 text-on-surface-variant">
          Khởi tạo hoặc thay thế dữ liệu khuôn mặt để nhân viên chấm công bằng camera. Ảnh được chụp trực tiếp, không hỗ trợ tải tệp lên.
        </p>
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          aria-label="Tìm kiếm nhân viên theo tên hoặc email"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm kiếm theo tên hoặc email..."
          className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest py-0 pl-9 pr-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary"
        />
      </div>

      {loadError && (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{loadError}</p>
      )}

      <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
        {filtered.map(employee => {
          const state = statuses[employee.uid];
          return (
            <li
              key={employee.uid}
              className="flex flex-col justify-between gap-3 p-3 hover:bg-surface sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-9 shrink-0 select-none items-center justify-center rounded-md border border-outline-variant bg-primary/10 text-xs font-semibold uppercase text-primary">
                  {(employee.displayName || "AD").slice(0, 2)}
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-medium text-on-surface">{employee.displayName}</p>
                  <p className="mt-0.5 truncate text-xs text-on-surface-variant">{employee.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {statusBadge(state)}
                <button
                  onClick={() => setEnrollTarget(employee)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  {state === "registered" ? "Khởi tạo lại" : "Khởi tạo nhận diện"}
                </button>
                {state === "registered" && (
                  <button
                    onClick={() => setDeleteTarget(employee)}
                    aria-label={`Xóa nhận diện của ${employee.displayName}`}
                    title="Xóa nhận diện"
                    className="flex size-9 items-center justify-center rounded-md border border-error bg-surface-container-lowest text-error hover:bg-error-container focus-visible:outline-2 focus-visible:outline-error"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!loadError && filtered.length === 0 && (
          <li className="py-8 text-center text-sm text-on-surface-variant">
            Không tìm thấy nhân viên phù hợp.
          </li>
        )}
      </ul>

      {enrollTarget && (
        <FaceEnrollmentCameraModal
          employee={enrollTarget}
          onSubmit={handleEnroll}
          onClose={() => setEnrollTarget(null)}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Xóa dữ liệu khuôn mặt"
        description={`Nhân viên ${deleteTarget?.displayName || ""} sẽ không thể chấm công bằng khuôn mặt cho đến khi được khởi tạo lại.`}
        confirmLabel="Xóa"
        isSubmitting={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
