import React, { useRef, useEffect, useState } from "react";
import { Search, Send, Sliders, Zap, FileText, DollarSign, MessageSquare, ChevronDown, Facebook, Clock3, Plus } from "lucide-react";
import { CustomerInbox, ChatMessage, AIChatConfig, ChatPagination } from "../../types";
import { toast } from "../../pages/Toast";
import { geminiApi } from "../../api/gemini";
import { ExtendedLeadCard } from "../../services/crmService";
import { AiAssistantConfigPanel } from "./AiAssistantConfigPanel";

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
  leads: ExtendedLeadCard[];
  onCreateLeadFromChat: (customer: CustomerInbox, status: "cold" | "warm" | "hot") => void;
  onUpdateLeadStatus: (id: string, newStatus: "cold" | "warm" | "hot") => void;
  facebookPages: Array<{ _id: string; displayName: string; username: string; isMock?: boolean }>;
  selectedFacebookPageId: string;
  setSelectedFacebookPageId: (val: string) => void;
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
  leads,
  onCreateLeadFromChat,
  onUpdateLeadStatus,
  facebookPages,
  selectedFacebookPageId,
  setSelectedFacebookPageId,
}) => {
  const [filterInbox, setFilterInbox] = useState("");
  const [activeChannel, setActiveChannel] = useState<"all" | "facebook" | "zalo">("all");
  const [showConfig, setShowConfig] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const [localConfig, setLocalConfig] = useState<AIChatConfig>(aiConfig);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    setLocalConfig(aiConfig);
  }, [aiConfig]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await setAIConfig(localConfig);
      toast.success("Đã lưu cấu hình trợ lý AI thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể lưu cấu hình.");
    } finally {
      setSavingConfig(false);
    }
  };

  // Google Drive integrations for Omni-Inbox
  const [driveLink, setDriveLink] = useState("");
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [clearingKnowledge, setClearingKnowledge] = useState(false);
  const [knowledgeHealth, setKnowledgeHealth] = useState<any | null>(null);
  const [loadingAIHealth, setLoadingAIHealth] = useState(false);
  const [testQuestion, setTestQuestion] = useState("Phí ship và chính sách bảo hành bên mình như thế nào?");
  const [testReply, setTestReply] = useState<any | null>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [aiReplyLogs, setAIReplyLogs] = useState<any[]>([]);
  const knowledgeDocuments = Array.isArray(knowledgeHealth?.documents) ? knowledgeHealth.documents : [];
  const detectedTopics = Array.isArray(knowledgeHealth?.detectedTopics) ? knowledgeHealth.detectedTopics : [];
  const knowledgeWarnings = Array.isArray(knowledgeHealth?.warnings) ? knowledgeHealth.warnings : [];

  const refreshAIHealth = async () => {
    setLoadingAIHealth(true);
    try {
      const [health, logs] = await Promise.all([
        geminiApi.getKnowledgeHealth(),
        geminiApi.fetchAIReplyLogs(6),
      ]);
      setKnowledgeHealth(health);
      setAIReplyLogs(logs);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể tải trạng thái kiểm định AI.");
    } finally {
      setLoadingAIHealth(false);
    }
  };

  const handleTestAIReply = async () => {
    if (!testQuestion.trim()) {
      toast.error("Vui lòng nhập câu hỏi mẫu để test AI.");
      return;
    }
    setTestingAI(true);
    try {
      const result = await geminiApi.testReply(testQuestion, localConfig);
      setTestReply(result);
      await refreshAIHealth();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể tạo câu trả lời thử.");
    } finally {
      setTestingAI(false);
    }
  };

  const handleFeedback = async (logId: string, feedback: "good" | "bad" | "needs_fix") => {
    try {
      await geminiApi.sendAIReplyFeedback(logId, feedback);
      await refreshAIHealth();
      toast.success("Đã lưu feedback cho phản hồi AI.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể lưu feedback AI.");
    }
  };

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
        refreshAIHealth();
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

  const handleClearKnowledge = async () => {
    if (clearingKnowledge) return;

    const confirmed = window.confirm("Xoa toan bo tai lieu AI da feed va reset du lieu huan luyen hien tai?");
    if (!confirmed) return;

    setClearingKnowledge(true);
    try {
      await geminiApi.clearKnowledge();
      const nextConfig = { ...localConfig, trainingKnowledge: "" };
      setLocalConfig(nextConfig);
      await setAIConfig(nextConfig);
      setTestReply(null);
      await refreshAIHealth();
      toast.success("Da xoa toan bo tai lieu AI da feed.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Khong the xoa tai lieu AI.");
    } finally {
      setClearingKnowledge(false);
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

  useEffect(() => {
    if (showConfig) {
      refreshAIHealth();
    }
  }, [showConfig]);

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

          {/* Facebook Page Switcher */}
          {activeChannel === "facebook" && facebookPages && facebookPages.length > 0 && (
            <div className="flex flex-col gap-1 mt-1 animate-fade-in" id="fb_page_switcher_container">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block text-left">Trang Fanpage hiển thị</label>
              <div className="relative">
                <select
                  value={selectedFacebookPageId}
                  onChange={(e) => setSelectedFacebookPageId(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none cursor-pointer focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 appearance-none"
                  id="fb_page_switcher_select"
                >
                  {facebookPages.map((page) => (
                    <option key={page.username} value={page.username}>
                      {page.displayName} {page.isMock ? "(Demo)" : ""}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-blue-650">
                  <Facebook className="h-3.5 w-3.5" />
                </div>
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="h-3 w-3" />
                </div>
              </div>
            </div>
          )}
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
              {(() => {
                const linkedLead = leads.find(l => l.customerName.toLowerCase() === activeCustomer.name.toLowerCase());
                return (
                  <div className="flex items-center gap-3 text-left">
                    <span className="p-1.5 bg-gradient-to-br from-white to-slate-100 border border-slate-200 rounded-full select-none shadow-sm">
                      {renderCustomerAvatar(activeCustomer, "h-11 w-11")}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-slate-800 text-sm font-sans">
                          {activeCustomer.name}
                        </h4>
                        {activeCustomer.isVip && (
                          <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-extrabold rounded-md shadow-sm">VIP</span>
                        )}
                        
                        {/* CRM Pipeline Status Indicator and Actions */}
                        {linkedLead ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border ${
                              linkedLead.status === 'cold' ? 'bg-slate-100 text-slate-655 border-slate-200' :
                              linkedLead.status === 'warm' ? 'bg-orange-50 text-orange-655 border-orange-200' :
                              linkedLead.status === 'hot' ? 'bg-rose-50 text-rose-655 border-rose-200 animate-pulse' :
                              'bg-emerald-50 text-emerald-655 border-emerald-200'
                            }`}>
                              CRM: {linkedLead.status === 'cold' ? 'Khách Lạnh' : linkedLead.status === 'warm' ? 'Khách Ấm' : linkedLead.status === 'hot' ? 'Khách Nóng' : 'Thành công'}
                            </span>
                            
                            {linkedLead.status === "cold" && (
                              <button
                                type="button"
                                onClick={() => onUpdateLeadStatus(linkedLead.id, "warm")}
                                className="px-2 py-0.5 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 rounded-md text-[9px] font-bold transition-all cursor-pointer active:scale-95"
                              >
                                Lên Ấm →
                              </button>
                            )}
                            {linkedLead.status === "warm" && (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => onUpdateLeadStatus(linkedLead.id, "cold")}
                                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-250 rounded-md text-[9px] font-bold transition-all cursor-pointer active:scale-95"
                                >
                                  ← Lạnh
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onUpdateLeadStatus(linkedLead.id, "hot")}
                                  className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-250 rounded-md text-[9px] font-bold transition-all cursor-pointer active:scale-95"
                                >
                                  Nóng →
                                </button>
                              </div>
                            )}
                            {linkedLead.status === "hot" && (
                              <button
                                type="button"
                                onClick={() => onUpdateLeadStatus(linkedLead.id, "warm")}
                                className="px-2 py-0.5 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 rounded-md text-[9px] font-bold transition-all cursor-pointer active:scale-95"
                              >
                                ← Về Ấm
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onCreateLeadFromChat(activeCustomer, "cold")}
                            className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-md text-[9px] font-bold transition-all cursor-pointer flex items-center gap-0.5 active:scale-95"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            Đưa vào CRM
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeCustomer.channel === "zalo" ? "bg-cyan-400 animate-pulse" : "bg-blue-500"}`} />
                        {activeCustomer.channel === "zalo" ? "Khách Zalo • UID: " : "Khách Facebook • PSID: "}
                        {activeCustomer.recipientId || activeCustomer.id}
                      </p>
                    </div>
                  </div>
                );
              })()}
              
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
                          <div className="shrink-0 mr-1 rounded-full shadow-sm select-none">
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
        <AiAssistantConfigPanel
          localConfig={localConfig}
          setLocalConfig={setLocalConfig}
          savingConfig={savingConfig}
          handleSaveConfig={handleSaveConfig}
          driveLink={driveLink}
          setDriveLink={setDriveLink}
          syncingDrive={syncingDrive}
          handleSyncDrive={handleSyncDrive}
          clearingKnowledge={clearingKnowledge}
          handleClearKnowledge={handleClearKnowledge}
          knowledgeHealth={knowledgeHealth}
          loadingAIHealth={loadingAIHealth}
          refreshAIHealth={refreshAIHealth}
          testQuestion={testQuestion}
          setTestQuestion={setTestQuestion}
          testReply={testReply}
          testingAI={testingAI}
          handleTestAIReply={handleTestAIReply}
          aiReplyLogs={aiReplyLogs}
          handleFeedback={handleFeedback}
        />
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
