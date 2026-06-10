import React, { useRef, useEffect, useState } from "react";
import { Search, Send, Sliders, Zap, FileText, DollarSign, MessageSquare, ChevronDown, Facebook, Clock3 } from "lucide-react";
import { CustomerInbox, ChatMessage, AIChatConfig, ChatPagination } from "../../types";

type OmniChatTabProps = {
  inboxCustomers: CustomerInbox[];
  activeCustomer: CustomerInbox | null;
  chatHistory: ChatMessage[];
  chatPagination: ChatPagination;
  typeMessage: string;
  setTypeMessage: (val: string) => void;
  aiWaiting: boolean;
  aiConfig: AIChatConfig;
  setAIConfig: (config: AIChatConfig) => void;
  handleSelectCustomer: (cust: CustomerInbox) => void;
  handleSendChatMessage: (e: React.FormEvent) => void;
  handleLoadOlderMessages: () => void;
};

export const OmniChatTab: React.FC<OmniChatTabProps> = ({
  inboxCustomers,
  activeCustomer,
  chatHistory,
  chatPagination,
  typeMessage,
  setTypeMessage,
  aiWaiting,
  aiConfig,
  setAIConfig,
  handleSelectCustomer,
  handleSendChatMessage,
  handleLoadOlderMessages,
}) => {
  const [filterInbox, setFilterInbox] = useState("");
  const [activeChannel, setActiveChannel] = useState<"all" | "facebook" | "zalo">("all");
  const [showConfig, setShowConfig] = useState(false);
  const chatStreamRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const previousFirstMessageIdRef = useRef<string | null>(null);

  // Chỉ auto-scroll khi đang ở gần cuối khung chat và có tin nhắn mới ở cuối.
  useEffect(() => {
    const container = chatStreamRef.current;
    if (!container) return;

    const previousCount = previousMessageCountRef.current;
    const currentCount = chatHistory.length;
    const previousFirstId = previousFirstMessageIdRef.current;
    const currentFirstId = chatHistory[0]?.id || null;
    const prependedOlderMessages = previousFirstId !== null && currentFirstId !== null && previousFirstId !== currentFirstId;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;

    if (prependedOlderMessages) {
      previousMessageCountRef.current = currentCount;
      previousFirstMessageIdRef.current = currentFirstId;
      return;
    }

    if (currentCount > previousCount && isNearBottom) {
      chatBottomRef.current?.scrollIntoView({ behavior: previousCount === 0 ? "auto" : "smooth" });
    }

    previousMessageCountRef.current = currentCount;
    previousFirstMessageIdRef.current = currentFirstId;
  }, [chatHistory]);

  useEffect(() => {
    if (!aiWaiting) return;
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiWaiting]);

  // Bộ đếm hội thoại theo từng kênh
  const counts = {
    all: inboxCustomers.length,
    facebook: inboxCustomers.filter((c) => c.channel === "facebook").length,
    zalo: inboxCustomers.filter((c) => c.channel === "zalo").length,
  };

  const renderCustomerAvatar = (customer: CustomerInbox, sizeClass: string) => {
    const hasImage = typeof customer.avatarUrl === "string" && customer.avatarUrl.startsWith("http");
    const initials = customer.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "FB";

    if (hasImage) {
      return (
        <img
          src={customer.avatarUrl}
          alt={customer.name}
          className={`${sizeClass} rounded-full object-cover`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      );
    }

    return (
      <span className={`${sizeClass} rounded-full bg-gradient-to-br from-sky-100 to-blue-200 text-sky-800 flex items-center justify-center font-extrabold text-[11px]`}>
        {initials}
      </span>
    );
  };

  return (
      <div className="flex h-full overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f4f7fb_100%)]" id="omni_inbox_layout">
      
      {/* L-Col: Inbox Customers list */}
      <div className="w-80 border-r border-slate-100 bg-white flex flex-col justify-between shrink-0 h-full shadow-sm" id="inbox_sidebar">
        
        {/* Search & Channel Filters Group */}
        <div className="flex flex-col gap-3 p-4 border-b border-slate-100 shrink-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <input 
              type="text" 
              placeholder="Tìm tên khách hàng..." 
              value={filterInbox}
              onChange={(e) => setFilterInbox(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-slate-50/60 focus:bg-white rounded-xl text-xs outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
              id="inbox_sidebar_search"
            />
          </div>

          {/* Premium Channel Segmented Controls */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-bold" id="inbox_channel_filters">
            {[
              { id: "all", label: "Tất cả", count: counts.all },
              { id: "facebook", label: "Facebook", count: counts.facebook },
              { id: "zalo", label: "Zalo", count: counts.zalo },
            ].map((btn) => {
              const isActive = activeChannel === btn.id;
              return (
                <button
                  key={btn.id}
                  onClick={() => setActiveChannel(btn.id as any)}
                  className={`flex-1 py-2 px-1 rounded-lg font-bold transition-all duration-250 cursor-pointer flex items-center justify-center gap-1.5 ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200/20"
                      : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
                  }`}
                >
                  {btn.id === "facebook" && (
                    <svg className="h-3 w-3 fill-current text-blue-600 shrink-0" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  )}
                  {btn.id === "zalo" && (
                    <span className="w-3.5 h-3.5 bg-blue-500 text-white text-[8px] font-extrabold rounded-full flex items-center justify-center leading-none shrink-0 font-sans shadow-xxs">Z</span>
                  )}
                  <span>{btn.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[8px] ${
                    isActive ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
                  }`}>{btn.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Thread list scroll content */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/60" id="inbox_thread_list">
          {inboxCustomers
            .filter((c) => {
              const matchesSearch = c.name.toLowerCase().includes(filterInbox.toLowerCase());
              const matchesChannel = activeChannel === "all" || c.channel === activeChannel;
              return matchesSearch && matchesChannel;
            })
            .map((cust) => {
              const isActive = activeCustomer?.id === cust.id;
              const hasHotTag = cust.tags.includes("Khách Nóng");
              
              return (
                <div 
                  key={cust.id} 
                  onClick={() => handleSelectCustomer(cust)}
                  className={`p-4 flex items-start gap-3.5 cursor-pointer transition-all duration-200 text-left relative ${
                    isActive ? "bg-slate-50 border-l-4 border-blue-600" : "hover:bg-slate-50/50"
                  }`}
                  id={`inbox_thread_${cust.id}`}
                >
                  {/* Avatar with dynamic channel source badge */}
                  <div className="p-1.5 bg-white border border-slate-100 rounded-full select-none relative shadow-sm shrink-0">
                    {renderCustomerAvatar(cust, "h-10 w-10")}
                    {/* Channel source badge in top-right */}
                    {cust.channel === "facebook" ? (
                      <span className="absolute -top-1.5 -right-1.5 p-0.5 bg-blue-600 text-white rounded-full border border-white shadow-sm flex items-center justify-center">
                        <svg className="h-2.5 w-2.5 fill-current" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </span>
                    ) : cust.channel === "zalo" ? (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 text-white text-[7px] font-extrabold rounded-full border border-white shadow-sm flex items-center justify-center leading-none font-sans">
                        Z
                      </span>
                    ) : null}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-800 truncate">{cust.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono">{cust.time}</span>
                    </div>
                    
                    <p className="text-[10px] text-slate-500 truncate mt-1 leading-normal select-none">{cust.lastMessage}</p>
                    <p className="text-[9px] text-slate-400 mt-1">Khách Facebook • PSID {cust.recipientId || cust.id}</p>
                    
                    <div className="flex flex-wrap items-center gap-1 mt-2.5">
                      {hasHotTag && (
                        <span className="animate-pulse px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-extrabold rounded-md shadow-sm flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping shrink-0" />
                          ƯU TIÊN GIỜ VÀNG
                        </span>
                      )}
                      {cust.tags.map((tag, tIdx) => {
                        if (tag === "Khách Nóng") return null;
                        return (
                          <span key={tIdx} className={`px-1.5 py-0.5 text-[8px] font-bold border rounded-md uppercase ${
                            tag === "Khách Ấm"
                              ? "bg-orange-50 text-orange-600 border-orange-100"
                              : tag === "Khách VIP"
                                ? "bg-purple-50 text-purple-600 border-purple-100"
                                : "bg-slate-55 bg-slate-50 text-slate-500 border-slate-150"
                          }`}>
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {cust.unreadCount > 0 && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-md animate-scale-in">
                      {cust.unreadCount}
                    </span>
                  )}
                </div>
              );
            })}

          {inboxCustomers.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              Chưa có cuộc hội thoại nào.
            </div>
          )}
        </div>
      </div>

      {/* M-Col: Active Conversation details */}
      <div className="flex-1 bg-[radial-gradient(circle_at_top,_rgba(191,219,254,0.22),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] flex flex-col justify-between h-full overflow-hidden" id="chat_conversation_area">
        {!activeCustomer ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-white">
            <MessageSquare className="w-12 h-12 text-slate-200 mb-3 animate-pulse" />
            <h4 className="font-extrabold text-slate-700 text-sm font-sans mb-1">Chưa chọn cuộc hội thoại</h4>
            <p className="text-[11px] text-slate-400 leading-normal max-w-xs font-sans">Vui lòng chọn một cuộc trò chuyện từ danh sách bên trái hoặc nhắn tin từ thẻ cơ hội bán hàng để bắt đầu.</p>
          </div>
        ) : (
          <>
            {/* Active Customer Info Top Header */}
            <div className="p-4 border-b border-slate-200/80 bg-white/90 backdrop-blur flex items-center justify-between shrink-0 shadow-sm" id="chat_header">
              <div className="flex items-center gap-3 text-left">
                <span className="p-1.5 bg-gradient-to-br from-white to-slate-100 border border-slate-200 rounded-full select-none shadow-sm">
                  {renderCustomerAvatar(activeCustomer, "h-11 w-11")}
                </span>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 font-sans">
                    {activeCustomer.name}
                    {activeCustomer.isVip && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-extrabold rounded-md shadow-sm">VIP</span>
                    )}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                    Khách Facebook • PSID: {activeCustomer.recipientId || activeCustomer.id}
                  </p>
                </div>
              </div>
              
              {/* Header Actions: Collapsible config and channel badge */}
              <div className="flex items-center gap-2">
                {/* Collapsible toggle button */}
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all border flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                    showConfig
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>{showConfig ? "Ẩn cấu hình AI" : "Cấu hình trợ lý AI"}</span>
                </button>

                {/* Source logo info */}
                <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold font-sans flex items-center gap-1.5 border shadow-sm ${
                  activeCustomer.channel === "facebook" 
                    ? "bg-blue-50 text-blue-700 border-blue-150" 
                    : "bg-indigo-50 text-indigo-700 border-indigo-150"
                }`}>
                  {activeCustomer.channel === "facebook" ? (
                    <>
                      <Facebook className="h-3 w-3" />
                      <span>FACEBOOK MESSENGER</span>
                    </>
                  ) : (
                    <>
                      <span className="w-3.5 h-3.5 bg-blue-500 text-white text-[8px] font-extrabold rounded-full flex items-center justify-center leading-none font-sans shrink-0">Z</span>
                      <span>ZALO INBOX</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Messages dialogue stream feed */}
            <div ref={chatStreamRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4" id="chat_messages_stream" style={{ maxHeight: "calc(85vh - 200px)" }}>
              <div className="sticky top-0 z-10 flex justify-center pb-2">
                {chatPagination.hasMore ? (
                  <button
                    type="button"
                    onClick={handleLoadOlderMessages}
                    disabled={chatPagination.loadingMore}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold shadow-sm backdrop-blur transition-all ${
                      chatPagination.loadingMore
                        ? "cursor-wait border-slate-200 bg-white/85 text-slate-400"
                        : "border-blue-200 bg-white/90 text-blue-700 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {chatPagination.loadingMore ? <Clock3 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5 rotate-180" />}
                    <span>{chatPagination.loadingMore ? "Đang tải cuộc trò chuyện cũ..." : "Tải cuộc trò chuyện cũ hơn"}</span>
                  </button>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold text-slate-400 shadow-sm">
                    Đang xem đoạn chat mới nhất
                  </span>
                )}
              </div>
              {chatHistory.map((h) => {
                const isMe = h.sender === "agent";
                const isAI = h.sender === "ai";
                const isSystem = h.text.includes("[AI AUTOMATION]");
                const attachments = h.attachments || [];
                const primaryAttachment = attachments[0];
                const hasImageAttachment = primaryAttachment?.url && ["image", "sticker"].includes(primaryAttachment.type);
                const displayText = h.text || (attachments.length > 0 ? (primaryAttachment?.type === "sticker" ? "[Biểu tượng]" : "[Đính kèm]") : "");
                
                return (
                  <div 
                    key={h.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"} animate-fade-in-up`}
                  >
                    <div className={`flex items-end gap-2 max-w-[78%] relative ${isMe ? "flex-row-reverse" : ""}`}>
                      {!isMe && (
                        <span className="text-xl p-1.5 bg-white border border-slate-200 rounded-full select-none mr-1 shrink-0 shadow-sm">
                          {isAI ? "🤖" : "🎙️"}
                        </span>
                      )}

                      <div className={`p-3.5 rounded-3xl relative shadow-sm ${
                        isMe 
                          ? "bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] border border-slate-800 text-white rounded-br-md text-left font-sans text-xs" 
                          : isSystem
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-bl-md text-left font-mono text-[10.5px]"
                            : isAI
                              ? "bg-indigo-50/70 border border-indigo-100 text-indigo-900 rounded-bl-md text-left font-sans text-xs"
                              : "bg-white border border-slate-200 text-slate-800 rounded-bl-md text-left font-sans text-xs"
                      }`}>
                        {isAI && (
                          <span className={`text-[8px] font-mono block font-bold tracking-wider mb-1 uppercase ${
                            isSystem ? "text-emerald-600" : "text-indigo-500"
                          }`}>
                            {isSystem ? "✦ HỆ THỐNG AI TỰ ĐỘNG CHỐT SALES" : "✦ iGen AI Assistant (Trả lời tự động)"}
                          </span>
                        )}
                        {hasImageAttachment && (
                          <img
                            src={primaryAttachment.url}
                            alt={primaryAttachment.type === "sticker" ? "Facebook sticker" : "Facebook attachment"}
                            className="max-w-[180px] max-h-[180px] rounded-2xl mb-2 object-contain bg-white/70"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {displayText ? (
                          <p className="leading-relaxed whitespace-pre-wrap select-text">{displayText}</p>
                        ) : null}
                      </div>
                    </div>
                    
                    <span className="text-[8.5px] text-slate-400 font-mono mt-1.5 select-none font-sans">
                      {isMe ? "CRM Operator • " : "Khách Facebook • "}
                      {new Date(h.timestamp).toLocaleTimeString("vi-VN", { hour: "numeric", minute: "numeric" })}
                    </span>
                  </div>
                );
              })}

              {/* Pulsing Loading active thinking response from AI */}
              {aiWaiting && (
                <div className="flex items-start gap-2.5" id="ai_thinking_marker">
                  <span className="text-xl p-1 bg-slate-50 border border-indigo-100 rounded-full select-none shrink-0 shadow-xxs animate-spin-slow">🤖</span>
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl rounded-bl-none text-left">
                    <span className="text-[8px] font-mono block text-indigo-400 font-bold mb-1 uppercase tracking-widest">Trợ lý AI đang soạn câu trả lời...</span>
                    <div className="flex gap-1.5 justify-center py-1">
                      <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Send Input Box area */}
            <form onSubmit={handleSendChatMessage} className="p-4 border-t border-slate-100 bg-white shrink-0" id="chat_input_section">
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder={`Gửi phản hồi cho ${activeCustomer.name}...`}
                  className="flex-1 text-left px-4 py-3 border border-slate-200 bg-slate-50/40 rounded-xl text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-sans"
                  value={typeMessage}
                  onChange={(e) => setTypeMessage(e.target.value)}
                  disabled={aiWaiting}
                />
                <button 
                  type="submit"
                  disabled={aiWaiting || !typeMessage.trim()}
                  className={`p-3 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 ${
                    aiWaiting || !typeMessage.trim()
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                      : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95 shadow-md shadow-blue-500/10"
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* R-Col: Config side-panel sidebar for custom AI assistant parameters (Collapsible) */}
      {showConfig && (
        <div className="w-80 border-l border-slate-100 bg-white p-5 text-xs text-left overflow-y-auto shrink-0 h-full flex flex-col justify-between shadow-sm animate-slide-in-right" id="ai_assistant_config_side_panel">
          <div className="space-y-5">
            <h4 className="font-extrabold text-slate-800 text-sm font-sans tracking-tight flex items-center gap-2 uppercase">
              <Sliders className="h-4 w-4 text-blue-600" />
              Cấu hình trợ lý AI
            </h4>
            <p className="text-slate-400 text-[10px] leading-relaxed font-sans">Tham số hóa hành vi tự động trả lời, phân tích tâm lý khách hàng đồng bộ thời gian trễ.</p>

            {/* AI switchers */}
            <div className="space-y-4 pt-4 border-t border-slate-100" id="config_switches">
              
              {/* auto classify */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h5 className="font-extrabold text-slate-700 font-sans tracking-tight text-xs">Tự phân loại khách</h5>
                  <p className="text-[9.5px] text-slate-400 mt-0.5 leading-normal">AI tự phân tích và tag nhóm hội thoại Khách VIP/Hỏi giá.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 mt-0.5">
                  <input 
                    type="checkbox" 
                    checked={aiConfig.autoClassify}
                    onChange={(e) => setAIConfig({ ...aiConfig, autoClassify: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              {/* auto close deal */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h5 className="font-extrabold text-slate-700 font-sans tracking-tight text-xs">Tự động chốt đơn AI *</h5>
                  <p className="text-[9.5px] text-slate-400 mt-0.5 leading-normal">Hướng hội thoại xin địa chỉ, tạo vận đơn tự động lên ERP.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 mt-0.5">
                  <input 
                    type="checkbox" 
                    checked={aiConfig.autoCloseDeal}
                    onChange={(e) => setAIConfig({ ...aiConfig, autoCloseDeal: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              {/* auto request feedback */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h5 className="font-extrabold text-slate-700 font-sans tracking-tight text-xs">Tự xin feedback quý</h5>
                  <p className="text-[9.5px] text-slate-400 mt-0.5 leading-normal">Lịch sự xin đánh giá sao sau khi khách hàng chào tạm biệt.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 mt-0.5">
                  <input 
                    type="checkbox" 
                    checked={aiConfig.autoFeedback}
                    onChange={(e) => setAIConfig({ ...aiConfig, autoFeedback: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

            </div>

            {/* delay slider config */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-slate-700 font-sans">Thời gian trễ trả lời</span>
                <strong className="font-mono bg-slate-50 px-2 py-0.5 border border-slate-200 rounded text-slate-600">{aiConfig.replyDelay} giây (s)</strong>
              </div>
              <input 
                type="range" 
                min={1} 
                max={45} 
                value={aiConfig.replyDelay}
                onChange={(e) => setAIConfig({ ...aiConfig, replyDelay: parseInt(e.target.value) })}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 animate-pulse-slow"
              />
              <span className="text-[9px] text-slate-400 block leading-normal text-left">Độ trễ giúp chatbot hành xử tương thích như người chăm sóc thật phục vụ hội thoại.</span>
            </div>

            {/* Custom active coreinstructions constraints */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <label className="block font-extrabold text-slate-700">Cài đặt nâng cao (AI Prompts)</label>
              <textarea 
                placeholder="Nhập luật hành xử nghiêm ngặt cho AI..."
                value={aiConfig.advancedInstructions}
                onChange={(e) => setAIConfig({ ...aiConfig, advancedInstructions: e.target.value })}
                className="w-full h-32 p-3 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl text-xs leading-relaxed focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 font-mono text-center text-[9px] text-slate-400 select-none">
            Cấu hình trợ lý AI tự động lưu
          </div>
        </div>
      )}

    </div>
  );
};
