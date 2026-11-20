import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Download,
  ExternalLink,
  FileText,
  FileCode,
  FileSpreadsheet,
  File,
  Layers,
  Search,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  AlertCircle,
  Calendar,
  Clock,
  ArrowRight,
  Loader2,
  Maximize2,
  Info,
  Sparkles,
} from "lucide-react";
import { downloadKnowledgeSource, getKnowledgeSourceBlob } from "../../services/assistantKnowledgeService";
import { DOCUMENT_TYPES } from "../settings/AssistantKnowledgeSettings";

interface DocumentViewerModalProps {
  document: {
    _id?: string;
    documentId?: string;
    title: string;
    sourceFileId?: string;
    sourceType?: string;
    documentType?: string;
    category?: string;
    medicalCategory?: string;
    medicalRiskLevel?: string;
    requiresSpotCheck?: boolean;
    isSpotChecked?: boolean;
    status?: string;
    isScanned?: boolean;
    effectiveFrom?: string;
    effectiveTo?: string;
    replacesDocumentId?: string;
    supersededByDocumentId?: string;
    createdAt?: string;
    updatedAt?: string;
    chunks?: Array<{ _id?: string; text: string; chunkIndex: number }>;
  };
  onClose: () => void;
  onNavigateDocument?: (id: string) => void;
  highlightChunkIndex?: string | null;
}

const getFileIcon = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return <FileText className="w-5 h-5 text-rose-600" />;
  if (lower.endsWith(".docx")) return <FileText className="w-5 h-5 text-blue-600" />;
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv"))
    return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
  if (lower.endsWith(".md") || lower.endsWith(".txt") || lower.endsWith(".json"))
    return <FileCode className="w-5 h-5 text-slate-600" />;
  return <File className="w-5 h-5 text-indigo-600" />;
};

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document: doc,
  onClose,
  onNavigateDocument,
  highlightChunkIndex,
}) => {
  const docId = doc._id || doc.documentId || "";
  const hasHighlight = highlightChunkIndex != null && /^\d+$/.test(highlightChunkIndex);
  const [activeTab, setActiveTab] = useState<"preview" | "chunks" | "info">(hasHighlight ? "chunks" : "preview");
  const highlightedChunk = useRef<HTMLDivElement>(null);
  const [sourceBlobUrl, setSourceBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [rawText, setRawText] = useState<string | null>(null);
  const [loadingSource, setLoadingSource] = useState<boolean>(true);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [chunkSearch, setChunkSearch] = useState("");
  useEffect(() => {
    setActiveTab(hasHighlight ? "chunks" : "preview");
    setChunkSearch("");
  }, [docId, highlightChunkIndex, hasHighlight]);
  useEffect(() => {
    if (activeTab === "chunks") highlightedChunk.current?.scrollIntoView?.({ block: "center" });
  }, [activeTab, docId, highlightChunkIndex, doc.chunks, chunkSearch]);
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null);
  const [copiedFullText, setCopiedFullText] = useState(false);

  // Determine file type
  const isPdf = mimeType.includes("pdf") || doc.title.toLowerCase().endsWith(".pdf");
  const isImage = mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(doc.title);
  const isTextFile = mimeType.includes("text") || mimeType.includes("json") || /\.(txt|md|json|csv)$/i.test(doc.title);
  const isOfficeDoc = /\.(docx|xlsx|xls)$/i.test(doc.title);

  // Fetch source file on mount
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    const loadSource = async () => {
      if (!docId) {
        setLoadingSource(false);
        return;
      }
      setLoadingSource(true);
      setSourceError(null);
      try {
        const { blob, mimeType: fetchedMime } = await getKnowledgeSourceBlob(docId);
        if (!active) return;

        setMimeType(fetchedMime);
        const url = URL.createObjectURL(blob);
        createdUrl = url;
        setSourceBlobUrl(url);

        if (fetchedMime.includes("text") || /\.(txt|md|json|csv)$/i.test(doc.title)) {
          const text = await blob.text();
          if (active) setRawText(text);
        }
      } catch (err) {
        if (!active) return;
        setSourceError(err instanceof Error ? err.message : "Tài liệu này không có tệp nhị phân gốc đính kèm.");
      } finally {
        if (active) setLoadingSource(false);
      }
    };

    void loadSource();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [docId, doc.title]);

  // Handle keyboard Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Filtered chunks
  const filteredChunks = useMemo(() => {
    if (!doc.chunks) return [];
    if (!chunkSearch.trim()) return doc.chunks;
    const term = chunkSearch.toLowerCase();
    return doc.chunks.filter((c) => c.text.toLowerCase().includes(term));
  }, [doc.chunks, chunkSearch]);

  // Combined full text from chunks if source preview is unavailable
  const combinedChunksText = useMemo(() => {
    if (!doc.chunks || doc.chunks.length === 0) return "";
    return doc.chunks.map((c) => c.text).join("\n\n");
  }, [doc.chunks]);

  const handleCopyChunk = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(id);
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  const handleCopyFullText = () => {
    const text = rawText || combinedChunksText;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedFullText(true);
    setTimeout(() => setCopiedFullText(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-label="Nội dung tài liệu"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-6xl h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="bg-slate-50/90 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs shrink-0">
              {getFileIcon(doc.title)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-base sm:text-lg truncate max-w-xl" title={doc.title}>
                  {doc.title}
                </h3>
                {doc.status === "withdrawn" && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                    Đã gỡ bỏ
                  </span>
                )}
                {doc.supersededByDocumentId && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Đã bị thay thế
                  </span>
                )}
                {doc.isScanned && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                    Ảnh quét OCR
                  </span>
                )}
                {doc.requiresSpotCheck && !doc.isSpotChecked && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Cần duyệt liều
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>{DOCUMENT_TYPES[doc.documentType || "general"] || "Tổng hợp"}</span>
                {doc.category && (
                  <>
                    <span>•</span>
                    <span className="font-medium text-slate-700">{doc.category}</span>
                  </>
                )}
                {doc.chunks && (
                  <>
                    <span>•</span>
                    <span>{doc.chunks.length} đoạn trích xuất</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Actions & Close */}
          <div className="flex items-center gap-2 shrink-0">
            {docId && (
              <button
                type="button"
                onClick={() => downloadKnowledgeSource(docId, doc.title)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition shadow-2xs cursor-pointer"
                title="Tải tệp nguồn về máy"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tải về</span>
              </button>
            )}
            {sourceBlobUrl && (
              <button
                type="button"
                onClick={() => window.open(sourceBlobUrl, "_blank")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition shadow-2xs cursor-pointer"
                title="Mở toàn màn hình trong tab mới"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tab mới</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 transition cursor-pointer font-bold text-xs"
              aria-label="Đóng"
              title="Đóng cửa sổ (Esc)"
            >
              <X className="w-4 h-4" />
              <span>Đóng</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === "preview"
                  ? "border-indigo-600 text-indigo-600 bg-white/60 rounded-t-lg"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Văn bản gốc</span>
              {isPdf && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold uppercase">
                  PDF
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("chunks")}
              className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === "chunks"
                  ? "border-indigo-600 text-indigo-600 bg-white/60 rounded-t-lg"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Dữ liệu AI trích xuất</span>
              {doc.chunks && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">
                  {doc.chunks.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === "info"
                  ? "border-indigo-600 text-indigo-600 bg-white/60 rounded-t-lg"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <Info className="w-4 h-4" />
              <span>Thông tin & Pháp lý</span>
            </button>
          </div>

          {/* Quick copy full text button when on preview / chunks */}
          {(rawText || combinedChunksText) && (
            <button
              type="button"
              onClick={handleCopyFullText}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
              title="Sao chép toàn bộ văn bản"
            >
              {copiedFullText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-medium">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép văn bản</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 min-h-0 relative bg-slate-100/50 flex flex-col">
          {/* TAB 1: PREVIEW VĂN BẢN GỐC */}
          {activeTab === "preview" && (
            <div className="flex-1 h-full min-h-0 flex flex-col p-3 sm:p-4">
              {loadingSource ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-sm font-medium text-slate-600">Đang tải bản xem trước tài liệu...</p>
                </div>
              ) : sourceBlobUrl && isPdf ? (
                /* PDF VIEWER EMBED */
                <div className="flex-1 h-full min-h-0 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-inner overflow-hidden">
                  <iframe
                    src={`${sourceBlobUrl}#toolbar=1&navpanes=1&view=FitH`}
                    className="w-full h-full border-0 rounded-2xl"
                    title={doc.title}
                  />
                </div>
              ) : sourceBlobUrl && isImage ? (
                /* IMAGE VIEWER */
                <div className="flex-1 h-full min-h-0 flex items-center justify-center p-4 bg-slate-900/5 rounded-2xl border border-slate-200 overflow-auto">
                  <img
                    src={sourceBlobUrl}
                    alt={doc.title}
                    className="max-h-full max-w-full object-contain rounded-xl shadow-md"
                  />
                </div>
              ) : sourceBlobUrl && isTextFile && rawText ? (
                /* TEXT / CODE VIEWER */
                <div className="flex-1 h-full min-h-0 bg-white rounded-2xl border border-slate-200 p-6 overflow-y-auto font-mono text-sm leading-relaxed text-slate-800 whitespace-pre-wrap selection:bg-indigo-100">
                  {rawText}
                </div>
              ) : isOfficeDoc ? (
                /* DOCX / XLSX SPECIAL FALLBACK + EXTRACTED TEXT */
                <div className="flex-1 h-full min-h-0 flex flex-col gap-4 overflow-y-auto">
                  <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-600 text-white rounded-xl shadow-xs">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Tệp văn bản Microsoft Office ({doc.title.split(".").pop()?.toUpperCase()})
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Trình duyệt không hỗ trợ dựng sẵn định dạng tệp này. Bạn có thể tải tệp gốc hoặc đọc văn bản
                          đã được AI trích xuất bên dưới.
                        </p>
                      </div>
                    </div>
                    {docId && (
                      <button
                        type="button"
                        onClick={() => downloadKnowledgeSource(docId, doc.title)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs shrink-0 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Tải tệp gốc về máy</span>
                      </button>
                    )}
                  </div>

                  {/* Render extracted text as a book/paper document */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                    <h2 className="text-lg font-bold text-slate-900 border-b pb-3 mb-4">{doc.title}</h2>
                    <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-sans">
                      {combinedChunksText || "Chưa có nội dung văn bản được trích xuất."}
                    </div>
                  </div>
                </div>
              ) : (
                /* NO SOURCE BLOB / MANUAL TEXT INPUT / EXTRACTED TEXT DISPLAY */
                <div className="flex-1 h-full min-h-0 flex flex-col gap-4 overflow-y-auto">
                  {sourceError && (
                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
                      <Info className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{sourceError} Đang hiển thị toàn bộ nội dung văn bản đã được lưu trữ trong hệ thống.</span>
                    </div>
                  )}

                  {/* Clean document reader layout */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs flex-1">
                    <div className="max-w-3xl mx-auto space-y-4">
                      <div className="border-b border-slate-200 pb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                          {DOCUMENT_TYPES[doc.documentType || "general"] || "Văn bản"}
                        </span>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{doc.title}</h1>
                      </div>

                      <div className="text-sm sm:text-base leading-relaxed text-slate-800 whitespace-pre-wrap font-sans space-y-4">
                        {combinedChunksText ? (
                          combinedChunksText
                        ) : (
                          <div className="text-center py-12 text-slate-400">
                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-40" />
                            <p>Không có nội dung văn bản nào để hiển thị.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI EXTRACTED CHUNKS */}
          {activeTab === "chunks" && (
            <div className="flex-1 h-full min-h-0 flex flex-col p-4 sm:p-6 overflow-hidden">
              {/* Search & Statistics Bar */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={chunkSearch}
                    onChange={(e) => setChunkSearch(e.target.value)}
                    placeholder="Tìm trong các đoạn AI..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  {chunkSearch && (
                    <button
                      type="button"
                      onClick={() => setChunkSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 w-full sm:w-auto justify-end">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    Hiển thị {filteredChunks.length} / {doc.chunks?.length || 0} đoạn (Chunks Vector)
                  </span>
                </div>
              </div>

              {/* Chunks List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {filteredChunks.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                    <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">Không tìm thấy đoạn nào phù hợp</p>
                    {chunkSearch && (
                      <button
                        type="button"
                        onClick={() => setChunkSearch("")}
                        className="text-xs text-indigo-600 font-semibold mt-1 hover:underline cursor-pointer"
                      >
                        Xóa bộ lọc tìm kiếm
                      </button>
                    )}
                  </div>
                ) : (
                  filteredChunks.map((chunk) => {
                    const isHighlighted = highlightChunkIndex && String(chunk.chunkIndex) === highlightChunkIndex;
                    return (
                      <div
                        key={chunk._id || chunk.chunkIndex}
                        ref={isHighlighted ? highlightedChunk : undefined}
                        className={`rounded-2xl p-4 transition border ${
                          isHighlighted
                            ? "bg-amber-50/80 border-amber-300 shadow-xs ring-2 ring-amber-400/30"
                            : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                isHighlighted ? "bg-amber-200 text-amber-900" : "bg-indigo-50 text-indigo-700"
                              }`}
                            >
                              Đoạn {chunk.chunkIndex + 1}
                            </span>
                            {isHighlighted && (
                              <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Đang được tham chiếu
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">{chunk.text.length} ký tự</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyChunk(chunk._id || String(chunk.chunkIndex), chunk.text)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                            title="Sao chép nội dung đoạn này"
                          >
                            {copiedChunkId === (chunk._id || String(chunk.chunkIndex)) ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600 font-medium">Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Sao chép</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed font-sans">
                          {chunk.text}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: METADATA & LEGAL STATUS */}
          {activeTab === "info" && (
            <div className="flex-1 h-full min-h-0 overflow-y-auto p-4 sm:p-6">
              <div className="max-w-4xl mx-auto space-y-5">
                {/* Legal Supersession Alert Banner */}
                {doc.supersededByDocumentId && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-900 text-sm">Văn bản này đã hết hiệu lực</h4>
                      <p className="text-xs text-amber-800 mt-0.5">
                        Tài liệu này đã được thay thế bởi một phiên bản hoặc phác đồ mới hơn. AI sẽ tự động ưu tiên dữ
                        liệu từ văn bản mới.
                      </p>
                      {onNavigateDocument && (
                        <button
                          type="button"
                          onClick={() => onNavigateDocument(doc.supersededByDocumentId!)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 hover:underline mt-2"
                        >
                          <span>Xem văn bản thay thế</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {doc.replacesDocumentId && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-emerald-900 text-sm">Văn bản thay thế phiên bản cũ</h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Văn bản này được ban hành để thay thế cho tài liệu y tế / chính sách trước đây.
                      </p>
                      {onNavigateDocument && (
                        <button
                          type="button"
                          onClick={() => onNavigateDocument(doc.replacesDocumentId!)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline mt-2"
                        >
                          <span>Xem văn bản cũ bị thay thế</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Properties Grid */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm border-b pb-2">Thông tin phân loại</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-1">Tên tài liệu</span>
                      <span className="font-semibold text-slate-800 break-all">{doc.title}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1">Loại tài liệu</span>
                      <span className="font-semibold text-slate-800">
                        {DOCUMENT_TYPES[doc.documentType || "general"] || "Tổng hợp"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1">Danh mục</span>
                      <span className="font-semibold text-slate-800">{doc.category || "Chưa phân loại"}</span>
                    </div>

                    {doc.medicalCategory && (
                      <div>
                        <span className="text-slate-400 block mb-1">Chuyên khoa y tế</span>
                        <span className="font-semibold text-rose-700">{doc.medicalCategory}</span>
                      </div>
                    )}

                    {doc.medicalRiskLevel && (
                      <div>
                        <span className="text-slate-400 block mb-1">Mức độ rủi ro y tế</span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded-md ${
                            doc.medicalRiskLevel === "high"
                              ? "bg-rose-100 text-rose-700"
                              : doc.medicalRiskLevel === "medium"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {doc.medicalRiskLevel === "high"
                            ? "Nguy cơ cao"
                            : doc.medicalRiskLevel === "medium"
                              ? "Trung bình"
                              : "Thấp"}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-slate-400 block mb-1">Kiểm tra spot-check liều dùng</span>
                      <span className="font-semibold text-slate-800">
                        {doc.requiresSpotCheck
                          ? doc.isSpotChecked
                            ? "✅ Đã kiểm tra & phê duyệt"
                            : "⚠️ Cần rà soát liều dùng"
                          : "Không yêu cầu"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1">Hiệu lực thời gian</span>
                      <span className="font-semibold text-slate-800">
                        {doc.effectiveFrom
                          ? `Từ ${new Date(doc.effectiveFrom).toLocaleDateString("vi-VN")}`
                          : "Từ khi ban hành"}{" "}
                        {doc.effectiveTo
                          ? `đến ${new Date(doc.effectiveTo).toLocaleDateString("vi-VN")}`
                          : "(Vô thời hạn)"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1">Cập nhật lần cuối</span>
                      <span className="font-semibold text-slate-800">
                        {doc.updatedAt ? new Date(doc.updatedAt).toLocaleString("vi-VN") : "Chưa xác định"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Technical Specifications */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm border-b pb-2">Thông số kỹ thuật RAG</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-1">Mã định danh (Document ID)</span>
                      <span className="font-mono text-slate-700">{docId || "N/A"}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1">Phương thức nhập nguồn</span>
                      <span className="font-semibold text-slate-800">
                        {doc.sourceType === "resource"
                          ? "Đồng bộ từ tài nguyên"
                          : doc.isScanned
                            ? "Tải lên tệp ảnh quét (Vision AI OCR)"
                            : "Tải tệp trực tiếp"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1">Tổng số đoạn Vector</span>
                      <span className="font-semibold text-slate-800">
                        {doc.chunks?.length || 0} chunks được mã hóa embedding
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1">Loại tệp lưu trữ GridFS</span>
                      <span className="font-mono text-slate-700">{mimeType || "Chưa xác định"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
