import React, { useEffect, useState } from "react";
import { getAccessToken } from "../services/authService";
import { useBranch } from "../context/BranchContext";
import { useAuth } from "../context/AuthContext";
import { equipmentActions } from "./equipmentBorrowUi";
import EquipmentInventoryView from "./EquipmentInventoryView";
import EquipmentRequestsView, { type EquipmentBorrowRequest } from "./EquipmentRequestsView";
import { readEquipmentView, writeEquipmentView, type EquipmentView } from "./equipmentTabNavigation";
import { LogisticsEmptyIllustration } from "../components/common/LogisticsEmptyIllustration";
import {
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  Download,
  Upload,
  Edit2,
  Trash2,
  Loader2,
  X,
  FileText,
  HelpCircle,
  Handshake,
  RotateCcw,
  History,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  ArrowLeftRight,
  Eye,
  FileCheck,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";


import { toast } from "./Toast";
import { RoomSelect } from "../components/common/RoomSelect";
import { DepartmentSelect } from "../components/common/DepartmentSelect";
import { departmentService, type DepartmentRecord } from "../services/departmentService";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import EquipmentComplianceModal, {
  getRiskClassificationBadge,
  getInspectionStatusBadge,
  isImageFile,
  LEGAL_DOC_TYPES,
} from "../components/equipment/EquipmentComplianceModal";
import {
  equipmentComplianceService,
  type ComplianceSummary,
  type MedicalRiskClassification,
  type LegalDocumentType,
} from "../services/equipmentComplianceService";

type Equipment = {
  _id: string;
  name: string;
  code: string;
  imageUrl?: string;
  category: string;
  status: "available" | "requested" | "in-use" | "maintenance" | "retired";
  roomId?: string;
  departmentId?: string;
  departmentName?: string;
  location?: string;
  purchaseDate?: string;
  notes?: string;
  branchId?: string;
  currentBorrowerId?: string;
  currentBorrowerName?: string;
  expectedReturnAt?: string;

  // Pháp lý & Kiểm định thiết bị y tế
  riskClassification?: MedicalRiskClassification;
  manufacturer?: string;
  originCountry?: string;
  modelNumber?: string;
  serialNumber?: string;
  usageStartDate?: string;
  legalDocuments?: any[];
  inspectionCycleMonths?: number;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  lastInspectionResult?: "pass" | "fail" | "conditional";
  lastInspectionProvider?: string;
  lastInspectionReportUrl?: string;
  lastInspectionReportFileName?: string;
};

export default function EquipmentTab() {
  const { activeBranchId } = useBranch();
  const { userProfile, hasPermission } = useAuth();
  const canManage = userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("equipment:manage");
  const [items, setItems] = useState<Equipment[]>([]);
  const [requests, setRequests] = useState<EquipmentBorrowRequest[]>([]);
  const [view, setView] = useState<EquipmentView>(() => readEquipmentView(window.location.search));
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departmentsForEquipmentFilter, setDepartmentsForEquipmentFilter] = useState<DepartmentRecord[]>([]);
  const [riskClassification, setRiskClassification] = useState("");
  const [inspectionStatus, setInspectionStatus] = useState("");

  // Stats & Compliance
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    requested: 0,
    inUse: 0,
    maintenance: 0,
    retired: 0,
  });

  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary>({
    total: 0,
    overdue: 0,
    dueSoon: 0,
    valid: 0,
    none: 0,
    classifications: { A: 0, B: 0, C: 0, D: 0 },
  });

  // Compliance modal
  const [complianceItem, setComplianceItem] = useState<Equipment | null>(null);

  // Deletion confirm modal
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [isDeletingEquipment, setIsDeletingEquipment] = useState(false);

  // Modal control
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    imageUrl: "",
    category: "",
    status: "available" as Equipment["status"],
    roomId: "",
    departmentId: "",
    departmentName: "",
    location: "",
    purchaseDate: "",
    notes: "",
    riskClassification: "" as MedicalRiskClassification | "",
    manufacturer: "",
    originCountry: "",
    modelNumber: "",
    serialNumber: "",
    usageStartDate: "",
    inspectionCycleMonths: 12,
    lastInspectionDate: "",
    nextInspectionDate: "",
    lastInspectionResult: "pass" as "pass" | "fail" | "conditional",
    lastInspectionProvider: "",
    lastInspectionReportUrl: "",
    lastInspectionReportFileName: "",
    legalDocuments: [] as any[],
  });

  // State hỗ trợ upload và hồ sơ trong modal Thêm/Sửa
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingReportFile, setUploadingReportFile] = useState(false);
  const [uploadingLegalDoc, setUploadingLegalDoc] = useState(false);
  const [showAddDocInline, setShowAddDocInline] = useState(false);
  const [newLegalDoc, setNewLegalDoc] = useState({
    title: "",
    type: "co_cq" as LegalDocumentType,
    documentNumber: "",
    fileUrl: "",
    fileName: "",
    fileSize: 0,
    issuedDate: "",
    expiryDate: "",
    issuingAuthority: "",
    notes: "",
  });
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);


  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [borrowItem, setBorrowItem] = useState<Equipment | null>(null);
  const [borrowReason, setBorrowReason] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");
  const [historyItem, setHistoryItem] = useState<Equipment | null>(null);
  const [history, setHistory] = useState<EquipmentBorrowRequest[]>([]);

  // Modal tạo phiếu mượn / trả mới
  const [showCreateBorrowReturnModal, setShowCreateBorrowReturnModal] = useState(false);
  const [createType, setCreateType] = useState<"borrow" | "return">("borrow");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [createExpectedReturnAt, setCreateExpectedReturnAt] = useState("");
  const [createReturnNote, setCreateReturnNote] = useState("");
  const [equipmentSearchTerm, setEquipmentSearchTerm] = useState("");

  useEffect(() => { departmentService.list({ activeOnly: true }).then(setDepartmentsForEquipmentFilter).catch((err) => console.error("Lỗi tải phòng ban:", err)); }, []);

  // Fetch data
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        status,
        category,
        ...(riskClassification ? { riskClassification } : {}),
        ...(inspectionStatus ? { inspectionStatus } : {}),
        ...(departmentId ? { departmentId } : {}),
      });

      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (activeBranchId) headers["X-Branch-Id"] = activeBranchId;

      const res = await fetch(`/api/v1/equipment?${queryParams}`, {
        credentials: "include",
        headers,
      });
      const json = await res.json();
      if (json.status === "success") {
        setItems(json.data || []);
        setTotal(json.total || 0);

        // Fetch overview stats
        const allRes = await fetch(`/api/v1/equipment?limit=1000`, {
          credentials: "include",
          headers,
        });
        const allJson = await allRes.json();
        if (allJson.status === "success") {
          const list: Equipment[] = allJson.data || [];
          setAllEquipment(list);
          setStats({
            total: list.length,
            available: list.filter((i) => i.status === "available").length,
            requested: list.filter((i) => i.status === "requested").length,
            inUse: list.filter((i) => i.status === "in-use").length,
            maintenance: list.filter((i) => i.status === "maintenance").length,
            retired: list.filter((i) => i.status === "retired").length,
          });
        }
      }

      // Fetch compliance summary stats
      try {
        const summary = await equipmentComplianceService.getSummary(activeBranchId);
        if (summary) setComplianceSummary(summary);
      } catch (sumErr) {
        console.error("Lỗi lấy compliance summary:", sumErr);
      }

      const requestRes = await fetch("/api/v1/equipment/borrow-requests?limit=100", { credentials: "include", headers });
      const requestJson = await requestRes.json();
      if (requestRes.ok) setRequests(requestJson.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status, category, riskClassification, inspectionStatus, departmentId, activeBranchId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(handler);
  }, [fetchData]);

  useEffect(() => {
    const onPopState = () => setView(readEquipmentView(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const selectView = (next: EquipmentView) => {
    setView(next);
    writeEquipmentView(next);
  };

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleLastInspectionDateChange = (val: string) => {
    setFormData((prev) => {
      const cycle = prev.inspectionCycleMonths || 12;
      let nextDate = prev.nextInspectionDate;
      if (val) {
        const d = new Date(val);
        d.setMonth(d.getMonth() + cycle);
        nextDate = d.toISOString().slice(0, 10);
      }
      return {
        ...prev,
        lastInspectionDate: val,
        nextInspectionDate: nextDate,
      };
    });
  };

  const handleUploadEquipmentImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chỉ chọn tệp hình ảnh (PNG, JPG, JPEG, WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Kích thước ảnh thiết bị không được vượt quá 10MB.");
      return;
    }
    setUploadingImage(true);
    try {
      const res = await equipmentComplianceService.uploadFile(file);
      setFormData((prev) => ({
        ...prev,
        imageUrl: res.url,
      }));
      toast.success("Đã tải ảnh thiết bị lên!");
    } catch (err: any) {
      toast.error(err.message || "Tải ảnh thiết bị thất bại.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleUploadReportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Tệp biên bản không được vượt quá 25MB.");
      return;
    }
    setUploadingReportFile(true);
    try {
      const res = await equipmentComplianceService.uploadFile(file);
      setFormData((prev) => ({
        ...prev,
        lastInspectionReportUrl: res.url,
        lastInspectionReportFileName: res.fileName,
      }));
      toast.success("Đã tải lên tệp biên bản kiểm định!");
    } catch (err: any) {
      toast.error(err.message || "Tải biên bản thất bại.");
    } finally {
      setUploadingReportFile(false);
    }
  };

  const handleUploadLegalDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Tệp tài liệu không được vượt quá 25MB.");
      return;
    }
    setUploadingLegalDoc(true);
    try {
      const res = await equipmentComplianceService.uploadFile(file);
      setNewLegalDoc((prev) => ({
        ...prev,
        fileUrl: res.url,
        fileName: res.fileName,
        fileSize: res.size,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
      }));
      toast.success("Đã tải tệp tài liệu / hình ảnh!");
    } catch (err: any) {
      toast.error(err.message || "Tải tệp tài liệu thất bại.");
    } finally {
      setUploadingLegalDoc(false);
    }
  };

  const handleAddLegalDocInline = () => {
    if (!newLegalDoc.fileUrl) {
      toast.error("Vui lòng chọn và tải lên tệp / hình ảnh đính kèm.");
      return;
    }
    if (!newLegalDoc.title.trim()) {
      toast.error("Vui lòng nhập tên tài liệu / hồ sơ.");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      legalDocuments: [
        ...prev.legalDocuments,
        {
          _id: `doc_${Date.now()}`,
          title: newLegalDoc.title.trim(),
          type: newLegalDoc.type,
          documentNumber: newLegalDoc.documentNumber.trim() || undefined,
          fileUrl: newLegalDoc.fileUrl,
          fileName: newLegalDoc.fileName || undefined,
          fileSize: newLegalDoc.fileSize || undefined,
          issuedDate: newLegalDoc.issuedDate || undefined,
          expiryDate: newLegalDoc.expiryDate || undefined,
          issuingAuthority: newLegalDoc.issuingAuthority.trim() || undefined,
          notes: newLegalDoc.notes.trim() || undefined,
          uploadedAt: new Date().toISOString(),
        },
      ],
    }));
    setNewLegalDoc({
      title: "",
      type: "co_cq",
      documentNumber: "",
      fileUrl: "",
      fileName: "",
      fileSize: 0,
      issuedDate: "",
      expiryDate: "",
      issuingAuthority: "",
      notes: "",
    });
    setShowAddDocInline(false);
    toast.success("Đã thêm hồ sơ vào danh sách.");
  };

  const [docToDeleteIndex, setDocToDeleteIndex] = useState<number | null>(null);

  const handleRequestRemoveLegalDoc = (index: number) => {
    setDocToDeleteIndex(index);
  };

  const handleConfirmRemoveLegalDoc = () => {
    if (docToDeleteIndex === null) return;
    const docTitle = formData.legalDocuments[docToDeleteIndex]?.title;
    setFormData((prev) => ({
      ...prev,
      legalDocuments: prev.legalDocuments.filter((_, i) => i !== docToDeleteIndex),
    }));
    toast.success(`Đã xóa tài liệu "${docTitle || "hồ sơ"}" khỏi danh sách.`);
    setDocToDeleteIndex(null);
  };

  // Open modal for add
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      code: "",
      imageUrl: "",
      category: "",
      status: "available",
      roomId: "",
      departmentId: "",
      departmentName: "",
      location: "",
      purchaseDate: "",
      notes: "",
      riskClassification: "",
      manufacturer: "",
      originCountry: "",
      modelNumber: "",
      serialNumber: "",
      usageStartDate: "",
      inspectionCycleMonths: 12,
      lastInspectionDate: "",
      nextInspectionDate: "",
      lastInspectionResult: "pass",
      lastInspectionProvider: "",
      lastInspectionReportUrl: "",
      lastInspectionReportFileName: "",
      legalDocuments: [],
    });
    setShowAddDocInline(false);
    setShowAddEditModal(true);
  };

  // Open modal for edit
  const handleOpenEdit = (item: Equipment) => {
    if (item.status === "in-use") {
      toast.warning(
        "Thiết bị đang được sử dụng (đang có người mượn). Vui lòng hoàn tất quy trình trả thiết bị trước khi chỉnh sửa thông tin.",
        { title: "Thiết bị đang được sử dụng" }
      );
      return;
    }
    if (item.status === "requested") {
      toast.warning(
        "Thiết bị đang có yêu cầu mượn chờ duyệt. Vui lòng xử lý yêu cầu mượn trước khi chỉnh sửa thông tin.",
        { title: "Yêu cầu mượn chờ duyệt" }
      );
      return;
    }

    setEditingItem(item);
    setFormData({
      name: item.name || "",
      code: item.code || "",
      imageUrl: item.imageUrl || "",
      category: item.category || "",
      status: item.status || "available",
      roomId: item.roomId || "",
      departmentId: item.departmentId || "",
      departmentName: item.departmentName || "",
      location: item.location || "",
      purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString().split("T")[0] : "",
      notes: item.notes || "",
      riskClassification: item.riskClassification || "",
      manufacturer: item.manufacturer || "",
      originCountry: item.originCountry || "",
      modelNumber: item.modelNumber || "",
      serialNumber: item.serialNumber || "",
      usageStartDate: item.usageStartDate ? new Date(item.usageStartDate).toISOString().split("T")[0] : "",
      inspectionCycleMonths: item.inspectionCycleMonths || 12,
      lastInspectionDate: item.lastInspectionDate ? new Date(item.lastInspectionDate).toISOString().split("T")[0] : "",
      nextInspectionDate: item.nextInspectionDate ? new Date(item.nextInspectionDate).toISOString().split("T")[0] : "",
      lastInspectionResult: item.lastInspectionResult || "pass",
      lastInspectionProvider: item.lastInspectionProvider || "",
      lastInspectionReportUrl: item.lastInspectionReportUrl || "",
      lastInspectionReportFileName: item.lastInspectionReportFileName || "",
      legalDocuments: Array.isArray(item.legalDocuments) ? [...item.legalDocuments] : [],
    });
    setShowAddDocInline(false);
    setShowAddEditModal(true);
  };


  // Handle Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItem?.status === "in-use") {
      toast.warning(
        "Thiết bị đang được sử dụng (đang có người mượn). Vui lòng hoàn tất quy trình trả thiết bị trước khi cập nhật thông tin.",
        { title: "Thiết bị đang được sử dụng" }
      );
      return;
    }
    if (editingItem?.status === "requested") {
      toast.warning(
        "Thiết bị đang có yêu cầu mượn chờ duyệt. Vui lòng xử lý yêu cầu mượn trước khi cập nhật thông tin.",
        { title: "Yêu cầu mượn chờ duyệt" }
      );
      return;
    }

    setActionLoading(true);

    const url = editingItem ? `/api/v1/equipment/${editingItem._id}` : "/api/v1/equipment";
    const method = editingItem ? "PATCH" : "POST";

    try {
      const token = getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const { departmentName: _departmentName, ...formFields } = formData;
      const payload = {
        ...formFields,
        legalDocuments: (formData.legalDocuments || []).map((doc) => {
          if (doc._id && typeof doc._id === "string" && doc._id.startsWith("doc_")) {
            const { _id: _, ...rest } = doc;
            return rest;
          }
          return doc;
        }),
        riskClassification: formData.riskClassification || null,
        roomId: formData.roomId || null,
        departmentId: formData.departmentId || null,
        purchaseDate: formData.purchaseDate || null,
        usageStartDate: formData.usageStartDate || null,
        lastInspectionDate: formData.lastInspectionDate || null,
        nextInspectionDate: formData.nextInspectionDate || null,
        lastInspectionResult: formData.lastInspectionResult || null,
      };

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setShowAddEditModal(false);
        fetchData();
        toast.success(editingItem ? "Cập nhật thiết bị thành công." : "Thêm mới thiết bị thành công.");
      } else {
        toast.error(data.message || "Đã xảy ra lỗi khi lưu thông tin.", { title: "Không thể lưu thiết bị" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối máy chủ.", { title: "Không thể lưu thiết bị" });
    } finally {
      setActionLoading(false);
    }
  };

  // Request Delete
  const handleRequestDelete = (item: Equipment) => {
    if (item.status === "in-use") {
      toast.warning(
        "Thiết bị đang được sử dụng (đang có người mượn). Vui lòng hoàn tất quy trình trả thiết bị trước khi xóa.",
        { title: "Không thể xóa thiết bị" }
      );
      return;
    }
    if (item.status === "requested") {
      toast.warning(
        "Thiết bị đang có yêu cầu mượn chờ duyệt. Vui lòng xử lý yêu cầu mượn trước khi xóa.",
        { title: "Không thể xóa thiết bị" }
      );
      return;
    }
    setEquipmentToDelete(item);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!equipmentToDelete) return;
    setIsDeletingEquipment(true);
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/equipment/${equipmentToDelete._id}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setEquipmentToDelete(null);
        fetchData();
        toast.success(`Xóa hồ sơ thiết bị "${equipmentToDelete.name}" thành công.`);
      } else {
        toast.error(data.message || "Không thể xóa thiết bị.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối máy chủ.");
    } finally {
      setIsDeletingEquipment(false);
    }
  };

  const mutateBorrowRequest = async (url: string, method: string, body?: any, successMsg?: string) => {
    setActionLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(activeBranchId ? { "X-Branch-Id": activeBranchId } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Không thể xử lý yêu cầu thiết bị.");
      setBorrowItem(null);
      setBorrowReason("");
      setExpectedReturnAt("");
      await fetchData();
      if (successMsg) {
        toast.success(successMsg);
      }
    } catch (error: any) {
      toast.error(error.message || "Không thể xử lý yêu cầu thiết bị.", { title: "Thao tác thiết bị thất bại" });
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenCreateModal = (type: "borrow" | "return" = "borrow") => {
    setCreateType(type);
    setSelectedEquipmentId("");
    setCreateReason("");
    setCreateExpectedReturnAt("");
    setCreateReturnNote("");
    setEquipmentSearchTerm("");
    setShowCreateBorrowReturnModal(true);
  };

  const handleCreateBorrowReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipmentId) {
      toast.error("Vui lòng chọn thiết bị.");
      return;
    }

    if (createType === "borrow") {
      if (!createReason.trim()) {
        toast.error("Vui lòng nhập lý do mượn thiết bị.");
        return;
      }
      try {
        await mutateBorrowRequest(
          `/api/v1/equipment/${selectedEquipmentId}/borrow-requests`,
          "POST",
          {
            reason: createReason.trim(),
            ...(createExpectedReturnAt ? { expectedReturnAt: createExpectedReturnAt } : {}),
          },
          "Gửi yêu cầu mượn thiết bị thành công."
        );
        setShowCreateBorrowReturnModal(false);
      } catch (err) {
        // error has been toasted
      }
    } else {
      try {
        await mutateBorrowRequest(
          `/api/v1/equipment/${selectedEquipmentId}/return-requests`,
          "POST",
          {
            note: createReturnNote.trim(),
          },
          "Gửi yêu cầu trả thiết bị thành công."
        );
        setShowCreateBorrowReturnModal(false);
      } catch (err) {
        // error has been toasted
      }
    }
  };

  const openBorrow = (item: Equipment) => {
    setBorrowReason(""); setExpectedReturnAt(""); setBorrowItem(item);
  };

  const submitBorrow = (event: React.FormEvent) => {
    event.preventDefault();
    if (!borrowItem) return;
    return mutateBorrowRequest(`/api/v1/equipment/${borrowItem._id}/borrow-requests`, "POST", {
      reason: borrowReason,
      ...(expectedReturnAt ? { expectedReturnAt } : {}),
    });
  };

  const openHistory = async (item: Equipment) => {
    setHistoryItem(item);
    const token = getAccessToken();
    const res = await fetch(`/api/v1/equipment/${item._id}/borrow-history`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(activeBranchId ? { "X-Branch-Id": activeBranchId } : {}) },
    });
    const json = await res.json();
    setHistory(res.ok ? json.data || [] : []);
  };

  // Handle Export
  const handleExport = async () => {
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const queryParams = new URLSearchParams({
        search,
        status,
        category,
      });

      const res = await fetch(`/api/v1/equipment/export?${queryParams}`, {
        headers,
      });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "danh-sach-thiet-bi.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xuất file Excel.");
    }
  };

  // Handle Download template
  const handleDownloadTemplate = async () => {
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/equipment/export?template=true`, {
        headers,
      });
      if (!res.ok) throw new Error("Template download failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "file-mau-import-thiet-bi.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi tải file mẫu.");
    }
  };

  // Handle Import
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImportLoading(true);

    const body = new FormData();
    body.append("file", importFile);

    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/equipment/import", {
        method: "POST",
        headers,
        body,
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        toast.success(data.message || "Import thiết bị thành công.");
        setImportFile(null);
        fetchData();
      } else {
        toast.error(data.message || "Import không thành công.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối máy chủ.");
    } finally {
      setImportLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <main className="h-full space-y-3 overflow-y-auto p-3 text-left text-on-surface sm:p-4">
      <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <nav aria-label="Điều hướng quản lý thiết bị" className="inline-flex shrink-0 self-start border-b border-outline-variant bg-surface-container-lowest p-1">
          <button type="button" aria-current={view === "devices" ? "page" : undefined} onClick={() => selectView("devices")} className={`border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary ${view === "devices" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:bg-primary/5 hover:text-primary"}`}>Danh sách thiết bị</button>
          <button type="button" aria-current={view === "requests" ? "page" : undefined} onClick={() => selectView("requests")} className={`border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary ${view === "requests" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:bg-primary/5 hover:text-primary"}`}>Yêu cầu mượn/trả</button>
        </nav>

        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end xl:flex-nowrap">
          {view === "devices" && canManage && <>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline-1 focus-visible:outline-primary"
            >
              <Download className="size-4 text-on-surface-variant" aria-hidden="true" />
              Tải File Mẫu
            </button>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => {
                setImportFile(null);
                setShowImportModal(true);
              }}
              className="inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline-1 focus-visible:outline-primary"
            >
              <Upload className="size-4 text-on-surface-variant" aria-hidden="true" />
              Import Excel
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline-1 focus-visible:outline-primary"
            >
              <FileSpreadsheet className="size-4 text-primary" aria-hidden="true" />
              Xuất Excel
            </button>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={handleOpenAdd}
              className="inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Plus className="size-4" aria-hidden="true" />
              Thêm thiết bị
            </button>
          </>}
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => handleOpenCreateModal("borrow")}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            <span>Tạo phiếu mượn/trả</span>
          </button>
        </div>
      </div>

      {view === "devices" && <EquipmentInventoryView>

        {/* Stats section */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-xs">
            <p className="text-xs font-medium text-on-surface-variant">Tổng thiết bị</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-on-surface">{stats.total}</p>
          </div>
          <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-xs">
            <p className="text-xs font-medium text-on-surface-variant">Đã có người tạo đơn</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-on-surface">{stats.requested}</p>
          </div>
          <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-xs">
            <p className="text-xs font-medium text-on-surface-variant">Sẵn sàng</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-on-surface">{stats.available}</p>
          </div>
          <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-xs">
            <p className="text-xs font-medium text-on-surface-variant">Đang sử dụng</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-on-surface">{stats.inUse}</p>
          </div>
          <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-xs">
            <p className="text-xs font-medium text-on-surface-variant">Bảo trì</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-on-surface">{stats.maintenance}</p>
          </div>
          <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-xs">
            <p className="text-xs font-medium text-on-surface-variant">Thanh lý</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-on-surface">{stats.retired}</p>
          </div>
        </div>

        {/* Compliance & Inspection Alerts Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => {
              setInspectionStatus(inspectionStatus === "overdue" ? "" : "overdue");
              setPage(1);
            }}
            className={`p-4 rounded-2xl border transition text-left flex items-start justify-between cursor-pointer ${inspectionStatus === "overdue"
                ? "bg-rose-100 border-rose-400 ring-2 ring-rose-400"
                : "bg-rose-50/70 hover:bg-rose-50 border-rose-200"
              }`}
          >
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                Quá hạn kiểm định
              </span>
              <p className="text-2xl font-bold text-rose-900 mt-1">
                {complianceSummary.overdue}
              </p>
              <p className="text-xs text-rose-600 mt-0.5">Cần xử lý kiểm định gấp</p>
            </div>
            <span className="p-2 bg-rose-200/60 text-rose-800 rounded-xl">
              <Clock className="w-5 h-5" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setInspectionStatus(inspectionStatus === "due_soon" ? "" : "due_soon");
              setPage(1);
            }}
            className={`p-4 rounded-2xl border transition text-left flex items-start justify-between cursor-pointer ${inspectionStatus === "due_soon"
                ? "bg-amber-100 border-amber-400 ring-2 ring-amber-400"
                : "bg-amber-50/70 hover:bg-amber-50 border-amber-200"
              }`}
          >
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                Sắp đến hạn (30 ngày)
              </span>
              <p className="text-2xl font-bold text-amber-900 mt-1">
                {complianceSummary.dueSoon}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Lên kế hoạch kiểm định</p>
            </div>
            <span className="p-2 bg-amber-200/60 text-amber-800 rounded-xl">
              <Calendar className="w-5 h-5" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setInspectionStatus(inspectionStatus === "valid" ? "" : "valid");
              setPage(1);
            }}
            className={`p-4 rounded-2xl border transition text-left flex items-start justify-between cursor-pointer ${inspectionStatus === "valid"
                ? "bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400"
                : "bg-emerald-50/70 hover:bg-emerald-50 border-emerald-200"
              }`}
          >
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                Đạt chuẩn & Còn hạn
              </span>
              <p className="text-2xl font-bold text-emerald-900 mt-1">
                {complianceSummary.valid}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">Đang hoạt động an toàn</p>
            </div>
            <span className="p-2 bg-emerald-200/60 text-emerald-800 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </span>
          </button>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                Phân loại thiết bị Y tế
              </span>
              <div className="flex items-center gap-2 mt-2 flex-wrap text-xs font-bold">
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800">
                  A: {complianceSummary.classifications?.A || 0}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800">
                  B: {complianceSummary.classifications?.B || 0}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800">
                  C: {complianceSummary.classifications?.C || 0}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800">
                  D: {complianceSummary.classifications?.D || 0}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Theo chuẩn NĐ 98/2021/NĐ-CP</p>
            </div>
          </div>
        </div>

        {/* Filter and Table Card */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Search bar & filter */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-col items-stretch gap-3"
            >
              <div className="relative w-full min-w-0">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 h-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="Tìm theo tên, mã, số seri, model, hãng sản xuất..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-400 transition"
                />
              </div>

              <div className="flex w-full flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600">
                  <span className="font-medium">Phòng ban:</span>
                  <select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }} className="max-w-48 bg-transparent focus:outline-none text-slate-800 font-semibold cursor-pointer">
                    <option value="">Tất cả phòng ban</option>
                    {departmentsForEquipmentFilter.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
                  </select>
                </div>
                {/* Lọc Phân loại Y tế */}
                <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600">
                  <span className="hidden sm:inline font-medium">Nhóm:</span>
                  <select
                    value={riskClassification}
                    onChange={(e) => {
                      setRiskClassification(e.target.value);
                      setPage(1);
                    }}
                    className="bg-transparent focus:outline-none text-slate-800 font-semibold cursor-pointer"
                  >
                    <option value="">Tất cả nhóm</option>
                    <option value="A">Nhóm A (Rất thấp)</option>
                    <option value="B">Nhóm B (TB thấp)</option>
                    <option value="C">Nhóm C (TB cao)</option>
                    <option value="D">Nhóm D (Cao)</option>
                  </select>
                </div>

                {/* Lọc Trạng thái Kiểm định */}
                <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600">
                  <span className="hidden sm:inline font-medium">Kiểm định:</span>
                  <select
                    value={inspectionStatus}
                    onChange={(e) => {
                      setInspectionStatus(e.target.value);
                      setPage(1);
                    }}
                    className="bg-transparent focus:outline-none text-slate-800 font-semibold cursor-pointer"
                  >
                    <option value="">Tất cả</option>
                    <option value="overdue">Quá hạn</option>
                    <option value="due_soon">Sắp đến hạn (30 ngày)</option>
                    <option value="valid">Còn hạn</option>
                    <option value="none">Chưa lên lịch</option>
                  </select>
                </div>

                {/* Lọc Trạng thái vận hành */}
                <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                    className="bg-transparent focus:outline-none text-slate-800 font-medium cursor-pointer"
                  >
                    <option value="">Trạng thái</option>
                    <option value="available">Sẵn sàng</option>
                    <option value="requested">Đã tạo đơn</option>
                    <option value="in-use">Đang dùng</option>
                    <option value="maintenance">Bảo trì</option>
                    <option value="retired">Thanh lý</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-emerald-600/10 active:scale-95 cursor-pointer"
                >
                  Tìm kiếm
                </button>
              </div>
            </form>
          </div>


          {/* Loading / empty states (shared) */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Đang tải dữ liệu thiết bị...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant">
              <LogisticsEmptyIllustration kind="equipment" />
              <p className="text-lg">Không tìm thấy thiết bị nào</p>
              <p className="text-sm mt-1">Vui lòng điều chỉnh bộ lọc hoặc thêm thiết bị mới.</p>
            </div>
          ) : (
            <>
              {/* Mobile list-row layout */}
              <div className="flex flex-col bg-white border border-slate-100 rounded-2xl divide-y divide-slate-100 md:hidden">

                {items.map((item) => (
                  <div key={item._id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0 flex-1 text-left">
                        {item.imageUrl ? (
                          <div
                            onClick={() => setPreviewImageUrl(item.imageUrl!)}
                            className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer bg-slate-50 shadow-2xs relative group"
                            title="Bấm để xem ảnh phóng to"
                          >
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                              <Eye className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 text-slate-400">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-800 text-sm truncate">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({item.code})</span>
                            {item.riskClassification && getRiskClassificationBadge(item.riskClassification)}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
                            <span>{item.category || "—"}</span>
                            {item.serialNumber && (
                              <>
                                <span>&middot;</span>
                                <span className="font-mono text-slate-600">Seri: {item.serialNumber}</span>
                              </>
                            )}
                            {item.departmentName && <span>· {item.departmentName}</span>}
                            {item.location && (
                              <>
                                <span>&middot;</span>
                                <span className="truncate max-w-[100px]">{item.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.status === "available" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Sẵn sàng
                          </span>
                        )}
                        {item.status === "requested" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">Đã tạo đơn</span>
                        )}
                        {item.status === "in-use" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                            Đang dùng
                          </span>
                        )}
                        {item.status === "maintenance" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                            Bảo trì
                          </span>
                        )}
                        {item.status === "retired" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                            Thanh lý
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dòng kiểm định & hồ sơ trên mobile */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-400 font-medium">Hạn K.Định:</span>
                          {getInspectionStatusBadge(item.nextInspectionDate)}
                          {item.nextInspectionDate && (
                            <span className="text-slate-700 font-semibold">
                              {new Date(item.nextInspectionDate).toLocaleDateString("vi-VN")}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setComplianceItem(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold cursor-pointer"
                            title="Hồ sơ pháp lý & Kiểm định"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Hồ sơ ({item.legalDocuments?.length || 0})</span>
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className={`p-1 rounded-lg transition ${
                                  item.status === "in-use" || item.status === "requested"
                                    ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                    : "text-slate-500 hover:bg-slate-100"
                                }`}
                                title={
                                  item.status === "in-use"
                                    ? "Thiết bị đang được sử dụng - Vui lòng trả thiết bị trước khi sửa"
                                    : item.status === "requested"
                                    ? "Thiết bị đang chờ duyệt mượn - Không thể sửa"
                                    : "Sửa thông tin thiết bị"
                                }
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRequestDelete(item)}
                                className={`p-1 rounded-lg transition ${
                                  item.status === "in-use" || item.status === "requested"
                                    ? "text-slate-300 hover:text-rose-500 hover:bg-rose-50"
                                    : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                }`}
                                title={
                                  item.status === "in-use"
                                    ? "Thiết bị đang được sử dụng - Không thể xóa"
                                    : item.status === "requested"
                                    ? "Thiết bị đang chờ duyệt mượn - Không thể xóa"
                                    : "Xóa thiết bị"
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Chi tiết đợt kiểm định gần nhất & kết quả */}
                      {(item.lastInspectionDate || item.lastInspectionResult || item.lastInspectionProvider || item.lastInspectionReportUrl) && (
                        <div className="bg-slate-50 p-2 rounded-xl text-[11px] space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">
                              Lần gần nhất: <strong className="text-slate-800">{item.lastInspectionDate ? new Date(item.lastInspectionDate).toLocaleDateString("vi-VN") : "—"}</strong>
                            </span>
                            {item.lastInspectionResult === "pass" && <span className="text-emerald-700 font-bold">✓ Đạt chuẩn</span>}
                            {item.lastInspectionResult === "fail" && <span className="text-rose-700 font-bold">✕ Không đạt</span>}
                            {item.lastInspectionResult === "conditional" && <span className="text-amber-700 font-bold">⚠ Có điều kiện</span>}
                          </div>
                          {item.lastInspectionProvider && (
                            <p className="text-slate-500 truncate">Đơn vị: {item.lastInspectionProvider}</p>
                          )}
                          {item.lastInspectionReportUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isImageFile(item.lastInspectionReportUrl, item.lastInspectionReportFileName)) {
                                  setPreviewImageUrl(item.lastInspectionReportUrl);
                                } else {
                                  window.open(item.lastInspectionReportUrl, "_blank");
                                }
                              }}
                              className="text-emerald-700 font-semibold underline flex items-center gap-1 pt-0.5 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{item.lastInspectionReportFileName || "Xem biên bản kiểm định"}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Hồ sơ đính kèm trên mobile */}
                      {item.legalDocuments && item.legalDocuments.length > 0 && (
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <span className="text-[11px] text-slate-400 font-medium">Hồ sơ ({item.legalDocuments.length}):</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.legalDocuments.map((doc: any, idx: number) => {
                              const isImg = isImageFile(doc.fileUrl, doc.fileName);
                              return isImg ? (
                                <div
                                  key={doc._id || idx}
                                  onClick={() => setPreviewImageUrl(doc.fileUrl)}
                                  className="w-6 h-6 rounded border border-slate-200 overflow-hidden cursor-pointer shrink-0"
                                  title={doc.title}
                                >
                                  <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <span key={doc._id || idx} className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  {doc.type === "invoice" ? "HĐ" : doc.type === "co_cq" ? "CO/CQ" : "HS"}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
                      <th className="p-4 pl-6">Mã & Tên thiết bị</th>
                      <th className="p-4">Phân loại Y tế</th>
                      <th className="p-4">Model & Seri</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4 min-w-[210px]">Kiểm định & Biên bản</th>
                      <th className="p-4 min-w-[170px]">Hồ sơ & Giấy tờ</th>
                      <th className="p-4">Phòng ban</th>
                      <th className="p-4">Vị trí</th>
                      <th className="p-4 pr-6 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {items.map((item) => (
                      <tr key={item._id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-3">
                            {item.imageUrl ? (
                              <div
                                onClick={() => setPreviewImageUrl(item.imageUrl!)}
                                className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer bg-slate-50 relative group shadow-2xs"
                                title="Bấm để xem ảnh phóng to"
                              >
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                                  <Eye className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 text-slate-400">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-400 font-mono">{item.code}</span>
                                <span className="text-[11px] text-slate-400">&bull; {item.category}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {getRiskClassificationBadge(item.riskClassification)}
                        </td>
                        <td className="p-4">
                          <p className="font-medium text-slate-800 text-xs">
                            {item.modelNumber || item.manufacturer ? `${item.manufacturer || ""} ${item.modelNumber || ""}`.trim() : "—"}
                          </p>
                          {item.serialNumber && (
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              SN: {item.serialNumber}
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          {item.status === "available" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              Sẵn sàng
                            </span>
                          )}
                          {item.status === "requested" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">Đã tạo đơn</span>
                          )}
                          {item.status === "in-use" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Đang sử dụng
                            </span>
                          )}
                          {item.status === "maintenance" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              Bảo trì
                            </span>
                          )}
                          {item.status === "retired" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                              Thanh lý
                            </span>
                          )}
                          {item.status === "in-use" && item.currentBorrowerName && <p className="text-[11px] text-slate-500 mt-1">{item.currentBorrowerName}</p>}
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {getInspectionStatusBadge(item.nextInspectionDate)}
                              {item.nextInspectionDate && (
                                <span className="text-xs font-medium text-slate-700">
                                  Hạn: {new Date(item.nextInspectionDate).toLocaleDateString("vi-VN")}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Gần nhất: {item.lastInspectionDate ? (
                                <strong className="text-slate-700">{new Date(item.lastInspectionDate).toLocaleDateString("vi-VN")}</strong>
                              ) : (
                                <span className="text-slate-400">Chưa ghi nhận</span>
                              )}
                            </div>
                            {(item.lastInspectionResult || item.lastInspectionProvider) && (
                              <div className="flex items-center gap-1 flex-wrap text-[10px]">
                                {item.lastInspectionResult === "pass" && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                    ✓ Đạt chuẩn
                                  </span>
                                )}
                                {item.lastInspectionResult === "fail" && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
                                    ✕ Không đạt
                                  </span>
                                )}
                                {item.lastInspectionResult === "conditional" && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                                    ⚠ Có ĐK
                                  </span>
                                )}
                                {item.lastInspectionProvider && (
                                  <span className="text-slate-500 truncate max-w-[130px]" title={item.lastInspectionProvider}>
                                    &bull; {item.lastInspectionProvider}
                                  </span>
                                )}
                              </div>
                            )}
                            {item.lastInspectionReportUrl && (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isImageFile(item.lastInspectionReportUrl, item.lastInspectionReportFileName)) {
                                      setPreviewImageUrl(item.lastInspectionReportUrl);
                                    } else {
                                      window.open(item.lastInspectionReportUrl, "_blank");
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>{item.lastInspectionReportFileName || "Xem biên bản"}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="p-4">
                          {(!item.legalDocuments || item.legalDocuments.length === 0) ? (
                            <span className="text-xs text-slate-400 italic">Chưa có hồ sơ</span>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-800">
                                  {item.legalDocuments.length} tài liệu
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.legalDocuments.slice(0, 3).map((doc: any, i: number) => {
                                  const isImg = isImageFile(doc.fileUrl, doc.fileName);
                                  return isImg ? (
                                    <div
                                      key={doc._id || i}
                                      onClick={() => setPreviewImageUrl(doc.fileUrl)}
                                      className="w-7 h-7 rounded border border-slate-200 overflow-hidden shrink-0 cursor-pointer hover:border-emerald-500 transition relative group"
                                      title={`${doc.title} (Bấm xem ảnh)`}
                                    >
                                      <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px]">
                                        <Eye className="w-3 h-3" />
                                      </div>
                                    </div>
                                  ) : (
                                    <span
                                      key={doc._id || i}
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                                      title={doc.title}
                                    >
                                      {doc.type === "invoice"
                                        ? "HĐ"
                                        : doc.type === "co_cq"
                                          ? "CO/CQ"
                                          : doc.type === "import_license"
                                            ? "NK"
                                            : doc.type === "circulation_license"
                                              ? "L.Hành"
                                              : "HS"}
                                    </span>
                                  );
                                })}
                                {item.legalDocuments.length > 3 && (
                                  <span className="text-[10px] text-slate-400 font-bold">
                                    +{item.legalDocuments.length - 3}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-slate-500 text-xs">{item.departmentName || "—"}</td>
                        <td className="p-4 text-slate-500 text-xs">{item.location || "—"}</td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Nút mở Hồ sơ pháp lý & Kiểm định */}
                            <button
                              onClick={() => setComplianceItem(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition cursor-pointer"
                              title="Quản lý Hồ sơ pháp lý & Kiểm định y tế"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Hồ sơ & K.Định</span>
                            </button>

                            {canManage && <>
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className={`p-1.5 rounded-lg transition ${
                                  item.status === "in-use" || item.status === "requested"
                                    ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                }`}
                                title={
                                  item.status === "in-use"
                                    ? "Thiết bị đang được sử dụng - Vui lòng trả thiết bị trước khi sửa"
                                    : item.status === "requested"
                                    ? "Thiết bị đang chờ duyệt mượn - Không thể sửa"
                                    : "Sửa thông tin thiết bị"
                                }
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRequestDelete(item)}
                                className={`p-1.5 rounded-lg transition ${
                                  item.status === "in-use" || item.status === "requested"
                                    ? "text-slate-300 hover:text-rose-500 hover:bg-rose-50"
                                    : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                }`}
                                title={
                                  item.status === "in-use"
                                    ? "Thiết bị đang được sử dụng - Không thể xóa"
                                    : item.status === "requested"
                                    ? "Thiết bị đang chờ duyệt mượn - Không thể xóa"
                                    : "Xóa thiết bị"
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}



          {/* Pagination bar */}
          {!loading && items.length > 0 && (
            <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Hiển thị <span className="font-semibold text-slate-700">{items.length}</span> trên{" "}
                <span className="font-semibold text-slate-700">{total}</span> thiết bị
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(page - 1, 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-medium rounded-xl transition cursor-pointer"
                >
                  Trước
                </button>
                <span className="px-3 text-sm font-medium text-slate-600">
                  Trang {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(page + 1, totalPages))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-medium rounded-xl transition cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      </EquipmentInventoryView>}

      {view === "requests" && <EquipmentRequestsView
        requests={requests}
        loading={loading}
        canManage={canManage}
        onCancel={(id) => mutateBorrowRequest(`/api/v1/equipment/borrow-requests/${id}`, "DELETE")}
        onDecision={(id, decision, rejectionReason) => mutateBorrowRequest(`/api/v1/equipment/borrow-requests/${id}/decision`, "PATCH", { decision, ...(rejectionReason ? { rejectionReason } : {}) })}
      />}

      {/* Popup Tạo phiếu mượn / trả thiết bị mới */}
      {showCreateBorrowReturnModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-auto">
            {/* Header modal */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Tạo phiếu mượn / trả thiết bị
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gửi yêu cầu mượn hoặc hoàn trả thiết bị trong hệ thống
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateBorrowReturnModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Switcher Tab Mượn thiết bị / Trả thiết bị */}
            <div className="px-4 sm:px-6 pt-4 shrink-0 bg-white">
              <div className="flex rounded-2xl bg-slate-100 p-1 border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => {
                    setCreateType("borrow");
                    setSelectedEquipmentId("");
                    setEquipmentSearchTerm("");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${createType === "borrow"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Handshake className="w-4 h-4" />
                  <span>Mượn thiết bị</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateType("return");
                    setSelectedEquipmentId("");
                    setEquipmentSearchTerm("");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${createType === "return"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Trả thiết bị</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateBorrowReturnSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Lọc danh sách thiết bị */}
              {(() => {
                const availableList = allEquipment.filter((e) => {
                  if (e.status !== "available") return false;
                  if (!equipmentSearchTerm.trim()) return true;
                  const term = equipmentSearchTerm.toLowerCase();
                  return (
                    e.name.toLowerCase().includes(term) ||
                    e.code.toLowerCase().includes(term) ||
                    (e.location && e.location.toLowerCase().includes(term))
                  );
                });

                const returnableList = allEquipment.filter((e) => {
                  if (e.status !== "in-use") return false;
                  const isBorrower = String(e.currentBorrowerId) === String(userProfile?.uid);
                  if (!isBorrower && !canManage) return false;
                  if (!equipmentSearchTerm.trim()) return true;
                  const term = equipmentSearchTerm.toLowerCase();
                  return (
                    e.name.toLowerCase().includes(term) ||
                    e.code.toLowerCase().includes(term) ||
                    (e.location && e.location.toLowerCase().includes(term))
                  );
                });

                const targetList = createType === "borrow" ? availableList : returnableList;
                const chosenEquipment = allEquipment.find((e) => e._id === selectedEquipmentId);

                return (
                  <>
                    {/* Ô tìm kiếm thiết bị */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tìm kiếm thiết bị nhanh
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder={createType === "borrow" ? "Lọc theo tên, mã thiết bị sẵn sàng..." : "Lọc theo tên, mã thiết bị đang dùng..."}
                          value={equipmentSearchTerm}
                          onChange={(e) => setEquipmentSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition"
                        />
                      </div>
                    </div>

                    {/* Select chọn thiết bị */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Chọn thiết bị *
                      </label>
                      <select
                        required
                        value={selectedEquipmentId}
                        onChange={(e) => setSelectedEquipmentId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition cursor-pointer"
                      >
                        <option value="">
                          {createType === "borrow"
                            ? `-- Chọn thiết bị cần mượn (${targetList.length} khả dụng) --`
                            : `-- Chọn thiết bị cần trả (${targetList.length} thiết bị) --`}
                        </option>
                        {targetList.map((eq) => (
                          <option key={eq._id} value={eq._id}>
                            [{eq.code}] {eq.name} {eq.location ? `— Vị trí: ${eq.location}` : ""} {eq.currentBorrowerName ? `(Đang mượn: ${eq.currentBorrowerName})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Thông báo nếu danh sách trống */}
                    {targetList.length === 0 && (
                      <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">
                            {createType === "borrow"
                              ? "Không có thiết bị sẵn sàng phù hợp."
                              : "Bạn không có thiết bị nào đang mượn cần hoàn trả."}
                          </p>
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            {createType === "borrow"
                              ? "Hiện tại tất cả thiết bị đều đang được sử dụng, bảo trì hoặc đã có người tạo đơn."
                              : "Chỉ người đang mượn thiết bị mới có thể tạo phiếu yêu cầu trả thiết bị."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Thông tin thiết bị được chọn */}
                    {chosenEquipment && (
                      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-sm">{chosenEquipment.name}</span>
                          <span className="font-mono text-slate-500 font-semibold">{chosenEquipment.code}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-slate-500 pt-1">
                          <span>Danh mục: <strong className="text-slate-700">{chosenEquipment.category || "—"}</strong></span>
                          <span>Vị trí: <strong className="text-slate-700">{chosenEquipment.location || "—"}</strong></span>
                          {chosenEquipment.riskClassification && (
                            <span className="flex items-center gap-1">
                              Rủi ro Y tế: {getRiskClassificationBadge(chosenEquipment.riskClassification)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Trường nhập riêng cho từng loại */}
                    {createType === "borrow" ? (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Lý do mượn *
                          </label>
                          <textarea
                            required
                            maxLength={1000}
                            rows={3}
                            placeholder="Nhập lý do sử dụng, ca điều trị, phòng thực hiện hoặc mục đích mượn thiết bị..."
                            value={createReason}
                            onChange={(e) => setCreateReason(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Ngày dự kiến trả (không bắt buộc)
                          </label>
                          <input
                            type="date"
                            min={new Date().toLocaleDateString("en-CA")}
                            value={createExpectedReturnAt}
                            onChange={(e) => setCreateExpectedReturnAt(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition"
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Ghi chú khi trả / Tình trạng bàn giao
                        </label>
                        <textarea
                          maxLength={1000}
                          rows={3}
                          placeholder="Ghi chú tình trạng thiết bị khi hoàn trả, phụ kiện đi kèm (nếu có)..."
                          value={createReturnNote}
                          onChange={(e) => setCreateReturnNote(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 transition"
                        />
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Sticky footer */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0 bg-white sticky bottom-0 z-10">
                <p className="text-[11px] text-slate-400">
                  Bạn có thể theo dõi hoặc Hủy yêu cầu tại tab Yêu cầu mượn/trả.
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateBorrowReturnModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !selectedEquipmentId}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer ${createType === "borrow"
                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
                      }`}
                  >
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{createType === "borrow" ? "Gửi yêu cầu mượn" : "Gửi yêu cầu trả"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {borrowItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitBorrow} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Mượn {borrowItem.name}</h3>
              <button type="button" onClick={() => setBorrowItem(null)} className="p-1 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <label className="block text-sm font-semibold text-slate-700">Lý do mượn
              <textarea required maxLength={1000} value={borrowReason} onChange={(e) => setBorrowReason(e.target.value)} rows={3} className="mt-1 w-full border border-slate-200 rounded-xl p-3 font-normal" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Ngày dự kiến trả (không bắt buộc)
              <input type="date" min={new Date().toLocaleDateString("en-CA")} value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl p-3 font-normal" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setBorrowItem(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700">Hủy</button>
              <button disabled={actionLoading} type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50">Gửi yêu cầu</button>
            </div>
          </form>
        </div>
      )}

      {historyItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white p-5 border-b border-slate-100 flex justify-between">
              <h3 className="font-bold text-slate-900">Lịch sử: {historyItem.name}</h3>
              <button onClick={() => setHistoryItem(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="divide-y divide-slate-100">
              {history.map((row) => <div key={row._id} className="p-4 text-sm">
                <p className="font-semibold text-slate-900">{row.employeeName} · {row.requestType === "borrow" ? "Mượn" : "Trả"}</p>
                <p className="text-slate-500 mt-1">{row.status === "pending" ? "Chờ duyệt" : row.status === "approved" ? "Đã duyệt" : row.status === "rejected" ? `Từ chối: ${row.rejectionReason || "—"}` : "Đã hủy"}</p>
              </div>)}
              {history.length === 0 && <div className="px-4 py-8 text-center text-on-surface-variant">
                <LogisticsEmptyIllustration kind="transactions" />
                <p className="mt-2 text-pretty text-sm">Chưa có lịch sử mượn trả.</p>
              </div>}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  {editingItem ? "Cập nhật Thiết bị" : "Thêm Thiết bị Mới"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Điền thông tin định danh, kỹ thuật, vị trí và chu kỳ kiểm định
                </p>
              </div>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Scrollable Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Hình ảnh thiết bị */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Hình ảnh thiết bị
                </label>
                {formData.imageUrl ? (
                  <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    <div
                      onClick={() => setPreviewImageUrl(formData.imageUrl)}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 relative group cursor-pointer shadow-xs"
                      title="Bấm để xem ảnh phóng to"
                    >
                      <img
                        src={formData.imageUrl}
                        alt="Ảnh thiết bị"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                        <Eye className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-xs text-slate-600 font-medium truncate">
                        Ảnh của thiết bị đã sẵn sàng
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition shadow-2xs">
                          {uploadingImage ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>{uploadingImage ? "Đang tải..." : "Đổi ảnh khác"}</span>
                          <input
                            type="file"
                            disabled={uploadingImage}
                            accept="image/*"
                            className="hidden"
                            onChange={handleUploadEquipmentImage}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, imageUrl: "" })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa ảnh</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center p-4 sm:p-5 border-2 border-dashed border-slate-200 hover:border-emerald-500/50 bg-slate-50/70 hover:bg-emerald-50/20 rounded-2xl transition group text-center">
                    {uploadingImage ? (
                      <div className="flex flex-col items-center py-2">
                        <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mb-2" />
                        <span className="text-xs font-semibold text-emerald-700">Đang tải ảnh lên hệ thống...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center text-slate-500 group-hover:text-emerald-600 group-hover:border-emerald-200 transition mb-2">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700 transition">
                          Bấm để tải lên ảnh thiết bị
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Hỗ trợ PNG, JPG, JPEG, WEBP (tối đa 10MB)
                        </p>
                      </>
                    )}
                    <input
                      type="file"
                      disabled={uploadingImage}
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadEquipmentImage}
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tên thiết bị *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Máy Laser CO2 Fractional"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Mã thiết bị *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: ML-01"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 font-mono transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Danh mục thiết bị *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Thiết bị laser, Máy soi da..."
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Trạng thái vận hành
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Equipment["status"] })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 cursor-pointer font-medium transition"
                  >
                    <option value="available">Sẵn sàng</option>
                    <option value="maintenance">Bảo trì</option>
                    <option value="retired">Thanh lý</option>
                  </select>
                </div>
              </div>

              {/* Thông số Pháp lý & Kỹ thuật Thiết bị Y tế */}
              <div className="p-3.5 sm:p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/70 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Hồ sơ & Phân loại Thiết bị Y tế</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Phân loại mức độ rủi ro (Bộ Y tế)
                    </label>
                    <select
                      value={formData.riskClassification}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          riskClassification: e.target.value as MedicalRiskClassification | "",
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                    >
                      <option value="">Chưa phân nhóm</option>
                      <option value="A">Nhóm A (Rất thấp)</option>
                      <option value="B">Nhóm B (TB thấp)</option>
                      <option value="C">Nhóm C (TB cao)</option>
                      <option value="D">Nhóm D (Cao)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Chu kỳ kiểm định định kỳ (tháng)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={formData.inspectionCycleMonths}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          inspectionCycleMonths: Number(e.target.value) || 12,
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="12"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Hãng sản xuất
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Lutronic"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Xuất xứ
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Hàn Quốc"
                      value={formData.originCountry}
                      onChange={(e) => setFormData({ ...formData, originCountry: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Ký hiệu Model
                    </label>
                    <input
                      type="text"
                      placeholder="VD: eCO2 Plus"
                      value={formData.modelNumber}
                      onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Số Seri (Serial No.)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: SN-2026-99"
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Kiểm định, Hiệu chuẩn & Bảo trì */}
              <div className="p-3.5 sm:p-4 bg-blue-50/50 rounded-2xl border border-blue-100/70 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Lịch Kiểm định & Hiệu chuẩn & Bảo trì</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Ngày kiểm định / hiệu chuẩn / bảo trì gần nhất
                    </label>
                    <input
                      type="date"
                      value={formData.lastInspectionDate}
                      onChange={(e) => handleLastInspectionDateChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Ngày đến hạn kiểm định tiếp theo
                    </label>
                    <input
                      type="date"
                      value={formData.nextInspectionDate}
                      onChange={(e) => setFormData({ ...formData, nextInspectionDate: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Kết quả thực hiện
                    </label>
                    <select
                      value={formData.lastInspectionResult}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lastInspectionResult: e.target.value as "pass" | "fail" | "conditional",
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      <option value="pass" className="text-emerald-700 font-bold">✓ Đạt chuẩn (Pass)</option>
                      <option value="fail" className="text-rose-700 font-bold">✕ Không đạt (Fail)</option>
                      <option value="conditional" className="text-amber-700 font-bold">⚠ Đạt có điều kiện (Conditional)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Đơn vị thực hiện
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Viện Trang thiết bị Y tế, TT Kỹ thuật Tiêu chuẩn..."
                      value={formData.lastInspectionProvider}
                      onChange={(e) => setFormData({ ...formData, lastInspectionProvider: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {/* File biên bản kiểm định */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    File biên bản kiểm định / Giấy chứng nhận (PDF hoặc Ảnh)
                  </label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition shadow-xs">
                      {uploadingReportFile ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <Upload className="w-4 h-4 text-blue-600" />
                      )}
                      <span>{uploadingReportFile ? "Đang tải lên..." : "Tải file biên bản / ảnh..."}</span>
                      <input
                        type="file"
                        disabled={uploadingReportFile}
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        className="hidden"
                        onChange={handleUploadReportFile}
                      />
                    </label>

                    {formData.lastInspectionReportUrl && (
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                        {isImageFile(formData.lastInspectionReportUrl, formData.lastInspectionReportFileName) ? (
                          <div
                            onClick={() => setPreviewImageUrl(formData.lastInspectionReportUrl)}
                            className="w-6 h-6 rounded overflow-hidden border border-slate-200 cursor-pointer"
                            title="Bấm để xem ảnh phóng to"
                          >
                            <img src={formData.lastInspectionReportUrl} alt="Biên bản" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                        <span className="font-medium text-slate-700 max-w-[180px] truncate" title={formData.lastInspectionReportFileName}>
                          {formData.lastInspectionReportFileName || "File biên bản"}
                        </span>
                        <a
                          href={formData.lastInspectionReportUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 hover:bg-slate-100 rounded text-blue-600"
                          title="Xem / Tải về"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, lastInspectionReportUrl: "", lastInspectionReportFileName: "" })}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded"
                          title="Xóa tệp"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Hồ sơ pháp lý & Hình ảnh Hóa đơn, CO/CQ, Giấy tờ nhập khẩu */}
              <div className="p-3.5 sm:p-4 bg-amber-50/40 rounded-2xl border border-amber-100/70 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                    <FileCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Hóa đơn, CO/CQ, Giấy tờ nhập khẩu & Hồ sơ ({formData.legalDocuments.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddDocInline(!showAddDocInline)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddDocInline ? "Đóng form" : "Thêm hồ sơ / tải ảnh"}</span>
                  </button>
                </div>

                {/* Form thêm nhanh tài liệu inline */}
                {showAddDocInline && (
                  <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Loại hồ sơ *</label>
                        <select
                          value={newLegalDoc.type}
                          onChange={(e) => setNewLegalDoc({ ...newLegalDoc, type: e.target.value as LegalDocumentType })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 cursor-pointer"
                        >
                          {LEGAL_DOC_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Tên tài liệu / Văn bản *</label>
                        <input
                          type="text"
                          placeholder="VD: Hóa đơn mua máy, Giấy chứng nhận CO/CQ..."
                          value={newLegalDoc.title}
                          onChange={(e) => setNewLegalDoc({ ...newLegalDoc, title: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Số hiệu văn bản</label>
                        <input
                          type="text"
                          placeholder="VD: INV-2026-01, CQ-9988..."
                          value={newLegalDoc.documentNumber}
                          onChange={(e) => setNewLegalDoc({ ...newLegalDoc, documentNumber: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày phát hành</label>
                        <input
                          type="date"
                          value={newLegalDoc.issuedDate}
                          onChange={(e) => setNewLegalDoc({ ...newLegalDoc, issuedDate: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày hết hạn (nếu có)</label>
                        <input
                          type="date"
                          value={newLegalDoc.expiryDate}
                          onChange={(e) => setNewLegalDoc({ ...newLegalDoc, expiryDate: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Tệp tài liệu / Hình ảnh Hóa đơn, CO/CQ (Ảnh, PDF) *
                      </label>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition">
                          {uploadingLegalDoc ? (
                            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                          ) : (
                            <Upload className="w-4 h-4 text-amber-600" />
                          )}
                          <span>{uploadingLegalDoc ? "Đang tải ảnh/tệp lên..." : "Chọn ảnh / file đính kèm..."}</span>
                          <input
                            type="file"
                            disabled={uploadingLegalDoc}
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                            className="hidden"
                            onChange={handleUploadLegalDoc}
                          />
                        </label>
                        {newLegalDoc.fileUrl && (
                          <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{newLegalDoc.fileName || "Tệp đã sẵn sàng"}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowAddDocInline(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleAddLegalDocInline}
                        disabled={uploadingLegalDoc || !newLegalDoc.fileUrl}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        Thêm hồ sơ này
                      </button>
                    </div>
                  </div>
                )}

                {/* Danh sách các tài liệu đã gắn vào thiết bị */}
                {formData.legalDocuments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Chưa đính kèm tài liệu nào. Bấm "Thêm hồ sơ / tải ảnh" để tải lên hóa đơn, CO/CQ hoặc giấy phép.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {formData.legalDocuments.map((doc: any, index: number) => {
                      const isImg = isImageFile(doc.fileUrl, doc.fileName);
                      return (
                        <div
                          key={doc._id || index}
                          className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2.5 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {isImg ? (
                              <div
                                onClick={() => setPreviewImageUrl(doc.fileUrl)}
                                className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100 cursor-pointer relative group"
                                title="Xem ảnh phóng to"
                              >
                                <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                                  <Eye className="w-3 h-3" />
                                </div>
                              </div>
                            ) : (
                              <div className="p-2 bg-amber-50 text-amber-700 rounded-lg shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 text-left">
                              <p className="text-xs font-bold text-slate-800 truncate" title={doc.title}>{doc.title}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                                  {LEGAL_DOC_TYPES.find((t) => t.value === doc.type)?.label?.split("(")[0]?.trim() || doc.type}
                                </span>
                                {doc.documentNumber && (
                                  <span className="text-[10px] text-slate-400 font-mono truncate">Số: {doc.documentNumber}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isImg && (
                              <button
                                type="button"
                                onClick={() => setPreviewImageUrl(doc.fileUrl)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                                title="Xem ảnh phóng to"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-700 transition"
                              title="Xem / Tải về"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRequestRemoveLegalDoc(index)}
                              className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              title="Xóa hồ sơ này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Vị trí phòng (Chi nhánh)
                </label>
                <RoomSelect
                  branchId={activeBranchId || editingItem?.branchId}
                  value={formData.location}
                  roomId={formData.roomId}
                  onChange={(name, id) => setFormData({ ...formData, location: name, roomId: id || "" })}
                  placeholder="Chọn phòng đặt thiết bị..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phòng ban quản lý</label>
                <DepartmentSelect value={formData.departmentName} departmentId={formData.departmentId} onChange={(name, id) => setFormData((prev) => ({ ...prev, departmentName: name, departmentId: id || "" }))} placeholder="Chọn phòng ban quản lý thiết bị..." />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Ngày mua thiết bị
                  </label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Ngày đưa vào sử dụng
                  </label>
                  <input
                    type="date"
                    value={formData.usageStartDate}
                    onChange={(e) => setFormData({ ...formData, usageStartDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Ghi chú
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Ghi chú thêm về thiết bị..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0 bg-white sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition text-center cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingItem ? "Lưu thay đổi" : "Tạo thiết bị mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Import modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-auto">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                Import Thiết bị từ Excel
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

              {/* Drag-drop file container */}
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center bg-slate-50 hover:bg-blue-50/20 transition group">
                <input
                  type="file"
                  id="excel-file"
                  accept=".xlsx, .xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setImportFile(file);
                  }}
                  className="hidden"
                />
                <label htmlFor="excel-file" className="cursor-pointer block space-y-2">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-100 shadow-sm mx-auto group-hover:scale-105 transition duration-200">
                    <FileText className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-700">
                      {importFile ? importFile.name : "Kéo thả hoặc Click để chọn file"}
                    </p>
                    <p className="text-xs text-slate-400">Chỉ chấp nhận tệp định dạng .xlsx, .xls</p>
                  </div>
                </label>
              </div>

              {/* Helper guide */}
              <div className="p-3 bg-amber-50/50 border border-amber-100/50 rounded-xl text-xs text-amber-800 space-y-1">
                <div className="flex items-center gap-1 text-amber-900 font-semibold">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Hướng dẫn chuẩn bị dữ liệu:</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>
                    Phải có các cột: <b>Tên thiết bị</b>, <b>Mã thiết bị</b>, <b>Danh mục</b>.
                  </li>
                  <li>
                    Có thể thêm cột <b>Số lượng</b> để hệ thống tự sinh các mã hậu tố như <b>-02</b>, <b>-03</b>.
                  </li>
                  <li>Mã thiết bị trong file không được trùng nhau và trùng trong cơ sở dữ liệu.</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={!importFile || importLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {importLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Bắt đầu Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Quản lý Hồ sơ Pháp lý & Kiểm định Thiết bị Y tế */}
      {complianceItem && (
        <EquipmentComplianceModal
          isOpen={Boolean(complianceItem)}
          onClose={() => setComplianceItem(null)}
          equipment={complianceItem}
          canManage={canManage}
          onEquipmentUpdated={(updated) => {
            setComplianceItem(updated);
            fetchData();
          }}
        />
      )}

      {/* Lightbox Modal xem ảnh Hóa đơn / CO-CQ / Biên bản kiểm định phóng to */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[80] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
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
      {/* Popup xác nhận xóa hồ sơ thiết bị */}
      <ConfirmDialog
        isOpen={Boolean(equipmentToDelete)}
        onClose={() => setEquipmentToDelete(null)}
        onConfirm={handleConfirmDelete}
        isSubmitting={isDeletingEquipment}
        title="Xóa hồ sơ thiết bị?"
        description={`Bạn có chắc chắn muốn xóa hồ sơ thiết bị "${equipmentToDelete?.name}" (${equipmentToDelete?.code}) không? Dữ liệu này sẽ không thể khôi phục.`}
        confirmLabel="Xóa thiết bị"
        tone="danger"
      />

      {/* Popup xác nhận xóa Hóa đơn, CO/CQ, Giấy tờ nhập khẩu & Hồ sơ */}
      <ConfirmDialog
        isOpen={docToDeleteIndex !== null}
        onClose={() => setDocToDeleteIndex(null)}
        onConfirm={handleConfirmRemoveLegalDoc}
        title="Xóa tài liệu hồ sơ thiết bị?"
        description={`Bạn có chắc chắn muốn xóa tài liệu "${
          docToDeleteIndex !== null ? formData.legalDocuments[docToDeleteIndex]?.title : ""
        }" khỏi danh sách hồ sơ của thiết bị không?`}
        confirmLabel="Xóa tài liệu"
        tone="danger"
      />
    </main>
  );
}

