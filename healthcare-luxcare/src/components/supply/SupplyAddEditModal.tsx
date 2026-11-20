import React, { useRef, useState } from "react";
import {
  Package,
  X,
  Upload,
  Loader2,
  Plus,
  FileText,
  Building2,
  Layers,
  Calendar,
  ShieldCheck,
  Image as ImageIcon,
  AlertCircle,
  HelpCircle,
  Camera,
} from "lucide-react";
import { RoomSelect } from "../common/RoomSelect";
import { SupplierSelect } from "./SupplierSelect";
import { WarehouseSelect } from "./WarehouseSelect";
import { CategorySelect } from "./CategorySelect";
import { SupplyCameraModal } from "./SupplyCameraModal";
import { supplyService } from "../../services/supplyService";
import { toast } from "../../pages/Toast";
import type { SupplyItem, SupplyDocument } from "../../types/supply";

interface FormDataState {
  name: string;
  code: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  expiryDate: string;
  requiresExpiry: boolean;
  manufactureDate: string;
  batchNumber: string;
  warehouseLocation: string;
  warehouseId?: string;
  roomId: string;
  supplier: string;
  supplierId?: string;
  inspectionDate: string;
  nextInspectionDate: string;
  inspectionCertificateNumber: string;
  imageUrl: string;
  documents: SupplyDocument[];
  unitPrice: number;
  notes: string;
}

interface Props {
  isOpen: boolean;
  editingItem: SupplyItem | null;
  formData: FormDataState;
  setFormData: React.Dispatch<React.SetStateAction<FormDataState>>;
  actionLoading: boolean;
  activeBranchId?: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const COMMON_UNITS = ["Hộp", "Cái", "Gói", "Ống", "Chai", "Cuộn", "Bộ", "Thùng", "Vỉ"];

export const SupplyAddEditModal: React.FC<Props> = ({
  isOpen,
  editingItem,
  formData,
  setFormData,
  actionLoading,
  activeBranchId,
  onClose,
  onSubmit,
}) => {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCameraCapture = async (file: File) => {
    setUploadingImage(true);
    try {
      const uploaded = await supplyService.uploadFiles([file], activeBranchId);
      if (uploaded.length > 0) {
        setFormData((prev) => ({ ...prev, imageUrl: uploaded[0].fileUrl }));
        toast.success("Đã chụp và cập nhật ảnh sản phẩm.");
      }
    } catch (err: any) {
      toast.error(err.message || "Tải ảnh chụp thất bại.");
      throw err;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const uploaded = await supplyService.uploadFiles([file], activeBranchId);
      if (uploaded.length > 0) {
        setFormData((prev) => ({ ...prev, imageUrl: uploaded[0].fileUrl }));
        toast.success("Đã tải lên ảnh sản phẩm.");
      }
    } catch (err: any) {
      toast.error(err.message || "Tải ảnh sản phẩm thất bại.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDocumentsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingFiles(true);
    try {
      const uploaded = await supplyService.uploadFiles(files, activeBranchId);
      setFormData((prev) => ({
        ...prev,
        documents: [...prev.documents, ...uploaded],
      }));
      toast.success(`Đã đính kèm ${uploaded.length} tệp tài liệu.`);
    } catch (err: any) {
      toast.error(err.message || "Tải lên tài liệu thất bại.");
    } finally {
      setUploadingFiles(false);
    }
  };

  const removeDocument = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden border border-slate-100 flex flex-col text-left animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                {editingItem ? "Cập nhật Danh mục Vật tư" : "Khai báo Danh mục Vật tư mới"}
              </h3>
              <p className="text-xs text-slate-500">
                Khai báo thông tin danh mục (Tên, Mã, ĐVT, Kho). Số lượng tồn và số lô được nhập qua Phiếu Nhập kho theo
                lô.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Clean Visual Sections */}
        <form onSubmit={onSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-left bg-slate-50/30">
          {/* Nhóm 1: Thông tin cơ bản & Phân loại */}
          <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  1. Thông tin định danh & Phân loại
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 italic">* Các trường bắt buộc</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên vật tư tiêu hao <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="vd: Găng tay y tế Nitrile không bột Vglove (Size M)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã vật tư <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="vd: VT-GT-01"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Danh mục phân loại <span className="text-rose-500">*</span>
                </label>
                <CategorySelect
                  value={formData.category}
                  onChange={(name) => setFormData({ ...formData, category: name })}
                  placeholder="Chọn hoặc bấm + Thêm phân loại..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đơn vị tính <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="vd: Hộp, Cái, Gói..."
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                />
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {COMMON_UNITS.slice(0, 6).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setFormData({ ...formData, unit: u })}
                      className={`text-[10px] px-1.5 py-0.5 rounded-md border transition cursor-pointer ${
                        formData.unit === u
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Đơn giá nhập dự kiến (VNĐ)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    placeholder="vd: 85000"
                    value={formData.unitPrice || ""}
                    onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                    className="w-full pl-3.5 pr-12 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                    VNĐ
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Nhóm 2: Nguồn cung & Vị trí kho */}
          <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                2. Nguồn cung ứng & Vị trí lưu trữ
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nhà cung cấp / Hãng sản xuất <span className="text-rose-500">*</span>
                </label>
                <SupplierSelect
                  value={formData.supplier}
                  supplierId={formData.supplierId}
                  onChange={(name, id) => {
                    setFormData({ ...formData, supplier: name, supplierId: id });
                  }}
                  placeholder="Chọn hoặc bấm + Thêm nhà cung cấp..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vị trí kho lưu trữ <span className="text-rose-500">*</span>
                </label>
                <WarehouseSelect
                  branchId={activeBranchId || editingItem?.branchId}
                  value={formData.warehouseLocation}
                  warehouseId={formData.warehouseId}
                  onChange={(location, id) => {
                    setFormData({ ...formData, warehouseLocation: location, warehouseId: id });
                  }}
                  placeholder="Chọn hoặc bấm + Thêm kho lưu trữ..."
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phòng ban / Kho liên kết (nếu có)
              </label>
              <RoomSelect
                branchId={activeBranchId || editingItem?.branchId}
                value=""
                roomId={formData.roomId}
                onChange={(name, id) => {
                  if (id) setFormData({ ...formData, roomId: id });
                }}
                placeholder="Chọn phòng ban đặt kho liên kết..."
              />
            </div>
          </section>

          {/* Nhóm 3: Tồn kho & Quản lý số lượng */}
          <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                3. Thiết lập tồn kho & Cảnh báo
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="supply-catalog-quantity" className="block text-xs font-semibold text-slate-700 mb-1">Số lượng tồn kho</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    id="supply-catalog-quantity"
                    readOnly
                    value={editingItem ? formData.quantity : 0}
                    className="w-full pl-3.5 pr-14 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">
                    {formData.unit || "đơn vị"}
                  </span>
                </div>
                {editingItem && (
                  <p className="text-xs text-slate-500 mt-1">
                    Số tồn chỉ thay đổi qua chứng từ kho. Lô, kho, giá và đơn vị được khóa sau khi có lịch sử.
                  </p>
                )}
                {!editingItem && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Sản phẩm mới có tồn kho bằng 0. Sau khi tạo, dùng <strong>"+ Nhập kho theo lô"</strong> để nhập số lượng hàng.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Mức tồn tối thiểu cảnh báo</span>
                  <span className="text-[10px] text-amber-600 font-normal">Cảnh báo khi chạm mốc này</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={formData.minQuantity}
                    onChange={(e) => setFormData({ ...formData, minQuantity: Number(e.target.value) })}
                    className="w-full pl-3.5 pr-14 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-2xs"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">
                    {formData.unit || "đơn vị"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Nhóm 4: Lô sản xuất & Hạn sử dụng */}
          <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">4. Lô hàng & Hạn sử dụng</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Số lô sản xuất (Batch/Lot)</label>
                <input
                  type="text"
                  placeholder="vd: LOT-2026-A1"
                  value={formData.batchNumber}
                  onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                  className="h-10 w-full min-w-0 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày sản xuất</label>
                <input
                  type="date"
                  value={formData.manufactureDate}
                  onChange={(e) => setFormData({ ...formData, manufactureDate: e.target.value })}
                  className="h-10 w-full min-w-0 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hạn sử dụng (HSD)</label>
                <input
                  type="date"
                  disabled={formData.requiresExpiry === false}
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="h-10 w-full min-w-0 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                />
                <label className="flex items-center gap-2 text-xs text-slate-600 mt-2">
                  <input
                    type="checkbox"
                    checked={formData.requiresExpiry !== false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        requiresExpiry: e.target.checked,
                        expiryDate: e.target.checked ? formData.expiryDate : "",
                      })
                    }
                  />
                  Vật tư có quản lý hạn dùng
                </label>
                {formData.requiresExpiry !== false && !formData.expiryDate && (
                  <p className="text-xs text-amber-700 mt-1">Chưa có hạn dùng: hàng chưa được phép xuất dùng.</p>
                )}
              </div>
            </div>
          </section>

          {/* Nhóm 5: Kiểm định & Chứng nhận y tế */}
          <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                5. Kiểm định & Chứng nhận chất lượng
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày kiểm định</label>
                <input
                  type="date"
                  value={formData.inspectionDate}
                  onChange={(e) => setFormData({ ...formData, inspectionDate: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hạn kiểm định tiếp theo</label>
                <input
                  type="date"
                  value={formData.nextInspectionDate}
                  onChange={(e) => setFormData({ ...formData, nextInspectionDate: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Số phiếu / Giấy kiểm định</label>
                <input
                  type="text"
                  placeholder="vd: KD-2026/08/BYT"
                  value={formData.inspectionCertificateNumber}
                  onChange={(e) => setFormData({ ...formData, inspectionCertificateNumber: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                />
              </div>
            </div>
          </section>

          {/* Nhóm 6: Ảnh sản phẩm, Tài liệu CO/CQ & Bảo quản */}
          <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <FileText className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                6. Hình ảnh, Tài liệu CO/CQ & Điều kiện bảo quản
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Ảnh sản phẩm */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Ảnh minh họa sản phẩm</label>
                <div className="flex items-center gap-3">
                  {formData.imageUrl ? (
                    <div className="relative w-20 h-20 rounded-xl border border-slate-200 overflow-hidden shrink-0 group shadow-2xs">
                      <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: "" })}
                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        title="Xóa ảnh"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0 bg-slate-50/50">
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                      <span className="text-[10px] mt-1">Chưa có ảnh</span>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
                      >
                        {uploadingImage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        {formData.imageUrl ? "Thay đổi ảnh" : "Tải ảnh lên"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCameraModalOpen(true)}
                        disabled={uploadingImage}
                        className="inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 rounded-xl text-xs font-semibold text-emerald-700 transition cursor-pointer shadow-2xs"
                      >
                        <Camera className="w-3.5 h-3.5 text-emerald-600" />
                        Chụp ảnh
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">Chụp ảnh trực tiếp bằng camera hoặc tải file (JPG, PNG tối đa 5MB)</p>
                  </div>
                </div>
              </div>

              {/* Tài liệu đính kèm */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700">Tài liệu chứng nhận CO/CQ, HDSD</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={handleDocumentsFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFiles}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    {uploadingFiles ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Đính kèm tệp
                  </button>
                </div>

                {formData.documents.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-36 overflow-y-auto bg-slate-50/50">
                    {formData.documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-medium text-slate-800 truncate">{doc.name}</span>
                          {doc.fileSize && (
                            <span className="text-slate-400 text-[10px] shrink-0">
                              ({Math.round(doc.fileSize / 1024)} KB)
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDocument(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50">
                    <p className="text-xs text-slate-400">Chưa có tệp tài liệu nào đính kèm.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Ghi chú điều kiện bảo quản */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ghi chú điều kiện bảo quản & Lưu ý sử dụng
              </label>
              <textarea
                rows={2}
                placeholder="vd: Bảo quản 2-8°C, tránh ánh sáng trực tiếp, độ ẩm < 70%. Sử dụng một lần duy nhất..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
              />
            </div>
          </section>

          {/* Modal Actions - Đặt ở cuối trang khi nhập xong, không bám theo màn hình */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl transition cursor-pointer shadow-2xs"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-600/10 active:scale-95"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingItem ? "Lưu thay đổi vật tư" : "Thêm mới vật tư"}
            </button>
          </div>
        </form>
      </div>

      {/* Modal Chụp Ảnh Trực Tiếp Bằng Camera / Webcam */}
      <SupplyCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        title="Chụp ảnh minh họa sản phẩm"
      />
    </div>
  );
};
