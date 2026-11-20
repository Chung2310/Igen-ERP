import React, { useState, useEffect, useCallback } from "react";
import {
  Warehouse,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Phone,
  User,
  MapPin,
  CheckCircle2,
  XCircle,
  Package,
  Loader2,
  X,
} from "lucide-react";
import { warehouseService } from "../../services/warehouseService";
import type { WarehouseRecord, WarehouseInput } from "../../types/warehouse";
import { toast } from "../../pages/Toast";
import { SupplyRecordDetailModal } from "./SupplyRecordDetailModal";
import { LogisticsEmptyIllustration } from "../common/LogisticsEmptyIllustration";

interface Props {
  canManage: boolean;
  activeBranchId?: string;
}

export const WarehouseManagementView: React.FC<Props> = ({ canManage, activeBranchId }) => {
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [detailWarehouse, setDetailWarehouse] = useState<WarehouseRecord | null>(null);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<WarehouseInput>({
    branchId: activeBranchId || "",
    code: "",
    name: "",
    location: "",
    managerName: "",
    managerPhone: "",
    description: "",
    isActive: true,
  });

  // Delete Confirm Modal
  const [deleteConfirm, setDeleteConfirm] = useState<WarehouseRecord | null>(null);

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const list = await warehouseService.list({
        branchId: activeBranchId,
        search,
        activeOnly: statusFilter === "active" ? true : undefined,
      });

      let filtered = list;
      if (statusFilter === "inactive") {
        filtered = list.filter((w) => !w.isActive);
      }
      setWarehouses(filtered);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi tải danh sách kho lưu trữ.");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, search, statusFilter]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const handleOpenAdd = () => {
    setEditingWarehouse(null);
    setFormData({
      branchId: activeBranchId || "",
      code: `KHO-${Date.now().toString().slice(-4)}`,
      name: "",
      location: "",
      managerName: "",
      managerPhone: "",
      description: "",
      isActive: true,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (wh: WarehouseRecord) => {
    setEditingWarehouse(wh);
    setFormData({
      branchId: wh.branchId || activeBranchId || "",
      code: wh.code || "",
      name: wh.name || "",
      location: wh.location || "",
      managerName: wh.managerName || "",
      managerPhone: wh.managerPhone || "",
      description: wh.description || "",
      isActive: wh.isActive ?? true,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Vui lòng nhập tên kho.");
      return;
    }
    if (!formData.code.trim()) {
      toast.error("Vui lòng nhập mã kho.");
      return;
    }

    setActionLoading(true);
    try {
      if (editingWarehouse) {
        await warehouseService.update(editingWarehouse._id, formData, activeBranchId);
        toast.success("Cập nhật kho lưu trữ thành công!");
      } else {
        await warehouseService.create(formData, activeBranchId);
        toast.success("Thêm mới kho lưu trữ thành công!");
      }
      setShowModal(false);
      fetchWarehouses();
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu kho lưu trữ.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(true);
    try {
      await warehouseService.delete(deleteConfirm._id, activeBranchId);
      toast.success(`Đã xóa kho '${deleteConfirm.name}' thành công.`);
      setDeleteConfirm(null);
      fetchWarehouses();
    } catch (err: any) {
      toast.error(err.message || "Không thể xóa kho lưu trữ.");
    } finally {
      setActionLoading(false);
    }
  };

  // Stats calculation
  const totalCount = warehouses.length;
  const activeCount = warehouses.filter((w) => w.isActive).length;
  const inactiveCount = totalCount - activeCount;
  const totalSuppliesStored = warehouses.reduce((acc, w) => acc + (w.supplyCount || 0), 0);

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/10 hover:shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Thêm kho lưu trữ
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng số kho</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">{totalCount}</p>
        </div>
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Đang hoạt động</p>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{activeCount}</p>
        </div>
        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Tạm dừng</p>
          <p className="text-2xl font-bold text-amber-700 mt-2">{inactiveCount}</p>
        </div>
        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Vật tư đang lưu</p>
          <p className="text-2xl font-bold text-blue-700 mt-2">{totalSuppliesStored}</p>
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
              placeholder="Tìm theo tên kho, mã kho, vị trí, thủ kho..."
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
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm dừng</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm">Đang tải dữ liệu kho lưu trữ...</p>
          </div>
        ) : warehouses.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <LogisticsEmptyIllustration kind="warehouse" />
            <p className="text-base font-semibold text-slate-700">Chưa có kho lưu trữ nào</p>
            <p className="text-sm text-slate-400 mt-1">
              Bấm &quot;Thêm kho lưu trữ&quot; để thiết lập kho đầu tiên cho cơ sở.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Kho lưu trữ</th>
                  <th className="px-4 py-3">Vị trí cụ thể</th>
                  <th className="px-4 py-3">Thủ kho / Phụ trách</th>
                  <th className="px-4 py-3">Mô tả</th>
                  <th className="px-4 py-3 text-center">Số vật tư</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  {canManage && <th className="px-5 py-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warehouses.map((wh) => (
                  <tr key={wh._id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailWarehouse(wh)}
                            className="text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                            title="Xem chi tiết kho"
                          >
                            {wh.name}
                          </button>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {wh.code}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      {wh.location ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {wh.location}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-0.5 text-xs">
                        {wh.managerName && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                            <User className="w-3 h-3 text-slate-400" />
                            {wh.managerName}
                          </span>
                        )}
                        {wh.managerPhone && (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {wh.managerPhone}
                          </span>
                        )}
                        {!wh.managerName && !wh.managerPhone && <span className="text-slate-400">—</span>}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="text-xs text-slate-500 max-w-xs line-clamp-2">{wh.description || "—"}</span>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        <Package className="w-3 h-3" />
                        {wh.supplyCount || 0}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-center">
                      {wh.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Hoạt động
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
                            onClick={() => handleOpenEdit(wh)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition"
                            title="Sửa thông tin"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(wh)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                            title="Xóa kho lưu trữ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Thêm / Sửa Kho Lưu Trữ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-lg">
                  {editingWarehouse ? "Cập nhật Kho lưu trữ" : "Thêm mới Kho lưu trữ"}
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

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Mã kho lưu trữ *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="vd: KHO-DUOC-01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Tên kho lưu trữ *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="vd: Kho Dược - Kệ B2"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Vị trí cụ thể (tòa nhà / tầng / phòng)
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="vd: Tầng 1 - Khu Cấp Cứu, Dãy A"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Thủ kho / Người quản lý
                  </label>
                  <input
                    type="text"
                    value={formData.managerName}
                    onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                    placeholder="vd: Trần Văn B"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    SĐT Thủ kho
                  </label>
                  <input
                    type="text"
                    value={formData.managerPhone}
                    onChange={(e) => setFormData({ ...formData, managerPhone: e.target.value })}
                    placeholder="vd: 0912345678"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Mô tả / Ghi chú kho
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ghi chú về phân loại vật tư trong kho, điều kiện nhiệt độ bảo quản..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="warehouseIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                />
                <label htmlFor="warehouseIsActive" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Kích hoạt kho lưu trữ (cho phép chọn để nhập vật tư)
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
                  {editingWarehouse ? "Lưu thay đổi" : "Tạo kho lưu trữ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <SupplyRecordDetailModal
        open={Boolean(detailWarehouse)}
        title={detailWarehouse?.name || "Chi tiết kho lưu trữ"}
        subtitle={detailWarehouse ? `Mã kho: ${detailWarehouse.code}` : undefined}
        status={
          detailWarehouse
            ? { label: detailWarehouse.isActive ? "Hoạt động" : "Tạm dừng", active: detailWarehouse.isActive }
            : undefined
        }
        fields={
          detailWarehouse
            ? [
                { label: "Chi nhánh", value: detailWarehouse.branchId },
                { label: "Số vật tư đang lưu", value: (detailWarehouse.supplyCount || 0).toLocaleString("vi-VN") },
                { label: "Người phụ trách", value: detailWarehouse.managerName },
                { label: "Điện thoại phụ trách", value: detailWarehouse.managerPhone },
                { label: "Vị trí kho", value: detailWarehouse.location, wide: true },
                { label: "Mô tả", value: detailWarehouse.description, wide: true },
                {
                  label: "Ngày tạo",
                  value: detailWarehouse.createdAt
                    ? new Date(detailWarehouse.createdAt).toLocaleString("vi-VN")
                    : undefined,
                },
                {
                  label: "Cập nhật gần nhất",
                  value: detailWarehouse.updatedAt
                    ? new Date(detailWarehouse.updatedAt).toLocaleString("vi-VN")
                    : undefined,
                },
              ]
            : []
        }
        onClose={() => setDetailWarehouse(null)}
        onEdit={
          canManage && detailWarehouse
            ? () => {
                const item = detailWarehouse;
                setDetailWarehouse(null);
                handleOpenEdit(item);
              }
            : undefined
        }
      />

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-left border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-slate-900 text-lg">Xác nhận xóa kho lưu trữ?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Bạn có chắc chắn muốn xóa kho <strong className="text-slate-900">{deleteConfirm.name}</strong>?
            </p>
            {Boolean(deleteConfirm.supplyCount) && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                Kho này hiện có <strong>{deleteConfirm.supplyCount}</strong> vật tư y tế đang được lưu trữ. Bạn không
                thể xóa nếu đang có vật tư tồn trữ tại đây.
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
