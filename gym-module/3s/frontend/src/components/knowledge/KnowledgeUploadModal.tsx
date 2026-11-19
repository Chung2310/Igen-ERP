import React, { useState, useRef, type DragEvent } from 'react';
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';

interface KnowledgeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

import { KnowledgeTopicDropdown } from './KnowledgeTopicDropdown';
import { KNOWLEDGE_TOPICS } from './knowledgeTopics';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileBadge(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'pdf':
      return { label: 'PDF', bg: 'bg-rose-100 text-rose-700 border-rose-200' };
    case 'docx':
    case 'doc':
      return { label: 'DOCX', bg: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'md':
    case 'markdown':
      return { label: 'MD', bg: 'bg-purple-100 text-purple-700 border-purple-200' };
    default:
      return { label: 'TXT', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

export const KnowledgeUploadModal: React.FC<KnowledgeUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [topic, setTopic] = useState<string>(KNOWLEDGE_TOPICS[0].val);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ count: number; totalChunks: number } | null>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      appendFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      appendFiles(Array.from(e.target.files));
    }
  };

  const appendFiles = (newFiles: File[]) => {
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt', '.md', '.markdown'];
    const filtered = newFiles.filter((f) => {
      const ext = '.' + (f.name.split('.').pop()?.toLowerCase() || '');
      return validExtensions.includes(ext);
    });

    if (filtered.length < newFiles.length) {
      toast.info('Một số file không đúng định dạng (.pdf, .docx, .txt, .md) đã được bỏ qua.');
    }

    setFiles((prev) => {
      // Tránh trùng lặp tên file trong cùng batch
      const existingNames = new Set(prev.map((f) => f.name));
      const uniqueNew = filtered.filter((f) => !existingNames.has(f.name));
      return [...prev, ...uniqueNew];
    });
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setFiles([]);
    setUploadResult(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      toast.error('Vui lòng chọn ít nhất một file tài liệu.');
      return;
    }

    try {
      setUploading(true);
      setUploadResult(null);

      const formData = new FormData();
      formData.append('topic', topic);
      for (const file of files) {
        formData.append('files', file);
      }

      const res = await api.upload<{ processedCount: number; totalChunks: number; message: string }>(
        '/api/knowledge/upload',
        formData
      );

      const data = res.data;
      setUploadResult({
        count: data?.processedCount || files.length,
        totalChunks: data?.totalChunks || 0,
      });

      toast.success(
        res.message ||
        `Đã tải lên và tạo thành công ${data?.totalChunks || 0} đoạn tri thức vector RAG!`
      );
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <UploadCloud size={22} />
            </div>
            <div>
              <h3 className="m-0 text-base font-extrabold text-slate-900">
                Tải Lên File Kho Tri Thức (RAG)
              </h3>
              <p className="m-0 text-xs text-slate-500 mt-0.5">
                Nạp tài liệu tự động: Hỗ trợ nhiều file, trích xuất text và tạo vector embedding
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              handleReset();
              onClose();
            }}
            disabled={uploading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto pr-1">
          {uploadResult ? (
            /* TRẠNG THÁI HOÀN TẤT */
            <div className="py-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 size={36} />
              </div>
              <h4 className="text-base font-bold text-slate-800 m-0">Nạp Kho Tri Thức Thành Công!</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-2 mb-4 leading-relaxed">
                Đã bóc tách thành công <b>{uploadResult.count} tài liệu</b> và tạo{' '}
                <b className="text-sky-600">{uploadResult.totalChunks} đoạn vector</b> (RAG Chunks). Trợ lý AI
                giờ đây sẽ tự động sử dụng nguồn tri thức này khi trả lời câu hỏi!
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
                >
                  Tải thêm file khác
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-lg bg-sky-600 text-white font-bold text-xs cursor-pointer hover:bg-sky-700"
                >
                  Xong & Đóng
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* CHỌN CHỦ ĐỀ CAO CẤP */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Layers size={14} className="text-sky-600" />
                  Chủ đề phân loại tài liệu:
                </label>
                <KnowledgeTopicDropdown
                  value={topic}
                  onChange={(val) => setTopic(val)}
                  disabled={uploading}
                />
              </div>

              {/* DROPZONE */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging
                    ? 'border-sky-500 bg-sky-50/70 scale-[0.99]'
                    : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
                  }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept=".pdf,.docx,.doc,.txt,.md,.markdown"
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-slate-200 text-sky-600 flex items-center justify-center mx-auto mb-2.5">
                  <UploadCloud size={24} />
                </div>
                <div className="font-bold text-xs text-slate-800">
                  Kéo thả nhiều file vào đây hoặc <span className="text-sky-600 underline">chọn từ máy tính</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 mb-0">
                  Hỗ trợ định dạng: <b>PDF, Word (.docx), Markdown (.md), Văn bản (.txt)</b> (tối đa 25MB/file)
                </p>
              </div>

              {/* DANH SÁCH FILE ĐÃ CHỌN */}
              {files.length > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-700">
                      Đã chọn {files.length} file tài liệu:
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      disabled={uploading}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-transparent border-none cursor-pointer"
                    >
                      Xóa tất cả
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {files.map((file, idx) => {
                      const badge = getFileBadge(file.name);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm border ${badge.bg}`}
                            >
                              {badge.label}
                            </span>
                            <span className="font-medium text-slate-800 truncate" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-slate-400 text-[11px] shrink-0">
                              ({formatBytes(file.size)})
                            </span>
                          </div>

                          {!uploading && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 bg-transparent border-none cursor-pointer shrink-0 ml-2"
                              title="Xóa file"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}



              {/* FOOTER ACTIONS */}
              <div className="flex justify-end gap-2.5 mt-5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={uploading || files.length === 0}
                  className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Đang xử lý & Tạo Vector RAG...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} />
                      Bắt đầu Tải lên & Nạp RAG ({files.length})
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
