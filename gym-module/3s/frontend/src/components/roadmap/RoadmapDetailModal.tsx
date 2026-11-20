import {
  Edit3,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import RoadmapDetailView from './RoadmapDetailView';
import type { Roadmap, Customer } from '../../types';

interface RoadmapDetailModalProps {
  open: boolean;
  roadmap: Roadmap | null;
  customer?: Customer | null;
  onClose: () => void;
  onEdit?: (roadmap: Roadmap) => void;
  onTogglePublish?: (roadmap: Roadmap) => void;
}

export default function RoadmapDetailModal({
  open,
  roadmap,
  customer,
  onClose,
  onEdit,
  onTogglePublish,
}: RoadmapDetailModalProps) {
  if (!open || !roadmap) return null;

  const customerName = customer?.fullName || 'Học viên';
  const customerPhone = customer?.phone || '';

  return (
    <div
      className="modal-backdrop fixed inset-0 z-9999 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-slate-900/65 backdrop-blur-xs"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="roadmap-detail-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[920px] max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="px-3.5 py-3 sm:px-6 sm:py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white shrink-0">
              <Sparkles className="w-5 h-5 text-sky-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={roadmap.status} />
                <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1">
                  <User className="w-3 h-3 text-emerald-600" /> {customerName} {customerPhone ? `(${customerPhone})` : ''}
                </span>
              </div>
              <h2
                id="roadmap-detail-title"
                className="m-0 mt-1 text-base sm:text-lg font-extrabold text-primary break-words"
              >
                {roadmap.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="icon-button bg-white hover:bg-slate-100 border border-slate-300 rounded-lg p-1.5 cursor-pointer text-slate-500 shrink-0 transition-colors"
            onClick={onClose}
            aria-label="Đóng modal chi tiết"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3 sm:p-5 sm:px-6 overflow-y-auto">
          <RoadmapDetailView roadmap={roadmap} />
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:px-6 sm:py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            className="button button-secondary text-xs sm:text-sm"
            onClick={onClose}
          >
            Đóng
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {onTogglePublish && (
              <button
                type="button"
                className={`button ${roadmap.status === 'PUBLISHED' ? 'button-secondary' : 'button-primary'} text-xs sm:text-sm`}
                onClick={() => onTogglePublish(roadmap)}
              >
                {roadmap.status === 'PUBLISHED' ? 'Gỡ công bố' : 'Công bố roadmap'}
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                className="button button-secondary text-xs sm:text-sm flex items-center gap-1.5"
                onClick={() => onEdit(roadmap)}
              >
                <Edit3 className="w-3.5 h-3.5" /> Chỉnh sửa
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
