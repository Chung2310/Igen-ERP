import React, { useState, useEffect, useCallback } from "react";
import { toast } from "../../../../../pages/Toast";
import { useAuth } from "../../../../../context/AuthContext";
import { useAdminCenters } from "../../../hooks/useAdminCenters";
import { apiFetch } from "../../../lib/api";
import {
  ErpModal,
  ErpField,
  ErpInput,
  ErpSelect,
  ErpSubmitButton,
} from "../../../components/Erp/ErpUI";
import { formatVND } from "../../../lib/utils";
import { Loader2, Trash2, Milestone, Landmark } from "lucide-react";
import { CommissionLevel } from "../../../types";
import { useEntityLabel } from "../../../hooks/useEntityLabel";

interface CommissionLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCenter?: string;
}

export function CommissionLevelModal({
  isOpen,
  onClose,
  selectedCenter,
}: CommissionLevelModalProps) {
  const entityLabel = useEntityLabel();
  const { userProfile: user } = useAuth();
  const { centers } = useAdminCenters();
  const [levels, setLevels] = useState<CommissionLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeCenterId, setActiveCenterId] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    minTuition: "",
    commissionRate: "",
  });

  // Determine which center ownerId to query
  useEffect(() => {
    let targetId = "";
    if (user?.role !== "superadmin") {
      targetId = user?.uid || "";
    } else if (selectedCenter && selectedCenter !== "all") {
      targetId = selectedCenter;
    } else if (centers.length > 0) {
      targetId = centers[0].uid;
    }

    if (targetId && targetId !== activeCenterId) {
      const timer = setTimeout(() => {
        setActiveCenterId(targetId);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, selectedCenter, centers, activeCenterId]);

  const fetchLevels = useCallback(async () => {
    if (!activeCenterId) return;
    setLoading(true);
    try {
      const res = await apiFetch(
        `/partners/commission-levels?ownerFilter=${activeCenterId}`,
      );
      if (res.success && res.data) {
        setLevels(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch levels:", error);
      toast.error("Không thể lấy danh sách cấp bậc hoa hồng.");
    } finally {
      setLoading(false);
    }
  }, [activeCenterId, toast]);

  useEffect(() => {
    if (isOpen && activeCenterId) {
      const timer = setTimeout(() => {
        fetchLevels();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeCenterId, fetchLevels]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "minTuition" ? formatVND(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Vui lòng nhập tên cấp bậc hoa hồng.");
      return;
    }

    const minTuitionNum =
      parseInt(formData.minTuition.replace(/\D/g, ""), 10) || 0;
    const rateNum = parseFloat(formData.commissionRate) || 0;

    if (rateNum < 0 || rateNum > 100) {
      toast.error("Tỷ lệ hoa hồng phải từ 0% đến 100%.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch("/partners/commission-levels", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          minTuition: minTuitionNum,
          commissionRate: rateNum,
          centerId: activeCenterId,
        }),
      });

      if (res.success) {
        toast.success("Đã thêm cấp bậc hoa hồng mới thành công!");
        setFormData({ name: "", minTuition: "", commissionRate: "" });
        fetchLevels();
        // Emit mutation event to refresh partners page lists
        window.dispatchEvent(new CustomEvent("partner-mutation"));
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "Lỗi khi tạo cấp bậc hoa hồng.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa cấp bậc hoa hồng "${name}" không?`,
      )
    )
      return;

    try {
      const res = await apiFetch(`/partners/commission-levels/${id}`, {
        method: "DELETE",
      });
      if (res.success) {
        toast.success(`Đã xóa cấp bậc "${name}" thành công!`);
        fetchLevels();
        // Emit mutation event to refresh partners page lists
        window.dispatchEvent(new CustomEvent("partner-mutation"));
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Lỗi khi xóa cấp bậc.";
      toast.error(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <ErpModal
      title="Cấu hình Level Hoa hồng"
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6 text-left">
        {user?.role === "superadmin" && (
          <ErpField label="Trung tâm quản lý *">
            <ErpSelect
              name="activeCenterId"
              value={activeCenterId}
              onChange={(e) => setActiveCenterId(e.target.value)}
            >
              {centers.map((center) => (
                <option key={center.uid} value={center.uid}>
                  {center.displayName} ({center.email})
                </option>
              ))}
            </ErpSelect>
          </ErpField>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form thêm mới */}
          <div className="lg:col-span-2 bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Milestone className="w-4 h-4 text-brand-primary" />
              Thêm Level mới
            </h4>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <ErpField label="Tên cấp bậc *">
                <ErpInput
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: Bạc, Vàng, Level 1..."
                />
              </ErpField>

              <ErpField
                label={`${entityLabel.preset === "worker" ? "Giá trị tuyển dụng" : entityLabel.preset === "customer" ? "Giá trị dịch vụ" : "Doanh số học phí"} tối thiểu (VND) *`}
              >
                <ErpInput
                  name="minTuition"
                  required
                  value={formData.minTuition}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: 50,000,000"
                />
              </ErpField>

              <ErpField label="Tỷ lệ hoa hồng (%) *">
                <ErpInput
                  name="commissionRate"
                  type="number"
                  step="0.1"
                  required
                  value={formData.commissionRate}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: 8"
                />
              </ErpField>

              <ErpSubmitButton disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang lưu...
                  </span>
                ) : (
                  "Lưu cấp bậc"
                )}
              </ErpSubmitButton>
            </form>
          </div>

          {/* Danh sách hiện tại */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-sky-600" />
              Danh sách Cấp bậc hiện tại
            </h4>

            {loading ? (
              <div className="p-8 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-350" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Đang tải danh sách...
                </span>
              </div>
            ) : levels.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 bg-white space-y-2">
                <p className="text-xs font-black text-slate-800">
                  Chưa cấu hình cấp bậc riêng
                </p>
                <p className="text-[10px] text-slate-500 leading-relaxed max-w-[240px] mx-auto">
                  Hệ thống đang tự động áp dụng 3 cấp bậc mặc định (5%, 8%,
                  10%). Hãy tạo thêm cấp bậc tùy chỉnh của riêng trung tâm bạn ở
                  cột bên trái!
                </p>
              </div>
            ) : (
              <div className="border border-slate-100 rounded-2xl overflow-x-auto bg-white shadow-sm shadow-slate-100/50">
                <table className="w-full min-w-[560px] text-xs text-left font-semibold">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="py-3 px-4">Tên cấp</th>
                      <th className="py-3 px-4 text-right">
                        Doanh số tối thiểu
                      </th>
                      <th className="py-3 px-4 text-center">Hoa hồng (%)</th>
                      <th className="py-3 px-4 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {levels.map((lvl) => (
                      <tr
                        key={lvl._id}
                        className="hover:bg-slate-55/20 text-slate-700"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {lvl.name}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-850">
                          {formatVND(String(lvl.minTuition))}
                        </td>
                        <td className="py-3 px-4 text-center font-black text-brand-primary">
                          {lvl.commissionRate}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDelete(lvl._id, lvl.name)}
                            className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErpModal>
  );
}
