import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import {
  Calendar,
  CheckCircle2,
  FileImage,
  FileText,
  ImageIcon,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import FormModal from '../ui/FormModal';
import CustomerSelect from '../ui/CustomerSelect';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import { errorMessage } from '../../types';
import InBodyReviewForm, { type InBodyOcrDraft } from './InBodyReviewForm';

interface InBodyScanModalProps {
  open: boolean;
  onClose: () => void;
  onConfirmed: (draft: InBodyOcrDraft) => void;
}

export default function InBodyScanModal({ open, onClose, onConfirmed }: InBodyScanModalProps) {
  const toast = useToast();
  const fileInputId = useId();
  const [customerId, setCustomerId] = useState('');
  const [measurementDate, setMeasurementDate] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const [draft, setDraft] = useState<InBodyOcrDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isPdf = Boolean(
    image && (image.type === 'application/pdf' || image.name.toLowerCase().endsWith('.pdf'))
  );

  // Object URL preview for the selected image (skip for PDF)
  const previewUrl = useMemo(() => {
    if (!image || isPdf) return null;
    return URL.createObjectURL(image);
  }, [image, isPdf]);

  // Clean up object URL when image changes or unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const scan = async (event: FormEvent) => {
    event.preventDefault();
    if (!image) {
      setImageError('Vui lòng chọn ảnh hoặc file PDF phiếu InBody.');
      return;
    }
    setImageError('');
    const body = new FormData();
    if (customerId) {
      body.set('customerId', customerId);
    }
    if (measurementDate) {
      body.set('measurementDate', measurementDate);
    }
    body.set('image', image);
    setLoading(true);
    try {
      const result = await api.upload<InBodyOcrDraft>('/api/inbody/ocr', body);
      setDraft(result.data);
      toast.info(result.message);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmed = (confirmedDraft: InBodyOcrDraft) => {
    setDraft(null);
    setCustomerId('');
    setMeasurementDate('');
    setImage(null);
    setImageError('');
    onConfirmed(confirmedDraft);
  };

  const handleClose = () => {
    setDraft(null);
    setImage(null);
    setImageError('');
    setIsDragging(false);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <FormModal
      open={open}
      size="lg"
      title={draft ? 'Kiểm tra và Xác nhận chỉ số InBody' : 'Quét phiếu InBody'}
      description={
        draft
          ? 'Vui lòng đối chiếu và chỉnh sửa các chỉ số từ bản quét trước khi lưu.'
          : undefined
      }
      dirty={Boolean(customerId || measurementDate || image || draft)}
      loading={loading}
      submitLabel={draft ? '' : 'Quét InBody'}
      onClose={handleClose}
      onSubmit={!draft ? scan : undefined}
    >
      {!draft ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '340px', padding: '4px 0 20px' }}>
          {/* Top Form Fields: Customer & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 200px', gap: '16px', alignItems: 'start' }}>
            <div>
              <CustomerSelect
                label="Khách hàng"
                name="customerId"
                ariaLabel=" Khách hàng"
                value={customerId}
                onChange={(selectedId) => setCustomerId(selectedId)}
                placeholder="Chọn trước học viên hoặc để trống để AI tự nhận diện..."
              />
              <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                💡 Không bắt buộc: Hệ thống sẽ tự động quét tên học viên in trên phiếu InBody và gợi ý chọn ở bước tiếp theo.
              </span>
            </div>

            <label className="field" style={{ margin: 0 }}>
              <span style={{ fontWeight: 600, color: '#003b70', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} color="#0284c7" /> Ngày đo
              </span>
              <input
                aria-label="Ngày đo"
                type="date"
                value={measurementDate}
                onChange={(event) => setMeasurementDate(event.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  marginTop: '4px',
                  background: '#ffffff',
                }}
              />
            </label>
          </div>

          {/* Upload Dropzone Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: 600, color: '#003b70', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileImage size={16} color="#0284c7" /> Ảnh hoặc File PDF phiếu InBody <strong style={{ color: '#e11d48' }}>*</strong>
            </span>

            {!image ? (
              <label
                htmlFor={fileInputId}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    setImage(file);
                    setImageError('');
                  }
                }}
                style={{
                  border: isDragging ? '2px dashed #0284c7' : '2px dashed #cbd5e1',
                  background: isDragging ? '#eff6ff' : '#f8fafc',
                  borderRadius: '14px',
                  padding: '36px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isDragging) {
                    e.currentTarget.style.borderColor = '#0284c7';
                    e.currentTarget.style.background = '#f0f9ff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDragging) {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.background = '#f8fafc';
                  }
                }}
              >
                <input
                  id={fileInputId}
                  aria-label="Ảnh hoặc file PDF phiếu InBody"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => {
                    setImage(event.target.files?.[0] ?? null);
                    setImageError('');
                  }}
                  style={{ display: 'none' }}
                />

                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: isDragging ? '#dbeafe' : '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.15)',
                  }}
                >
                  <UploadCloud size={28} />
                </div>

                <strong style={{ fontSize: '0.96rem', color: '#0f172a', marginBottom: '4px' }}>
                  Kéo thả ảnh hoặc file PDF phiếu InBody vào đây hoặc duyệt từ thiết bị
                </strong>
                <span style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '14px', maxWidth: '440px' }}>
                  Hỗ trợ định dạng JPG, PNG, WebP hoặc PDF xuất từ máy đo. Tài liệu rõ nét sẽ cho kết quả nhận diện chính xác nhất.
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 16px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#003b70',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <ImageIcon size={15} color="#0284c7" /> Chọn ảnh hoặc PDF
                </span>
              </label>
            ) : (
              <div
                style={{
                  border: isPdf ? '1px solid #fecaca' : '1px solid #bbf7d0',
                  background: isPdf ? '#fef2f2' : '#f0fdf4',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <input
                  id={fileInputId}
                  aria-label="Ảnh hoặc file PDF phiếu InBody"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => {
                    setImage(event.target.files?.[0] ?? null);
                    setImageError('');
                  }}
                  style={{ display: 'none' }}
                />

                {/* Left: Thumbnail & Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '240px' }}>
                  {isPdf ? (
                    <div
                      style={{
                        width: '58px',
                        height: '58px',
                        borderRadius: '8px',
                        background: '#fee2e2',
                        border: '1px solid #fca5a5',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#dc2626',
                        gap: '2px',
                      }}
                    >
                      <FileText size={24} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>PDF</span>
                    </div>
                  ) : previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Phiếu InBody preview"
                      style={{
                        width: '58px',
                        height: '58px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '1px solid #86efac',
                        background: '#ffffff',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '58px',
                        height: '58px',
                        borderRadius: '8px',
                        background: '#dcfce7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#15803d',
                      }}
                    >
                      <ImageIcon size={26} />
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} color={isPdf ? '#dc2626' : '#16a34a'} />
                      <strong style={{ color: isPdf ? '#991b1b' : '#14532d', fontSize: '0.92rem' }}>{image.name}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.8rem', color: isPdf ? '#b91c1c' : '#15803d' }}>
                      <span>{formatFileSize(image.size)}</span>
                      <span>•</span>
                      <span style={{ fontWeight: 600 }}>Sẵn sàng quét chỉ số</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label
                    htmlFor={fileInputId}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#003b70',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Đổi tệp khác
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setImage(null);
                      setImageError('');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: '#fee2e2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} /> Xóa
                  </button>
                </div>
              </div>
            )}

            {imageError && (
              <span className="field-error" role="alert" style={{ color: '#e11d48', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                ⚠️ {imageError}
              </span>
            )}
          </div>

          {/* Feature Highlight Box */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.82rem',
              color: '#475569',
            }}
          >
            <Sparkles size={18} color="#0284c7" style={{ flexShrink: 0 }} />
            <span>
              Hệ thống sẽ tự động nhận diện các chỉ số: <strong>Cân nặng, % Mỡ, Khối lượng cơ, Mỡ nội tạng, BMI, BMR</strong> và cho phép PT kiểm tra, hiệu chỉnh trước khi lưu.
            </span>
          </div>
        </div>
      ) : (
        <InBodyReviewForm draft={draft} onConfirmed={handleConfirmed} />
      )}
    </FormModal>
  );
}

