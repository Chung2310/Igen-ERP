import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileText,
  CheckCircle2,
  XCircle,
  Package,
  Loader2,
  X,
} from "lucide-react";
import { supplierService } from "../../services/supplierService";
import type { SupplierRecord, SupplierInput } from "../../types/supplier";
import { toast } from "../../pages/Toast";
import { SupplyRecordDetailModal } from "./SupplyRecordDetailModal";
import { LogisticsEmptyIllustration } from "../common/LogisticsEmptyIllustration";

interface Props {
  canManage: boolean;
}

export const SupplierManagementView: React.FC<Props> = ({ canManage }) => {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [detailSupplier, setDetailSupplier] = useState<SupplierRecord | null>(null);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<SupplierInput>({
    code: "",
    name: "",
    shortName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    taxCode: "",
    notes: "",
    isActive: true,
  });

  // Delete Confirm Modal
  const [deleteConfirm, setDeleteConfirm] = useState<SupplierRecord | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await supplierService.list({
        search,
        activeOnly: statusFilter === "active" ? true : undefined,
      });

      let filtered = list;
      if (statusFilter === "inactive") {
        filtered = list.filter((s) => !s.isActive);
      }
      setSuppliers(filtered);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi tải danh sách nhà cung cấp.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      code: `NCC-${Date.now().toString().slice(-4)}`,
      name: "",
      shortName: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      taxCode: "",
      notes: "",
      isActive: true,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (sup: SupplierRecord) => {
    setEditingSupplier(sup);
    setFormData({
      code: sup.code || "",
      name: sup.name || "",
      shortName: sup.shortName || "",
      contactPerson: sup.contactPerson || "",
      phone: sup.phone || "",
      email: sup.email || "",
      address: sup.address || "",
      taxCode: sup.taxCode || "",
      notes: sup.notes || "",
      isActive: sup.isActive ?? true,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Vui lòng nhập tên nhà cung cấp.");
      return;
    }
    if (!formData.code.trim()) {
      toast.error("Vui lòng nhập mã nhà cung cấp.");
      return;
    }

    setActionLoading(true);
    try {
      if (editingSupplier) {
        await supplierService.update(editingSupplier._id, formData);
        toast.success("Cập nhật nhà cung cấp thành công!");
      } else {
        await supplierService.create(formData);
        toast.success("Thêm mới nhà cung cấp thành công!");
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu nhà cung cấp.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(true);
    try {
      await supplierService.delete(deleteConfirm._id);
      toast.success(`Đã xóa nhà cung cấp '${deleteConfirm.name}' thành công.`);
      setDeleteConfirm(null);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Không thể xóa nhà cung cấp.");
    } finally {
      setActionLoading(false);
    }
  };

  // Stats calculation
  const totalCount = suppliers.length;
  const activeCount = suppliers.filter((s) => s.isActive).length;
  const inactiveCount = totalCount - activeCount;
  const totalSuppliesLinked = suppliers.reduce((acc, s) => acc + (s.supplyCount || 0), 0);

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/10 hover:shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Thêm nhà cung cấp
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng nhà cung cấp</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">{totalCount}</p>
        </div>
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Đang hợp tác</p>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{activeCount}</p>
        </div>
        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Tạm dừng</p>
          <p className="text-2xl font-bold text-amber-700 mt-2">{inactiveCount}</p>
        </div>
        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-xs text-left">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Vật tư đang cấp</p>
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
              placeholder="Tìm theo tên, mã nhà cung cấp, người liên hệ, SĐT, mã số thuế..."
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
              <option value="active">Đang hợp tác</option>
              <option value="inactive">Tạm dừng</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm">Đang tải dữ liệu nhà cung cấp...</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <LogisticsEmptyIllustration kind="supplier" />
            <p className="text-base font-semibold text-slate-700">Chưa có nhà cung cấp nào</p>
            <p className="text-sm text-slate-400 mt-1">
              Bấm &quot;Thêm nhà cung cấp&quot; để thiết lập đối tác đầu tiên.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Nhà cung cấp / Hãng</th>
                  <th className="px-4 py-3">Liên hệ</th>
                  <th className="px-4 py-3">Địa chỉ & Mã số thuế</th>
                  <th className="px-4 py-3 text-center">Số vật tư</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  {canManage && <th className="px-5 py-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((sup) => (
                  <tr key={sup._id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailSupplier(sup)}
                            className="text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                            title="Xem chi tiết nhà cung cấp"
                          >
                            {sup.name}
                          </button>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {sup.code}
                          </span>
                        </div>
                        {sup.shortName && sup.shortName !== sup.name && (
                          <span className="text-xs text-slate-500 mt-0.5">Tên viết tắt: {sup.shortName}</span>
                        )}
                        {sup.notes && (
                          <span className="text-xs text-slate-400 italic mt-0.5 line-clamp-1">{sup.notes}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1 text-xs text-slate-600">
                        {sup.contactPerson && <span className="font-medium text-slate-800">{sup.contactPerson}</span>}
                        {sup.phone && (
                          <span className="inline-flex items-center gap-1.5 text-slate-600">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {sup.phone}
                          </span>
                        )}
                        {sup.email && (
                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {sup.email}
                          </span>
                        )}
                        {!sup.contactPerson && !sup.phone && !sup.email && <span className="text-slate-400">—</span>}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1 text-xs">
                        {sup.address && (
                          <span className="inline-flex items-start gap-1.5 text-slate-600 max-w-xs line-clamp-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            {sup.address}
                          </span>
                        )}
                        {sup.taxCode && (
                          <span className="inline-flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                            <FileText className="w-3 h-3 text-slate-400" />
                            MST: {sup.taxCode}
                          </span>
                        )}
                        {!sup.address && !sup.taxCode && <span className="text-slate-400">—</span>}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        <Package className="w-3 h-3" />
                        {sup.supplyCount || 0}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-center">
                      {sup.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Đang hoạt động
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
                            onClick={() => handleOpenEdit(sup)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition"
                            title="Sửa thông tin"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(sup)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                            title="Xóa nhà cung cấp"
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

      {/* Modal Thêm / Sửa Nhà Cung Cấp */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-lg">
                  {editingSupplier ? "Cập nhật Nhà cung cấp" : "Thêm mới Nhà cung cấp"}
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
                    Mã nhà cung cấp *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="vd: NCC-BBRAUN"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Tên viết tắt / Tên hãng
                  </label>
                  <input
                    type="text"
                    value={formData.shortName}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    placeholder="vd: B.Braun, 3M, Vglove..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Tên nhà cung cấp đầy đủ *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="vd: Công ty TNHH B.Braun Việt Nam"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Người liên hệ đại diện
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="vd: Nguyễn Văn A (Phụ trách kinh doanh)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="vd: 0901234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Email liên hệ
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="vd: order@bbraun.vn"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Mã số thuế
                  </label>
                  <input
                    type="text"
                    value={formData.taxCode}
                    onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                    placeholder="vd: 0101234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Địa chỉ văn phòng / Nhà kho
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="vd: Tầng 5, Tòa nhà Keangnam, Cầu Giấy, Hà Nội"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Ghi chú bổ sung
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ghi chú về chiết khấu, chính sách bảo hành, thời gian giao hàng..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="supplierIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                />
                <label htmlFor="supplierIsActive" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Kích hoạt đối tác (sẵn sàng sử dụng trong quản lý vật tư)
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
                  {editingSupplier ? "Lưu thay đổi" : "Tạo nhà cung cấp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <SupplyRecordDetailModal
        open={Boolean(detailSupplier)}
        title={detailSupplier?.name || "Chi tiết nhà cung cấp"}
        subtitle={detailSupplier ? `Mã nhà cung cấp: ${detailSupplier.code}` : undefined}
        status={
          detailSupplier
            ? { label: detailSupplier.isActive ? "Đang hoạt động" : "Tạm dừng", active: detailSupplier.isActive }
            : undefined
        }
        fields={
          detailSupplier
            ? [
                { label: "Tên viết tắt", value: detailSupplier.shortName },
                { label: "Mã số thuế", value: detailSupplier.taxCode },
                { label: "Người liên hệ", value: detailSupplier.contactPerson },
                { label: "Số điện thoại", value: detailSupplier.phone },
                { label: "Email", value: detailSupplier.email },
                { label: "Số vật tư liên kết", value: (detailSupplier.supplyCount || 0).toLocaleString("vi-VN") },
                { label: "Địa chỉ", value: detailSupplier.address, wide: true },
                { label: "Ghi chú", value: detailSupplier.notes, wide: true },
                {
                  label: "Ngày tạo",
                  value: detailSupplier.createdAt
                    ? new Date(detailSupplier.createdAt).toLocaleString("vi-VN")
                    : undefined,
                },
                {
                  label: "Cập nhật gần nhất",
                  value: detailSupplier.updatedAt
                    ? new Date(detailSupplier.updatedAt).toLocaleString("vi-VN")
                    : undefined,
                },
              ]
            : []
        }
        onClose={() => setDetailSupplier(null)}
        onEdit={
          canManage && detailSupplier
            ? () => {
                const item = detailSupplier;
                setDetailSupplier(null);
                handleOpenEdit(item);
              }
            : undefined
        }
      />

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-left border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-slate-900 text-lg">Xác nhận xóa nhà cung cấp?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Bạn có chắc chắn muốn xóa nhà cung cấp <strong className="text-slate-900">{deleteConfirm.name}</strong>?
            </p>
            {Boolean(deleteConfirm.supplyCount) && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                Nhà cung cấp này hiện có <strong>{deleteConfirm.supplyCount}</strong> vật tư y tế liên kết. Bạn không
                thể xóa nếu đang có vật tư dùng nhà cung cấp này.
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
