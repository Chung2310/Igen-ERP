import React, { useState, useEffect } from "react";
import { Activity, Zap, FileText, DollarSign, MessageSquare } from "lucide-react";
import { CRMSubTabType, ChatMessage, CustomerInbox, AIChatConfig, ChatPagination } from "../types";
import { geminiApi } from "../api/gemini";
import { toast } from "./Toast";
import { crmService, ExtendedLeadCard } from "../services/crmService";
import { useAuth } from "../context/AuthContext";
import { fbMessengerService } from "../services/fbMessengerService";
import { PipelineTab } from "../components/crm/PipelineTab";
import { OmniChatTab } from "../components/crm/OmniChatTab";

export default function CRMTab() {
  const [subTab, setSubTab] = useState<CRMSubTabType>("PHỄU KHÁCH HÀNG");

  // 1. Leads Kanban Pipeline States loaded from Firebase
  const [leads, setLeads] = useState<ExtendedLeadCard[]>([]);

  useEffect(() => {
    const unsubscribe = crmService.subscribeLeads((loadedLeads) => {
      setLeads(loadedLeads);
    });
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadValue, setNewLeadValue] = useState("");
  const [newLeadStatus, setNewLeadStatus] = useState<"cold" | "warm" | "hot">("cold");
  const [newLeadTouchpoint, setNewLeadTouchpoint] = useState("Mới tiếp cận");
  const [newLeadCompany, setNewLeadCompany] = useState("");

  const [searchPipeline, setSearchPipeline] = useState("");

  // Modals state
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);

  // Automation warning modal state
  const [automationModal, setAutomationModal] = useState<{
    isOpen: boolean;
    leadName: string;
    company: string;
    contractLink: string;
    paymentLink: string;
  } | null>(null);

  // 2. Omni-Inbox States
  const { userProfile } = useAuth();
  const isFbConnected = userProfile?.facebookIntegration?.isConnected ?? false;

  const [inboxCustomers, setInboxCustomers] = useState<CustomerInbox[]>([]);

  const [activeCustomer, setActiveCustomer] = useState<CustomerInbox | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatPagination, setChatPagination] = useState<ChatPagination>({
    limit: 20,
    hasMore: false,
    nextBefore: null,
    loadingMore: false,
  });

  const [typeMessage, setTypeMessage] = useState("");
  const [aiWaiting, setAIWaiting] = useState(false);

  // AI assistant configurations
  const [aiConfig, setAIConfig] = useState<AIChatConfig>({
    autoClassify: true,
    autoCloseDeal: false,
    autoFeedback: false,
    replyDelay: 15,
    advancedInstructions: "Luôn ưu tiên xưng hô lịch thiệp. Hỏi thăm nhu cầu chăm sóc sức khỏe của doanh nghiệp."
  });

  const mapFbMessages = (msgs: any[]): ChatMessage[] => msgs.map((m: any) => ({
    id: m._id || m.messageId,
    sender: m.direction === "inbound" ? "user" : "agent",
    text: m.text || "",
    timestamp: new Date(m.timestamp),
    attachments: Array.isArray(m.attachments) ? m.attachments : []
  }));

  const areMessagesEqual = (left: ChatMessage[], right: ChatMessage[]) => {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (
        left[i].id !== right[i].id ||
        left[i].sender !== right[i].sender ||
        left[i].text !== right[i].text ||
        left[i].timestamp.getTime() !== right[i].timestamp.getTime() ||
        JSON.stringify(left[i].attachments || []) !== JSON.stringify(right[i].attachments || [])
      ) {
        return false;
      }
    }
    return true;
  };

  const loadConversationMessages = async (conversationId: string, mode: "replace" | "prepend" = "replace") => {
    const before = mode === "prepend" ? chatPagination.nextBefore || undefined : undefined;
    if (mode === "prepend") {
      setChatPagination((prev) => ({ ...prev, loadingMore: true }));
    }

    try {
      const result = await fbMessengerService.getMessages(conversationId, { limit: 20, before });
      const mappedMsgs = mapFbMessages(result.data);

      if (mode === "prepend") {
        setChatHistory((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          const older = mappedMsgs.filter((item) => !seen.has(item.id));
          if (older.length === 0) {
            return prev;
          }
          return [...older, ...prev];
        });
      } else {
        setChatHistory((prev) => (areMessagesEqual(prev, mappedMsgs) ? prev : mappedMsgs));
      }

      setChatPagination({
        limit: result.pagination.limit || 20,
        hasMore: !!result.pagination.hasMore,
        nextBefore: result.pagination.nextBefore || null,
        loadingMore: false,
      });
    } catch (err) {
      setChatPagination((prev) => ({ ...prev, loadingMore: false }));
      throw err;
    }
  };

  // 1. Polling danh sách hội thoại Facebook thật nếu đã kết nối
  useEffect(() => {
    if (subTab !== "OMNI-INBOX CHAT" || !isFbConnected) return;

    const fetchFbConversations = async () => {
      console.log("[FE CRMTab] Polling danh sách hội thoại Facebook từ server...");
      try {
        const data = await fbMessengerService.getConversations();
        console.log("[FE CRMTab] Đã lấy dữ liệu hội thoại Facebook:", data);
        if (data && data.length > 0) {
          const mapped: CustomerInbox[] = data.map((c: any) => ({
            id: c._id, // DB conversation id
            recipientId: c.recipientId,
            name: c.senderName || "Khách hàng Facebook",
            avatar: c.avatarUrl || "👤",
            avatarUrl: c.avatarUrl || "",
            lastMessage: c.lastMessageText || "[Đính kèm]",
            time: new Date(c.lastMessageAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            unreadCount: c.unreadCount || 0,
            isVip: c.isVip || false,
            status: "offline",
            tags: c.tags || [],
            channel: "facebook"
          }));

          setInboxCustomers(mapped);
          console.log("[FE CRMTab] Cập nhật danh sách inboxCustomers mới:", mapped);
          
          // Tự động chọn cuộc hội thoại đầu tiên nếu chưa có
          if (!activeCustomer) {
            console.log("[FE CRMTab] Chưa có active customer. Tự động chọn cuộc trò chuyện đầu tiên:", mapped[0]);
            setActiveCustomer(mapped[0]);
          }
        } else {
          console.log("[FE CRMTab] Không tìm thấy cuộc hội thoại nào trên Facebook.");
          setInboxCustomers([]);
        }
      } catch (err) {
        console.error("[FE CRMTab] Lỗi khi tải danh sách hội thoại Facebook:", err);
      }
    };

    fetchFbConversations();
    const interval = setInterval(fetchFbConversations, 5000);
    return () => clearInterval(interval);
  }, [subTab, isFbConnected, activeCustomer?.id]);

  // 2. Polling lịch sử tin nhắn của hội thoại Facebook đang chọn
  useEffect(() => {
    if (subTab !== "OMNI-INBOX CHAT" || !activeCustomer) return;

      const fetchFbMessages = async () => {
        console.log(`[FE CRMTab] Polling lịch sử tin nhắn cho conversation ID: ${activeCustomer.id}...`);
        try {
        await loadConversationMessages(activeCustomer.id, "replace");
        console.log(`[FE CRMTab] Đã tải tin nhắn mới nhất cho conversation ID: ${activeCustomer.id}`);
      } catch (err) {
        console.error("[FE CRMTab] Lỗi khi tải tin nhắn Facebook:", err);
      }
    };

    fetchFbMessages();
    const interval = setInterval(fetchFbMessages, 4000);
    return () => clearInterval(interval);
  }, [subTab, activeCustomer?.id]);

  const handleSelectCustomer = async (cust: CustomerInbox) => {
    console.log("[FE CRMTab] Nhân viên chọn khách hàng từ danh sách:", cust);
    setActiveCustomer(cust);
    console.log(`[FE CRMTab] Khách hàng thật (Facebook) "${cust.name}". Tải tin nhắn từ server...`);
    // Real Facebook flow
    try {
      await loadConversationMessages(cust.id, "replace");
      console.log(`[FE CRMTab] Tải tin nhắn cho khách hàng thật thành công.`);
    } catch (err) {
      console.error("[FE CRMTab] Lỗi khi lấy lịch sử tin nhắn khách hàng thật:", err);
    }
  };

  const handleLoadOlderMessages = async () => {
    if (!activeCustomer || !chatPagination.hasMore || chatPagination.loadingMore) return;
    try {
      await loadConversationMessages(activeCustomer.id, "prepend");
    } catch (err) {
      console.error("[FE CRMTab] Lỗi khi tải thêm tin nhắn cũ:", err);
      toast.error("Không thể tải thêm tin nhắn cũ.");
    }
  };

  // Sync classification tags to Omni-Inbox
  const syncLeadTagToInbox = (name: string, status: "cold" | "warm" | "hot", touchpoint?: string) => {
    setInboxCustomers(prev => {
      let hasChanges = false;

      const nextCustomers = prev.map(cust => {
        if (cust.name.toLowerCase() !== name.toLowerCase()) {
          return cust;
        }

        const cleanTags = cust.tags.filter(t => !["Khách Lạnh", "Khách Ấm", "Khách Nóng", "Sắp chốt HD", "Đã gửi báo giá", "Mới tiếp cận"].includes(t));
        const newTempTag = status === "cold" ? "Khách Lạnh" : status === "warm" ? "Khách Ấm" : "Khách Nóng";
        const newTags = [...cleanTags, newTempTag];
        if (touchpoint) {
          newTags.push(touchpoint);
        }

        if (newTags.length === cust.tags.length && newTags.every((tag, index) => tag === cust.tags[index])) {
          return cust;
        }

        hasChanges = true;
        return { ...cust, tags: newTags };
      });

      return hasChanges ? nextCustomers : prev;
    });
  };

  // Trigger automation modal when lead becomes "Sắp chốt HD" in Hot Column
  const triggerAutoCloseWorkflow = (lead: ExtendedLeadCard) => {
    const mockContract = `https://igen-erp.vn/contracts/HD-2026-${lead.id.substring(0, 8) || "X1"}.pdf`;
    const mockPayment = `https://pay.igen-erp.vn/invoice/INV-2026-${lead.id.substring(0, 8) || "X1"}`;
    
    setAutomationModal({
      isOpen: true,
      leadName: lead.customerName,
      company: lead.company,
      contractLink: mockContract,
      paymentLink: mockPayment
    });

    const systemMsgText = `✦ [AI AUTOMATION] Đã gửi tự động:
- Hợp đồng điện tử: ${mockContract}
- Link thanh toán: ${mockPayment}
(Trạng thái: Sắp chốt HD - Khách Nóng)`;

    if (activeCustomer && activeCustomer.name.toLowerCase() === lead.customerName.toLowerCase()) {
      setChatHistory(prev => [
        ...prev,
        {
          id: "system_" + Date.now(),
          sender: "ai",
          text: systemMsgText,
          timestamp: new Date()
        }
      ]);
    }
    toast.success("Kịch bản chốt Sales tự động: Đã gửi hợp đồng điện tử!");
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim()) return;
    
    const val = parseFloat(newLeadValue) || 0;
    
    const newLead: Omit<ExtendedLeadCard, "id"> = {
      customerName: newLeadName.trim(),
      company: newLeadCompany.trim() || "Liên hệ cá nhân mới",
      value: val,
      phone: "Chưa bổ sung",
      avatar: ["👤", "👨‍💼", "👩‍💼", "👨‍💻", "👩‍💻", "🧘"][Math.floor(Math.random() * 6)],
      email: "chua.co@igen.vn",
      productOfChoice: "",
      status: newLeadStatus,
      lastInteraction: newLeadTouchpoint,
      lastInteractionTime: "Vừa xong"
    };

    setNewLeadName("");
    setNewLeadValue("");
    setNewLeadCompany("");
    setShowCreateLeadModal(false);

    try {
      const createdId = await crmService.createLead(newLead);
      const fullLead = { ...newLead, id: createdId };

      const customerExists = inboxCustomers.some(c => c.name.toLowerCase() === newLead.customerName.toLowerCase());
      if (customerExists) {
        syncLeadTagToInbox(newLead.customerName, newLeadStatus, newLeadTouchpoint);
      }

      if (newLeadStatus === "hot" && newLeadTouchpoint === "Sắp chốt HD") {
        triggerAutoCloseWorkflow(fullLead);
      }

      toast.success("Đã thêm khách hàng tiềm năng thành công!");
    } catch (err) {
      toast.error("Không thể tạo khách hàng trên hệ thống.");
    }
  };

  const moveLeadPipeline = async (id: string, newStatus: "cold" | "warm" | "hot") => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    try {
      await crmService.updateLead(id, { status: newStatus });
      const updatedLead = { ...lead, status: newStatus };
      
      if (newStatus === "hot" && lead.lastInteraction === "Sắp chốt HD") {
        triggerAutoCloseWorkflow(updatedLead);
      }
      
      syncLeadTagToInbox(lead.customerName, newStatus, lead.lastInteraction);
    } catch (err) {
      toast.error("Không thể cập nhật trạng thái khách hàng.");
    }
  };

  const deleteLead = async (id: string) => {
    try {
      await crmService.deleteLead(id);
      toast.info("Đã xóa thẻ cơ hội bán hàng.");
    } catch (err) {
      toast.error("Không thể xóa khách hàng trên hệ thống.");
    }
  };

  const triggerUpsellCampaignOptimized = async () => {
    const coldLeads = leads.filter(l => l.status === "cold");
    if (coldLeads.length === 0) {
      toast.error("Không có khách hàng nào ở cột Khách Lạnh để gửi chiến dịch.");
      return;
    }

    toast.success(`Đã kích hoạt chiến dịch Up-sell! Gửi tự động SMS & Voucher giảm giá 10% cho ${coldLeads.length} Khách Lạnh.`);

    try {
      await crmService.bulkUpdateLeads(
        coldLeads.map((lead) => ({
          id: lead.id,
          lead: {
            lastInteraction: "Gửi Campaign Up-sell",
            lastInteractionTime: "Vừa xong"
          }
        }))
      );

      setInboxCustomers(prev => {
        let hasChanges = false;
        const nextCustomers = prev.map(cust => {
          const matchedLead = coldLeads.find(l => l.customerName.toLowerCase() === cust.name.toLowerCase());
          if (!matchedLead) {
            return cust;
          }

          const cleanTags = cust.tags.filter(t => !["Khách Lạnh", "Khách Ấm", "Khách Nóng", "Sắp chốt HD", "Đã gửi báo giá", "Mới tiếp cận"].includes(t));
          const nextTags = [...cleanTags, "Khách Lạnh", "Gửi Campaign Up-sell"];

          if (nextTags.length === cust.tags.length && nextTags.every((tag, index) => tag === cust.tags[index])) {
            return cust;
          }

          hasChanges = true;
          return { ...cust, tags: nextTags };
        });

        return hasChanges ? nextCustomers : prev;
      });
    } catch (err) {
      console.error("Error updating campaign status:", err);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const msgText = typeMessage.trim();
    if (!msgText || !activeCustomer) return;

    const userMsg: ChatMessage = {
      id: "user_" + Date.now(),
      sender: "agent",
      text: msgText,
      timestamp: new Date(),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setTypeMessage("");

    try {
      await fbMessengerService.sendReply(activeCustomer.id, msgText);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Không thể gửi tin nhắn qua Facebook Page.");
      setChatHistory((prev) => prev.filter((h) => h.id !== userMsg.id));
    }
  };

  const handleGoToChat = (customerName: string) => {
    const cust = inboxCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
    if (cust) {
      setActiveCustomer(cust);
      handleSelectCustomer(cust);
      setSubTab("OMNI-INBOX CHAT");
      toast.info(`Đã mở cuộc trò chuyện với ${customerName}`);
    } else {
      toast.warning("Khách hàng này chưa từng tương tác/nhắn tin tới Fanpage, không thể tự khởi tạo chat.");
    }
  };

  // Sync active Customer status tags when leads change
  useEffect(() => {
    if (!activeCustomer) return;
    const updatedActive = inboxCustomers.find(c => c.id === activeCustomer.id);
    if (updatedActive && updatedActive !== activeCustomer) {
      setActiveCustomer(updatedActive);
    }
  }, [activeCustomer, inboxCustomers]);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50" id="crm_tab_wrapper">
      
      {/* Sub tabs selector bar */}
      <div className="border-b border-slate-100 bg-[#f8fafc] p-2.5 text-xs flex justify-between shrink-0" id="crm_sub_tabs_switch">
        <div className="flex gap-2">
          {["PHỄU KHÁCH HÀNG", "OMNI-INBOX CHAT"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab as CRMSubTabType)}
              className={`px-3.5 py-2 rounded-xl border font-bold uppercase transition-all tracking-wide text-[10px] cursor-pointer ${
                subTab === tab 
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-200 text-emerald-800 font-mono text-[9px] font-bold">
          <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          <span>Omni-Channel Lead Routing Active</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden" id="crm_tab_main_content">
        {subTab === "PHỄU KHÁCH HÀNG" && (
          <PipelineTab
            leads={leads}
            searchPipeline={searchPipeline}
            setSearchPipeline={setSearchPipeline}
            triggerUpsellCampaignOptimized={triggerUpsellCampaignOptimized}
            setShowCreateLeadModal={setShowCreateLeadModal}
            moveLeadPipeline={moveLeadPipeline}
            deleteLead={deleteLead}
            handleGoToChat={handleGoToChat}
          />
        )}

        {subTab === "OMNI-INBOX CHAT" && (
          <OmniChatTab
            inboxCustomers={inboxCustomers}
            activeCustomer={activeCustomer}
            chatHistory={chatHistory}
            chatPagination={chatPagination}
            typeMessage={typeMessage}
            setTypeMessage={setTypeMessage}
            aiWaiting={aiWaiting}
            aiConfig={aiConfig}
            setAIConfig={setAIConfig}
            handleSelectCustomer={handleSelectCustomer}
            handleSendChatMessage={handleSendChatMessage}
            handleLoadOlderMessages={handleLoadOlderMessages}
          />
        )}
      </div>

      {/* Create Lead Modal Form */}
      {showCreateLeadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col gap-5 text-left animate-fade-in-up">
            
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
              <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">Thêm Cơ Hội Bán Hàng Mới</h4>
              <button 
                onClick={() => setShowCreateLeadModal(false)}
                className="text-slate-400 hover:text-slate-700 font-extrabold text-lg focus:outline-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tên khách hàng tiềm năng *</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Lê Thị B..." 
                  required
                  className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50/50 rounded-xl text-xs focus:bg-white outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tên doanh nghiệp / Công ty</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Công ty TNHH ABC..." 
                  className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50/50 rounded-xl text-xs focus:bg-white outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                  value={newLeadCompany}
                  onChange={(e) => setNewLeadCompany(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Dự toán giá trị (đ)</label>
                <input 
                  type="number" 
                  placeholder="Ví dụ: 15000000" 
                  className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50/50 rounded-xl text-xs font-mono focus:bg-white outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200"
                  value={newLeadValue}
                  onChange={(e) => setNewLeadValue(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Mức độ nhiệt độ</label>
                  <select
                    className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50/50 rounded-xl text-xs outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 cursor-pointer transition-all duration-200"
                    value={newLeadStatus}
                    onChange={(e) => setNewLeadStatus(e.target.value as "cold" | "warm" | "hot")}
                  >
                    <option value="cold">Khách Lạnh (Cold)</option>
                    <option value="warm">Khách Ấm (Warm)</option>
                    <option value="hot">Khách Nóng (Hot)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Bước xử lý (Tiến độ)</label>
                  <select
                    className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50/50 rounded-xl text-xs outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 cursor-pointer transition-all duration-200"
                    value={newLeadTouchpoint}
                    onChange={(e) => setNewLeadTouchpoint(e.target.value)}
                  >
                    <option value="Mới tiếp cận">Mới tiếp cận</option>
                    <option value="Đã gửi báo giá">Đã gửi báo giá</option>
                    <option value="Sắp chốt HD">Sắp chốt HD</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Lưu cơ hội
                </button>
                <button 
                  type="button"
                  onClick={() => setShowCreateLeadModal(false)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Automation Modal */}
      {automationModal && automationModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col gap-4 text-left animate-fade-in-up">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="p-2 bg-emerald-50 rounded-2xl">
                <Zap className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h4 className="font-extrabold text-slate-800 text-sm">Kích hoạt chốt sales tự động</h4>
                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">Đã tạo và gửi hợp đồng</p>
              </div>
            </div>

            <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/50 text-xs">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Khách hàng</span>
                <strong className="text-slate-700 text-xs mt-0.5 block">{automationModal.leadName}</strong>
                <span className="text-slate-400 block text-[9px] mt-0.5">{automationModal.company}</span>
              </div>
              <div className="h-px bg-slate-200/50 my-2" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-500 truncate">Hợp đồng điện tử:</span>
                  <a href={automationModal.contractLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline truncate ml-auto">
                    {automationModal.contractLink.substring(automationModal.contractLink.lastIndexOf("/") + 1)}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-500 truncate">Link thanh toán:</span>
                  <a href={automationModal.paymentLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline truncate ml-auto">
                    pay.igen-erp.vn/invoice...
                  </a>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              ✦ Trợ lý iGen AI đã tự động đóng gói hợp đồng, tạo mã thanh toán, và gửi trực tiếp qua Omni-Inbox chat cho khách hàng để tối ưu hóa tỷ lệ chốt sales.
            </p>

            <div className="flex gap-2.5 mt-2">
              <button 
                onClick={() => {
                  setAutomationModal(null);
                  setSubTab("OMNI-INBOX CHAT");
                }}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" />
                Xem chat
              </button>
              <button 
                onClick={() => setAutomationModal(null)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
