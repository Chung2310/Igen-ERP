import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Phone,
  Sparkles,
  X,
} from 'lucide-react';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import { errorMessage } from '../../types';
import type { CustomerGoalData, InBodyRecordData } from '../../types/inbody';
import { analyzeInBody } from '../../services/inbodyAnalytics';
import InBodyDetailView from './InBodyDetailView';

interface InBodyDetailModalProps {
  open: boolean;
  record: InBodyRecordData | null;
  previousRecord?: InBodyRecordData | null;
  historyRecords?: InBodyRecordData[];
  customerMeta?: { fullName?: string; gender?: string; height?: number; phone?: string };
  onClose: () => void;
  onEdit?: (record: InBodyRecordData) => void;
  onStatusChanged?: (updated: InBodyRecordData) => void;
}

export default function InBodyDetailModal({
  open,
  record,
  previousRecord,
  historyRecords,
  customerMeta,
  onClose,
  onEdit,
  onStatusChanged,
}: InBodyDetailModalProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [customerGoal, setCustomerGoal] = useState<CustomerGoalData | null>(null);

  useEffect(() => {
    if (!open || !record) {
      setCustomerGoal(null);
      return;
    }
    const cId =
      typeof record.customerId === 'object' && record.customerId !== null
        ? record.customerId._id
        : String(record.customerId || '');
    if (!cId) return;

    api
      .get<CustomerGoalData[]>(`/api/goals?customerId=${cId}&limit=1`)
      .then((res) => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setCustomerGoal(res.data[0]);
        } else {
          setCustomerGoal(null);
        }
      })
      .catch(() => setCustomerGoal(null));
  }, [open, record]);

  const analysis = useMemo(() => {
    if (!record) return null;
    return analyzeInBody(record, previousRecord, customerMeta, customerGoal);
  }, [record, previousRecord, customerMeta, customerGoal]);

  if (!open || !record || !analysis) return null;

  const customerName =
    customerMeta?.fullName ||
    (typeof record.customerId === 'object' && record.customerId?.fullName) ||
    'Học viên';
  const customerPhone =
    customerMeta?.phone ||
    (typeof record.customerId === 'object' && record.customerId?.phone) ||
    '';
  const isPublished = record.status === 'PUBLISHED';

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(analysis.quickMessage);
      setCopied(true);
      toast.success('Đã sao chép kịch bản tư vấn InBody vào clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Không thể sao chép tự động. Vui lòng chọn và sao chép thủ công.');
    }
  };

  const handleTogglePublish = async () => {
    setToggling(true);
    const isPublishing = record.status !== 'PUBLISHED';
    try {
      const endpoint = isPublishing ? `/api/inbody/${record._id}/publish` : `/api/inbody/${record._id}/unpublish`;
      const res = await api.patch<InBodyRecordData>(endpoint, {});
      toast.success(res.message || (isPublishing ? 'Đã công bố InBody cho học viên!' : 'Đã chuyển về bản nháp!'));
      const updated: InBodyRecordData = {
        ...record,
        status: isPublishing ? 'PUBLISHED' : 'DRAFT',
        publishedAt: isPublishing ? new Date().toISOString() : null,
      };
      onStatusChanged?.(updated);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10050] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-primary to-sky-700 p-3 sm:px-5 sm:py-3.5 text-white flex justify-between items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                title={customerName}
                className="m-0 text-base sm:text-xl font-bold text-white leading-tight max-w-[280px] sm:max-w-md truncate"
              >
                {customerName}
              </h2>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-semibold text-sky-100 inline-flex items-center gap-1 shrink-0">
                <Sparkles className="w-3 h-3" /> Phân Tích InBody & Tư Vấn PT
              </span>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 text-xs text-sky-200 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Ngày đo: {new Date(record.measurementDate).toLocaleDateString('vi-VN')}
              </span>
              {customerPhone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {customerPhone}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyMessage}
              className={`border border-white/30 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                copied ? 'bg-emerald-600' : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Sao chép kịch bản tư vấn nhanh"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Đã chép' : 'Sao chép tư vấn'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer transition-colors text-white"
              title="Đóng cửa sổ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3 sm:p-5 sm:px-6 overflow-y-auto">
          <InBodyDetailView
            record={record}
            previousRecord={previousRecord}
            historyRecords={historyRecords}
            customerMeta={customerMeta}
            customerGoal={customerGoal}
          />
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-white border-t border-slate-200 p-3 sm:px-6 sm:py-3.5 flex justify-between items-center flex-wrap gap-2.5">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onEdit && (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  onClose();
                  onEdit(record);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Pencil size={15} /> Sửa chỉ số
              </button>
            )}

            <button
              type="button"
              className={isPublished ? 'button button-secondary' : 'button button-primary'}
              onClick={handleTogglePublish}
              disabled={toggling}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {isPublished ? <EyeOff size={15} /> : <Eye size={15} />}
              {toggling ? 'Đang cập nhật...' : isPublished ? 'Thu hồi về bản nháp' : 'Công bố cho học viên'}
            </button>
          </div>

          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            style={{ padding: '8px 18px', fontWeight: 600 }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
