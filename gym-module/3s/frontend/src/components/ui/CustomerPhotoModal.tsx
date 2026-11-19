import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowRight, Calendar, Camera, Image as ImageIcon, Plus, Sliders, Trash2, Upload, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { useToast } from './ToastProvider';
import { api } from '../../services/api';
import type { PaginationMeta } from '../../types';
import { errorMessage } from '../../types';

interface CustomerSummary { _id?: string; fullName?: string }
export interface ProgressPhotoItem {
  _id: string;
  customerId: string;
  ptId: string;
  photoUrl: string;
  takenDate: string;
  stage: 'BEFORE' | 'AFTER' | 'PROGRESS';
  angle: 'FRONT' | 'SIDE' | 'BACK' | 'OTHER';
  weight?: number | null;
  bodyFat?: number | null;
  notes?: string;
  createdAt?: string;
}

interface CustomerPhotoModalProps {
  open: boolean;
  customer: CustomerSummary | null;
  onClose: () => void;
}

const STAGE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  BEFORE: { label: 'Trước khi tập (Before)', color: '#0369a1', bg: '#e0f2fe' },
  AFTER: { label: 'Sau khi tập (After)', color: '#15803d', bg: '#dcfce7' },
  PROGRESS: { label: 'Tiến độ định kỳ', color: '#7c3aed', bg: '#f3e8ff' },
};

const ANGLE_LABELS: Record<string, string> = {
  FRONT: 'Chính diện',
  SIDE: 'Nghiêng',
  BACK: 'Phía sau',
  OTHER: 'Khác',
};

export default function CustomerPhotoModal({ open, customer, onClose }: CustomerPhotoModalProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'gallery' | 'compare'>('gallery');
  const [items, setItems] = useState<ProgressPhotoItem[]>([]);
  const [_meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });
  const [stageFilter, setStageFilter] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [deleting, setDeleting] = useState<ProgressPhotoItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [_loading, setLoading] = useState(false);

  // Batch Multi-Photo Upload State
  const [uploadQueue, setUploadQueue] = useState<
    Array<{
      id: string;
      file: File;
      previewUrl: string;
      stage: 'BEFORE' | 'AFTER' | 'PROGRESS';
      angle: 'FRONT' | 'SIDE' | 'BACK' | 'OTHER';
      weight?: string;
      notes?: string;
      takenDate: string;
    }>
  >([]);
  const [bulkStage, setBulkStage] = useState<'BEFORE' | 'AFTER' | 'PROGRESS'>('BEFORE');
  const [bulkDate, setBulkDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [bulkWeight, setBulkWeight] = useState<string>('');

  // Compare Mode State
  const [beforePhotoId, setBeforePhotoId] = useState('');
  const [afterPhotoId, setAfterPhotoId] = useState('');
  const [compareAngle, setCompareAngle] = useState<string>('ALL');
  const [compareViewType, setCompareViewType] = useState<'sideBySide' | 'slider' | 'multiAngle' | 'timeline'>('sideBySide');
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [zoomPhoto, setZoomPhoto] = useState<ProgressPhotoItem | null>(null);

  // Direct Drag Handler for Split Slider
  const sliderContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const handleSliderMove = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = clientX - rect.left;
    const percent = Math.min(100, Math.max(0, (x / rect.width) * 100));
    setSliderPos(Math.round(percent * 10) / 10);
  };

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSlider(true);
    handleSliderMove(e.clientX);
  };

  const handleSliderTouchStart = (e: React.TouchEvent) => {
    setIsDraggingSlider(true);
    if (e.touches[0]) {
      handleSliderMove(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    if (!isDraggingSlider) return;

    const onMouseMove = (e: MouseEvent) => {
      handleSliderMove(e.clientX);
    };

    const onMouseUp = () => {
      setIsDraggingSlider(false);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        handleSliderMove(e.touches[0].clientX);
      }
    };

    const onTouchEnd = () => {
      setIsDraggingSlider(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDraggingSlider]);

  const autoPairPhotos = (angle = compareAngle) => {
    const pool = angle === 'ALL' ? items : items.filter((p) => p.angle === angle);
    if (pool.length < 2) {
      if (pool.length === 1) {
        setBeforePhotoId(pool[0]._id);
      }
      return;
    }
    const sorted = [...pool].sort((a, b) => new Date(a.takenDate).getTime() - new Date(b.takenDate).getTime());
    const earliest = sorted.find((p) => p.stage === 'BEFORE') || sorted[0];
    const latest = [...sorted].reverse().find((p) => (p.stage === 'AFTER' || p.stage === 'PROGRESS') && p._id !== earliest._id) || sorted[sorted.length - 1];
    
    if (earliest && latest) {
      setBeforePhotoId(earliest._id);
      setAfterPhotoId(latest._id);
    }
  };

  const swapBeforeAfter = () => {
    const temp = beforePhotoId;
    setBeforePhotoId(afterPhotoId);
    setAfterPhotoId(temp);
  };

  const load = async (page = 1) => {
    if (!customer?._id) return;
    try {
      setLoading(true);
      const url = `/api/customers/${customer._id}/photos?page=${page}&limit=50${stageFilter ? `&stage=${stageFilter}` : ''}`;
      const result = await api.get<ProgressPhotoItem[]>(url);
      const loaded = result.data || [];
      setItems(loaded);
      setMeta(result.meta || { page, totalPages: 0 });

      // Auto-assign default before/after if available
      if (loaded.length > 0) {
        const sorted = [...loaded].sort((a, b) => new Date(a.takenDate).getTime() - new Date(b.takenDate).getTime());
        const befores = sorted.filter((p) => p.stage === 'BEFORE');
        const afters = sorted.filter((p) => p.stage === 'AFTER' || p.stage === 'PROGRESS');
        
        if (befores.length > 0 && !beforePhotoId) {
          setBeforePhotoId(befores[0]._id);
        } else if (!beforePhotoId) {
          setBeforePhotoId(sorted[0]._id);
        }
        
        if (afters.length > 0 && !afterPhotoId) {
          setAfterPhotoId(afters[afters.length - 1]._id);
        } else if (!afterPhotoId && sorted.length > 1) {
          setAfterPhotoId(sorted[sorted.length - 1]._id);
        }
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setShowUploadForm(false);
    setUploadQueue([]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?._id, stageFilter]);

  const handleFilesSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newItems = files.map((file) => ({
      id: Math.random().toString(36).slice(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      stage: bulkStage,
      angle: 'FRONT' as const,
      weight: bulkWeight,
      notes: '',
      takenDate: bulkDate,
    }));
    setUploadQueue((prev) => [...prev, ...newItems]);
    e.target.value = '';
  };

  const applyBulkStage = (stage: 'BEFORE' | 'AFTER' | 'PROGRESS') => {
    setBulkStage(stage);
    setUploadQueue((q) => q.map((item) => ({ ...item, stage })));
  };

  const applyBulkDate = (date: string) => {
    setBulkDate(date);
    setUploadQueue((q) => q.map((item) => ({ ...item, takenDate: date })));
  };

  const applyBulkWeight = (weight: string) => {
    setBulkWeight(weight);
    setUploadQueue((q) => q.map((item) => ({ ...item, weight })));
  };

  const removeQueueItem = (id: string) => {
    setUploadQueue((q) => q.filter((item) => item.id !== id));
  };

  const updateQueueItem = (id: string, updates: Partial<(typeof uploadQueue)[0]>) => {
    setUploadQueue((q) => q.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleBatchUploadSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customer?._id) return;
    if (!uploadQueue.length) {
      toast.error('Vui lòng chọn ít nhất 1 ảnh để tải lên.');
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      uploadQueue.forEach((item) => {
        formData.append('images', item.file);
      });

      const uploadRes = await api.upload<Array<{ url: string; publicId: string }>>('/api/upload/images', formData);
      const uploadedImages = uploadRes.data || [];

      const photosPayload = uploadQueue.map((item, index) => ({
        photoUrl: uploadedImages[index]?.url || item.previewUrl,
        takenDate: item.takenDate || new Date().toISOString().slice(0, 10),
        stage: item.stage,
        angle: item.angle,
        weight: item.weight ? Number(item.weight) : null,
        notes: (item.notes || '').trim(),
      }));

      const result = await api.post(`/api/customers/${customer._id}/photos`, photosPayload);
      toast.success(result.message || `Đã tải lên thành công ${uploadQueue.length} ảnh!`);
      setUploadQueue([]);
      setShowUploadForm(false);
      load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!customer?._id || !deleting) return;
    try {
      const result = await api.delete(`/api/customers/${customer._id}/photos/${deleting._id}`);
      toast.success(result.message);
      setDeleting(null);
      load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  // Dedicated options for Before and After dropdowns
  const beforeOptions = useMemo(() => {
    const pool = compareAngle === 'ALL' ? items : items.filter((p) => p.angle === compareAngle);
    const befores = pool.filter((p) => p.stage === 'BEFORE');
    return befores.length > 0 ? befores : pool;
  }, [items, compareAngle]);

  const afterOptions = useMemo(() => {
    const pool = compareAngle === 'ALL' ? items : items.filter((p) => p.angle === compareAngle);
    const afters = pool.filter((p) => p.stage === 'AFTER' || p.stage === 'PROGRESS');
    return afters.length > 0 ? afters : pool;
  }, [items, compareAngle]);

  useEffect(() => {
    if (beforeOptions.length > 0 && !beforeOptions.some((p) => p._id === beforePhotoId)) {
      setBeforePhotoId(beforeOptions[0]._id);
    }
  }, [beforeOptions, beforePhotoId]);

  useEffect(() => {
    if (afterOptions.length > 0 && !afterOptions.some((p) => p._id === afterPhotoId)) {
      setAfterPhotoId(afterOptions[afterOptions.length - 1]._id);
    }
  }, [afterOptions, afterPhotoId]);

  const selectedBefore = useMemo(() => items.find((i) => i._id === beforePhotoId), [items, beforePhotoId]);
  const selectedAfter = useMemo(() => items.find((i) => i._id === afterPhotoId), [items, afterPhotoId]);

  const multiAnglePairs = useMemo(() => {
    const angles: Array<'FRONT' | 'SIDE' | 'BACK'> = ['FRONT', 'SIDE', 'BACK'];
    return angles.map((angle) => {
      const list = items
        .filter((p) => p.angle === angle)
        .sort((a, b) => new Date(a.takenDate).getTime() - new Date(b.takenDate).getTime());
      const before = list.find((p) => p.stage === 'BEFORE') || list[0] || null;
      const after =
        [...list].reverse().find((p) => (p.stage === 'AFTER' || p.stage === 'PROGRESS') && p._id !== before?._id) ||
        (list.length > 1 ? list[list.length - 1] : null);
      return {
        angle,
        title: ANGLE_LABELS[angle] || angle,
        before,
        after: after && after._id !== before?._id ? after : null,
        totalCount: list.length,
      };
    });
  }, [items]);

  const sortedTimeline = useMemo(() => {
    return [...items].sort((a, b) => new Date(a.takenDate).getTime() - new Date(b.takenDate).getTime());
  }, [items]);

  if (!open || !customer) return null;

  return (
    <div className="modal-backdrop photo-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="photo-modal-title">
      <div className="modal-content photo-modal-box" style={{ maxWidth: '1020px', width: '96%', maxHeight: '94vh', display: 'flex', flexDirection: 'column', background: '#ffffff', color: '#0f172a', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 38, 77, 0.45)', overflow: 'hidden' }}>
        {/* Header */}
        <div className="modal-header photo-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Top Title & Close Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Camera size={16} style={{ color: '#0284c7' }} />
                </div>
                <h2 id="photo-modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#003b70', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Ảnh Before / After: {customer?.fullName || 'Học viên'}
                </h2>
              </div>
              <p className="photo-modal-subtitle" style={{ margin: '3px 0 0 36px', fontSize: '0.8rem', color: '#64748b' }}>
                Theo dõi tiến độ vóc dáng & đối chiếu ảnh trực quan đa góc độ
              </p>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng" style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          {/* Tab Switcher Row */}
          <div className="photo-tab-switcher" style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', width: '100%', maxWidth: '440px' }}>
            <button
              type="button"
              className={`button ${activeTab === 'gallery' ? 'button-primary' : 'button-ghost'}`}
              style={{ flex: 1, padding: '7px 12px', fontSize: '0.82rem', justifyContent: 'center' }}
              onClick={() => setActiveTab('gallery')}
            >
              <ImageIcon size={15} style={{ marginRight: '6px' }} /> Thư viện ảnh ({items.length})
            </button>
            <button
              type="button"
              className={`button ${activeTab === 'compare' ? 'button-primary' : 'button-ghost'}`}
              style={{ flex: 1, padding: '7px 12px', fontSize: '0.82rem', justifyContent: 'center' }}
              onClick={() => setActiveTab('compare')}
            >
              <Sliders size={15} style={{ marginRight: '6px' }} /> So sánh Before / After
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="photo-modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'gallery' && (
            <div>
              {/* Top Filter & Upload Button */}
              <div className="photo-gallery-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'auto' }}>
                  <select
                    className="filter-select"
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value)}
                    style={{ minWidth: '150px' }}
                    aria-label="Lọc theo giai đoạn"
                  >
                    <option value="">Tất cả giai đoạn</option>
                    <option value="BEFORE">Trước khi tập (Before)</option>
                    <option value="AFTER">Sau khi tập (After)</option>
                    <option value="PROGRESS">Tiến độ định kỳ</option>
                  </select>
                </div>
                {!showUploadForm && (
                  <button type="button" className="button button-primary photo-upload-btn" onClick={() => setShowUploadForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> Tải nhiều ảnh mới
                  </button>
                )}
              </div>

              {/* Multi-Photo Batch Upload Form */}
              {showUploadForm && (
                <form
                  onSubmit={handleBatchUploadSubmit}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '20px 22px',
                    marginBottom: '22px',
                    boxShadow: '0 4px 14px rgba(0, 59, 112, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#003b70' }}>
                        Tải nhiều ảnh tiến độ cùng lúc
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                        Chọn hoặc kéo thả nhiều ảnh cùng lúc, gán nhanh giai đoạn (Before/After) và tải lên 1 chạm.
                      </p>
                    </div>
                    <button type="button" className="icon-button" onClick={() => setShowUploadForm(false)} aria-label="Đóng form tải ảnh">
                      <X size={18} />
                    </button>
                  </div>

                  {/* Drop zone / File selector */}
                  <div style={{ marginBottom: '18px' }}>
                    <label
                      htmlFor="multiPhotoInput"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                        border: '2px dashed #0284c7',
                        borderRadius: '12px',
                        background: '#f0f9ff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                      }}
                    >
                      <Upload size={36} style={{ color: '#0284c7', marginBottom: '8px' }} />
                      <strong style={{ fontSize: '0.95rem', color: '#003b70' }}>
                        Nhấp để chọn nhiều ảnh hoặc kéo thả ảnh vào đây
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                        Hỗ trợ định dạng JPG, PNG, WebP (chọn được 1 hoặc nhiều ảnh cùng lúc)
                      </span>
                      <input
                        id="multiPhotoInput"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFilesSelect}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>

                  {/* Bulk Controls & Queue Preview */}
                  {uploadQueue.length > 0 && (
                    <div>
                      {/* Bulk Settings Bar */}
                      <div
                        style={{
                          background: '#ffffff',
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          marginBottom: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#003b70' }}>
                            Gán nhanh cho cả {uploadQueue.length} ảnh:
                          </span>
                          <button
                            type="button"
                            className={`button ${bulkStage === 'BEFORE' ? 'button-primary' : 'button-secondary'}`}
                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                            onClick={() => applyBulkStage('BEFORE')}
                          >
                            Tất cả Trước (Before)
                          </button>
                          <button
                            type="button"
                            className={`button ${bulkStage === 'AFTER' ? 'button-primary' : 'button-secondary'}`}
                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                            onClick={() => applyBulkStage('AFTER')}
                          >
                            Tất cả Sau (After)
                          </button>
                          <button
                            type="button"
                            className={`button ${bulkStage === 'PROGRESS' ? 'button-primary' : 'button-secondary'}`}
                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                            onClick={() => applyBulkStage('PROGRESS')}
                          >
                            Tất cả Tiến độ
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="date"
                            className="field"
                            value={bulkDate}
                            onChange={(e) => applyBulkDate(e.target.value)}
                            style={{ padding: '5px 8px', fontSize: '0.8rem', width: '140px' }}
                            title="Ngày chụp cho tất cả"
                          />
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Cân nặng (kg)"
                            value={bulkWeight}
                            onChange={(e) => applyBulkWeight(e.target.value)}
                            style={{ padding: '5px 8px', fontSize: '0.8rem', width: '110px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            title="Cân nặng cho tất cả"
                          />
                        </div>
                      </div>

                      {/* Upload Queue Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: '14px',
                          maxHeight: '340px',
                          overflowY: 'auto',
                          paddingRight: '4px',
                          marginBottom: '16px',
                        }}
                      >
                        {uploadQueue.map((item, idx) => (
                          <div
                            key={item.id}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              position: 'relative',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                            }}
                          >
                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => removeQueueItem(item.id)}
                              style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: 'rgba(0,0,0,0.65)',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 2,
                              }}
                              title="Bỏ ảnh này"
                            >
                              <X size={14} />
                            </button>

                            {/* Thumbnail */}
                            <div style={{ height: '140px', background: '#0f172a', position: 'relative' }}>
                              <img
                                src={item.previewUrl}
                                alt={`Queue ${idx + 1}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: '6px',
                                  left: '6px',
                                  background: 'rgba(0,0,0,0.7)',
                                  color: '#fff',
                                  fontSize: '0.7rem',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                #{idx + 1}
                              </span>
                            </div>

                            {/* Controls for this photo */}
                            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <select
                                value={item.stage}
                                onChange={(e) => updateQueueItem(item.id, { stage: e.target.value as any })}
                                style={{ padding: '4px 6px', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
                              >
                                <option value="BEFORE">Trước (Before)</option>
                                <option value="AFTER">Sau (After)</option>
                                <option value="PROGRESS">Tiến độ định kỳ</option>
                              </select>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                <select
                                  value={item.angle}
                                  onChange={(e) => updateQueueItem(item.id, { angle: e.target.value as any })}
                                  style={{ padding: '3px 4px', fontSize: '0.74rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                >
                                  <option value="FRONT">Chính diện</option>
                                  <option value="SIDE">Nghiêng</option>
                                  <option value="BACK">Sau lưng</option>
                                  <option value="OTHER">Khác</option>
                                </select>
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="Kg"
                                  value={item.weight || ''}
                                  onChange={(e) => updateQueueItem(item.id, { weight: e.target.value })}
                                  style={{ padding: '3px 4px', fontSize: '0.74rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => setUploadQueue([])}
                          disabled={uploading}
                        >
                          Xóa tất cả ({uploadQueue.length})
                        </button>
                        <button
                          type="submit"
                          className="button button-primary"
                          disabled={uploading}
                          style={{ minWidth: '180px', fontWeight: 700 }}
                        >
                          {uploading ? 'Đang tải lên...' : `Tải lên tất cả (${uploadQueue.length} ảnh)`}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* Photo Grid */}
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                  <ImageIcon size={40} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                  <h4 style={{ margin: '0 0 6px', color: '#334155' }}>Chưa có ảnh tiến độ</h4>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b' }}>
                    Hãy tải lên ảnh Before và After để theo dõi kết quả thay đổi hình thể của học viên.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {items.map((item) => {
                    const stageInfo = STAGE_LABELS[item.stage] || { label: item.stage, color: '#475569', bg: '#f1f5f9' };
                    return (
                      <div
                        key={item._id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div
                          style={{
                            height: '210px',
                            background: '#0f172a',
                            position: 'relative',
                            cursor: 'pointer',
                            overflow: 'hidden',
                          }}
                          onClick={() => setZoomPhoto(item)}
                        >
                          <img
                            src={item.photoUrl}
                            alt={stageInfo.label}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <span
                            style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              background: stageInfo.bg,
                              color: stageInfo.color,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            }}
                          >
                            {item.stage}
                          </span>
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '8px',
                              left: '8px',
                              background: 'rgba(0,0,0,0.65)',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {ANGLE_LABELS[item.angle] || item.angle}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleting(item);
                            }}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              background: 'rgba(225,29,72,0.85)',
                              border: 'none',
                              color: '#ffffff',
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                            title="Xóa ảnh"
                            aria-label="Xóa ảnh"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div style={{ padding: '12px 14px', fontSize: '0.82rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={12} />
                              {item.takenDate ? new Date(item.takenDate).toLocaleDateString('vi-VN') : '—'}
                            </span>
                            {item.weight && (
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                {item.weight} kg {item.bodyFat ? `• ${item.bodyFat}%` : ''}
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'compare' && (
            <div>
              {/* Compare Mode Header & Mode Switcher */}
              <div
                className="photo-compare-toolbar"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                {/* View Mode Buttons */}
                <div className="photo-compare-modes" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#003b70', marginRight: '4px' }}>Chế độ xem:</span>
                  <button
                    type="button"
                    className={`button ${compareViewType === 'sideBySide' ? 'button-primary' : 'button-ghost'}`}
                    style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                    onClick={() => setCompareViewType('sideBySide')}
                  >
                    Song song (2 cột)
                  </button>
                  <button
                    type="button"
                    className={`button ${compareViewType === 'slider' ? 'button-primary' : 'button-ghost'}`}
                    style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                    onClick={() => setCompareViewType('slider')}
                  >
                    Thanh trượt lồng nhau
                  </button>
                  <button
                    type="button"
                    className={`button ${compareViewType === 'multiAngle' ? 'button-primary' : 'button-ghost'}`}
                    style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                    onClick={() => setCompareViewType('multiAngle')}
                  >
                    Trọn bộ 3 góc (360°)
                  </button>
                  <button
                    type="button"
                    className={`button ${compareViewType === 'timeline' ? 'button-primary' : 'button-ghost'}`}
                    style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                    onClick={() => setCompareViewType('timeline')}
                  >
                    Dòng thời gian ({items.length})
                  </button>
                </div>

                {/* Quick actions: Angle Filter & Auto-Pair */}
                {(compareViewType === 'sideBySide' || compareViewType === 'slider') && (
                  <div className="photo-compare-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <select
                      className="filter-select"
                      value={compareAngle}
                      onChange={(e) => {
                        setCompareAngle(e.target.value);
                        autoPairPhotos(e.target.value);
                      }}
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      aria-label="Lọc góc chụp so sánh"
                    >
                      <option value="ALL">Tất cả góc</option>
                      <option value="FRONT">Chính diện</option>
                      <option value="SIDE">Nghiêng</option>
                      <option value="BACK">Phía sau</option>
                    </select>

                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onClick={() => autoPairPhotos()}
                      title="Tự động chọn ảnh đầu tiên và ảnh mới nhất"
                    >
                      ⚡ Ghép tự động
                    </button>

                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onClick={swapBeforeAfter}
                      title="Đổi chiều ảnh Trước và Sau"
                    >
                      ⇄ Hoán đổi
                    </button>
                  </div>
                )}
              </div>

              {/* Selectors Bar for both Side-by-Side and Slider views */}
              {(compareViewType === 'sideBySide' || compareViewType === 'slider') && (
                <div
                  className="photo-compare-selectors"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ background: '#f0f9ff', padding: '10px 14px', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: '#0369a1', marginBottom: '4px' }}>
                      <span>1. Ảnh Trước (Before):</span>
                      <span style={{ fontSize: '0.74rem', opacity: 0.85 }}>({beforeOptions.length} ảnh)</span>
                    </label>
                    <select
                      className="filter-select"
                      style={{ width: '100%', fontSize: '0.84rem' }}
                      value={beforePhotoId}
                      onChange={(e) => setBeforePhotoId(e.target.value)}
                      aria-label="Chọn ảnh Before"
                    >
                      <option value="">-- Chọn ảnh Trước (Before) --</option>
                      {beforeOptions.map((p) => (
                        <option key={p._id} value={p._id}>
                          {new Date(p.takenDate).toLocaleDateString('vi-VN')} ({STAGE_LABELS[p.stage]?.label || p.stage}) - {ANGLE_LABELS[p.angle] || p.angle} {p.weight ? `• ${p.weight}kg` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>
                      <span>2. Ảnh Sau (After):</span>
                      <span style={{ fontSize: '0.74rem', opacity: 0.85 }}>({afterOptions.length} ảnh)</span>
                    </label>
                    <select
                      className="filter-select"
                      style={{ width: '100%', fontSize: '0.84rem' }}
                      value={afterPhotoId}
                      onChange={(e) => setAfterPhotoId(e.target.value)}
                      aria-label="Chọn ảnh After"
                    >
                      <option value="">-- Chọn ảnh Sau (After) --</option>
                      {afterOptions.map((p) => (
                        <option key={p._id} value={p._id}>
                          {new Date(p.takenDate).toLocaleDateString('vi-VN')} ({STAGE_LABELS[p.stage]?.label || p.stage}) - {ANGLE_LABELS[p.angle] || p.angle} {p.weight ? `• ${p.weight}kg` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* VIEW 1: SIDE BY SIDE */}
              {compareViewType === 'sideBySide' && (
                <div>
                  {/* Side-by-Side Comparison Container */}
                  {selectedBefore && selectedAfter ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Delta Stats Badge */}
                      <div
                        className="photo-compare-delta-badge"
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '10px',
                          padding: '10px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-around',
                          fontSize: '0.88rem',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div>
                          <span style={{ color: '#64748b' }}>Cân nặng Trước: </span>
                          <strong style={{ color: '#0369a1' }}>{selectedBefore.weight ? `${selectedBefore.weight} kg` : '—'}</strong>
                        </div>
                        <ArrowRight size={16} style={{ color: '#0284c7' }} />
                        <div>
                          <span style={{ color: '#64748b' }}>Cân nặng Sau: </span>
                          <strong style={{ color: '#15803d' }}>{selectedAfter.weight ? `${selectedAfter.weight} kg` : '—'}</strong>
                        </div>
                        {selectedBefore.weight && selectedAfter.weight && (
                          <div
                            style={{
                              background: selectedAfter.weight <= selectedBefore.weight ? '#16a34a' : '#ea580c',
                              color: '#fff',
                              padding: '2px 10px',
                              borderRadius: '20px',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                            }}
                          >
                            Thay đổi: {(selectedAfter.weight - selectedBefore.weight).toFixed(1)} kg
                          </div>
                        )}
                        {selectedBefore.takenDate && selectedAfter.takenDate && (
                          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            Khoảng cách: {Math.max(0, Math.round((new Date(selectedAfter.takenDate).getTime() - new Date(selectedBefore.takenDate).getTime()) / (1000 * 3600 * 24)))} ngày
                          </span>
                        )}
                      </div>

                      <div className="photo-compare-side-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        {/* Before Card */}
                        <div style={{ border: '2px solid #0284c7', borderRadius: '12px', overflow: 'hidden', background: '#0f172a' }}>
                          <div style={{ background: '#0284c7', color: '#fff', padding: '8px 14px', fontWeight: 700, fontSize: '0.86rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>TRƯỚC (BEFORE) • {ANGLE_LABELS[selectedBefore.angle] || selectedBefore.angle}</span>
                            <span>{new Date(selectedBefore.takenDate).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <div className="photo-compare-img-box" style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setZoomPhoto(selectedBefore)}>
                            <img src={selectedBefore.photoUrl} alt="Before" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          </div>
                          <div style={{ background: '#ffffff', padding: '10px 14px', fontSize: '0.84rem' }}>
                            <div><strong>Chỉ số:</strong> {selectedBefore.weight ? `${selectedBefore.weight} kg` : ''} {selectedBefore.bodyFat ? `• ${selectedBefore.bodyFat}% Fat` : ''}</div>
                            {selectedBefore.notes && <div style={{ color: '#64748b', marginTop: '2px' }}>{selectedBefore.notes}</div>}
                          </div>
                        </div>

                        {/* After Card */}
                        <div style={{ border: '2px solid #16a34a', borderRadius: '12px', overflow: 'hidden', background: '#0f172a' }}>
                          <div style={{ background: '#16a34a', color: '#fff', padding: '8px 14px', fontWeight: 700, fontSize: '0.86rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>SAU (AFTER) • {ANGLE_LABELS[selectedAfter.angle] || selectedAfter.angle}</span>
                            <span>{new Date(selectedAfter.takenDate).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <div className="photo-compare-img-box" style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setZoomPhoto(selectedAfter)}>
                            <img src={selectedAfter.photoUrl} alt="After" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          </div>
                          <div style={{ background: '#ffffff', padding: '10px 14px', fontSize: '0.84rem' }}>
                            <div><strong>Chỉ số:</strong> {selectedAfter.weight ? `${selectedAfter.weight} kg` : ''} {selectedAfter.bodyFat ? `• ${selectedAfter.bodyFat}% Fat` : ''}</div>
                            {selectedAfter.notes && <div style={{ color: '#64748b', marginTop: '2px' }}>{selectedAfter.notes}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                      <Sliders size={32} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
                      <h4 style={{ margin: '0 0 4px', color: '#334155' }}>Vui lòng chọn 2 ảnh để so sánh</h4>
                      <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b' }}>
                        Chọn 1 ảnh ở giai đoạn Trước (Before) và 1 ảnh ở giai đoạn Sau (After) để thấy sự khác biệt.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: INTERACTIVE SPLIT SLIDER */}
              {compareViewType === 'slider' && (
                <div>
                  {selectedBefore && selectedAfter ? (
                    <div>
                      {/* Interactive Drag Notice / Tooltip */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#003b70', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></span>
                          Kéo trực tiếp thanh trượt trên ảnh để đối chiếu (Trước: {Math.round(sliderPos)}% / Sau: {Math.round(100 - sliderPos)}%):
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={sliderPos}
                          onChange={(e) => setSliderPos(Number(e.target.value))}
                          style={{ width: '200px', cursor: 'pointer' }}
                        />
                      </div>

                      {/* Slider Container with Direct Mouse/Touch Drag */}
                      <div
                        ref={sliderContainerRef}
                        onMouseDown={handleSliderMouseDown}
                        onTouchStart={handleSliderTouchStart}
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '520px',
                          background: '#0f172a',
                          borderRadius: '14px',
                          overflow: 'hidden',
                          border: isDraggingSlider ? '3px solid #005696' : '2px solid #0284c7',
                          userSelect: 'none',
                          cursor: 'ew-resize',
                          touchAction: 'none',
                        }}
                      >
                        {/* After Image (Full background) */}
                        <img
                          src={selectedAfter.photoUrl}
                          alt="After"
                          draggable={false}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            pointerEvents: 'none',
                          }}
                        />

                        {/* Before Image (Clipped) */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                            pointerEvents: 'none',
                          }}
                        >
                          <img
                            src={selectedBefore.photoUrl}
                            alt="Before"
                            draggable={false}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              pointerEvents: 'none',
                            }}
                          />
                        </div>

                        {/* Vertical Slider Divider Line */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${sliderPos}%`,
                            width: '4px',
                            background: '#ffffff',
                            boxShadow: '0 0 12px rgba(0,0,0,0.8)',
                            transform: 'translateX(-50%)',
                            pointerEvents: 'none',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: `translate(-50%, -50%) scale(${isDraggingSlider ? 1.25 : 1})`,
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: '#ffffff',
                              color: '#003b70',
                              border: '3px solid #0284c7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                              fontWeight: 900,
                              fontSize: '1rem',
                              cursor: 'ew-resize',
                              transition: 'transform 0.1s ease',
                            }}
                          >
                            ⇄
                          </div>
                        </div>

                        {/* Labels on top corners */}
                        <span
                          style={{
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            background: 'rgba(2, 132, 199, 0.9)',
                            color: '#fff',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.82rem',
                          }}
                        >
                          TRƯỚC ({new Date(selectedBefore.takenDate).toLocaleDateString('vi-VN')})
                        </span>
                        <span
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: 'rgba(22, 163, 74, 0.9)',
                            color: '#fff',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.82rem',
                          }}
                        >
                          SAU ({new Date(selectedAfter.takenDate).toLocaleDateString('vi-VN')})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '50px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                      <p style={{ margin: 0, color: '#64748b' }}>Vui lòng chọn ít nhất 2 ảnh để kích hoạt thanh trượt.</p>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 3: MULTI-ANGLE 360 MATRIX */}
              {compareViewType === 'multiAngle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ background: '#f0f9ff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #bae6fd', fontSize: '0.86rem', color: '#0369a1' }}>
                    <strong>Bảng so sánh 360° đa góc độ:</strong> Tổng hợp nhanh các góc chụp Chính diện, Nghiêng và Sau lưng giữa giai đoạn bắt đầu và hiện tại.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {multiAnglePairs.map((pair) => (
                      <div
                        key={pair.angle}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div style={{ background: '#003b70', color: '#ffffff', padding: '10px 14px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Góc {pair.title}</span>
                          <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>({pair.totalCount} ảnh)</span>
                        </div>

                        {pair.before && pair.after ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '10px', background: '#0f172a' }}>
                            {/* Before Thumbnail */}
                            <div style={{ position: 'relative', height: '220px', cursor: 'pointer' }} onClick={() => setZoomPhoto(pair.before)}>
                              <img src={pair.before.photoUrl} alt="Before" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                              <span style={{ position: 'absolute', top: '4px', left: '4px', background: '#0284c7', color: '#fff', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                                Trước: {new Date(pair.before.takenDate).toLocaleDateString('vi-VN')}
                              </span>
                            </div>

                            {/* After Thumbnail */}
                            <div style={{ position: 'relative', height: '220px', cursor: 'pointer' }} onClick={() => setZoomPhoto(pair.after)}>
                              <img src={pair.after.photoUrl} alt="After" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                              <span style={{ position: 'absolute', top: '4px', left: '4px', background: '#16a34a', color: '#fff', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                                Sau: {new Date(pair.after.takenDate).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '30px 14px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem', background: '#f8fafc' }}>
                            Chưa đủ 2 ảnh Trước và Sau cho góc {pair.title}.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VIEW 4: TIMELINE PROGRESSION */}
              {compareViewType === 'timeline' && (
                <div>
                  <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '0.86rem', color: '#334155' }}>
                    <strong>Dòng tiến trình thời gian ({sortedTimeline.length} cột mốc):</strong> Xem lại toàn bộ ảnh tiến trình theo trình tự thời gian từ lúc nhập học.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                    {sortedTimeline.map((item, idx) => (
                      <div
                        key={item._id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <div style={{ height: '190px', background: '#0f172a', position: 'relative', cursor: 'pointer' }} onClick={() => setZoomPhoto(item)}>
                          <img src={item.photoUrl} alt={item.stage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span
                            style={{
                              position: 'absolute',
                              top: '6px',
                              left: '6px',
                              background: item.stage === 'BEFORE' ? '#0284c7' : item.stage === 'AFTER' ? '#16a34a' : '#7c3aed',
                              color: '#fff',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            #{idx + 1} • {item.stage}
                          </span>
                        </div>
                        <div style={{ padding: '10px', fontSize: '0.8rem', color: '#475569' }}>
                          <div style={{ fontWeight: 700, color: '#003b70' }}>{new Date(item.takenDate).toLocaleDateString('vi-VN')}</div>
                          <div>Góc: {ANGLE_LABELS[item.angle] || item.angle}</div>
                          {item.weight && <div>Cân nặng: <strong>{item.weight} kg</strong></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Zoom Modal */}
      {zoomPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setZoomPhoto(null)}
        >
          <img src={zoomPhoto.photoUrl} alt="Zoom" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        open={Boolean(deleting)}
        title="Xóa ảnh tiến độ"
        description="Bạn có chắc chắn muốn xóa ảnh này? Dữ liệu đã xóa không thể khôi phục."
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
