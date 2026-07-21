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
          setLoadError(error instanceof Error ? error.message : "Không thể tải danh sách nhân viên.");
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
        return <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">Đã khởi tạo</span>;
      case "unregistered":
        return <span className="rounded-full bg-gray-50 border border-gray-200 px-2.5 py-0.5 text-[10px] font-bold text-gray-500">Chưa khởi tạo</span>;
      case "unavailable":
        return <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold text-rose-600">Không kiểm tra được</span>;
      default:
        return <span className="rounded-full bg-gray-50 border border-gray-200 px-2.5 py-0.5 text-[10px] font-bold text-gray-400">Đang kiểm tra...</span>;
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-6 shadow-xs backdrop-blur-md">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <Scan className="h-4 w-4 text-indigo-650" />
          Nhận diện khuôn mặt chấm công
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Khởi tạo hoặc thay thế dữ liệu khuôn mặt để nhân viên chấm công bằng camera. Ảnh được chụp trực tiếp, không hỗ trợ tải tệp lên.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm kiếm theo tên hoặc email..."
          className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-indigo-400 focus:outline-none"
        />
      </div>

      {loadError && (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{loadError}</p>
      )}

      <ul className="divide-y divide-gray-100">
        {filtered.map(employee => {
          const state = statuses[employee.uid];
          return (
            <li key={employee.uid} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-gray-800">{employee.displayName}</p>
                <p className="truncate text-[11px] text-gray-500">{employee.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge(state)}
                <button
                  onClick={() => setEnrollTarget(employee)}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-650 hover:bg-indigo-100 cursor-pointer"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  {state === "registered" ? "Khởi tạo nhận diện lại" : "Khởi tạo nhận diện"}
                </button>
                {state === "registered" && (
                  <button
                    onClick={() => setDeleteTarget(employee)}
                    aria-label={`Xóa nhận diện của ${employee.displayName}`}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa nhận diện
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!loadError && filtered.length === 0 && (
          <li className="py-8 text-center text-xs text-gray-400">Không tìm thấy nhân viên phù hợp.</li>
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
    </div>
  );
}
