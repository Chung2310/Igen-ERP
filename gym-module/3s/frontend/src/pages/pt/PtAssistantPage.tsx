import { useCallback, useEffect, useState, useRef, type FormEvent } from 'react';
import {
  Bot,
  Send,
  User,
  RefreshCw,
  Plus,
  History,
  MessageSquare,
  Clock,
  X,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../components/ui/ToastProvider';
import CustomerSelect from '../../components/ui/CustomerSelect';
import { useMobile } from '../../hooks/useMobile';
import { errorMessage } from '../../types';

import { getSession } from '../../services/session';

export interface AssistantMessage {
  role: string;
  content: string;
  suggestionId?: string;
  citations?: Array<{ documentId: string; title: string }>;
  reviewStatus?: string;
  createdAt?: string;
}

export interface Conversation {
  _id: string;
  title: string;
  customerId?: string;
  updatedAt?: string;
  createdAt?: string;
  messages?: AssistantMessage[];
}

export default function PtAssistantPage() {
  const toast = useToast();
  const isMobile = useMobile(768);
  const session = getSession();
  const isCustomer = session?.user?.role === 'CUSTOMER';

  // === STATE ===
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showCustomerPicker, setShowCustomerPicker] = useState<boolean>(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);

  // Input & Chat State
  const [promptInput, setPromptInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, generating]);

  // === DATA FETCHING ===
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const c = await api.get<Conversation[]>('/api/assistant/conversations?page=1&limit=30');
      setConversations(c.data || []);

      if (c.data && c.data.length > 0 && !activeConversation) {
        setActiveConversation(c.data[0]);
      }
    } catch {
      // Bắt lỗi êm ái khi network tải ban đầu
    } finally {
      setLoading(false);
    }
  }, [activeConversation]);

  useEffect(() => {
    void load();
  }, []);

  // === HANDLERS ===
  const handleStartNewChat = () => {
    setActiveConversation(null);
    setPromptInput('');
    setShowHistoryDrawer(false);
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setShowHistoryDrawer(false);
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = promptInput.trim();
    if (!textToSend || generating) return;

    setPromptInput('');
    setGenerating(true);

    // Optimistic UI Update
    const userMsg: AssistantMessage = {
      role: 'USER',
      content: textToSend,
      createdAt: new Date().toISOString(),
    };

    if (activeConversation) {
      setActiveConversation({
        ...activeConversation,
        messages: [...(activeConversation.messages || []), userMsg],
      });
    }

    try {
      if (activeConversation?._id) {
        const result = await api.post<Conversation>(
          `/api/assistant/conversations/${activeConversation._id}/messages`,
          {
            content: textToSend,
            requestType: 'GENERAL',
          }
        );
        setActiveConversation(result.data);
        setConversations((prev) =>
          prev.map((c) => (c._id === result.data._id ? result.data : c))
        );
      } else {
        const title = textToSend.length > 35 ? textToSend.slice(0, 35) + '...' : textToSend;
        const newConv = await api.post<Conversation>('/api/assistant/conversations', {
          customerId: isCustomer ? undefined : (selectedCustomerId || undefined),
          title,
        });

        const withMsg = await api.post<Conversation>(
          `/api/assistant/conversations/${newConv.data._id}/messages`,
          {
            content: textToSend,
            requestType: 'GENERAL',
          }
        );

        setActiveConversation(withMsg.data);
        setConversations((prev) => [withMsg.data, ...prev]);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? '4px 0 8px' : '0 4px',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 130px)',
        minHeight: '460px',
        overflow: 'hidden',
        overflowX: 'hidden',
      }}
    >
      {/* 1. Header Tối Giản & Gọn Gàng */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: isMobile ? '6px' : '10px',
          padding: isMobile ? '0 2px' : '0',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #003b70 0%, #00a4e4 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bot size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: isMobile ? '0.98rem' : '1.15rem',
                fontWeight: 750,
                color: '#003b70',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {isCustomer ? 'Trợ lý AI 3S' : 'Trợ lý PT 3S'}
            </h1>
          </div>
        </div>

        {/* Nút Thao Tác Gọn */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowHistoryDrawer(true)}
            title="Lịch sử các phiên chat"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              height: '32px',
              padding: '0 8px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: 650,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#003b70',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <History size={14} color="#003b70" />
            <span style={{ fontSize: '0.74rem' }}>{conversations.length}</span>
          </button>

          <button
            type="button"
            onClick={handleStartNewChat}
            title="Cuộc trò chuyện mới"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              height: '32px',
              padding: isMobile ? '0 8px' : '0 12px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: 650,
              background: '#003b70',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={14} />
            <span>Chat mới</span>
          </button>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title="Làm mới"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} color="#003b70" />
          </button>
        </div>
      </div>

      {/* 2. KHUNG CHAT TOÀN DIỆN (SẠCH SẼ, KHÔNG SCROLL NGANG, Ô NHẬP CỐ ĐỊNH Ở ĐÁY) */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: isMobile ? '10px' : '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(0, 59, 112, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Header Phụ Khung Chat: Tiêu đề & Nút liên kết học viên (chỉ hiện cho PT) */}
        <div
          style={{
            padding: isMobile ? '6px 10px' : '8px 16px',
            background: '#f8fafc',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: isMobile ? '0.76rem' : '0.82rem',
              color: '#003b70',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
            }}
          >
            {activeConversation?.title || 'Đoạn chat mới'}
          </span>

          {!isCustomer && (
            <button
              type="button"
              onClick={() => setShowCustomerPicker(!showCustomerPicker)}
              style={{
                background: selectedCustomerId ? '#e0f2fe' : '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '2px 8px',
                cursor: 'pointer',
                color: selectedCustomerId ? '#0284c7' : '#64748b',
                fontSize: '0.72rem',
                fontWeight: 650,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              <User size={11} />
              {selectedCustomerId ? 'Đã liên kết' : '+ Học viên'}
            </button>
          )}
        </div>

        {/* Picker học viên nếu mở (dành cho PT) */}
        {!isCustomer && showCustomerPicker && (
          <div style={{ padding: '8px 14px', background: '#f0f9ff', borderBottom: '1px solid #e0f2fe', flexShrink: 0 }}>
            <CustomerSelect
              label=""
              name="chatCustomer"
              value={selectedCustomerId}
              onChange={(id) => {
                setSelectedCustomerId(id);
                if (id) setShowCustomerPicker(false);
              }}
              placeholder="Tìm và chọn học viên..."
            />
          </div>
        )}

        {/* VÙNG TIN NHẮN (TỰ CUỘN DỌC, KHÔNG BAO GIỜ BỊ SCROLL NGANG) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: isMobile ? '12px 10px' : '16px 18px',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? '10px' : '14px',
          }}
        >
          {activeConversation?.messages && activeConversation.messages.length > 0 ? (
            activeConversation.messages.map((msg, index) => {
              const isUser = msg.role === 'USER';
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    gap: '3px',
                    width: '100%',
                  }}
                >
                  {/* Nhãn người gửi */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.68rem',
                      color: '#94a3b8',
                      fontWeight: 650,
                      paddingLeft: isUser ? 0 : '2px',
                      paddingRight: isUser ? '2px' : 0,
                    }}
                  >
                    {isUser ? (
                      <>
                        <span>Bạn</span>
                        <User size={11} />
                      </>
                    ) : (
                      <>
                        <Bot size={11} color="#003b70" />
                        <span style={{ color: '#003b70' }}>Trợ lý AI 3S-Gym</span>
                      </>
                    )}
                  </div>

                  {/* Bong bóng tin nhắn */}
                  <div
                    style={{
                      maxWidth: isMobile ? (isUser ? '86%' : '94%') : '85%',
                      padding: isMobile ? '9px 13px' : '12px 16px',
                      borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      background: isUser ? '#003b70' : '#f8fafc',
                      color: isUser ? '#ffffff' : '#1e293b',
                      fontSize: isMobile ? '0.84rem' : '0.88rem',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      border: isUser ? 'none' : '1px solid #e2e8f0',
                      boxShadow: isUser
                        ? '0 1px 4px rgba(0, 59, 112, 0.15)'
                        : '0 1px 3px rgba(0, 0, 0, 0.02)',
                    }}
                  >
                    {msg.content}

                    {/* Hiển thị nguồn tri thức RAG nếu có trích dẫn */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div
                        style={{
                          marginTop: '8px',
                          paddingTop: '6px',
                          borderTop: '1px solid #e2e8f0',
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          color: '#64748b',
                        }}
                      >
                        <span style={{ fontWeight: 650, color: '#0369a1' }}>📚 Nguồn tài liệu:</span>
                        {msg.citations.map((c, cIdx) => (
                          <span
                            key={cIdx}
                            style={{
                              background: '#e0f2fe',
                              color: '#0369a1',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                            title={`ID: ${c.documentId}`}
                          >
                            {c.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            /* Màn Hình Chào Mừng Siêu Tinh Gọn Kèm Gợi Ý 1 Chạm */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 'auto 0',
                padding: '24px 12px',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '10px',
                }}
              >
                <Bot size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: isMobile ? '0.96rem' : '1.1rem', fontWeight: 750, color: '#003b70' }}>
                {isCustomer ? 'Xin chào bạn!' : 'Chào Huấn luyện viên!'}
              </h3>
              <p style={{ margin: '4px 0 14px', maxWidth: '420px', fontSize: '0.8rem', lineHeight: 1.45 }}>
                {isCustomer
                  ? 'Tôi có thể hỗ trợ bạn lên thực đơn, cách tập, giải đáp chỉ số InBody và mọi thắc mắc về vóc dáng.'
                  : 'Trợ lý AI am hiểu sâu sắc cơ sinh học, giáo án tập luyện, dinh dưỡng và giải đáp chuyên môn.'}
              </p>

              {/* Quick Suggestion Chips */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: '6px',
                  maxWidth: '540px',
                }}
              >
                {[
                  { label: '🔥 Thực đơn giảm mỡ an toàn', prompt: 'Tôi muốn giảm mỡ an toàn, bạn gợi ý thực đơn món ăn Việt Nam cho 1 ngày nhé' },
                  { label: '💪 Lịch tập 4 buổi tăng cơ', prompt: 'Gợi ý lịch tập 4 buổi mỗi tuần để tăng cơ săn chắc toàn thân' },
                  { label: '📊 Phân tích chỉ số InBody', prompt: 'Dựa trên chỉ số InBody của tôi, tôi nên tập luyện và ăn uống thế nào?' },
                  { label: '🧘 Chỉnh lỗi đau lưng khi Squat', prompt: 'Nguyên nhân và cách khắc phục tình trạng đau mỏi thắt lưng khi tập Squat' },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPromptInput(chip.prompt);
                    }}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '20px',
                      padding: '5px 12px',
                      fontSize: '0.74rem',
                      color: '#003b70',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {generating && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#0284c7',
                fontSize: '0.78rem',
                fontStyle: 'italic',
                padding: '4px 8px',
                background: '#f0f9ff',
                borderRadius: '6px',
                width: 'fit-content',
              }}
            >
              <Sparkles size={13} className="animate-spin" /> Trợ lý AI đang suy nghĩ...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Ô NHẬP TIN NHẮN (CỐ ĐỊNH Ở ĐÁY KHUNG CHAT) */}
        <form
          onSubmit={handleSendMessage}
          style={{
            padding: isMobile ? '8px 10px' : '10px 16px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <textarea
            placeholder="Nhập câu hỏi hoặc tình huống cần hỗ trợ (Nhấn Enter để gửi)..."
            rows={1}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSendMessage();
              }
            }}
            disabled={generating}
            style={{
              flex: 1,
              padding: isMobile ? '8px 10px' : '9px 12px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: isMobile ? '0.84rem' : '0.88rem',
              lineHeight: 1.4,
              resize: 'none',
              fontFamily: 'inherit',
              color: '#1e293b',
              outline: 'none',
              maxHeight: '80px',
            }}
          />

          <button
            type="submit"
            className="button button-primary"
            disabled={generating || !promptInput.trim()}
            style={{
              padding: isMobile ? '8px 12px' : '9px 16px',
              borderRadius: '8px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              flexShrink: 0,
              background: '#003b70',
              height: '36px',
            }}
          >
            <Send size={14} />
            {!isMobile && <span>Gửi</span>}
          </button>
        </form>
      </div>

      {/* DRAWER POPUP LỊCH SỬ CÁC PHIÊN CHAT */}
      {showHistoryDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setShowHistoryDrawer(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: isMobile ? '300px' : '340px',
              height: '100%',
              background: '#ffffff',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              padding: isMobile ? '16px' : '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={16} color="#003b70" />
                <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#003b70' }}>
                  Lịch sử các phiên chat
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <button
              type="button"
              className="button button-primary"
              onClick={handleStartNewChat}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 12px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.82rem',
                background: '#003b70',
                marginBottom: '12px',
              }}
            >
              <Plus size={14} /> Bắt đầu cuộc trò chuyện mới
            </button>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {conversations.length === 0 ? (
                <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                  Chưa có lịch sử cuộc trò chuyện nào.
                </div>
              ) : (
                conversations.map((conv) => {
                  const isActive = activeConversation?._id === conv._id;
                  return (
                    <button
                      key={conv._id}
                      type="button"
                      onClick={() => handleSelectConversation(conv)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: isActive ? '1.5px solid #003b70' : '1px solid #f1f5f9',
                        background: isActive ? '#f0f7ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <MessageSquare
                        size={14}
                        color={isActive ? '#003b70' : '#94a3b8'}
                        style={{ marginTop: '2px', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: isActive ? 700 : 550,
                            color: isActive ? '#003b70' : '#1e293b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {conv.title || 'Đoạn chat chưa đặt tên'}
                        </div>
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: '#94a3b8',
                            marginTop: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Clock size={10} />
                          {conv.updatedAt
                            ? new Date(conv.updatedAt).toLocaleDateString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit',
                              })
                            : 'Vừa xong'}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
