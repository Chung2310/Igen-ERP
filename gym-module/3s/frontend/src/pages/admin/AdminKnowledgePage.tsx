import React, { useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon, FileText, RefreshCw, UploadCloud, Sparkles } from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { GymEmptyIllustration } from '../../components/ui/GymEmptyIllustration';
import { api } from '../../services/api';
import { useToast } from '../../components/ui/ToastProvider';
import { errorMessage, type PaginationMeta } from '../../types';
import type { FoodImageItem, FoodImageSummary, KnowledgeDocument } from '../../types/knowledge';
import {
  FoodImageStats,
  FoodImageToolbar,
  FoodImageCard,
  FoodImagePreviewModal,
  FoodImageEditModal,
  FoodImageUploadModal,
  FoodImageAiModal,
  KnowledgeDocModal,
  KnowledgeUploadModal,
  KnowledgeDocList,
  FoodImagePagination,
} from '../../components/knowledge';

export default function AdminKnowledgePage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'images' | 'docs'>('images');

  // ==========================================
  // STATE: KHO ẢNH MÓN ĂN
  // ==========================================
  const [images, setImages] = useState<FoodImageItem[]>([]);
  const [summary, setSummary] = useState<FoodImageSummary | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  const [deleteImageTarget, setDeleteImageTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<FoodImageItem | null>(null);
  const [editingImage, setEditingImage] = useState<FoodImageItem | null>(null);

  // ==========================================
  // STATE: TÀI LIỆU TRI THỨC
  // ==========================================
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDocument | null>(null);
  const [docsSearchQuery, setDocsSearchQuery] = useState('');
  const [docsTopicFilter, setDocsTopicFilter] = useState<string>('ALL');
  const [docsStatusFilter, setDocsStatusFilter] = useState<string>('ALL');
  const [docsCurrentPage, setDocsCurrentPage] = useState(1);
  const [docsPageSize, setDocsPageSize] = useState(10);
  const [docsPagination, setDocsPagination] = useState<PaginationMeta | null>(null);

  // ==========================================
  // API LOADERS
  // ==========================================
  const loadImages = useCallback(async () => {
    try {
      setLoadingImages(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (sourceFilter !== 'ALL') params.append('source', sourceFilter);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      params.append('page', String(currentPage));
      params.append('limit', String(pageSize));

      const res = await api.get<FoodImageItem[]>(`/api/food-images?${params.toString()}`);
      setImages(res.data || []);
      if ((res as any).summary) {
        setSummary((res as any).summary);
      }
      if ((res as any).meta) {
        setPagination((res as any).meta);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingImages(false);
    }
  }, [searchQuery, sourceFilter, categoryFilter, currentPage, pageSize, toast]);

  const loadDocs = useCallback(async () => {
    try {
      setLoadingDocs(true);
      const params = new URLSearchParams();
      if (docsSearchQuery.trim()) params.append('search', docsSearchQuery.trim());
      if (docsTopicFilter !== 'ALL') params.append('topic', docsTopicFilter);
      if (docsStatusFilter !== 'ALL') params.append('status', docsStatusFilter);
      params.append('page', String(docsCurrentPage));
      params.append('limit', String(docsPageSize));

      const res = await api.get<KnowledgeDocument[]>(`/api/knowledge?${params.toString()}`);
      setDocs(res.data || []);
      if (res.meta) {
        setDocsPagination(res.meta);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingDocs(false);
    }
  }, [docsSearchQuery, docsTopicFilter, docsStatusFilter, docsCurrentPage, docsPageSize, toast]);

  useEffect(() => {
    if (activeTab === 'images') {
      void loadImages();
    } else {
      void loadDocs();
    }
  }, [activeTab, loadImages, loadDocs]);

  // ==========================================
  // HANDLERS: KHO ẢNH MÓN ĂN
  // ==========================================
  const handleDeleteImage = async () => {
    if (!deleteImageTarget || deletingImage) return;
    const { id, name } = deleteImageTarget;
    setDeletingImage(true);
    try {
      await api.delete(`/api/food-images/${id}`);
      toast.success(`Đã xóa ảnh món "${name}" khỏi kho.`);
      setDeleteImageTarget(null);
      if (previewImage?._id === id) setPreviewImage(null);
      if (images.length === 1 && currentPage > 1) setCurrentPage((page) => page - 1);
      else void loadImages();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeletingImage(false);
    }
  };

  // ==========================================
  // HANDLERS: TÀI LIỆU TRI THỨC
  // ==========================================
  const handleOpenDocModal = (doc?: KnowledgeDocument) => {
    setEditingDoc(doc || null);
    setShowDocModal(true);
  };

  const handleTogglePublishDoc = async (doc: KnowledgeDocument) => {
    try {
      const action = doc.status === 'PUBLISHED' ? 'unpublish' : 'publish';
      await api.patch(`/api/knowledge/${doc._id}/${action}`, {});
      toast.success(doc.status === 'PUBLISHED' ? 'Đã thu hồi về bản nháp.' : 'Đã xuất bản tài liệu!');
      void loadDocs();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDeleteDoc = async (id: string, title: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa tài liệu "${title}" không?`)) return;
    try {
      await api.delete(`/api/knowledge/${id}`);
      toast.success('Đã xóa tài liệu tri thức.');
      void loadDocs();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleSeedDocs = async () => {
    try {
      const res = await api.post<any>('/api/knowledge/seed-standard', {});
      toast.success(res.message || 'Đã nạp các tài liệu chuẩn 3S Gym thành công!');
      void loadDocs();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="w-full min-w-0 pb-4">
      {/* HEADER SECTION */}
      <div className="gym-knowledge-tabs mb-2.5 flex flex-wrap items-center gap-2 pb-2.5">
        {/* TABS SWITCHER */}
        <div className="gym-transfer-tabs" role="group" aria-label="Loại tư liệu">
          <button
            type="button"
            onClick={() => setActiveTab('images')}
            className="gym-transfer-tab"
            aria-pressed={activeTab === 'images'}
          >
            <ImageIcon size={16} />
            <span>Kho Ảnh Món Ăn</span>
            {summary && (
              <span className="bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded-full text-[11px]">
                {summary.totalImages}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className="gym-transfer-tab"
            aria-pressed={activeTab === 'docs'}
          >
            <FileText size={16} />
            <span>Tài Liệu Tri Thức</span>
            {docs.length > 0 && (
              <span className="bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded-full text-[11px]">
                {docs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB 1: KHO ẢNH MÓN ĂN                      */}
      {/* ========================================== */}
      {activeTab === 'images' && (
        <>
          {/* STATS WIDGETS (WITHOUT USAGE COUNT) */}
          <FoodImageStats summary={summary} />

          {/* ACTION TOOLBAR & FILTERS */}
          <FoodImageToolbar
            searchQuery={searchQuery}
            onSearchChange={(val) => {
              setSearchQuery(val);
              setCurrentPage(1);
            }}
            sourceFilter={sourceFilter}
            onSourceFilterChange={(val) => {
              setSourceFilter(val);
              setCurrentPage(1);
            }}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={(val) => {
              setCategoryFilter(val);
              setCurrentPage(1);
            }}
            onOpenUploadModal={() => setShowUploadModal(true)}
            onOpenAiModal={() => setShowAiModal(true)}
          />

          {/* GALLERY GRID */}
          {loadingImages ? (
            <div className="text-center py-16 text-slate-500">
              <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-sky-600" />
              <div>Đang tải kho ảnh món ăn...</div>
            </div>
          ) : images.length === 0 ? (
            <div className="py-10 text-center">
              <GymEmptyIllustration kind={searchQuery ? 'search' : 'knowledge'} className="mb-3" />
              <div className="font-semibold text-sm text-[#071629] mb-4">
                Chưa có ảnh món ăn nào trong kho
              </div>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="button button-secondary"
                >
                  <UploadCloud size={15} /> Tải Ảnh Lên Kho
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  className="button button-primary"
                >
                  <Sparkles size={15} /> Tạo Ảnh AI Lưu Kho
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((item) => (
                  <FoodImageCard
                    key={item._id}
                    item={item}
                    onPreview={(dish) => setPreviewImage(dish)}
                    onEdit={(dish) => setEditingImage(dish)}
                    onDelete={(id, name) => setDeleteImageTarget({ id, name })}
                  />
                ))}
              </div>

              {/* PHÂN TRANG ẢNH MÓN ĂN */}
              {pagination && (
                <FoodImagePagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  pageSize={pageSize}
                  onPageChange={(p) => setCurrentPage(p)}
                  onPageSizeChange={(sz) => {
                    setPageSize(sz);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[12, 16, 24, 48]}
                  itemLabel="ảnh món"
                />
              )}
            </>
          )}
        </>
      )}

      {/* ========================================== */}
      {/* TAB 2: TÀI LIỆU TRI THỨC                   */}
      {/* ========================================== */}
      {activeTab === 'docs' && (
        <KnowledgeDocList
          docs={docs}
          loading={loadingDocs}
          onOpenUploadModal={() => setShowUploadDocModal(true)}
          onOpenDocModal={handleOpenDocModal}
          onTogglePublishDoc={handleTogglePublishDoc}
          onDeleteDoc={handleDeleteDoc}
          onSeedDocs={handleSeedDocs}
          searchQuery={docsSearchQuery}
          onSearchChange={(val) => {
            setDocsSearchQuery(val);
            setDocsCurrentPage(1);
          }}
          topicFilter={docsTopicFilter}
          onTopicFilterChange={(val) => {
            setDocsTopicFilter(val);
            setDocsCurrentPage(1);
          }}
          statusFilter={docsStatusFilter}
          onStatusFilterChange={(val) => {
            setDocsStatusFilter(val);
            setDocsCurrentPage(1);
          }}
          pagination={docsPagination}
          pageSize={docsPageSize}
          onPageChange={(p) => setDocsCurrentPage(p)}
          onPageSizeChange={(sz) => {
            setDocsPageSize(sz);
            setDocsCurrentPage(1);
          }}
        />
      )}

      {/* ========================================== */}
      {/* MODALS CONTAINER                           */}
      {/* ========================================== */}
      <ConfirmModal
        open={Boolean(deleteImageTarget)}
        title="Xóa ảnh món ăn?"
        description={`Bạn có chắc muốn xóa ảnh món "${deleteImageTarget?.name || ''}" khỏi kho? Ảnh đã xóa không thể khôi phục.`}
        confirmLabel="Xóa ảnh"
        cancelLabel="Hủy"
        danger
        loading={deletingImage}
        onClose={() => { if (!deletingImage) setDeleteImageTarget(null); }}
        onConfirm={handleDeleteImage}
      />

      <FoodImageUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => void loadImages()}
      />

      <FoodImageAiModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onSuccess={() => void loadImages()}
      />

      <FoodImagePreviewModal
        item={previewImage}
        onClose={() => setPreviewImage(null)}
        onEdit={(dish) => {
          setPreviewImage(null);
          setEditingImage(dish);
        }}
      />

      <FoodImageEditModal
        item={editingImage}
        onClose={() => setEditingImage(null)}
        onSaved={() => void loadImages()}
      />

      <KnowledgeDocModal
        isOpen={showDocModal}
        editingDoc={editingDoc}
        onClose={() => setShowDocModal(false)}
        onSuccess={() => void loadDocs()}
      />

      <KnowledgeUploadModal
        isOpen={showUploadDocModal}
        onClose={() => setShowUploadDocModal(false)}
        onSuccess={() => void loadDocs()}
      />
    </div>
  );
}
