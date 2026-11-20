import React, { useState, useEffect, useCallback } from "react";
import { Tag, Plus, Search, Filter, Edit2, Trash2, CheckCircle2, XCircle, Package, Loader2, X } from "lucide-react";
import { categoryService } from "../../services/categoryService";
import type { CategoryRecord, CategoryInput } from "../../types/category";
import { toast } from "../../pages/Toast";
import { SupplyRecordDetailModal } from "./SupplyRecordDetailModal";
import { LogisticsEmptyIllustration } from "../common/LogisticsEmptyIllustration";

interface Props {
  canManage: boolean;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
};

export const CategoryManagementView: React.FC<Props> = ({ canManage }) => {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [detailCategory, setDetailCategory] = useState<CategoryRecord | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CategoryInput>({
    code: "",
    name: "",
    description: "",
    color: "emerald",
    isActive: true,
  });

  // Delete Confirm Modal
  const [deleteConfirm, setDeleteConfirm] = useState<CategoryRecord | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const list = await categoryService.list({
        search,
        activeOnly: statusFilter === "active" ? true : undefined,
      });

      let filtered = list;
      if (statusFilter === "inactive") {
        filtered = list.filter((c) => !c.isActive);
      }
      setCategories(filtered);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi tải danh sách phân loại sản phẩm.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({
      code: `DM-${Date.now().toString().slice(-4)}`,
      name: "",
      description: "",
      color: "emerald",
      isActive: true,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (cat: CategoryRecord) => {
    setEditingCategory(cat);
    setFormData({
      code: cat.code || "",
      name: cat.name || "",
      description: cat.description || "",
      color: cat.color || "emerald",
      isActive: cat.isActive ?? true,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Vui lòng nhập tên phân loại.");
      return;
    }
    if (!formData.code.trim()) {
      toast.error("Vui lòng nhập mã phân loại.");
      return;
    }

    setActionLoading(true);
    try {
      if (editingCategory) {
        await categoryService.update(editingCategory._id, formData);
        toast.success("Cập nhật phân loại thành công!");
      } else {
        await categoryService.create(formData);
        toast.success("Thêm mới phân loại thành công!");
      }
      setShowModal(false);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu phân loại.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(true);
    try {
      await categoryService.delete(deleteConfirm._id);
      toast.success(`Đã xóa phân loại '${deleteConfirm.name}' thành công.`);
      setDeleteConfirm(null);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "Không thể xóa phân loại.");
    } finally {
      setActionLoading(false);
    }
  };

  const totalCount = categories.length;
  const activeCount = categories.filter((c) => c.isActive).length;
  const inactiveCount = totalCount - activeCount;
  const totalSuppliesLinked = categories.reduce((acc, c) => acc + (c.supplyCount || 0), 0);

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/10 hover:shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Thêm phân loại
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng phân loại</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">{totalCount}</p>
        </div>
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Đang áp dụng</p>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{activeCount}</p>
        </div>
        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Tạm dừng</p>
          <p className="text-2xl font-bold text-amber-700 mt-2">{inactiveCount}</p>
        </div>
        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Sản phẩm thuộc nhóm</p>
          <p className="text-2xl font-bold text-blue-700 mt-2">{totalSuppliesLinked}</p>
        </div>
      </div>

      {/* Filter and Table Card */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden text-left">
        {/* Search & Filter */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên phân loại, mã, mô tả..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-400 transition"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 shrink-0">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold uppercase text-slate-400">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent focus:outline-none text-slate-800 font-medium cursor-pointer"
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang áp dụng</option>
              <option value="inactive">Tạm dừng</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm">Đang tải dữ liệu phân loại sản phẩm...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <LogisticsEmptyIllustration kind="category" />
            <p className="text-base font-semibold text-slate-700">Chưa có phân loại nào</p>
            <p className="text-sm text-slate-400 mt-1">
              Bấm &quot;Thêm phân loại&quot; để thiết lập nhóm vật tư đầu tiên.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Phân loại sản phẩm</th>
                  <th className="px-4 py-3">Mô tả chi tiết</th>
                  <th className="px-4 py-3 text-center">Số vật tư</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  {canManage && <th className="px-5 py-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((cat) => {
                  const colorStyle = COLOR_MAP[cat.color || "emerald"] || COLOR_MAP.emerald;
                  return (
                    <tr key={cat._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-3 h-3 rounded-full shrink-0 ${
                              cat.color === "blue"
                                ? "bg-blue-500"
                                : cat.color === "amber"
                                  ? "bg-amber-500"
                                  : cat.color === "rose"
                                    ? "bg-rose-500"
                                    : cat.color === "purple"
                                      ? "bg-purple-500"
                                      : cat.color === "indigo"
                                        ? "bg-indigo-500"
                                        : "bg-emerald-500"
                            }`}
                          />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setDetailCategory(cat)}
                                className="text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                                title="Xem chi tiết phân loại"
                              >
                                {cat.name}
                              </button>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {cat.code}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-xs text-slate-500 max-w-md line-clamp-2">{cat.description || "—"}</span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          <Package className="w-3 h-3" />
                          {cat.supplyCount || 0}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        {cat.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Áp dụng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Tạm dừng
                          </span>
                        )}
                      </td>

                      {canManage && (
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(cat)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition"
                              title="Sửa phân loại"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(cat)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Xóa phân loại"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Thêm / Sửa Phân Loại */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-lg">
                  {editingCategory ? "Cập nhật Phân loại sản phẩm" : "Thêm mới Phân loại sản phẩm"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Mã phân loại <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="vd: DM-GANG-TAY"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Tên phân loại sản phẩm <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="vd: Găng tay & Bảo hộ y tế"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Màu đại diện
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: "emerald", label: "Xanh lá", bg: "bg-emerald-500" },
                    { id: "blue", label: "Xanh dương", bg: "bg-blue-500" },
                    { id: "amber", label: "Vàng cam", bg: "bg-amber-500" },
                    { id: "rose", label: "Hồng đỏ", bg: "bg-rose-500" },
                    { id: "purple", label: "Tím", bg: "bg-purple-500" },
                    { id: "indigo", label: "Chàm", bg: "bg-indigo-500" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c.id })}
                      className={`w-7 h-7 rounded-full ${c.bg} transition-all cursor-pointer ${
                        formData.color === c.id
                          ? "ring-2 ring-offset-2 ring-slate-800 scale-110"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Mô tả phân loại
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả các vật tư thuộc danh mục này..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="catIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                />
                <label htmlFor="catIsActive" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Kích hoạt phân loại (sẵn sàng sử dụng khi tạo vật tư)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/10 transition disabled:opacity-60 cursor-pointer"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingCategory ? "Lưu thay đổi" : "Tạo phân loại"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <SupplyRecordDetailModal
        open={Boolean(detailCategory)}
        title={detailCategory?.name || "Chi tiết phân loại"}
        subtitle={detailCategory ? `Mã phân loại: ${detailCategory.code}` : undefined}
        status={
          detailCategory
            ? { label: detailCategory.isActive ? "Đang áp dụng" : "Tạm dừng", active: detailCategory.isActive }
            : undefined
        }
        fields={
          detailCategory
            ? [
                { label: "Màu nhận diện", value: detailCategory.color || "emerald" },
                { label: "Biểu tượng", value: detailCategory.icon },
                { label: "Số vật tư thuộc nhóm", value: (detailCategory.supplyCount || 0).toLocaleString("vi-VN") },
                { label: "Mã nội bộ", value: detailCategory._id },
                { label: "Mô tả nghiệp vụ", value: detailCategory.description, wide: true },
                {
                  label: "Ngày tạo",
                  value: detailCategory.createdAt
                    ? new Date(detailCategory.createdAt).toLocaleString("vi-VN")
                    : undefined,
                },
                {
                  label: "Cập nhật gần nhất",
                  value: detailCategory.updatedAt
                    ? new Date(detailCategory.updatedAt).toLocaleString("vi-VN")
                    : undefined,
                },
              ]
            : []
        }
        onClose={() => setDetailCategory(null)}
        onEdit={
          canManage && detailCategory
            ? () => {
                const item = detailCategory;
                setDetailCategory(null);
                handleOpenEdit(item);
              }
            : undefined
        }
      />

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-left border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-slate-900 text-lg">Xác nhận xóa phân loại?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Bạn có chắc chắn muốn xóa phân loại <strong className="text-slate-900">{deleteConfirm.name}</strong>?
            </p>
            {Boolean(deleteConfirm.supplyCount) && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                Phân loại này hiện có <strong>{deleteConfirm.supplyCount}</strong> vật tư đang thuộc nhóm. Bạn không thể
                xóa nếu đang có vật tư dùng phân loại này.
              </div>
            )}
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-rose-600/10 transition disabled:opacity-60 cursor-pointer"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
