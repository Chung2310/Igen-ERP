import { MessageSquare, Plus, Clock, User } from 'lucide-react';

export interface Conversation {
  _id: string;
  title: string;
  customerId?: string;
  updatedAt?: string;
  messages?: Array<{
    role: string;
    content: string;
    suggestionId?: string;
    citations?: Array<{ documentId: string; title: string }>;
    reviewStatus?: string;
    createdAt?: string;
  }>;
}

interface ConversationListProps {
  items: Conversation[];
  activeId?: string;
  onSelect: (item: Conversation) => void;
  onNew?: () => void;
}

export default function ConversationList({
  items,
  activeId,
  onSelect,
  onNew,
}: ConversationListProps) {
  return (
    <div
      className="panel"
      style={{
        padding: '16px',
        borderRadius: '12px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0, 59, 112, 0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          paddingBottom: '10px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color="#003b70" />
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#003b70' }}>
            Hội thoại gần đây
          </h2>
        </div>
        {onNew && (
          <button
            type="button"
            className="button button-secondary"
            onClick={onNew}
            style={{
              padding: '6px 10px',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '6px',
            }}
          >
            <Plus size={14} /> Mới
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: '24px 12px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '0.84rem',
          }}
        >
          <MessageSquare size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
          <p style={{ margin: 0 }}>Chưa có hội thoại nào.</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
            Hãy chọn một kịch bản hoặc gửi tin nhắn để bắt đầu!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
          {items.map((item) => {
            const isActive = item._id === activeId;
            const messageCount = item.messages?.length || 0;
            const formattedDate = item.updatedAt
              ? new Date(item.updatedAt).toLocaleDateString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                })
              : '';

            return (
              <button
                key={item._id}
                type="button"
                className="published-card"
                onClick={() => onSelect(item)}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: isActive ? '1.5px solid #003b70' : '1px solid #e2e8f0',
                  background: isActive ? '#f0f9ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span
                    style={{
                      fontWeight: isActive ? 700 : 600,
                      color: isActive ? '#003b70' : '#1e293b',
                      fontSize: '0.86rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {item.title}
                  </span>
                  {messageCount > 0 && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        background: isActive ? '#0284c7' : '#e2e8f0',
                        color: isActive ? '#ffffff' : '#64748b',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 600,
                      }}
                    >
                      {messageCount}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: '#94a3b8',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <User size={12} /> PT Assistant
                  </span>
                  {formattedDate && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={11} /> {formattedDate}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
