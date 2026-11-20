import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Download,
  ExternalLink,
  Upload,
  Loader2,
  Building2,
  FileSpreadsheet,
  Award,
  FileCheck,
  Layers,
  Sparkles,
  Eye,
} from "lucide-react";
import {
  equipmentComplianceService,
  type ILegalDocument,
  type IEquipmentInspectionRecord,
  type MedicalRiskClassification,
  type InspectionResult,
  type LegalDocumentType,
} from "../../services/equipmentComplianceService";
import { toast } from "../../pages/Toast";
import { ConfirmDialog } from "../common/ConfirmDialog";

interface EquipmentComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: any;
  canManage: boolean;
  onEquipmentUpdated?: (updatedEquipment: any) => void;
}

export const isImageFile = (url?: string, fileName?: string) => {
  if (!url) return false;
  const lower = `${url} ${fileName || ""}`.toLowerCase();
  return (
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".png") ||
    lower.includes(".webp") ||
    lower.includes(".gif") ||
    lower.includes("image/upload") ||
    lower.startsWith("data:image/")
  );
};

export const LEGAL_DOC_TYPES: { value: LegalDocumentType; label: string }[] = [
  { value: "co_cq", label: "Giấy chứng nhận xuất xứ & chất lượng (CO/CQ)" },
  { value: "invoice", label: "Hóa đơn mua sắm / Chứng từ tài sản" },
  { value: "import_license", label: "Tờ khai hải quan / Giấy phép nhập khẩu" },
  { value: "circulation_license", label: "Số lưu hành / Giấy phép lưu hành TTBYT" },
  { value: "calibration_cert", label: "Giấy chứng nhận kiểm định / hiệu chuẩn" },
  { value: "manual", label: "Tài liệu kỹ thuật / Hướng dẫn sử dụng" },
  { value: "other", label: "Tài liệu hồ sơ khác" },
];

export const getRiskClassificationBadge = (classification?: MedicalRiskClassification) => {
  switch (classification) {
    case "A":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          Nhóm A (Rủi ro rất thấp)
        </span>
      );
    case "B":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
          Nhóm B (Rủi ro TB thấp)
        </span>
      );
    case "C":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          Nhóm C (Rủi ro TB cao)
        </span>
      );
    case "D":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          Nhóm D (Rủi ro cao)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          Chưa phân nhóm
        </span>
      );
  }
};

export const getInspectionStatusBadge = (nextDateStr?: string | Date) => {
  if (!nextDateStr) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        <Clock className="w-3.5 h-3.5" /> Chưa lên lịch
      </span>
    );
  }

  const nextDate = new Date(nextDateStr);
  const now = new Date();
  const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
        Quá hạn {Math.abs(diffDays)} ngày
      </span>
    );
  }

  if (diffDays <= 30) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        <Clock className="w-3.5 h-3.5 text-amber-600" />
        Còn {diffDays} ngày đến hạn
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      Còn hạn ({diffDays} ngày)
    </span>
  );
};

export default function EquipmentComplianceModal({
  isOpen,
  onClose,
  equipment,
  canManage,
  onEquipmentUpdated,
}: EquipmentComplianceModalProps) {
  const [activeTab, setActiveTab] = useState<"docs" | "inspection" | "history">("inspection");
  const [currentEquipment, setCurrentEquipment] = useState<any>(equipment);
  const [inspections, setInspections] = useState<IEquipmentInspectionRecord[]>([]);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Deletion confirm states
  const [docToDelete, setDocToDelete] = useState<ILegalDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [inspectionToDelete, setInspectionToDelete] = useState<any | null>(null);
  const [isDeletingInspection, setIsDeletingInspection] = useState(false);

  // Form thêm hồ sơ pháp lý
  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docFormData, setDocFormData] = useState({
    title: "",
    type: "co_cq" as LegalDocumentType,
    documentNumber: "",
    fileUrl: "",
    fileName: "",
    fileSize: 0,
    uploadToken: "",
    issuedDate: "",
    expiryDate: "",
    issuingAuthority: "",
    notes: "",
  });

  // Form ghi nhận kiểm định mới
  const [showRecordInspectionForm, setShowRecordInspectionForm] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [savingInspection, setSavingInspection] = useState(false);
  const [inspectionFormData, setInspectionFormData] = useState({
    type: "inspection" as "inspection" | "calibration" | "maintenance",
    performedDate: new Date().toISOString().slice(0, 10),
    nextDueDate: "",
    serviceProvider: "",
    inspectorName: "",
    result: "pass" as InspectionResult,
    certificateNumber: "",
    reportFileUrl: "",
    reportFileName: "",
    uploadToken: "",
    cost: "",
    notes: "",
  });

  useEffect(() => {
    setCurrentEquipment(equipment);
    if (equipment?._id && isOpen) {
      loadInspections();
    }
  }, [equipment, isOpen]);

  // Tự động tính hạn kế tiếp khi đổi ngày thực hiện
  useEffect(() => {
    if (inspectionFormData.performedDate) {
      const cycle = currentEquipment?.inspectionCycleMonths || 12;
      const d = new Date(inspectionFormData.performedDate);
      d.setMonth(d.getMonth() + cycle);
      setInspectionFormData((prev) => ({
        ...prev,
        nextDueDate: d.toISOString().slice(0, 10),
      }));
    }
  }, [inspectionFormData.performedDate, currentEquipment?.inspectionCycleMonths]);

  const loadInspections = async () => {
    if (!equipment?._id) return;
    setLoadingInspections(true);
    try {
      const data = await equipmentComplianceService.listInspections(equipment._id);
      setInspections(data);
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải lịch sử kiểm định.");
    } finally {
      setLoadingInspections(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "doc" | "report") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Tệp đính kèm không được vượt quá 25MB.");
      return;
    }

    if (target === "doc") {
      setUploadingDoc(true);
      try {
        const uploaded = await equipmentComplianceService.uploadFile(file);
        setDocFormData((prev) => ({
          ...prev,
          fileUrl: uploaded.url,
          fileName: uploaded.fileName,
          fileSize: uploaded.size,
          uploadToken: uploaded.uploadToken,
          title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
        }));
        toast.success("Tải tệp hồ sơ lên thành công!");
      } catch (err: any) {
        toast.error(err.message || "Tải tệp thất bại.");
      } finally {
        setUploadingDoc(false);
      }
    } else {
      setUploadingReport(true);
      try {
        const uploaded = await equipmentComplianceService.uploadFile(file);
        setInspectionFormData((prev) => ({
          ...prev,
          reportFileUrl: uploaded.url,
          reportFileName: uploaded.fileName,
          uploadToken: uploaded.uploadToken,
        }));
        toast.success("Tải tệp biên bản kiểm định thành công!");
      } catch (err: any) {
        toast.error(err.message || "Tải biên bản thất bại.");
      } finally {
        setUploadingReport(false);
      }
    }
  };

  const handleSubmitDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFormData.fileUrl) {
      toast.error("Vui lòng tải lên file tài liệu đính kèm.");
      return;
    }

    try {
      const updatedEquipment = await equipmentComplianceService.addLegalDocument(currentEquipment._id, docFormData);
      setCurrentEquipment(updatedEquipment);
      if (onEquipmentUpdated) onEquipmentUpdated(updatedEquipment);
      toast.success("Thêm tài liệu pháp lý thành công!");
      setShowAddDocForm(false);
      setDocFormData({
        title: "",
        type: "co_cq",
        documentNumber: "",
        fileUrl: "",
        fileName: "",
        fileSize: 0,
        uploadToken: "",
        issuedDate: "",
        expiryDate: "",
        issuingAuthority: "",
        notes: "",
      });
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu hồ sơ pháp lý.");
    }
  };

  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);
    try {
      const updated = await equipmentComplianceService.deleteLegalDocument(currentEquipment._id, docToDelete._id as string);
      setCurrentEquipment(updated);
      if (onEquipmentUpdated) onEquipmentUpdated(updated);
      setDocToDelete(null);
      toast.success("Đã xóa tài liệu hồ sơ thiết bị.");
    } catch (err: any) {
      toast.error(err.message || "Xóa tài liệu thất bại.");
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectionFormData.serviceProvider.trim()) {
      toast.error("Vui lòng nhập đơn vị thực hiện kiểm định / bảo dưỡng.");
      return;
    }

    setSavingInspection(true);
    try {
      const res = await equipmentComplianceService.recordInspection(currentEquipment._id, {
        type: inspectionFormData.type,
        performedDate: inspectionFormData.performedDate,
        nextDueDate: inspectionFormData.nextDueDate || undefined,
        serviceProvider: inspectionFormData.serviceProvider,
        inspectorName: inspectionFormData.inspectorName || undefined,
        result: inspectionFormData.result,
        certificateNumber: inspectionFormData.certificateNumber || undefined,
        reportFileUrl: inspectionFormData.reportFileUrl || undefined,
        reportFileName: inspectionFormData.reportFileName || undefined,
        uploadToken: inspectionFormData.uploadToken || undefined,
        cost: inspectionFormData.cost ? Number(inspectionFormData.cost) : undefined,
        notes: inspectionFormData.notes || undefined,
      });

      setCurrentEquipment(res.equipment);
      if (onEquipmentUpdated) onEquipmentUpdated(res.equipment);
      await loadInspections();
      toast.success("Đã ghi nhận kết quả kiểm định và cập nhật hạn tiếp theo!");
      setShowRecordInspectionForm(false);
      setInspectionFormData({
        type: "inspection",
        performedDate: new Date().toISOString().slice(0, 10),
        nextDueDate: "",
        serviceProvider: "",
        inspectorName: "",
        result: "pass",
        certificateNumber: "",
        reportFileUrl: "",
        reportFileName: "",
        uploadToken: "",
        cost: "",
        notes: "",
      });
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu kết quả kiểm định.");
    } finally {
      setSavingInspection(false);
    }
  };

  const handleConfirmDeleteInspection = async () => {
    if (!inspectionToDelete) return;
    setIsDeletingInspection(true);
    try {
      await equipmentComplianceService.deleteInspectionRecord(currentEquipment._id, inspectionToDelete._id);
      await loadInspections();
      // Reload equipment detail
      const res = await fetch(`/api/v1/equipment/${currentEquipment._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      });
      const data = await res.json();
      if (data.status === "success") {
        setCurrentEquipment(data.data);
        if (onEquipmentUpdated) onEquipmentUpdated(data.data);
      }
      setInspectionToDelete(null);
      toast.success("Đã xóa bản ghi kiểm định.");
    } catch (err: any) {
      toast.error(err.message || "Không thể xóa bản ghi kiểm định.");
    } finally {
      setIsDeletingInspection(false);
    }
  };

  if (!isOpen || !equipment) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-start justify-between relative shrink-0">
          <div className="flex items-start gap-4 pr-8 min-w-0">
            {currentEquipment.imageUrl ? (
              <div
                className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/20 shrink-0 shadow-md bg-white/10"
                title="Ảnh thiết bị"
              >
                <img src={currentEquipment.imageUrl} alt={currentEquipment.name} className="w-full h-full object-cover" />
              </div>
            ) : null}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-white">{currentEquipment.name}</h2>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-white/10 text-emerald-300 border border-white/10">
                  {currentEquipment.code}
                </span>
              </div>

            <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap pt-1">
              <span>{getRiskClassificationBadge(currentEquipment.riskClassification)}</span>
              {currentEquipment.serialNumber && (
                <span>
                  Seri: <strong className="text-white">{currentEquipment.serialNumber}</strong>
                </span>
              )}
              {currentEquipment.manufacturer && (
                <span>
                  Hãng SX: <strong className="text-white">{currentEquipment.manufacturer}</strong>
                </span>
              )}
              {currentEquipment.location && (
                <span>
                  Vị trí: <strong className="text-white">{currentEquipment.location}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 shrink-0 gap-6">
          <button
            onClick={() => setActiveTab("inspection")}
            className={`py-3.5 text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === "inspection"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Kiểm định & Hiệu chuẩn
            <span className="ml-1">{getInspectionStatusBadge(currentEquipment.nextInspectionDate)}</span>
          </button>

          <button
            onClick={() => setActiveTab("docs")}
            className={`py-3.5 text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === "docs"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            Hồ sơ pháp lý ({currentEquipment.legalDocuments?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`py-3.5 text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === "history"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Award className="w-4 h-4" />
            Lịch sử các đợt kiểm tra ({inspections.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ================= TAB 1: KIỂM ĐỊNH & HIỆU CHUẨN ================= */}
          {activeTab === "inspection" && (
            <div className="space-y-6">
              {/* Card trạng thái hiện tại */}
              <div className="bg-gradient-to-br from-slate-50 to-emerald-50/40 rounded-2xl border border-emerald-100/70 p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Tình trạng kiểm định thiết bị
                    </span>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <div className="text-lg font-bold text-slate-900">
                        {currentEquipment.nextInspectionDate
                          ? `Hạn kế tiếp: ${new Date(currentEquipment.nextInspectionDate).toLocaleDateString("vi-VN")}`
                          : "Chưa thiết lập ngày đến hạn"}
                      </div>
                      {getInspectionStatusBadge(currentEquipment.nextInspectionDate)}
                    </div>
                  </div>

                  {canManage && (
                    <button
                      onClick={() => setShowRecordInspectionForm(!showRecordInspectionForm)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {showRecordInspectionForm ? "Đóng form" : "Ghi nhận kiểm định mới"}
                    </button>
                  )}
                </div>

                {/* Chi tiết đợt gần nhất */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-200/70 text-xs">
                  <div>
                    <p className="text-slate-400 font-medium">Chu kỳ định kỳ:</p>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {currentEquipment.inspectionCycleMonths
                        ? `${currentEquipment.inspectionCycleMonths} tháng / lần`
                        : "12 tháng (mặc định)"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Lần kiểm tra gần nhất:</p>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {currentEquipment.lastInspectionDate
                        ? new Date(currentEquipment.lastInspectionDate).toLocaleDateString("vi-VN")
                        : "Chưa ghi nhận"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Kết quả lần trước:</p>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {currentEquipment.lastInspectionResult === "pass" ? (
                        <span className="text-emerald-600 font-bold">✓ Đạt yêu cầu</span>
                      ) : currentEquipment.lastInspectionResult === "fail" ? (
                        <span className="text-rose-600 font-bold">✕ Không đạt</span>
                      ) : currentEquipment.lastInspectionResult === "conditional" ? (
                        <span className="text-amber-600 font-bold">⚠ Đạt có điều kiện</span>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Đơn vị thực hiện:</p>
                    <p className="font-semibold text-slate-800 mt-0.5 truncate">
                      {currentEquipment.lastInspectionProvider || "—"}
                    </p>
                  </div>
                </div>

                {currentEquipment.lastInspectionReportUrl && (
                  <div className="mt-3 text-xs flex items-center gap-2">
                    <span className="text-slate-400">Biên bản gần nhất:</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (isImageFile(currentEquipment.lastInspectionReportUrl, currentEquipment.lastInspectionReportFileName)) {
                          setPreviewImageUrl(currentEquipment.lastInspectionReportUrl);
                        } else {
                          window.open(currentEquipment.lastInspectionReportUrl, "_blank");
                        }
                      }}
                      className="text-emerald-700 hover:text-emerald-800 font-semibold underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{currentEquipment.lastInspectionReportFileName || "Xem biên bản kiểm định"}</span>
                    </button>
                    <a
                      href={currentEquipment.lastInspectionReportUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800"
                      title="Tải về"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Form ghi nhận kiểm định mới */}
              {showRecordInspectionForm && (
                <form
                  onSubmit={handleSubmitInspection}
                  className="bg-white rounded-2xl border-2 border-emerald-500/30 p-5 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Ghi nhận kết quả Kiểm định / Hiệu chuẩn / Bảo trì
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowRecordInspectionForm(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Loại quy trình *</label>
                      <select
                        value={inspectionFormData.type}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            type: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 font-medium text-slate-800"
                      >
                        <option value="inspection">Kiểm định an toàn y tế</option>
                        <option value="calibration">Hiệu chuẩn thiết bị</option>
                        <option value="maintenance">Bảo trì / Bảo dưỡng định kỳ</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày thực hiện *</label>
                      <input
                        type="date"
                        required
                        value={inspectionFormData.performedDate}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            performedDate: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Hạn kiểm tra lần sau *</label>
                      <input
                        type="date"
                        required
                        value={inspectionFormData.nextDueDate}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            nextDueDate: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Đơn vị thực hiện *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Viện Trang thiết bị Y tế, TT Kỹ thuật Tiêu chuẩn 1..."
                        value={inspectionFormData.serviceProvider}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            serviceProvider: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Kết quả đánh giá *</label>
                      <select
                        value={inspectionFormData.result}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            result: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-800"
                      >
                        <option value="pass" className="text-emerald-700">
                          ✓ Đạt chuẩn (Pass)
                        </option>
                        <option value="fail" className="text-rose-700">
                          ✕ Không đạt (Fail)
                        </option>
                        <option value="conditional" className="text-amber-700">
                          ⚠ Có điều kiện (Conditional)
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Chuyên viên / Kỹ thuật viên
                      </label>
                      <input
                        type="text"
                        placeholder="Người kiểm định..."
                        value={inspectionFormData.inspectorName}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            inspectorName: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Số tem / Số giấy chứng nhận
                      </label>
                      <input
                        type="text"
                        placeholder="VD: TEM-KD-2026-99"
                        value={inspectionFormData.certificateNumber}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            certificateNumber: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Chi phí (VNĐ)</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="VD: 1500000"
                        value={inspectionFormData.cost}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            cost: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                      />
                    </div>
                  </div>

                  {/* File biên bản upload */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      File biên bản kiểm định / Giấy chứng nhận (PDF hoặc Ảnh)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition">
                        {uploadingReport ? (
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                        ) : (
                          <Upload className="w-4 h-4 text-slate-500" />
                        )}
                        {uploadingReport ? "Đang tải lên..." : "Chọn file biên bản..."}
                        <input
                          type="file"
                          disabled={uploadingReport}
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, "report")}
                        />
                      </label>
                      {inspectionFormData.reportFileUrl && (
                        <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {inspectionFormData.reportFileName || "Đã đính kèm tệp"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Ghi chú / Kết luận kiểm tra
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ghi chú chi tiết kết quả hoặc khuyến cáo vận hành..."
                      value={inspectionFormData.notes}
                      onChange={(e) => setInspectionFormData({ ...inspectionFormData, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowRecordInspectionForm(false)}
                      className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={savingInspection}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      {savingInspection && <Loader2 className="w-4 h-4 animate-spin" />}
                      Lưu và Cập nhật lịch tiếp theo
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ================= TAB 2: HỒ SƠ PHÁP LÝ ================= */}
          {activeTab === "docs" && (
            <div className="space-y-6">
              {/* Header thêm hồ sơ */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Hồ sơ pháp lý & Chứng từ</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hóa đơn, CO/CQ, Tờ khai hải quan, Giấy phép lưu hành theo quy định Bộ Y tế.
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => setShowAddDocForm(!showAddDocForm)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    {showAddDocForm ? "Đóng form" : "Thêm tài liệu mới"}
                  </button>
                )}
              </div>

              {/* Form thêm tài liệu mới */}
              {showAddDocForm && (
                <form
                  onSubmit={handleSubmitDoc}
                  className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in"
                >
                  <h4 className="font-bold text-slate-800 text-sm">Tải lên hồ sơ pháp lý mới</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Tên tài liệu / Văn bản *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Hóa đơn mua máy Laser, Giấy chứng nhận CO/CQ..."
                        value={docFormData.title}
                        onChange={(e) => setDocFormData({ ...docFormData, title: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Loại hồ sơ *</label>
                      <select
                        value={docFormData.type}
                        onChange={(e) =>
                          setDocFormData({
                            ...docFormData,
                            type: e.target.value as LegalDocumentType,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800"
                      >
                        {LEGAL_DOC_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Số hiệu văn bản</label>
                      <input
                        type="text"
                        placeholder="VD: 00123/CQ-2026"
                        value={docFormData.documentNumber}
                        onChange={(e) => setDocFormData({ ...docFormData, documentNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày phát hành</label>
                      <input
                        type="date"
                        value={docFormData.issuedDate}
                        onChange={(e) => setDocFormData({ ...docFormData, issuedDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày hết hạn (nếu có)</label>
                      <input
                        type="date"
                        value={docFormData.expiryDate}
                        onChange={(e) => setDocFormData({ ...docFormData, expiryDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Upload file đính kèm */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      File tài liệu đính kèm (PDF, Ảnh, Word) *
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition">
                        {uploadingDoc ? (
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                        ) : (
                          <Upload className="w-4 h-4 text-slate-500" />
                        )}
                        {uploadingDoc ? "Đang tải lên..." : "Chọn tệp từ máy..."}
                        <input
                          type="file"
                          disabled={uploadingDoc}
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, "doc")}
                        />
                      </label>
                      {docFormData.fileUrl && (
                        <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {docFormData.fileName || "Tệp đã tải lên"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowAddDocForm(false)}
                      className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={uploadingDoc || !docFormData.fileUrl}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                    >
                      Lưu hồ sơ
                    </button>
                  </div>
                </form>
              )}

              {/* Danh sách các tài liệu đã tải lên */}
              {!currentEquipment.legalDocuments || currentEquipment.legalDocuments.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                  <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">Chưa có hồ sơ pháp lý nào</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Bổ sung CO/CQ, hóa đơn hoặc giấy phép để hoàn thiện hồ sơ thiết bị.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentEquipment.legalDocuments.map((doc: ILegalDocument) => {
                    const isImg = isImageFile(doc.fileUrl, doc.fileName);
                    return (
                    <div
                      key={doc._id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-emerald-300 transition flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {isImg ? (
                          <div
                            onClick={() => setPreviewImageUrl(doc.fileUrl)}
                            className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100 cursor-pointer relative group"
                            title="Bấm để xem ảnh phóng to"
                          >
                            <img
                              src={doc.fileUrl}
                              alt={doc.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl shrink-0 mt-0.5">
                            <FileCheck className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 text-left">
                          <h4 className="font-bold text-slate-800 text-sm truncate" title={doc.title}>
                            {doc.title}
                          </h4>
                          <span className="inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            {LEGAL_DOC_TYPES.find((t) => t.value === doc.type)?.label || doc.type}
                          </span>
                          {doc.documentNumber && (
                            <p className="text-xs text-slate-500 font-mono mt-1">Số: {doc.documentNumber}</p>
                          )}
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2">
                            <span>
                              {doc.issuedDate ? `Cấp: ${new Date(doc.issuedDate).toLocaleDateString("vi-VN")}` : ""}
                            </span>
                            {doc.expiryDate && (
                              <span>&bull; Hạn: {new Date(doc.expiryDate).toLocaleDateString("vi-VN")}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isImg && (
                          <button
                            type="button"
                            onClick={() => setPreviewImageUrl(doc.fileUrl)}
                            className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="Xem ảnh phóng to"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="Xem / Tải về"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {canManage && (
                          <button
                            onClick={() => setDocToDelete(doc)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Xóa tài liệu"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: LỊCH SỬ KIỂM ĐỊNH ================= */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Lịch sử kiểm định & bảo trì</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lưu vết toàn bộ biên bản kiểm định, hiệu chuẩn qua các chu kỳ.
                  </p>
                </div>
              </div>

              {loadingInspections ? (
                <div className="p-12 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                  <p className="text-xs">Đang tải lịch sử kiểm định...</p>
                </div>
              ) : inspections.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                  <Clock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">Chưa có lịch sử kiểm định</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Ghi nhận đợt kiểm định đầu tiên ở Tab "Kiểm định & Hiệu chuẩn".
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <th className="p-3 pl-4">Ngày thực hiện</th>
                        <th className="p-3">Loại quy trình</th>
                        <th className="p-3">Đơn vị & Chuyên viên</th>
                        <th className="p-3">Kết quả</th>
                        <th className="p-3">Hạn lần tới</th>
                        <th className="p-3">Biên bản đính kèm</th>
                        {canManage && <th className="p-3 pr-4 text-right">Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {inspections.map((rec) => (
                        <tr key={rec._id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 pl-4 font-semibold text-slate-900 whitespace-nowrap">
                            {new Date(rec.performedDate).toLocaleDateString("vi-VN")}
                          </td>
                          <td className="p-3 font-medium">
                            {rec.type === "inspection"
                              ? "Kiểm định y tế"
                              : rec.type === "calibration"
                                ? "Hiệu chuẩn máy"
                                : "Bảo trì định kỳ"}
                          </td>
                          <td className="p-3">
                            <p className="font-medium text-slate-800">{rec.serviceProvider}</p>
                            {rec.inspectorName && (
                              <p className="text-[11px] text-slate-400 mt-0.5">NV: {rec.inspectorName}</p>
                            )}
                          </td>
                          <td className="p-3">
                            {rec.result === "pass" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                Đạt (Pass)
                              </span>
                            ) : rec.result === "fail" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                                Không đạt
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                                Đạt có ĐK
                              </span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap font-medium text-slate-800">
                            {new Date(rec.nextDueDate).toLocaleDateString("vi-VN")}
                          </td>
                          <td className="p-3">
                            {rec.reportFileUrl ? (
                              <a
                                href={rec.reportFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold underline"
                              >
                                <Download className="w-3.5 h-3.5" />
                                {rec.reportFileName || "Tải biên bản"}
                              </a>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          {canManage && (
                            <td className="p-3 pr-4 text-right">
                              <button
                                onClick={() => setInspectionToDelete(rec)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Xóa bản ghi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Lightbox Modal xem ảnh tài liệu / hóa đơn / CO-CQ / biên bản phóng to */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[70] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 px-4 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Xem hình ảnh hồ sơ / biên bản</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white font-medium flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải ảnh gốc
                </a>
                <button
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[80vh] overflow-auto bg-slate-950">
              <img
                src={previewImageUrl}
                alt="Hình ảnh hồ sơ thiết bị"
                className="max-w-full max-h-[72vh] object-contain rounded-lg shadow"
              />
            </div>
          </div>
        </div>
      )}
      {/* Popup xác nhận xóa tài liệu hồ sơ */}
      <ConfirmDialog
        isOpen={Boolean(docToDelete)}
        onClose={() => setDocToDelete(null)}
        onConfirm={handleConfirmDeleteDoc}
        isSubmitting={isDeletingDoc}
        title="Xóa tài liệu hồ sơ thiết bị?"
        description={`Bạn có chắc chắn muốn xóa tài liệu "${docToDelete?.title}" không? Dữ liệu này sẽ không thể khôi phục.`}
        confirmLabel="Xóa tài liệu"
        tone="danger"
      />

      {/* Popup xác nhận xóa bản ghi kiểm định */}
      <ConfirmDialog
        isOpen={Boolean(inspectionToDelete)}
        onClose={() => setInspectionToDelete(null)}
        onConfirm={handleConfirmDeleteInspection}
        isSubmitting={isDeletingInspection}
        title="Xóa bản ghi kiểm định?"
        description="Bạn có chắc chắn muốn xóa bản ghi kiểm định này của thiết bị không? Dữ liệu này sẽ không thể khôi phục."
        confirmLabel="Xóa bản ghi"
        tone="danger"
      />
    </div>
  );
}
