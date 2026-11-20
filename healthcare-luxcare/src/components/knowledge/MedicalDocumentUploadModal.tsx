import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileText,
  X,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  uploadKnowledgeFiles,
  suggestSupersededDocument,
  type KnowledgeFileUploadResult,
} from "../../services/assistantKnowledgeService";
import { toast } from "../../pages/Toast";

interface MedicalDocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (results: KnowledgeFileUploadResult[]) => void;
}

export const MedicalDocumentUploadModal: React.FC<MedicalDocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("medical");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [selectedReplacementId, setSelectedReplacementId] = useState<string>("");
  const [suggestedDoc, setSuggestedDoc] = useState<{ id: string; title: string; matchReason: string } | null>(null);
  const [existingDocs, setExistingDocs] = useState<Array<{ id: string; title: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setTitle("");
      setSelectedReplacementId("");
      setSuggestedDoc(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen]);

  // When file is picked, update title and request supersession suggestion
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    const cleanName = picked.name.replace(/\.[^/.]+$/, "");
    setTitle(cleanName);
    fetchSuggestion(cleanName);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const picked = e.dataTransfer.files?.[0];
    if (!picked) return;
    setFile(picked);
    const cleanName = picked.name.replace(/\.[^/.]+$/, "");
    setTitle(cleanName);
    fetchSuggestion(cleanName);
  };

  const fetchSuggestion = async (searchTitle: string) => {
    if (!searchTitle.trim()) return;
    setLoadingSuggestion(true);
    try {
      const res = await suggestSupersededDocument(searchTitle);
      if (res.suggestion) {
        setSuggestedDoc(res.suggestion);
        setSelectedReplacementId(res.suggestion.id);
      } else {
        setSuggestedDoc(null);
      }
      if (res.existing) {
        setExistingDocs(res.existing);
      }
    } catch (err) {
      // Non-blocking
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Vui lòng chọn tệp tài liệu.");
      return;
    }

    setUploading(true);
    try {
      const results = await uploadKnowledgeFiles([file], {
        documentType,
        replaces: selectedReplacementId || undefined,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : undefined,
        visibility: "company",
      });

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length) {
        toast.error(failed[0].message || "Tải lên thất bại.");
      } else {
        toast.success("Tải lên và kích hoạt vào kho tài liệu thành công!");
        onSuccess(results);
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra khi tải lên.");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Tải Lên Tài Liệu & Phác Đồ Y Tế</h3>
              <p className="text-xs text-slate-500">Tự động kích hoạt vào kho tri thức RAG (không cần lưu nháp)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* File Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Chọn Tệp Văn Bản / Phác Đồ (PDF, DOCX)
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-3 sm:p-4 text-center transition-colors ${
                file
                  ? "border-indigo-200 bg-indigo-50/20"
                  : "border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileChange}
                className="hidden"
                id="medical-file-upload"
              />
              {file ? (
                <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs max-w-full overflow-hidden">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p
                        className="text-xs font-semibold text-slate-800 truncate"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <label
                      htmlFor="medical-file-upload"
                      className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    >
                      Đổi tệp
                    </label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFile(null);
                        setTitle("");
                        setSelectedReplacementId("");
                        setSuggestedDoc(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa tệp đã chọn"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label htmlFor="medical-file-upload" className="cursor-pointer block">
                  <div className="space-y-1">
                    <UploadCloud className="w-6 h-6 text-slate-400 mx-auto" />
                    <div className="text-xs text-slate-600 font-medium">Bấm để tải tệp hoặc kéo thả vào đây</div>
                    <div className="text-[11px] text-slate-400">Hỗ trợ PDF văn bản, DOCX, scan rõ nét (Tối đa 10 MB)</div>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Hướng Dẫn / Quyết Định</label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                fetchSuggestion(e.target.value);
              }}
              placeholder="Ví dụ: Hướng dẫn chẩn đoán và điều trị Viêm gan B năm 2024"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              required
            />
          </div>

          {/* Type and Effective Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Loại Tài Liệu</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="medical">Phác đồ & Hướng dẫn y tế</option>
                <option value="guideline">Quy chuẩn chuyên môn</option>
                <option value="policy">Chính sách / Thông tư</option>
                <option value="procedure">Quy trình kỹ thuật</option>
                <option value="general">Khác</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày Có Hiệu Lực</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {/* Supersession / Replacement Relation */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                Văn Bản Bị Thay Thế (Nếu có)
              </label>
              {loadingSuggestion && <span className="text-[11px] text-slate-400">Đang tìm gợi ý...</span>}
            </div>

            {suggestedDoc && (
              <div className="p-2.5 rounded-lg bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900 space-y-1 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 font-medium text-indigo-800">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>AI phát hiện tài liệu tiền nhiệm:</span>
                </div>
                <p className="font-semibold text-slate-900 line-clamp-1 truncate" title={suggestedDoc.title}>
                  {suggestedDoc.title}
                </p>
                <div className="flex items-center justify-between pt-1 gap-2">
                  <span className="text-[11px] text-indigo-700 truncate" title={suggestedDoc.matchReason}>
                    {suggestedDoc.matchReason}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedReplacementId(suggestedDoc.id)}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer shrink-0"
                  >
                    Áp dụng thay thế
                  </button>
                </div>
              </div>
            )}

            <select
              value={selectedReplacementId}
              onChange={(e) => setSelectedReplacementId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 truncate"
            >
              <option value="">-- Không thay thế văn bản nào (Tài liệu độc lập) --</option>
              {existingDocs.map((doc) => (
                <option key={doc.id} value={doc.id} className="truncate">
                  {doc.title}
                </option>
              ))}
            </select>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              💡 Khi văn bản mới đến ngày hiệu lực, văn bản cũ sẽ tự động được đánh dấu là <em>đã bị thay thế</em> và AI
              sẽ không bao giờ trả lời theo phác đồ cũ nữa.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {uploading ? "Đang tải lên & xử lý..." : "Tải Lên & Kích Hoạt Ngay"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
