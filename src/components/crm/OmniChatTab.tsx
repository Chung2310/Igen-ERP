import React, { useRef, useEffect, useState } from "react";
import { Search, Send, Sliders, Zap, FileText, DollarSign, MessageSquare, ChevronDown, Facebook, Clock3 } from "lucide-react";
import { CustomerInbox, ChatMessage, AIChatConfig, ChatPagination } from "../../types";
import { toast } from "../../pages/Toast";

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
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Google Drive integrations for Omni-Inbox
  const [driveLink, setDriveLink] = useState("");
  const [syncingDrive, setSyncingDrive] = useState(false);

  const handleSyncDrive = async () => {
    if (!driveLink.trim()) {
      toast.error("Vui lòng nhập đường dẫn tài liệu Google Drive / Doc.");
      return;
    }
    setSyncingDrive(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/v1/gemini/sync-drive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ docLink: driveLink })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setAIConfig({
          ...aiConfig,
          trainingKnowledge: data.text
        });
        toast.success(`Đồng bộ thành công từ ${data.title}!`);
      } else {
        toast.error(data.message || "Lỗi đồng bộ từ Google Drive.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể kết nối tới máy chủ.");
    } finally {
      setSyncingDrive(false);
    }
  };

  const chatStreamRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const previousFirstMessageIdRef = useRef<string | null>(null);

  // Monitor scroll position to show/hide Scroll to Bottom button
  const handleScroll = () => {
    const container = chatStreamRef.current;
    if (!container) return;
    const isFarFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight > 400;
    setShowScrollBottom(isFarFromBottom);
  };

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset refs when active customer changes to ensure correct scroll logic on load
  useEffect(() => {
    previousMessageCountRef.current = 0;
    previousFirstMessageIdRef.current = null;
  }, [activeCustomer?.id]);

  // Auto-scroll when new messages arrive or conversation loaded
  useEffect(() => {
    const container = chatStreamRef.current;
    if (!container) return;

    const previousCount = previousMessageCountRef.current;
    const currentCount = chatHistory.length;
    const previousFirstId = previousFirstMessageIdRef.current;
    const currentFirstId = chatHistory[0]?.id || null;
    const prependedOlderMessages = previousFirstId !== null && currentFirstId !== null && previousFirstId !== currentFirstId;
    
    // Increased bottom threshold to 300px for a better scroll trigger
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
    
    const lastMessage = chatHistory[chatHistory.length - 1];
    const isAgentMessage = lastMessage?.sender === "agent";

    if (prependedOlderMessages) {
      previousMessageCountRef.current = currentCount;
      previousFirstMessageIdRef.current = currentFirstId;
      return;
    }

    if (currentCount > previousCount) {
      if (previousCount === 0) {
        // First load scroll to bottom immediately
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: "auto" });
        }, 50);
      } else if (isAgentMessage || isNearBottom) {
        // Send by agent or near bottom, scroll smoothly
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    }

    previousMessageCountRef.current = currentCount;
    previousFirstMessageIdRef.current = currentFirstId;
  }, [chatHistory]);

  useEffect(() => {
    if (!aiWaiting) return;
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
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
                  className={`p-4 flex items-start gap-3.5 cursor-pointer transition-all duration-250 text-left relative group border-b border-slate-100/50 ${
                    isActive 
                      ? "bg-blue-50/40 border-l-4 border-blue-600 shadow-xs" 
                      : "hover:bg-slate-50/60 hover:translate-x-1"
                  }`}
                  id={`inbox_thread_${cust.id}`}
                >
                  {/* Avatar with dynamic channel source badge */}
                  <div className="p-1.5 bg-white border border-slate-100 rounded-full select-none relative shadow-sm shrink-0 group-hover:scale-105 transition-transform duration-200">
                    {renderCustomerAvatar(cust, "h-10 w-10")}
                    {/* Channel source badge in top-right */}
                    {cust.channel === "facebook" ? (
                      <span className="absolute -top-1 -right-1 p-0.5 bg-blue-600 text-white rounded-full border border-white shadow-sm flex items-center justify-center">
                        <svg className="h-2.5 w-2.5 fill-current" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </span>
                    ) : cust.channel === "zalo" ? (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[7px] font-extrabold rounded-full border border-white shadow-sm flex items-center justify-center leading-none font-sans">
                        Z
                      </span>
                    ) : null}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-800 group-hover:text-blue-600 transition-colors duration-200 truncate">{cust.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono">{cust.time}</span>
                    </div>
                    
                    <p className="text-[10px] text-slate-500 truncate mt-1 leading-normal select-none">{cust.lastMessage}</p>
                    <p className="text-[9px] text-slate-400 mt-1">
                      {cust.channel === "zalo" ? "Khách Zalo • UID: " : "Khách Facebook • PSID: "}
                      {cust.recipientId || cust.id}
                    </p>
                    
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
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeCustomer.channel === "zalo" ? "bg-cyan-400 animate-pulse" : "bg-blue-500"}`} />
                    {activeCustomer.channel === "zalo" ? "Khách Zalo • UID: " : "Khách Facebook • PSID: "}
                    {activeCustomer.recipientId || activeCustomer.id}
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

            {/* Messages dialogue stream feed container */}
            <div className="flex-1 relative overflow-hidden flex flex-col justify-between">
              <div 
                ref={chatStreamRef} 
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-6 py-4 space-y-4" 
                id="chat_messages_stream" 
                style={{ maxHeight: "calc(85vh - 200px)" }}
              >
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
                          <div className="shrink-0 mr-1 shadow-sm select-none">
                            {isAI ? (
                              <span className="text-lg w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center">
                                🤖
                              </span>
                            ) : (
                              renderCustomerAvatar(activeCustomer, "h-8 w-8")
                            )}
                          </div>
                        )}

                        <div className={`p-3.5 rounded-3xl relative shadow-xs transition-all duration-200 ${
                          isMe 
                            ? "bg-gradient-to-tr from-blue-600 via-indigo-600 to-indigo-700 text-white rounded-br-none text-left font-sans text-xs hover:shadow-md" 
                            : isSystem
                              ? "bg-emerald-50/90 border border-emerald-200 text-emerald-950 rounded-bl-none text-left font-mono text-[10.5px] shadow-sm shadow-emerald-500/5"
                              : isAI
                                ? "bg-gradient-to-tr from-indigo-50 to-purple-50/70 border border-indigo-100 text-indigo-950 rounded-bl-none text-left font-sans text-xs shadow-sm shadow-indigo-500/5"
                                : "bg-white border border-slate-100 hover:border-slate-200 text-slate-800 rounded-bl-none text-left font-sans text-xs hover:shadow-sm"
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
                              className="max-w-[220px] max-h-[220px] rounded-2xl mb-2 object-contain bg-white/70 cursor-zoom-in hover:brightness-95 active:scale-98 transition-all duration-200 border border-slate-150/40 shadow-xs"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onClick={() => setLightboxImage(primaryAttachment.url)}
                            />
                          )}
                          {displayText ? (
                            <p className="leading-relaxed whitespace-pre-wrap select-text">{displayText}</p>
                          ) : null}
                        </div>
                      </div>
                      
                      <span className="text-[8.5px] text-slate-400 font-mono mt-1.5 select-none font-sans">
                        {isMe ? "CRM Operator • " : isAI ? "Trợ lý AI • " : `${activeCustomer.name} • `}
                        {new Date(h.timestamp).toLocaleTimeString("vi-VN", { hour: "numeric", minute: "numeric" })}
                      </span>
                    </div>
                  );
                })}

                {/* Pulsing Loading active thinking response from AI */}
                {aiWaiting && (
                  <div className="flex items-start gap-2.5 animate-pulse" id="ai_thinking_marker">
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

              {/* Floating scroll to bottom button */}
              {showScrollBottom && (
                <button
                  type="button"
                  onClick={() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="absolute bottom-4 right-6 bg-white/90 backdrop-blur border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 p-2.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 animate-bounce active:scale-95 z-20 flex items-center gap-1.5 text-[10px] font-extrabold"
                >
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                  <span>Cuộn xuống dưới</span>
                </button>
              )}
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
              
              {/* auto reply status */}
              <div className="flex justify-between items-start gap-4 pb-3 border-b border-slate-100/50">
                <div>
                  <h5 className="font-extrabold text-blue-600 font-sans tracking-tight text-xs flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 fill-blue-600/20 text-blue-600" />
                    Tự động trả lời AI
                  </h5>
                  <p className="text-[9.5px] text-slate-400 mt-0.5 leading-normal">Cho phép bot AI trả lời tin nhắn từ Facebook và Zalo.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 mt-0.5">
                  <input 
                    type="checkbox" 
                    checked={aiConfig.enabled}
                    onChange={(e) => setAIConfig({ ...aiConfig, enabled: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

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
                className="w-full h-24 p-3 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl text-xs leading-relaxed focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>

            {/* Google Drive Link Sync */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <label className="block font-extrabold text-slate-700 flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                Đồng bộ tài liệu từ Google Drive
              </label>
              <p className="text-[9px] text-slate-400 leading-normal">Dán link Google Doc công khai. AI sẽ tự động chuyển đổi tài liệu thành danh sách FAQs chuẩn hóa để huấn luyện bot.</p>
              <div className="flex gap-1.5">
                <input 
                  type="text" 
                  placeholder="https://docs.google.com/document/d/..."
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  disabled={syncingDrive}
                  className="flex-1 min-w-0 px-2.5 py-1.5 border border-slate-200 bg-slate-50 focus:bg-white rounded-lg text-[10px] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all disabled:opacity-50"
                />
                <button 
                  type="button"
                  onClick={handleSyncDrive}
                  disabled={syncingDrive}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[9px] shrink-0 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {syncingDrive ? (
                    <>
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                      </svg>
                      Đang xử lý...
                    </>
                  ) : "Đồng bộ & Tạo FAQ"}
                </button>
              </div>
            </div>

            {/* Training knowledge base input */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block font-extrabold text-slate-700">Dữ liệu huấn luyện AI</label>
                {aiConfig.trainingKnowledge && aiConfig.trainingKnowledge.trim().length > 0 && (
                  <span className="text-[8px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    {aiConfig.trainingKnowledge.includes("Q:") ? "FAQ đã chuẩn hóa" : "Dữ liệu tùy chỉnh"}
                  </span>
                )}
              </div>
              <textarea 
                placeholder={"Nhập thông tin sản phẩm, chính sách bán hàng, bảng giá...\nHoặc bấm 'Đồng bộ & Tạo FAQ' ở trên để AI tự động tạo từ Google Doc.\n\nVí dụ:\nQ: Gói dịch vụ cơ bản giá bao nhiêu?\nA: Dạ, gói cơ bản có giá 500.000đ/tháng ạ."}
                value={aiConfig.trainingKnowledge}
                onChange={(e) => setAIConfig({ ...aiConfig, trainingKnowledge: e.target.value })}
                className="w-full h-48 p-3 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl text-xs leading-relaxed focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-200 font-sans"
              />
              <p className="text-[9px] text-slate-400 leading-normal">Bot sẽ sử dụng dữ liệu trên để trả lời khách hàng. Bạn có thể chỉnh sửa trực tiếp hoặc đồng bộ lại từ Google Drive.</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 font-mono text-center text-[9px] text-slate-400 select-none">
            Cấu hình trợ lý AI tự động lưu
          </div>
        </div>
      )}

      {/* Premium Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[9999] animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            type="button"
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-all text-xs font-bold font-sans"
            onClick={() => setLightboxImage(null)}
          >
            Đóng [ESC]
          </button>
          <img 
            src={lightboxImage} 
            alt="Fullsize attachment" 
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
};
