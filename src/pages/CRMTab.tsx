import React, { useState, useEffect, useRef } from "react";
import { 
  Users, 
  Search, 
  Plus, 
  DollarSign, 
  ArrowUpRight, 
  Trash2, 
  MessageSquare,
  Shield,
  Bot,
  Sparkles,
  Sliders,
  Play,
  CheckCircle,
  ToggleLeft,
  ChevronRight,
  User,
  Send,
  MoreVertical,
  Activity,
  Clock,
  AlertCircle,
  ArrowRight,
  FileText,
  Mail,
  Zap
} from "lucide-react";
import { CRMSubTabType, ChatMessage, CustomerInbox, AIChatConfig, LeadCard, ProductItem } from "../types";
import { geminiApi } from "../api/gemini";
import { toast } from "./Toast";
import { crmService, ExtendedLeadCard } from "../services/crmService";
export default function CRMTab() {
  const [subTab, setSubTab] = useState<CRMSubTabType>("PHỄU KHÁCH HÀNG");

  // 1. Leads Kanban Pipeline States (Phễu Khách hàng) loaded from Firebase
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

  // HTML5 Drag and Drop states
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);

  // Automation warning modal state
  const [automationModal, setAutomationModal] = useState<{
    isOpen: boolean;
    leadName: string;
    company: string;
    contractLink: string;
    paymentLink: string;
  } | null>(null);

  // 2. Omni-Inbox & AI Chatbot Configuration Simulator States
  const [inboxCustomers, setInboxCustomers] = useState<CustomerInbox[]>([
    { id: "cust-1", name: "Nguyễn Thị Mai", avatar: "👩‍💼", lastMessage: "Giá thiết bị đeo thông minh X1 là bao nhiêu ạ?", time: "3 phút trước", unreadCount: 1, isVip: true, status: "online", tags: ["Khách VIP", "Hỏi giá X1", "Khách Nóng"] },
    { id: "cust-2", name: "Trần Hùng", avatar: "👨‍💻", lastMessage: "Bên mình có free ship nội thành Hà Nội không?", time: "18 phút trước", unreadCount: 0, isVip: false, status: "offline", tags: ["Hỏi Ship", "Khách Lạnh"] },
    { id: "cust-3", name: "Nguyễn Văn A", avatar: "🧘", lastMessage: "Tôi đã nhận được bản thảo hợp đồng, để tôi xem lại.", time: "2 giờ trước", unreadCount: 0, isVip: true, status: "online", tags: ["Khách VIP", "Khách Nóng", "Sắp chốt HD"] },
    { id: "cust-4", name: "Phạm Thị D", avatar: "👩‍⚕️", lastMessage: "Đã gửi lại yêu cầu số lượng, kiểm tra giúp mình nhé.", time: "1 ngày trước", unreadCount: 0, isVip: false, status: "offline", tags: ["Khách Ấm", "Đã gửi báo giá"] }
  ]);

  const [activeCustomer, setActiveCustomer] = useState<CustomerInbox>(inboxCustomers[0]);

  // Specific virtual chat histories for active customer
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { id: "c-1", sender: "user", text: "Xin chào, tôi là Mai. Tôi đang chuẩn bị quà tặng cho toàn thể nhân viên trong công ty.", timestamp: new Date(Date.now() - 3600000 * 2) },
    { id: "c-2", sender: "ai", text: "Dạ, iGen ERP hân hạnh chào đón chị Nguyễn Thị Mai (khách VIP). Rất tuyệt vời khi chị quan tâm quà tặng công nghệ nâng cao phong cách sống cho doanh nghiệp ạ! Chị đang muốn tìm kiếm phân khúc nào ạ?", timestamp: new Date(Date.now() - 3600000) },
    { id: "c-3", sender: "user", text: "Tôi muốn tham khảo thiết bị đeo thông minh X1. Giá thiết bị này là bao nhiêu ạ?", timestamp: new Date(Date.now() - 180000) }
  ]);

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

  const [filterInbox, setFilterInbox] = useState("");

  const handleSelectCustomer = (cust: CustomerInbox) => {
    setActiveCustomer(cust);
    if (cust.name === "Nguyễn Thị Mai") {
      setChatHistory([
        { id: "c-1", sender: "user", text: "Xin chào, tôi là Mai. Tôi đang chuẩn bị quà tặng cho toàn thể nhân viên.", timestamp: new Date(Date.now() - 3600000 * 2) },
        { id: "c-2", sender: "ai", text: "Dạ, iGen ERP hân hạnh chào đón chị Nguyễn Thị Mai (khách VIP). Rất tuyệt vời khi chị ghé thăm ạ!", timestamp: new Date(Date.now() - 3600000) },
        { id: "c-3", sender: "user", text: "Tôi muốn tham khảo thiết bị đeo thông minh X1. Giá thiết bị này là bao nhiêu ạ?", timestamp: new Date(Date.now() - 180000) }
      ]);
    } else if (cust.name === "Nguyễn Văn A") {
      setChatHistory([
        { id: "c-11", sender: "user", text: "Chào bạn, tôi muốn đặt mua số lượng lớn thiết bị X1 cho văn phòng Global Tech.", timestamp: new Date(Date.now() - 7200000) },
        { id: "c-12", sender: "ai", text: "Chào anh Nguyễn Văn A, dự án X1 cho Global Tech rất tiềm năng ạ. Em gửi báo giá trị giá 45tr và chuẩn bị hợp đồng chốt nhé.", timestamp: new Date(Date.now() - 3600000) },
        { id: "c-13", sender: "user", text: "Tôi đã nhận được bản thảo hợp đồng, để tôi xem lại.", timestamp: new Date(Date.now() - 7200000) }
      ]);
    } else {
      setChatHistory([
        { id: "c-a", sender: "user", text: `Xin chào! Cho tôi hỏi thông tin về ${cust.name === "Trần Hùng" ? "Vận chuyển ship" : cust.name === "Phạm Thị D" ? "Hóa Đơn mua hàng" : "Khuyến mãi"}`, timestamp: new Date() }
      ]);
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

    // Append AI system confirmation message to chat if matching customer
    const systemMsgText = `✦ [AI AUTOMATION] Đã gửi tự động:
- Hợp đồng điện tử: ${mockContract}
- Link thanh toán: ${mockPayment}
(Trạng thái: Sắp chốt HD - Khách Nóng)`;

    if (activeCustomer.name.toLowerCase() === lead.customerName.toLowerCase()) {
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

    // Reset Form fields and close modal immediately for optimistic instant experience
    setNewLeadName("");
    setNewLeadValue("");
    setNewLeadCompany("");
    setShowCreateLeadModal(false);

    try {
      const createdId = await crmService.createLead(newLead);
      const fullLead = { ...newLead, id: createdId };

      // Auto sync lead to inbox list so it appears in chats
      const customerExists = inboxCustomers.some(c => c.name.toLowerCase() === newLead.customerName.toLowerCase());
      if (!customerExists) {
        const newCust: CustomerInbox = {
          id: "cust_" + Date.now(),
          name: newLead.customerName,
          avatar: newLead.avatar,
          lastMessage: `Khởi tạo mối liên hệ mới`,
          time: "Vừa xong",
          unreadCount: 0,
          isVip: val >= 40000000,
          status: "online",
          tags: [newLeadStatus === "cold" ? "Khách Lạnh" : newLeadStatus === "warm" ? "Khách Ấm" : "Khách Nóng", newLeadTouchpoint]
        };
        setInboxCustomers(prev => [newCust, ...prev]);
      } else {
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
      
      // Auto-close check
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

  // Re-engagement Bulk Campaign trigger for Cold leads
  const triggerUpsellCampaign = async () => {
    const coldLeads = leads.filter(l => l.status === "cold");
    if (coldLeads.length === 0) {
      toast.error("Không có khách hàng nào ở cột Khách Lạnh để gửi chiến dịch.");
      return;
    }
    
    toast.success(`Đã kích hoạt chiến dịch Up-sell! Gửi tự động SMS & Voucher giảm giá 10% cho ${coldLeads.length} Khách Lạnh.`);
    
    try {
      for (const l of coldLeads) {
        await crmService.updateLead(l.id, {
          lastInteraction: "Gửi Campaign Up-sell",
          lastInteractionTime: "Vừa xong"
        });
        syncLeadTagToInbox(l.customerName, "cold", "Gửi Campaign Up-sell");
      }
    } catch (err) {
      console.error("Error updating campaign status:", err);
    }
  };

  const triggerUpsellCampaignOptimized = async () => {
    const coldLeads = leads.filter(l => l.status === "cold");
    if (coldLeads.length === 0) {
      toast.error("KhÃ´ng cÃ³ khÃ¡ch hÃ ng nÃ o á»Ÿ cá»™t KhÃ¡ch Láº¡nh Ä‘á»ƒ gá»­i chiáº¿n dá»‹ch.");
      return;
    }

    toast.success(`ÄÃ£ kÃ­ch hoáº¡t chiáº¿n dá»‹ch Up-sell! Gá»­i tá»± Ä‘á»™ng SMS & Voucher giáº£m giÃ¡ 10% cho ${coldLeads.length} KhÃ¡ch Láº¡nh.`);

    try {
      await crmService.bulkUpdateLeads(
        coldLeads.map((lead) => ({
          id: lead.id,
          lead: {
            lastInteraction: "Gá»­i Campaign Up-sell",
            lastInteractionTime: "Vá»«a xong"
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
          const nextTags = [...cleanTags, "Khách Lạnh", "Gá»­i Campaign Up-sell"];

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

  // HTML5 Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedLeadId(id);
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, status: "cold" | "warm" | "hot") => {
    e.preventDefault();
    setActiveColumn(status);
  };

  const handleDragLeave = () => {
    setActiveColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: "cold" | "warm" | "hot") => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedLeadId;
    if (id) {
      moveLeadPipeline(id, targetStatus);
    }
    setDraggedLeadId(null);
    setActiveColumn(null);
  };

  // Send message using backend Gemini API
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const msgText = typeMessage.trim();
    if (!msgText) return;

    const userMsg: ChatMessage = {
      id: "user_" + Date.now(),
      sender: "user",
      text: msgText,
      timestamp: new Date(),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setTypeMessage("");
    setAIWaiting(true);

    try {
      const data = await geminiApi.sendChatMessage(
        msgText,
        chatHistory.map(h => ({ sender: h.sender, text: h.text })),
        aiConfig
      );
      
      setTimeout(() => {
        const aiMsg: ChatMessage = {
          id: "ai_" + Date.now(),
          sender: "ai",
          text: data.text || "Dạ, Trợ lý AI đang bận kết nối. Vui lòng thử lại ạ!",
          timestamp: new Date()
        };
        setChatHistory((prev) => [...prev, aiMsg]);
        setAIWaiting(false);
      }, aiConfig.replyDelay * 100);
    } catch (err) {
      console.error(err);
      setAIWaiting(false);
      toast.error("Kết nối AI Trợ Lý Chatbot bị gián đoạn.");
    }
  };

  // Auto scroll chat box
  const chatBottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, aiWaiting]);

  // Synchronize active Customer status tags when leads change
  useEffect(() => {
    const updatedActive = inboxCustomers.find(c => c.id === activeCustomer.id);
    if (updatedActive && updatedActive !== activeCustomer) {
      setActiveCustomer(updatedActive);
    }
  }, [activeCustomer, inboxCustomers]);

  // Navigate directly to thread and focus it
  const handleGoToChat = (customerName: string) => {
    const cust = inboxCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
    if (cust) {
      setActiveCustomer(cust);
      handleSelectCustomer(cust);
      setSubTab("OMNI-INBOX CHAT");
    } else {
      const newCust: CustomerInbox = {
        id: "cust_" + Date.now(),
        name: customerName,
        avatar: "👤",
        lastMessage: "Chưa có cuộc hội thoại nào.",
        time: "Vừa xong",
        unreadCount: 0,
        isVip: false,
        status: "online",
        tags: ["Khách Mới"]
      };
      setInboxCustomers(prev => [newCust, ...prev]);
      setActiveCustomer(newCust);
      setSubTab("OMNI-INBOX CHAT");
    }
    toast.info(`Đã mở cuộc trò chuyện với ${customerName}`);
  };

  // Filter leads by search query
  const filteredLeads = leads.filter(l => 
    l.customerName.toLowerCase().includes(searchPipeline.toLowerCase()) ||
    l.company.toLowerCase().includes(searchPipeline.toLowerCase()) ||
    l.productOfChoice.toLowerCase().includes(searchPipeline.toLowerCase())
  );
  const groupedLeads = {
    cold: [] as ExtendedLeadCard[],
    warm: [] as ExtendedLeadCard[],
    hot: [] as ExtendedLeadCard[],
  };

  filteredLeads.forEach((lead) => {
    if (lead.status === "cold") {
      groupedLeads.cold.push(lead);
      return;
    }
    if (lead.status === "warm") {
      groupedLeads.warm.push(lead);
      return;
    }
    if (lead.status === "hot") {
      groupedLeads.hot.push(lead);
    }
  });

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
        
        {/* SUB TAB 1: PHỄU KHÁCH HÀNG KANBAN */}
        {subTab === "PHỄU KHÁCH HÀNG" && (
          <div className="p-3.5 overflow-y-auto h-full space-y-3.5 flex flex-col" id="leads_pipeline_kanban">
            
            {/* Search and Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 border border-slate-100 p-3 rounded-2xl shrink-0">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-450 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm cơ hội bán hàng (tên, công ty, sản phẩm)..."
                  value={searchPipeline}
                  onChange={(e) => setSearchPipeline(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-white rounded-xl text-xs outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-150"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={triggerUpsellCampaignOptimized}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-indigo-200/50 transition-all cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5 text-indigo-500" />
                  Gửi Up-sell hàng loạt
                </button>
                <button 
                  onClick={() => setShowCreateLeadModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/10 hover:shadow-lg active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm cơ hội mới
                </button>
              </div>
            </div>

            {/* Pipeline Columns Scrollable container */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-hidden pb-2" id="pipeline_columns_grid">
              
              {/* COLD: KHÁCH LẠNH */}
              <div 
                onDragOver={(e) => handleDragOver(e, "cold")}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, "cold")}
                className={`bg-slate-50/70 border-2 p-3 rounded-2xl flex flex-col h-full overflow-hidden transition-all duration-200 ${
                  activeColumn === "cold" ? "border-blue-500 bg-blue-50/30 scale-[1.01]" : "border-slate-100"
                }`} 
                id="pipeline_cold"
              >
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200/50 shrink-0">
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">KHÁCH LẠNH (COLD)</span>
                    <span className="text-[9px] text-slate-400">Chưa xác định rõ nhu cầu</span>
                  </div>
                  <span className="bg-slate-200 text-slate-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                    {groupedLeads.cold.length}
                  </span>
                </div>
                
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  {groupedLeads.cold.map(l => (
                    <PipelineCard 
                      key={l.id} 
                      lead={l} 
                      onMove={(ns) => moveLeadPipeline(l.id, ns)} 
                      onDelete={() => deleteLead(l.id)} 
                      onDragStart={(e) => handleDragStart(e, l.id)}
                      onGoToChat={handleGoToChat}
                    />
                  ))}
                  {groupedLeads.cold.length === 0 && (
                    <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs italic font-sans">
                      Không có khách hàng
                    </div>
                  )}
                </div>
              </div>

              {/* WARM: KHÁCH ẤM */}
              <div 
                onDragOver={(e) => handleDragOver(e, "warm")}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, "warm")}
                className={`bg-orange-50/20 border-2 p-3 rounded-2xl flex flex-col h-full overflow-hidden transition-all duration-200 ${
                  activeColumn === "warm" ? "border-amber-500 bg-amber-50/30 scale-[1.01]" : "border-slate-100"
                }`} 
                id="pipeline_warm"
              >
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-orange-100/50 shrink-0">
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider block">KHÁCH WARM (ẤM)</span>
                    <span className="text-[9px] text-orange-500">Đã tương tác hoặc nhận báo giá</span>
                  </div>
                  <span className="bg-orange-100 text-orange-850 text-[9px] font-bold px-2 py-0.5 rounded-full">
                    {groupedLeads.warm.length}
                  </span>
                </div>
                
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  {groupedLeads.warm.map(l => (
                    <PipelineCard 
                      key={l.id} 
                      lead={l} 
                      onMove={(ns) => moveLeadPipeline(l.id, ns)} 
                      onDelete={() => deleteLead(l.id)} 
                      onDragStart={(e) => handleDragStart(e, l.id)}
                      onGoToChat={handleGoToChat}
                    />
                  ))}
                  {groupedLeads.warm.length === 0 && (
                    <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs italic font-sans">
                      Không có khách hàng
                    </div>
                  )}
                </div>
              </div>

              {/* HOT: KHÁCH NÓNG */}
              <div 
                onDragOver={(e) => handleDragOver(e, "hot")}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, "hot")}
                className={`bg-rose-50/20 border-2 p-3 rounded-2xl flex flex-col h-full overflow-hidden transition-all duration-200 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/10 ${
                  activeColumn === "hot" ? "border-emerald-500 bg-emerald-50/10 scale-[1.01]" : "border-slate-100"
                }`} 
                id="pipeline_hot"
              >
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-red-100/50 shrink-0">
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block flex items-center gap-1.5">
                      KHÁCH HOT (NÓNG)
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                    </span>
                    <span className="text-[9px] text-red-500">Chuẩn bị ký kết & chốt hợp đồng</span>
                  </div>
                  <span className="bg-red-100 text-red-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                    {groupedLeads.hot.length}
                  </span>
                </div>
                
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  {groupedLeads.hot.map(l => (
                    <PipelineCard 
                      key={l.id} 
                      lead={l} 
                      onMove={(ns) => moveLeadPipeline(l.id, ns)} 
                      onDelete={() => deleteLead(l.id)} 
                      onDragStart={(e) => handleDragStart(e, l.id)}
                      onGoToChat={handleGoToChat}
                    />
                  ))}
                  {groupedLeads.hot.length === 0 && (
                    <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs italic font-sans">
                      Không có khách hàng
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
 
        {/* SUB TAB 2: OMNI-INBOX DIALOG & CONFIG */}
        {subTab === "OMNI-INBOX CHAT" && (
          <div className="flex h-full overflow-hidden" id="omni_inbox_layout">
            
            {/* L-Col: Inbox Customers list list */}
            <div className="w-72 border-r border-slate-100 flex flex-col justify-between shrink-0 h-full" id="inbox_sidebar">
              <div className="p-4 border-b border-slate-100">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Tìm hộp thư khách hàng..." 
                    value={filterInbox}
                    onChange={(e) => setFilterInbox(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-xs"
                    id="inbox_sidebar_search"
                  />
                </div>
              </div>

              {/* Thread list scroll content */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50" id="inbox_thread_list">
                {inboxCustomers
                  .filter(c => c.name.toLowerCase().includes(filterInbox.toLowerCase()))
                  .map((cust) => {
                    const isActive = activeCustomer.id === cust.id;
                    const hasHotTag = cust.tags.includes("Khách Nóng");
                    
                    return (
                      <div 
                        key={cust.id} 
                        onClick={() => handleSelectCustomer(cust)}
                        className={`p-4 flex items-start gap-3 cursor-pointer transition-colors text-left relative ${
                          isActive ? "bg-slate-50 border-l-4 border-blue-500" : "hover:bg-slate-50/40"
                        }`}
                        id={`inbox_thread_${cust.id}`}
                      >
                        <div className="text-2xl p-1 bg-white border border-slate-100 rounded-full select-none relative shadow-xxs shrink-0">
                          {cust.avatar}
                          {cust.status === "online" && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-slate-800 truncate">{cust.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{cust.time}</span>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 truncate mt-1 leading-normal select-none">{cust.lastMessage}</p>
                          
                          <div className="flex flex-wrap items-center gap-1 mt-2">
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
                                    : tag === "Khách Lạnh"
                                      ? "bg-slate-50 text-slate-500 border-slate-200"
                                      : tag === "Sắp chốt HD"
                                        ? "bg-red-50 text-red-600 border-red-150"
                                        : "bg-blue-50 text-blue-600 border-blue-100"
                                }`}>
                                  {tag}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    );
                  })}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 font-mono select-none">
                Đồng bộ 4 kênh tin nhắn iGen
              </div>
            </div>

            {/* C-Col: Active chat logs dialogue screen */}
            <div className="flex-1 bg-white flex flex-col justify-between h-full relative" id="chat_main_screen">
              {/* Customer header info */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/20 flex items-center justify-between" id="chat_header">
                <div className="flex items-center gap-3">
                  <div className="text-3xl p-1.5 bg-white border border-slate-100 rounded-full relative shadow-sm select-none">
                    {activeCustomer.avatar}
                    {activeCustomer.status === "online" && (
                      <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                  </div>
                  <div className="text-left select-text">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase font-sans">
                      {activeCustomer.name}
                      {activeCustomer.isVip && <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-150 text-amber-600 text-[9px] rounded-md font-bold uppercase shrink-0 font-sans">KHÁCH VIP</span>}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono">Đại lý phân phối iGen • Hoạt động Omni-Inbox</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-[10px] font-bold font-mono">
                    HỘP THƯ CHÍNH
                  </span>
                </div>
              </div>

              {/* Messages dialogue stream feed */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" id="chat_messages_stream" style={{ maxHeight: "calc(85vh - 200px)" }}>
                {chatHistory.map((h, idx) => {
                  const isMe = h.sender === "user";
                  const isAI = h.sender === "ai";
                  const isSystem = h.text.includes("[AI AUTOMATION]");
                  
                  return (
                    <div 
                      key={h.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-end gap-2 max-w-[75%] relative">
                        {!isMe && (
                          <span className="text-xl p-1 bg-slate-50 border border-slate-100 rounded-full select-none mr-1 shrink-0 shadow-xxs">
                            {isAI ? "🤖" : "🎙️"}
                          </span>
                        )}

                        <div className={`p-3.5 rounded-2xl relative ${
                          isMe 
                            ? "bg-slate-900 border border-slate-700 text-white rounded-br-none text-right font-sans text-xs" 
                            : isSystem
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-bl-none text-left font-mono text-[10.5px]"
                              : isAI
                                ? "bg-indigo-50/70 border border-indigo-100 text-indigo-900 rounded-bl-none text-left font-sans text-xs"
                                : "bg-slate-100 text-slate-800 rounded-bl-none text-left font-sans text-xs"
                        }`}>
                          {isAI && (
                            <span className={`text-[8px] font-mono block font-bold tracking-wider mb-1 uppercase ${
                              isSystem ? "text-emerald-600" : "text-indigo-500"
                            }`}>
                              {isSystem ? "✦ HỆ THỐNG AI TỰ ĐỘNG CHỐT SALES" : "✦ iGen AI Assistant (Trả lời tự động)"}
                            </span>
                          )}
                          <p className="leading-relaxed whitespace-pre-wrap select-text">{h.text}</p>
                        </div>
                      </div>
                      
                      <span className="text-[8.5px] text-slate-400 font-mono mt-1.5 select-none font-sans">
                        {isMe ? "CRM Operator • " : ""}
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
              <form onSubmit={handleSendChatMessage} className="p-4 border-t border-slate-100 bg-white" id="chat_input_section">
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
            </div>

            {/* R-Col: Config side-panel sidebar for custom AI assistant parameters */}
            <div className="w-72 border-l border-slate-100 bg-slate-50/30 p-5 text-xs text-left overflow-y-auto shrink-0 h-full flex flex-col justify-between" id="ai_assistant_config_side_panel">
              <div className="space-y-5">
                <h4 className="font-bold text-slate-800 text-sm font-sans tracking-tight flex items-center gap-2 uppercase">
                  <Sliders className="h-4.5 w-4.5 text-blue-500" />
                  Cấu hình trợ lý AI
                </h4>
                <p className="text-slate-400 text-[10px] leading-relaxed font-sans">Tham số hóa hành vi tự động trả lời, phân tích tâm lý khách hàng đồng bộ thời gian trễ.</p>

                {/* AI switchers */}
                <div className="space-y-4 pt-4 border-t border-slate-100" id="config_switches">
                  
                  {/* auto classify */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h5 className="font-bold text-slate-700 font-sans tracking-tight">Tự phân loại khách</h5>
                      <p className="text-[9.5px] text-slate-400 mt-0.5 leading-normal">AI tự phân tích và tag nhóm hội thoại Khách VIP/Hỏi giá.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input 
                        type="checkbox" 
                        checked={aiConfig.autoClassify}
                        onChange={(e) => setAIConfig({ ...aiConfig, autoClassify: e.target.checked })}
                        className="sr-only peer" 
                      />
                      <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  {/* auto close deal */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h5 className="font-bold text-slate-700 font-sans tracking-tight">Tự động chốt đơn AI *</h5>
                      <p className="text-[9.5px] text-slate-400 mt-0.5 leading-normal">Hướng hội thoại xin địa chỉ, tạo vận đơn tự động lên ERP.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input 
                        type="checkbox" 
                        checked={aiConfig.autoCloseDeal}
                        onChange={(e) => setAIConfig({ ...aiConfig, autoCloseDeal: e.target.checked })}
                        className="sr-only peer" 
                      />
                      <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  {/* auto request feedback */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h5 className="font-bold text-slate-700 font-sans tracking-tight">Tự xin feedback quý</h5>
                      <p className="text-[9.5px] text-slate-400 mt-0.5 leading-normal">Lịch sự xin đánh giá sao sau khi khách hàng chào tạm biệt.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input 
                        type="checkbox" 
                        checked={aiConfig.autoFeedback}
                        onChange={(e) => setAIConfig({ ...aiConfig, autoFeedback: e.target.checked })}
                        className="sr-only peer" 
                      />
                      <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                </div>

                {/* delay slider config */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 font-sans">Thời gian trễ trả lời</span>
                    <strong className="font-mono bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-600">{aiConfig.replyDelay} giây (s)</strong>
                  </div>
                  <input 
                    type="range" 
                    min={1} 
                    max={45} 
                    value={aiConfig.replyDelay}
                    onChange={(e) => setAIConfig({ ...aiConfig, replyDelay: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-[9px] text-slate-400 block leading-normal text-left">Độ trễ giúp chatbot hành xử tương thích như người chăm sóc thật phục vụ hội thoại.</span>
                </div>

                {/* Custom active coreinstructions constraints */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <label className="block font-bold text-slate-700">Cài đặt nâng cao (AI Prompts)</label>
                  <textarea 
                    placeholder="Nhập luật hành xử nghiêm ngặt cho AI..."
                    value={aiConfig.advancedInstructions}
                    onChange={(e) => setAIConfig({ ...aiConfig, advancedInstructions: e.target.value })}
                    className="w-full h-24 p-3 border border-slate-200 bg-white rounded-xl text-xxs leading-relaxed focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 font-mono text-center text-[9px] text-slate-400 select-none">
                Lưu tự động cấu hình trợ lý AI
              </div>
            </div>

          </div>
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

            <form onSubmit={(e) => {
              handleCreateLead(e);
              setShowCreateLeadModal(false);
            }} className="space-y-4">
              
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

type PipelineCardProps = {
  lead: ExtendedLeadCard;
  onMove: (ns: "cold" | "warm" | "hot") => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onGoToChat: (customerName: string) => void;
};

// PIPELINE CARD widget representing a single potential lead
const PipelineCard: React.FC<PipelineCardProps> = ({
  lead,
  onMove,
  onDelete,
  onDragStart,
  onGoToChat
}) => {
  const isHot = lead.status === "hot";

  return (
    <div 
      draggable
      onDragStart={onDragStart}
      className={`bg-white border border-slate-200 rounded-2xl p-3 shadow-xs hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing flex flex-col gap-2.5 relative text-left ${
        isHot 
          ? "border-rose-350 shadow-rose-100/20" 
          : lead.status === "warm"
            ? "border-orange-200 shadow-orange-50/20"
            : "border-slate-200 shadow-slate-50"
      }`}
      id={`pipeline_card_${lead.id}`}
    >
      {/* Badge & Avatar Header */}
      <div className="flex items-center gap-2.5">
        <div className="text-lg p-1 bg-slate-50 border border-slate-100 rounded-xl select-none shrink-0 shadow-xxs">
          {lead.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h5 className="font-extrabold text-slate-800 text-xs leading-none truncate font-sans">{lead.customerName}</h5>
          <p className="text-[10px] text-slate-400 font-mono mt-1 leading-none truncate">{lead.company}</p>
        </div>
      </div>

      {/* Status & Value Row */}
      <div className="flex items-center justify-between py-1.5 border-y border-slate-100 text-[11px] leading-tight">
        <div>
          <span className="text-[8.5px] text-slate-400 block font-bold uppercase tracking-wider">Tiến độ</span>
          <span className={`inline-block mt-0.5 px-1.5 py-0.5 text-[8px] font-bold rounded-md uppercase tracking-wider ${
            lead.lastInteraction === "Sắp chốt HD" 
              ? "bg-red-50 text-red-600 border border-red-100" 
              : lead.lastInteraction === "Đã gửi báo giá"
                ? "bg-blue-50 text-blue-600 border border-blue-100"
                : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}>
            {lead.lastInteraction || "Mới tiếp cận"}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[8.5px] text-slate-400 block font-bold uppercase tracking-wider">Dự toán đơn</span>
          <strong className="text-blue-600 font-extrabold font-mono text-[10.5px] block mt-0.5">
            {lead.value > 0 ? `${lead.value.toLocaleString("vi-VN")} đ` : "Chưa xác định"}
          </strong>
        </div>
      </div>



      {/* Time & Delete Action Row */}
      <div className="flex items-center justify-between text-[9.5px] text-slate-400 pt-0.5">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-300" />
          <span>{lead.lastInteractionTime || "Chưa rõ"}</span>
        </div>
        <button 
          onClick={onDelete} 
          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-505 text-rose-500 rounded-md transition-colors cursor-pointer"
          title="Xóa cơ hội này"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Hybrid Action Controls for Lowtech Users */}
      <div className="grid grid-cols-2 gap-1.5 mt-0.5 pt-1.5 border-t border-slate-100 shrink-0">
        <button
          onClick={() => onGoToChat(lead.customerName)}
          className="py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-xl text-[9.5px] font-bold transition-all border border-slate-200 hover:border-blue-200 flex items-center justify-center gap-1 cursor-pointer"
        >
          <MessageSquare className="w-3 h-3 shrink-0" />
          Nhắn tin
        </button>

        {lead.status === "cold" && (
          <button 
            onClick={() => onMove("warm")}
            className="py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-[9.5px] font-bold transition-all flex items-center justify-center gap-0.5 cursor-pointer shadow-sm shadow-orange-500/10 active:scale-95"
          >
            Chuyển Ấm →
          </button>
        )}
        
        {lead.status === "hot" && (
          <button 
            onClick={() => onMove("warm")}
            className="py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-[9.5px] font-bold transition-all flex items-center justify-center gap-0.5 cursor-pointer shadow-sm shadow-slate-500/10 active:scale-95"
          >
            ← Chuyển Ấm
          </button>
        )}

        {lead.status === "warm" && (
          <div className="flex gap-1">
            <button 
              onClick={() => onMove("cold")}
              className="flex-1 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-[9.5px] font-bold transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
              title="Chuyển Lạnh"
            >
              ← Lạnh
            </button>
            <button 
              onClick={() => onMove("hot")}
              className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[9.5px] font-bold transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
              title="Chuyển Nóng"
            >
              Nóng →
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
