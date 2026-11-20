import { useState } from 'react';
import { AlertCircle, CheckCircle2, XCircle, FileText, Check, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';

export interface Suggestion {
  _id: string;
  scenario?: string;
  requestType?: string;
  content: string;
  editedContent?: string;
  reviewStatus: 'PT_REVIEW_REQUIRED' | 'APPROVED' | 'REJECTED';
  appliedAt: string | null;
  citations: Array<{ documentId: string; title: string }>;
  safetyWarnings: string[];
  createdAt?: string;
}

export default function SuggestionReview({
  initial,
  onUpdated,
}: {
  initial: Suggestion;
  onUpdated?: (updated: Suggestion) => void;
}) {
  const toast = useToast();
  const [item, setItem] = useState<Suggestion>(initial);
  const [edited, setEdited] = useState(item.editedContent || item.content);
  const [loading, setLoading] = useState(false);

  const review = async (approve: boolean) => {
    try {
      setLoading(true);
      await api.patch(
        `/api/assistant/suggestions/${item._id}/${approve ? 'approve' : 'reject'}`,
        approve ? { editedContent: edited } : {}
      );
      const updated: Suggestion = {
        ...item,
        reviewStatus: approve ? 'APPROVED' : 'REJECTED',
        ...(approve ? { editedContent: edited } : {}),
      };
      setItem(updated);
      onUpdated?.(updated);
      toast.success(approve ? 'Đã phê duyệt đề xuất!' : 'Đã từ chối đề xuất!');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    try {
      setLoading(true);
      await api.patch(`/api/assistant/suggestions/${item._id}/apply`, {});
      const updated: Suggestion = { ...item, appliedAt: new Date().toISOString() };
      setItem(updated);
      onUpdated?.(updated);
      toast.success('Đã đánh dấu sử dụng đề xuất!');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = {
    PT_REVIEW_REQUIRED: {
      label: 'PT_REVIEW_REQUIRED',
      text: 'Chờ PT duyệt',
      bg: '#fef3c7',
      color: '#b45309',
      icon: AlertCircle,
    },
    APPROVED: {
      label: 'APPROVED',
      text: 'Đã phê duyệt',
      bg: '#dcfce7',
      color: '#15803d',
      icon: CheckCircle2,
    },
    REJECTED: {
      label: 'REJECTED',
      text: 'Đã từ chối',
      bg: '#fee2e2',
      color: '#b91c1c',
      icon: XCircle,
    },
  }[item.reviewStatus];

  const StatusIcon = statusBadge.icon;

  return (
    <article
      className="panel"
      style={{
        padding: '18px 20px',
        borderRadius: '12px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 10px rgba(0, 59, 112, 0.05)',
        marginBottom: '16px',
      }}
    >
      {/* Header: Title & Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '14px',
          paddingBottom: '12px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: statusBadge.bg,
                color: statusBadge.color,
              }}
            >
              <StatusIcon size={14} />
              <strong>{item.reviewStatus}</strong> ({statusBadge.text})
            </span>
            {item.appliedAt && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: '#e0f2fe',
                  color: '#0369a1',
                }}
              >
                <Check size={12} /> Đã áp dụng
              </span>
            )}
          </div>
          {item.scenario && (
            <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#475569', fontWeight: 500 }}>
              <span style={{ color: '#003b70', fontWeight: 650 }}>Tình huống:</span> {item.scenario}
            </p>
          )}
        </div>
      </div>

      {/* Safety Warnings */}
      {item.safetyWarnings && item.safetyWarnings.length > 0 && (
        <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {item.safetyWarnings.map((warning) => (
            <div
              key={warning}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: '#fffbeb',
                borderLeft: '4px solid #f59e0b',
                borderRadius: '0 6px 6px 0',
                fontSize: '0.8rem',
                color: '#92400e',
              }}
            >
              <ShieldAlert size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
              <p role="alert" style={{ margin: 0, fontWeight: 500 }}>
                {warning}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Editable Content */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 650, color: '#334155', marginBottom: '6px' }}>
          Nội dung đề xuất chuyên môn:
        </label>
        <textarea
          aria-label="Nội dung đề xuất"
          rows={4}
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
          disabled={item.reviewStatus !== 'PT_REVIEW_REQUIRED' || loading}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.88rem',
            lineHeight: 1.5,
            color: '#1e293b',
            background: item.reviewStatus === 'PT_REVIEW_REQUIRED' ? '#ffffff' : '#f8fafc',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Citations */}
      {item.citations && item.citations.length > 0 && (
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Tài liệu tham khảo:</span>
          {item.citations.map((citation) => (
            <span
              key={citation.documentId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                fontSize: '0.76rem',
                color: '#475569',
                fontWeight: 500,
              }}
            >
              <FileText size={12} />
              {citation.title}
            </span>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div
        className="inline-actions"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '10px',
          paddingTop: '12px',
          borderTop: '1px solid #f1f5f9',
        }}
      >
        <button
          type="button"
          className="button button-danger"
          onClick={() => void review(false)}
          disabled={item.reviewStatus !== 'PT_REVIEW_REQUIRED' || loading}
          style={{
            padding: '8px 16px',
            fontSize: '0.82rem',
            borderRadius: '6px',
            fontWeight: 600,
          }}
        >
          Từ chối
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => void review(true)}
          disabled={item.reviewStatus !== 'PT_REVIEW_REQUIRED' || loading}
          style={{
            padding: '8px 18px',
            fontSize: '0.82rem',
            borderRadius: '6px',
            fontWeight: 700,
            background: '#10b981',
            color: '#ffffff',
            borderColor: '#059669',
          }}
        >
          Phê duyệt
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={() => void apply()}
          disabled={item.reviewStatus !== 'APPROVED' || Boolean(item.appliedAt) || loading}
          style={{
            padding: '8px 18px',
            fontSize: '0.82rem',
            borderRadius: '6px',
            fontWeight: 700,
          }}
        >
          Đánh dấu đã sử dụng
        </button>
      </div>
    </article>
  );
}
