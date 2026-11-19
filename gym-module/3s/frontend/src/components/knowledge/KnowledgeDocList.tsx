import React from 'react';
import { UploadCloud, Zap, RefreshCw, FileText, Trash2, Search } from 'lucide-react';
import type { KnowledgeDocument } from '../../types/knowledge';
import type { PaginationMeta } from '../../types';
import { FoodImagePagination } from './FoodImagePagination';
import { KNOWLEDGE_TOPICS, getTopicBadgeStyle } from './knowledgeTopics';

export const DOC_TOPICS = [
  { val: 'ALL', label: 'Tất cả chủ đề', icon: '📚' },
  ...KNOWLEDGE_TOPICS.map((t) => ({ val: t.val, label: t.shortLabel, icon: t.icon })),
];

export const DOC_STATUSES = [
  { val: 'ALL', label: 'Tất cả trạng thái' },
  { val: 'PUBLISHED', label: 'Đã xuất bản' },
  { val: 'DRAFT', label: 'Bản nháp' },
] as const;

interface KnowledgeDocListProps {
  docs: KnowledgeDocument[];
  loading: boolean;
  onOpenUploadModal: () => void;
  onOpenDocModal: (doc?: KnowledgeDocument) => void;
  onTogglePublishDoc: (doc: KnowledgeDocument) => void;
  onDeleteDoc: (id: string, title: string) => void;
  onSeedDocs: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  topicFilter?: string;
  onTopicFilterChange?: (val: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (val: string) => void;
  pagination?: PaginationMeta | null;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export const KnowledgeDocList: React.FC<KnowledgeDocListProps> = ({
  docs,
  loading,
  onOpenUploadModal,
  onOpenDocModal,
  onTogglePublishDoc,
  onDeleteDoc,
  onSeedDocs,
  searchQuery = '',
  onSearchChange,
  topicFilter = 'ALL',
  onTopicFilterChange,
  statusFilter = 'ALL',
  onStatusFilterChange,
  pagination,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
}) => {
  return (
    <>
      {/* TOOLBAR FOR DOCS */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4.5 border border-slate-200 mb-5">
        <div className="flex justify-between items-center flex-wrap gap-3 mb-3">
          {/* Search & Status filter */}
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
            {onSearchChange && (
              <div className="relative w-full max-w-[360px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tiêu đề, chủ đề, nội dung tài liệu..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full py-2 pl-9 pr-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
            )}

            {onStatusFilterChange && (
              <div className="flex gap-1">
                {DOC_STATUSES.map((st) => (
                  <button
                    key={st.val}
                    type="button"
                    onClick={() => onStatusFilterChange(st.val)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold border-none cursor-pointer transition-colors ${
                      statusFilter === st.val
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onSeedDocs}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs cursor-pointer hover:bg-emerald-100 transition-colors"
            >
              <Zap size={15} /> Nạp 4 Tài Liệu Chuẩn 3S
            </button>

            <button
              type="button"
              onClick={onOpenUploadModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
            >
              <UploadCloud size={15} /> Tải Lên File Tri Thức
            </button>
          </div>
        </div>

        {/* Topic Filter Pills */}
        {onTopicFilterChange && (
          <div className="flex gap-1.5 overflow-x-auto pt-2 border-t border-slate-100">
            {DOC_TOPICS.map((top) => (
              <button
                key={top.val}
                type="button"
                onClick={() => onTopicFilterChange(top.val)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer whitespace-nowrap transition-all ${
                  topicFilter === top.val
                    ? 'border-sky-500 bg-sky-50 text-sky-600'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <span className="mr-1">{top.icon}</span>
                <span>{top.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">
          <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-sky-600" />
          <div>Đang tải tài liệu tri thức...</div>
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <FileText size={44} className="text-slate-400 mx-auto mb-3" />
          <div className="font-bold text-base text-slate-800">
            Chưa có tài liệu tri thức nào
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto my-2 mb-4">
            Bấm "Tải Lên File Tri Thức" để tải các tài liệu quy chuẩn (PDF, Word, Markdown, TXT)".
          </p>
          <div className="flex justify-center gap-2.5">
            <button
              type="button"
              onClick={onSeedDocs}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs cursor-pointer hover:bg-emerald-100 transition-colors"
            >
              <Zap size={14} /> Nạp 4 Tài Liệu Mẫu
            </button>
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer transition-colors"
            >
              <UploadCloud size={14} /> Tải Lên File Ngay
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {docs.map((doc) => (
              <div
                key={doc._id}
                className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex justify-between items-start gap-4 shadow-xs hover:border-slate-300 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const topicStyle = getTopicBadgeStyle(doc.topic);
                      return (
                        <span
                          className={`text-[11px] font-extrabold px-2 py-0.5 rounded-sm flex items-center gap-1 ${topicStyle.bg} ${topicStyle.text}`}
                        >
                          <span>{topicStyle.icon}</span>
                          <span>{doc.topic}</span>
                        </span>
                      );
                    })()}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-sm ${
                        doc.status === 'PUBLISHED'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {doc.status === 'PUBLISHED' ? '✓ Đã xuất bản' : 'Bản nháp'}
                    </span>
                    {doc.chunkCount !== undefined && doc.chunkCount > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-sm bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                        ⚡ {doc.chunkCount} đoạn RAG
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">v{doc.version || 1}</span>
                  </div>

                  <h3 className="my-2 text-sm font-extrabold text-slate-900">
                    {doc.title}
                  </h3>
                  <p className="m-0 text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {doc.content}
                  </p>
                </div>

                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onTogglePublishDoc(doc)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold border cursor-pointer transition-colors ${
                      doc.status === 'PUBLISHED'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {doc.status === 'PUBLISHED' ? 'Thu hồi' : 'Xuất bản'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDocModal(doc)}
                    className="px-2.5 py-1.5 rounded-md text-xs font-bold bg-slate-50 text-slate-700 border border-slate-300 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    Chi tiết
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDoc(doc._id, doc.title)}
                    className="p-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 border-none cursor-pointer transition-colors"
                    title="Xóa tài liệu"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* PHÂN TRANG TÀI LIỆU */}
          {pagination && onPageChange && (
            <FoodImagePagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              pageSizeOptions={[5, 10, 20]}
              itemLabel="tài liệu"
            />
          )}
        </>
      )}
    </>
  );
};
