import { AiSharingNotice } from "../AiSharingNotice";
import { useAiSharing } from "../../hooks/useAiSharing";
import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useState, useMemo } from "react";
import KnowledgeProcessingStatus from "../knowledge/KnowledgeProcessingStatus";
import {
  BookOpen,
  FileText,
  UploadCloud,
  X,
  Plus,
  Search,
  Trash2,
  Edit3,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Layers,
  ShieldCheck,
  HelpCircle,
  FileSpreadsheet,
  FileCode,
  ExternalLink,
  RefreshCw,
  Tag,
  ArrowUpDown,
  Filter,
  Eye,
  Download,
  Clock,
} from "lucide-react";
import {
  updateKnowledgeMetadata,
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  testKnowledgeSearch,
  uploadKnowledgeFiles,
  type KnowledgeFileUploadResult,
} from "../../services/assistantKnowledgeService";
import KnowledgeScopeFields, { companyScope } from "./KnowledgeScopeFields";
import KnowledgeLegalReviewPanel from "./KnowledgeLegalReviewPanel";
import {
  getKnowledgeDocument,
  downloadKnowledgeSource,
  reindexKnowledgeDocument,
} from "../../services/assistantKnowledgeService";
import { toast } from "../../pages/Toast";
import { MedicalDocumentUploadModal } from "../knowledge/MedicalDocumentUploadModal";
import { MedicalSpotCheckModal } from "../knowledge/MedicalSpotCheckModal";
import { DocumentViewerModal } from "../knowledge/DocumentViewerModal";

const ACCEPT = ".pdf,.docx,.txt,.md,.xlsx,.xls,.csv";
const MAX_FILES = 10;
const MAX_SIZE = 10 * 1024 * 1024;

export const DOCUMENT_TYPES: Record<string, string> = {
  general: "Tổng hợp",
  company_profile: "Hồ sơ doanh nghiệp",
  policy: "Chính sách",
  procedure: "Quy trình",
  faq: "Hỏi đáp",
  medical: "Phác đồ & Hướng dẫn y tế",
  guideline: "Quy chuẩn chuyên môn",
};

export const getDocTypeBadge = (type?: string) => {
  switch (type) {
    case "medical":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <ShieldCheck className="w-3 h-3 text-rose-600" />
          Phác đồ y tế
        </span>
      );
    case "guideline":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Layers className="w-3 h-3 text-purple-600" />
          Quy chuẩn
        </span>
      );
    case "policy":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <ShieldCheck className="w-3 h-3" />
          Chính sách
        </span>
      );
    case "procedure":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Layers className="w-3 h-3" />
          Quy trình
        </span>
      );
    case "company_profile":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <FileText className="w-3 h-3" />
          Hồ sơ doanh nghiệp
        </span>
      );
    case "faq":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <HelpCircle className="w-3 h-3" />
          Hỏi đáp (FAQ)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <FileText className="w-3 h-3" />
          Tổng hợp
        </span>
      );
  }
};

const getFileBadge = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf"))
    return (
      <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 text-rose-500 shadow-2xs">
        <FileText className="w-5 h-5" />
      </div>
    );
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv"))
    return (
      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600 shadow-2xs">
        <FileSpreadsheet className="w-5 h-5" />
      </div>
    );
  if (lower.endsWith(".docx"))
    return (
      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-600 shadow-2xs">
        <FileText className="w-5 h-5" />
      </div>
    );
  return (
    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 text-slate-600 shadow-2xs">
      <FileCode className="w-5 h-5" />
    </div>
  );
};

const getFileIcon = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return <FileText className="w-4 h-4 text-rose-500" />;
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv"))
    return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
  if (lower.endsWith(".docx")) return <FileText className="w-4 h-4 text-blue-600" />;
  if (lower.endsWith(".md") || lower.endsWith(".txt")) return <FileCode className="w-4 h-4 text-slate-600" />;
  return <FileText className="w-4 h-4 text-indigo-500" />;
};

export default function AssistantKnowledgeSettings({ canManage = false }: { canManage?: boolean }) {
  const { userProfile } = useAuth();
  const sharing = useAiSharing("company", `${userProfile?.uid}:${userProfile?.companyCode}`);
  const [showLegalReview, setShowLegalReview] = useState(false);
  const [uploadScope, setUploadScope] = useState(companyScope);
  const [addScope, setAddScope] = useState(companyScope);
  const [detail, setDetail] = useState<any>(null);
  const openDocument = async (id: string, revision?: string, chunkIndex?: string) => {
    try {
      const data = await getKnowledgeDocument(id, revision);
      setDetail({ ...data, _id: id, documentId: id, highlightChunkIndex: chunkIndex });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể mở tài liệu.");
    }
  };
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [nameFilter, setNameFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("*");

  // Popups state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [importMode, setImportMode] = useState<"file" | "text">("file");
  const [showMedicalUpload, setShowMedicalUpload] = useState(false);
  const [spotCheckDoc, setSpotCheckDoc] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Upload modal form state
  const [uploadDocType, setUploadDocType] = useState("general");
  const [uploadCategory, setUploadCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<KnowledgeFileUploadResult[]>([]);

  // Direct add modal form state
  const [addTitle, setAddTitle] = useState("");
  const [addText, setAddText] = useState("");
  const [addDocType, setAddDocType] = useState("general");
  const [addCategory, setAddCategory] = useState("");
  const [savingText, setSavingText] = useState(false);

  // Test retrieval state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);

  // Fetch documents
  const reload = async () => {
    setLoading(true);
    try {
      const data = await listKnowledgeDocuments();
      setDocuments(data);
    } catch (error: any) {
      toast.error(error.message || "Không thể tải danh sách tài liệu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("document");
    if (id && /^[a-f0-9]{24}$/i.test(id))
      void openDocument(
        id,
        new URLSearchParams(window.location.search).get("revision") || undefined,
        new URLSearchParams(window.location.search).get("chunk") || undefined,
      );
  }, []);
  useEffect(() => {
    if (!documents.some((doc) => ["queued", "processing"].includes(doc.indexingStatus))) return;
    let alive = true;
    const timer = setInterval(() => {
      listKnowledgeDocuments()
        .then((data) => {
          if (alive) setDocuments(data);
        })
        .catch(() => undefined);
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [documents]);
  // Distinct categories
  const categories = useMemo(
    () => Array.from(new Set(documents.map((doc) => doc.category || "").filter(Boolean))).sort(),
    [documents],
  );

  // Filtered documents
  const visibleDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesType = !typeFilter || (doc.documentType || "general") === typeFilter;
      const matchesCategory = categoryFilter === "*" || (doc.category || "") === categoryFilter;
      const matchesName = !nameFilter || doc.title.toLocaleLowerCase().includes(nameFilter.toLocaleLowerCase());
      return matchesType && matchesCategory && matchesName;
    });
  }, [documents, typeFilter, categoryFilter, nameFilter]);

  // Handle files selection
  const selectFiles = (selected: File[]) => {
    const accepted = selected.slice(0, MAX_FILES);
    if (selected.length > MAX_FILES) toast.error("Chỉ được tải tối đa 10 tệp mỗi lần.");
    const oversized = accepted.filter((file) => file.size > MAX_SIZE);
    if (oversized.length) toast.error(`Tệp vượt quá 10 MB: ${oversized.map((file) => file.name).join(", ")}`);
    setFiles(accepted.filter((file) => file.size <= MAX_SIZE));
    setUploadResults([]);
  };

  // Upload action
  const handleUpload = async () => {
    if (!sharing.accepted) { toast.error("Hãy đồng ý chia sẻ dữ liệu AI trước khi xử lý tài liệu."); return; }
    if (!files.length) return toast.error("Vui lòng chọn ít nhất một tệp.");
    setUploading(true);
    try {
      const results = await uploadKnowledgeFiles(files, {
        ...uploadScope,
        documentType: uploadDocType,
        category: uploadCategory.trim(),
      });
      setUploadResults(results);
      if (results.some((result) => result.status !== "rejected")) {
        await reload();
        toast.success("Đã tiếp nhận tài liệu. Hệ thống đang xử lý nền.");
      }
      setFiles([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải tài liệu.");
    } finally {
      setUploading(false);
    }
  };

  // Direct create document
  const handleCreateText = async (e: React.FormEvent) => {
    if (!sharing.accepted) { e.preventDefault(); toast.error("Hãy đồng ý chia sẻ dữ liệu AI trước khi xử lý tài liệu."); return; }
    e.preventDefault();
    if (!addTitle.trim()) return toast.error("Vui lòng nhập tiêu đề tài liệu.");
    if (!addText.trim()) return toast.error("Vui lòng nhập nội dung tài liệu.");
    setSavingText(true);
    try {
      await createKnowledgeDocument({
        ...addScope,
        title: addTitle.trim(),
        text: addText.trim(),
        documentType: addDocType,
        category: addCategory.trim(),
      });
      setAddTitle("");
      setAddText("");
      setAddCategory("");
      setShowUploadModal(false);
      await reload();
      toast.success("Đã tiếp nhận nội dung để lập chỉ mục.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể thêm tài liệu.");
    } finally {
      setSavingText(false);
    }
  };

  // Save metadata classification
  const handleSaveClassification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      await updateKnowledgeMetadata(editing._id, {
        visibility: editing.visibility || "company",
        branchIds: editing.branchIds || [],
        departmentIds: editing.departmentIds || [],
        documentType: editing.documentType,
        category: editing.category.trim(),
      });
      setEditing(null);
      await reload();
      toast.success("Đã cập nhật phân loại tài liệu thành công!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật tài liệu.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete document
  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn gỡ tài liệu "${title}" khỏi chỉ mục tri thức?`)) return;
    try {
      await deleteKnowledgeDocument(id);
      await reload();
      toast.success("Đã gỡ tài liệu khỏi kho tri thức.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gỡ tài liệu.");
    }
  };

  // Test search action
  const handleTestSearch = async () => {
    if (!sharing.accepted) { toast.error("Hãy đồng ý chia sẻ dữ liệu AI trước khi xử lý tài liệu."); return; }
    if (!query.trim()) return toast.error("Vui lòng nhập nội dung câu hỏi thử nghiệm.");
    setSearching(true);
    try {
      const evidence = await testKnowledgeSearch(query.trim(), {
        ...(typeFilter ? { documentType: typeFilter } : {}),
        ...(categoryFilter !== "*" ? { category: categoryFilter } : {}),
      });
      setMatches(evidence || []);
      if (!evidence || evidence.length === 0) {
        toast.info("Không tìm thấy đoạn nội dung nào khớp với câu hỏi.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tìm kiếm.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <AiSharingNotice sharing={sharing} />
      {detail && (
        <DocumentViewerModal
          document={detail}
          onClose={() => setDetail(null)}
          onNavigateDocument={(targetId) => void openDocument(targetId)}
          highlightChunkIndex={detail.highlightChunkIndex}
        />
      )}
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <BookOpen className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Kho tri thức trợ lý</h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setShowLegalReview(!showLegalReview)}
            aria-expanded={showLegalReview}
            className="px-4 py-2.5 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-semibold"
          >
            Rà soát pháp lý
          </button>
          <button
            type="button"
            hidden={!canManage}
            onClick={() => setShowMedicalUpload(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm shadow-rose-600/20 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Thêm phác đồ y tế</span>
          </button>
          <button
            type="button"
            hidden={!canManage}
            onClick={() => {
              setImportMode("file");
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm shadow-emerald-600/20 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Thêm tài liệu</span>
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Overview Statistics */}
      {showLegalReview && <KnowledgeLegalReviewPanel />}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tổng tài liệu</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{documents.length}</span>
            <span className="text-xs text-slate-400">bản ghi</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Quy trình & Chính sách</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600">
              {documents.filter((d) => d.documentType === "policy" || d.documentType === "procedure").length}
            </span>
            <span className="text-xs text-slate-400">văn bản</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Danh mục tri thức</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{categories.length}</span>
            <span className="text-xs text-slate-400">chủ đề</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Hỏi đáp & Hồ sơ</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">
              {documents.filter((d) => d.documentType === "faq" || d.documentType === "company_profile").length}
            </span>
            <span className="text-xs text-slate-400">hồ sơ / FAQ</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              aria-label="Tìm tài liệu"
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Tìm theo tên tài liệu..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {nameFilter && (
              <button
                type="button"
                onClick={() => setNameFilter("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              aria-label="Lọc loại tài liệu"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="">Tất cả loại tài liệu</option>
              {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              aria-label="Lọc danh mục"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="*">Tất cả danh mục</option>
              <option value="">Chưa phân danh mục</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {(nameFilter || typeFilter || categoryFilter !== "*") && (
              <button
                type="button"
                onClick={() => {
                  setNameFilter("");
                  setTypeFilter("");
                  setCategoryFilter("*");
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Đặt lại lọc
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-50">
          <span>
            Hiển thị <strong>{visibleDocuments.length}</strong> / {documents.length} tài liệu
          </span>
        </div>
      </div>

      {/* Main Document Table & List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Đang tải danh sách tài liệu...</p>
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">Không có tài liệu phù hợp</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {documents.length === 0
                ? "Kho tri thức hiện đang trống. Hãy tải lên tài liệu PDF, Word hoặc nhập nội dung để trợ lý học hỏi."
                : "Không tìm thấy tài liệu phù hợp với bộ lọc hiện tại."}
            </p>
            {documents.length === 0 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  hidden={!canManage}
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Tải lên tệp đầu tiên
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/90 text-slate-500 font-semibold text-xs tracking-wider">
                  <th className="py-3.5 px-5 sm:px-6">Tài liệu & Tiêu đề</th>
                  <th className="py-3.5 px-4">Phân loại</th>
                  <th className="py-3.5 px-4">Danh mục</th>
                  <th className="py-3.5 px-4">Chỉ mục AI</th>
                  <th className="py-3.5 px-5 sm:px-6 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {visibleDocuments.map((document) => (
                  <tr key={document._id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="py-3.5 px-5 sm:px-6">
                      <div className="flex items-center gap-3">
                        {getFileBadge(document.title)}
                        <div className="min-w-0 max-w-xs sm:max-w-md lg:max-w-lg">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p
                              className="font-semibold text-slate-900 truncate text-sm hover:text-indigo-600 transition-colors cursor-pointer"
                              title={document.title}
                              onClick={() => void openDocument(document._id)}
                            >
                              {document.title}
                            </p>
                            {(document as any).replaces && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/70 shrink-0">
                                Thay thế văn bản cũ
                              </span>
                            )}
                            {(document as any).status === "superseded" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold border border-slate-200 line-through shrink-0">
                                Đã bị thay thế
                              </span>
                            )}
                            {(document as any).auditStatus === "flagged" && (
                              <button
                                type="button"
                                onClick={() => setSpotCheckDoc(document)}
                                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer shrink-0 animate-pulse"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                Cần Spot-check (
                                {
                                  ((document as any).auditFlags || []).filter(
                                    (flag: any) => flag.reviewStatus !== "confirmed",
                                  ).length
                                }
                                )
                              </button>
                            )}
                            {(document as any).auditStatus === "verified" && (
                              <button
                                type="button"
                                onClick={() => setSpotCheckDoc(document)}
                                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 shrink-0"
                              >
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                Đã kiểm tra số liệu
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>{document.sourceType === "resource" ? "Từ Tài nguyên" : "Tải lên thủ công"}</span>
                            {document.createdAt && (
                              <>
                                <span className="text-slate-300">&bull;</span>
                                <span>{new Date(document.createdAt).toLocaleDateString("vi-VN")}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">{getDocTypeBadge(document.documentType)}</td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {document.category ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-700 font-medium border border-slate-200/60">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {document.category}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-medium select-none">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <KnowledgeProcessingStatus
                        status={document.indexingStatus}
                        progress={document.indexingProgress}
                        quality={document.extractionQuality}
                      />
                    </td>

                    <td className="py-3.5 px-5 sm:px-6 text-right whitespace-nowrap">
                      {document.indexingError && (
                        <p className="text-xs text-rose-600 max-w-xs whitespace-normal mb-1.5">
                          {document.indexingError}
                        </p>
                      )}
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void openDocument(document._id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 hover:border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                          title="Đọc tài liệu"
                          aria-label="Đọc tài liệu"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {document.sourceFileId && (
                          <button
                            type="button"
                            onClick={() => {
                              downloadKnowledgeSource(document._id, document.title).catch((error) =>
                                toast.error(error.message),
                              );
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 transition-colors shadow-2xs cursor-pointer"
                            title="Tải bản gốc"
                            aria-label="Tải bản gốc"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}

                        {canManage && !["queued", "processing"].includes(document.indexingStatus) && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await reindexKnowledgeDocument(document._id);
                                await reload();
                              } catch (error) {
                                toast.error(error instanceof Error ? error.message : "Không thể lập lại chỉ mục.");
                              }
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-amber-600 hover:bg-amber-50 border border-slate-200/80 hover:border-amber-200 transition-colors shadow-2xs cursor-pointer"
                            title="Lập lại chỉ mục"
                            aria-label="Lập lại chỉ mục"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}

                        {canManage && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({
                                ...document,
                                documentType: document.documentType || "general",
                                category: document.category || "",
                              })
                            }
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 hover:border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                            title="Phân loại"
                            aria-label="Phân loại"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleDelete(document._id, document.title)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                            title="Gỡ khỏi chỉ mục"
                            aria-label="Gỡ khỏi chỉ mục"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Test Retrieval Sandbox Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">
              Kiểm tra truy xuất tri thức (AI Retrieval Test)
            </h3>
            <p className="text-xs text-slate-500">
              Nhập câu hỏi để kiểm tra đoạn tài liệu nào được trích xuất khi trợ lý ảo trả lời nhân viên.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            aria-label="Câu hỏi thử"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTestSearch();
            }}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            placeholder="Nhập câu hỏi thử nghiệm để kiểm tra retrieval..."
          />
          <button
            type="button"
            onClick={handleTestSearch}
            disabled={searching || !query.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold transition disabled:opacity-50 shadow-xs cursor-pointer"
          >
            {searching && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Thử tìm kiếm</span>
          </button>
        </div>

        {matches.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <p className="text-xs font-bold text-slate-600">Kết quả đoạn văn bản khớp nhất ({matches.length}):</p>
            <div className="grid gap-2.5">
              {matches.map((match, idx) => (
                <div
                  key={match.id || idx}
                  className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 truncate">{match.title}</span>
                    {match.citation?.documentId && (
                      <button
                        className="text-indigo-600 underline"
                        onClick={() =>
                          void openDocument(
                            match.citation.documentId,
                            match.citation.revision,
                            String(match.citation.chunkIndex ?? 0),
                          )
                        }
                      >
                        Xem nguồn
                      </button>
                    )}
                    {match.score !== undefined && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        Điểm khớp: {(match.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 leading-relaxed line-clamp-3">{match.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* POPUP 1: Modal Nhập tài liệu vào kho tri thức (Import files by default) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-auto">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-emerald-600" />
                  <span>Nhập tài liệu vào kho tri thức</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tải lên tài liệu và hệ thống sẽ tự động bóc tách và lập chỉ mục cho AI
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setFiles([]);
                  setUploadResults([]);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex border-b border-slate-100 px-6 bg-slate-50/60 shrink-0">
              <button
                type="button"
                onClick={() => setImportMode("file")}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  importMode === "file"
                    ? "border-emerald-600 text-emerald-600 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Nhập tệp tài liệu (Khuyên dùng)</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode("text")}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  importMode === "text"
                    ? "border-indigo-600 text-indigo-600 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Dán văn bản thủ công</span>
              </button>
            </div>

            {/* Mode 1: File Upload */}
            {importMode === "file" && (
              <>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Loại tài liệu</label>
                      <select
                        aria-label="Loại tài liệu"
                        value={uploadDocType}
                        onChange={(e) => setUploadDocType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                      >
                        {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Danh mục</label>
                      <input
                        aria-label="Danh mục"
                        list="knowledge-categories"
                        maxLength={100}
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value)}
                        placeholder="VD: Nhân sự, Vận hành..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <datalist id="knowledge-categories">
                        {categories.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <KnowledgeScopeFields value={uploadScope} onChange={setUploadScope} />
                  {/* Drag and Drop Zone */}
                  <div
                    className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50/50 p-5 space-y-3 text-center transition"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      selectFiles(Array.from(event.dataTransfer.files));
                    }}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 shadow-2xs flex items-center justify-center text-emerald-600 mx-auto">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Kéo thả tài liệu vào đây hoặc bấm để chọn tệp</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Hỗ trợ PDF, DOCX, TXT, MD, XLS, XLSX, CSV &bull; Tối đa 10 MB/tệp &bull; Tối đa 10 tệp
                      </p>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Chọn tài liệu từ máy</span>
                      <input
                        aria-label="Tải tài liệu"
                        type="file"
                        multiple
                        accept={ACCEPT}
                        className="sr-only"
                        onChange={(event) => selectFiles(Array.from(event.target.files || []))}
                      />
                    </label>
                  </div>

                  {/* Selected Files List */}
                  {files.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-700">Tệp đã chọn ({files.length}):</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {files.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              {getFileIcon(file.name)}
                              <span className="truncate max-w-[260px] font-medium text-slate-800">{file.name}</span>
                              <span className="text-[10px] text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                            </span>
                            <button
                              type="button"
                              aria-label={`Bỏ ${file.name}`}
                              onClick={() =>
                                setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
                              }
                              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload Results feedback */}
                  {uploadResults.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-700">Kết quả xử lý:</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {uploadResults.map((result, index) => (
                          <div
                            key={`${result.filename}-${index}`}
                            className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs"
                          >
                            <span className="font-semibold text-slate-700 truncate max-w-[220px]">
                              {result.filename}
                            </span>
                            {result.status === "queued" && result.documentId ? (
                              <div className="w-full">
                                <KnowledgeProcessingStatus
                                  status={
                                    documents.find((doc) => doc._id === result.documentId)?.indexingStatus || "queued"
                                  }
                                  progress={documents.find((doc) => doc._id === result.documentId)?.indexingProgress}
                                  quality={documents.find((doc) => doc._id === result.documentId)?.extractionQuality}
                                />
                                {documents.find((doc) => doc._id === result.documentId)?.indexingError && (
                                  <p className="mt-1 text-rose-600">
                                    {documents.find((doc) => doc._id === result.documentId)?.indexingError}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span
                                className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                                  result.status === "rejected"
                                    ? "bg-rose-50 text-rose-600"
                                    : result.status === "duplicate"
                                      ? "bg-amber-50 text-amber-600"
                                      : "bg-emerald-50 text-emerald-600"
                                }`}
                              >
                                {result.status === "queued"
                                  ? "Đã tiếp nhận · chờ xử lý"
                                  : result.status === "indexed"
                                    ? `Đã lập chỉ mục · ${result.chunksCount || 0} đoạn`
                                    : result.status === "duplicate"
                                      ? "Nội dung đã tồn tại"
                                      : result.message || "Không thể đọc tệp"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer File Mode */}
                <div className="p-4 sm:p-6 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setFiles([]);
                      setUploadResults([]);
                    }}
                    className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    disabled={!files.length || uploading}
                    onClick={handleUpload}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{uploading ? "Đang xử lý..." : "Tải lên và lập chỉ mục"}</span>
                  </button>
                </div>
              </>
            )}

            {/* Mode 2: Direct Text Input */}
            {importMode === "text" && (
              <form onSubmit={handleCreateText} className="flex-1 flex flex-col overflow-hidden">
                <KnowledgeScopeFields value={addScope} onChange={setAddScope} />
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tiêu đề tài liệu *</label>
                    <input
                      aria-label="Tiêu đề tài liệu"
                      required
                      type="text"
                      value={addTitle}
                      onChange={(event) => setAddTitle(event.target.value)}
                      placeholder="VD: Chính sách nghỉ phép năm 2026"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Loại tài liệu</label>
                      <select
                        aria-label="Loại tài liệu"
                        value={addDocType}
                        onChange={(e) => setAddDocType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                      >
                        {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Danh mục</label>
                      <input
                        aria-label="Danh mục"
                        list="knowledge-categories"
                        maxLength={100}
                        value={addCategory}
                        onChange={(e) => setAddCategory(e.target.value)}
                        placeholder="VD: Nhân sự, Quy chế..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nội dung tài liệu *</label>
                    <textarea
                      aria-label="Nội dung tài liệu"
                      required
                      rows={6}
                      value={addText}
                      onChange={(event) => setAddText(event.target.value)}
                      placeholder="Dán hoặc nhập toàn bộ nội dung chính sách, FAQ hoặc hướng dẫn quy trình tại đây..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed min-h-[160px]"
                    />
                  </div>
                </div>

                {/* Footer Text Mode */}
                <div className="p-4 sm:p-6 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setImportMode("file");
                    }}
                    className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={savingText}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold transition disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    {savingText && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Thêm tài liệu</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* POPUP 3: Modal Phân loại / Chỉnh sửa siêu dữ liệu */}
      {editing && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-auto">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <span>Phân loại tài liệu</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]" title={editing.title}>
                  {editing.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveClassification} className="p-4 sm:p-6 space-y-4">
              <KnowledgeScopeFields
                value={{
                  visibility: editing.visibility || "company",
                  branchIds: editing.branchIds || [],
                  departmentIds: editing.departmentIds || [],
                }}
                onChange={(scope) => setEditing({ ...editing, ...scope })}
              />
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Loại tài liệu</label>
                <select
                  aria-label="Đổi loại tài liệu"
                  value={editing.documentType}
                  onChange={(e) => setEditing({ ...editing, documentType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Danh mục</label>
                <input
                  aria-label="Đổi danh mục"
                  list="knowledge-categories"
                  maxLength={100}
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  placeholder="VD: Nhân sự, Quy trình..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Lưu phân loại</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <MedicalDocumentUploadModal
        isOpen={showMedicalUpload}
        onClose={() => setShowMedicalUpload(false)}
        onSuccess={() => void reload()}
      />
      <MedicalSpotCheckModal
        isOpen={Boolean(spotCheckDoc)}
        document={spotCheckDoc}
        onClose={() => setSpotCheckDoc(null)}
        onVerified={() => void reload()}
      />
    </div>
  );
}
