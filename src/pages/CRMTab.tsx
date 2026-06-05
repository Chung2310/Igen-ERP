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
  Activity
} from "lucide-react";
import { CRMSubTabType, ChatMessage, CustomerInbox, AIChatConfig, LeadCard } from "../types";
import { geminiApi } from "../api/gemini";
import { toast } from "./Toast";

export default function CRMTab() {
  const [subTab, setSubTab] = useState<CRMSubTabType>("OMNI-INBOX CHAT");

  // 1. Leads Kanban Pipeline States (Phễu Khách hàng)
  const [leads, setLeads] = useState<LeadCard[]>([
    { id: "lead-1", customerName: "Lê Thị B", company: "Cửa hàng Phụ kiện Đống Đa", value: 45000000, phone: "0911222333", avatar: "👩‍💼", email: "le.tb@gmail.com", productOfChoice: "Bàn phím cơ Workspace V2", status: "cold", lastInteraction: "Chưa kết nối" },
    { id: "lead-2", customerName: "Trần Văn C", company: "Công ty Robot Việt", value: 125000000, phone: "0911333444", avatar: "👨‍💻", email: "tran.vc@robotviet.vn", productOfChoice: "Linh kiện cánh tay robot X-5", status: "cold", lastInteraction: "Gửi email báo giá sơ bộ" },
    { id: "lead-3", customerName: "Phạm Thị D", company: "Hệ thống nhà thuốc Pharm-H", value: 89000000, phone: "0912444555", avatar: "👩‍⚕️", email: "d.pharmh@gmail.com", productOfChoice: "Thiết bị đeo thông minh X1", status: "warm", lastInteraction: "Gọi điện tư vấn, xin địa chỉ" },
    { id: "lead-4", customerName: "Nguyễn Văn A", company: "Trung tâm Yoga Life", value: 18900000, phone: "0913555666", avatar: "🧘", email: "van.na@yogalife.vn", productOfChoice: "Thiết bị đeo thông minh X1", status: "hot", lastInteraction: "Khách VIP hỏi han nhiệt tình" },
    { id: "lead-5", customerName: "Hoàng Quân", company: "Tập đoàn công nghệ Q-Tech", value: 450000000, phone: "0915666777", avatar: "👨‍💼", email: "quan.h@qtech.com.vn", productOfChoice: "Gói Dịch vụ Cloud Enterprise 500GB", status: "hot", lastInteraction: "Chuẩn bị demo giải pháp" },
    { id: "lead-6", customerName: "Lê Minh", company: "Studio nghệ thuật Artify", value: 8900000, phone: "0916777888", avatar: "🎨", email: "minh.l@artify.vn", productOfChoice: "Tai nghe không dây Pro Max", status: "won", lastInteraction: "Đã xuất hóa đơn, chờ giao" },
  ]);

  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadValue, setNewLeadValue] = useState("");
  const [newLeadProduct, setNewLeadProduct] = useState("Thiết bị đeo thông minh X1");

  const [searchPipeline, setSearchPipeline] = useState("");

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim()) return;
    const newLead: LeadCard = {
      id: "lead_" + Date.now(),
      customerName: newLeadName,
      company: "Liên hệ cá nhân mới",
      value: parseFloat(newLeadValue) || 1000000,
      phone: "Chưa bổ sung",
      avatar: "👤",
      email: "chua.co@igen.vn",
      productOfChoice: newLeadProduct,
      status: "cold",
      lastInteraction: "Vừa nhập lên ERP"
    };
    setLeads([newLead, ...leads]);
    setNewLeadName("");
    setNewLeadValue("");
  };

  const moveLeadPipeline = (id: string, newStatus: "cold" | "warm" | "hot" | "won" | "upsell") => {
    setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus } : l));
  };

  const deleteLead = (id: string) => {
    setLeads(leads.filter(l => l.id !== id));
  };


  // 2. Omni-Inbox & AI Chatbot Configuration Simulator States
  const [activeCustomer, setActiveCustomer] = useState<CustomerInbox>({
    id: "cust-1",
    name: "Nguyễn Thị Mai",
    avatar: "👩‍💼",
    lastMessage: "Giá thiết bị đeo thông minh X1 là bao nhiêu ạ?",
    time: "3 phút trước",
    unreadCount: 1,
    isVip: true,
    status: "online",
    tags: ["Khách VIP", "Hỏi giá X1"]
  });

  const inboxCustomers: CustomerInbox[] = [
    { id: "cust-1", name: "Nguyễn Thị Mai", avatar: "👩‍💼", lastMessage: "Giá thiết bị đeo thông minh X1 là bao nhiêu ạ?", time: "3 phút trước", unreadCount: 1, isVip: true, status: "online", tags: ["Khách VIP", "Hỏi giá X1"] },
    { id: "cust-2", name: "Trần Hùng", avatar: "👨‍💻", lastMessage: "Bên mình có free ship nội thành Hà Nội không?", time: "18 phút trước", unreadCount: 0, isVip: false, status: "offline", tags: ["Hỏi Ship"] },
    { id: "cust-3", name: "Lê Văn B", avatar: "📦", lastMessage: "Gửi cho tôi hóa đơn giá trị gia tăng nhé.", time: "1 giờ trước", unreadCount: 0, isVip: false, status: "online", tags: ["Cần Hóa Đơn"] },
    { id: "cust-4", name: "Phạm Vy", avatar: "👩‍⚕️", lastMessage: "Có khuyến mãi gì dịp cuối năm này không ạ?", time: "3 giờ trước", unreadCount: 0, isVip: true, status: "offline", tags: ["Khách VIP"] }
  ];

  // Specific virtual chat histories for Nguyen Thi Mai client
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

  // Handle active client selection trigger mock histories
  const [filterInbox, setFilterInbox] = useState("");

  const handleSelectCustomer = (cust: CustomerInbox) => {
    setActiveCustomer(cust);
    if (cust.name === "Nguyễn Thị Mai") {
      setChatHistory([
        { id: "c-1", sender: "user", text: "Xin chào, tôi là Mai. Tôi đang chuẩn bị quà tặng cho toàn thể nhân viên.", timestamp: new Date(Date.now() - 3600000 * 2) },
        { id: "c-2", sender: "ai", text: "Dạ, iGen ERP hân hạnh chào đón chị Nguyễn Thị Mai (khách VIP). Rất tuyệt vời khi chị ghé thăm ạ!", timestamp: new Date(Date.now() - 3600000) },
        { id: "c-3", sender: "user", text: "Tôi muốn tham khảo thiết bị đeo thông minh X1. Giá thiết bị này là bao nhiêu ạ?", timestamp: new Date(Date.now() - 180000) }
      ]);
    } else {
      setChatHistory([
        { id: "c-a", sender: "user", text: `Xin chào! Cho tôi hỏi thông tin về ${cust.name === "Trần Hùng" ? "Vận chuyển ship" : cust.name === "Lê Văn B" ? "Hóa Đơn mua hàng" : "Khuyến mãi"}`, timestamp: new Date() }
      ]);
    }
  };

  // Run the conversation message flow triggering Express-hosted chatbot API
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const msgText = typeMessage.trim();
    if (!msgText) return;

    // Create immediate user message
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
      // Gọi API đến Express server qua geminiApi client module
      const data = await geminiApi.sendChatMessage(
        msgText,
        chatHistory.map(h => ({ sender: h.sender, text: h.text })),
        aiConfig
      );
      
      // Delay AI answer simulation according to Slider
      setTimeout(() => {
        const aiMsg: ChatMessage = {
          id: "ai_" + Date.now(),
          sender: "ai",
          text: data.text || "Dạ, Trợ lý AI đang bận kết nối. Vui lòng thử lại ạ!",
          timestamp: new Date()
        };
        setChatHistory((prev) => [...prev, aiMsg]);
        setAIWaiting(false);
      }, aiConfig.replyDelay * 100); // reduced slightly so user doesn't wait too long but still experiences simulated delay!
    } catch (err) {
      console.error(err);
      setAIWaiting(false);
      toast.error("Kết nối AI Trợ Lý Chatbot bị gián đoạn.");
    }
  };

  // Scroll to bottom helper of chat dialog box
  const chatBottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, aiWaiting]);

  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="crm_tab_wrapper">
      
      {/* Sub tabs selector bar */}
      <div className="border-b border-gray-200 bg-gray-50/50 p-2 text-xs flex justify-between shrink-0" id="crm_sub_tabs_switch">
        <div className="flex gap-2">
          {["PHỄU KHÁCH HÀNG", "OMNI-INBOX CHAT"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab as CRMSubTabType)}
              className={`px-4 py-2 rounded-lg border font-bold uppercase transition-all tracking-wide ${
                subTab === tab 
                  ? "bg-slate-800 text-white border-slate-800 shadow-xs" 
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-rose-50 rounded-full border border-rose-200 text-rose-800 font-mono text-[10px]">
          <Activity className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
          <span>Omni-Channel Lead Routing Active</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden" id="crm_tab_main_content">
        
        {/* SUB TAB 1: PHỄU KHÁCH HÀNG KANBAN */}
        {subTab === "PHỄU KHÁCH HÀNG" && (
          <div className="p-6 overflow-y-auto h-full space-y-6" id="leads_pipeline_kanban">
            
            {/* Quick lead creation form */}
            <form onSubmit={handleCreateLead} className="bg-slate-50 border border-gray-200 p-5 rounded-2xl flex flex-wrap gap-4 items-end" id="quick_add_lead_form">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 font-sans">Tên khách hàng Tiềm năng *</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Hoàng Anh Quân (Đại lý Q-Tech)..." 
                  required
                  className="w-full text-left px-3.5 py-2 border border-gray-205 bg-white border-gray-200 rounded-lg text-xs"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 font-sans">Dự toán giá trị đơn hàng (VNĐ)</label>
                <input 
                  type="number" 
                  placeholder="Ex: 50000000" 
                  className="px-3 py-2 border border-gray-200 bg-white rounded-lg text-xs font-mono"
                  value={newLeadValue}
                  onChange={(e) => setNewLeadValue(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 font-sans">Sản phẩm quan tâm</label>
                <select 
                  className="px-3.5 py-2 border border-gray-200 bg-white rounded-lg text-xs"
                  value={newLeadProduct}
                  onChange={(e) => setNewLeadProduct(e.target.value)}
                >
                  <option value="Thiết bị đeo thông minh X1">Thiết bị đeo thông minh X1</option>
                  <option value="Cloud Storage Enterprise">Cloud Storage Enterprise</option>
                  <option value="Tai nghe không dây Pro Max">Tai nghe không dây Pro Max</option>
                  <option value="Bàn phím cơ Workspace V2">Bàn phím cơ Workspace V2</option>
                </select>
              </div>

              <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Thêm Tiềm Năng
              </button>
            </form>

            {/* Pipeline Columns Scrollable container */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto" id="pipeline_columns_grid">
              
              {/* COLD: KHÁCH LẠNH */}
              <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-2xl flex flex-col min-h-[420px]" id="pipeline_cold">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <span className="text-[11px] font-bold text-gray-550 text-slate-700">KHÁCH LẠNH (COLD)</span>
                  <span className="bg-slate-250 bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {leads.filter(l => l.status === "cold").length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {leads.filter(l => l.status === "cold").map(l => (
                    <PipelineCard key={l.id} lead={l} onMove={(ns) => moveLeadPipeline(l.id, ns)} onDelete={() => deleteLead(l.id)} />
                  ))}
                </div>
              </div>

              {/* WARM: KHÁCH ẤM */}
              <div className="bg-orange-50/20 border border-orange-100 p-4 rounded-2xl flex flex-col min-h-[420px]" id="pipeline_warm">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <span className="text-[11px] font-bold text-orange-700">KHÁCH ẤM (WARM)</span>
                  <span className="bg-orange-100 text-orange-850 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {leads.filter(l => l.status === "warm").length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {leads.filter(l => l.status === "warm").map(l => (
                    <PipelineCard key={l.id} lead={l} onMove={(ns) => moveLeadPipeline(l.id, ns)} onDelete={() => deleteLead(l.id)} />
                  ))}
                </div>
              </div>

              {/* HOT: KHÁCH NÓNG */}
              <div className="bg-red-50/20 border border-red-100 p-4 rounded-2xl flex flex-col min-h-[420px]" id="pipeline_hot">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <span className="text-[11px] font-bold text-red-700">KHÁCH NÓNG (HOT)</span>
                  <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {leads.filter(l => l.status === "hot").length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {leads.filter(l => l.status === "hot").map(l => (
                    <PipelineCard key={l.id} lead={l} onMove={(ns) => moveLeadPipeline(l.id, ns)} onDelete={() => deleteLead(l.id)} />
                  ))}
                </div>
              </div>

              {/* WON: ĐÃ CHỐT */}
              <div className="bg-green-50/20 border border-green-100 p-4 rounded-2xl flex flex-col min-h-[420px]" id="pipeline_won">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <span className="text-[11px] font-bold text-green-700">ĐÃ CHỐT ĐƠN (WON)</span>
                  <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {leads.filter(l => l.status === "won").length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {leads.filter(l => l.status === "won").map(l => (
                    <PipelineCard key={l.id} lead={l} onMove={(ns) => moveLeadPipeline(l.id, ns)} onDelete={() => deleteLead(l.id)} />
                  ))}
                </div>
              </div>

              {/* UPSELL: CẦN UPSELL */}
              <div className="bg-indigo-50/20 border border-indigo-150 p-4 rounded-2xl flex flex-col min-h-[420px]" id="pipeline_upsell">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <span className="text-[11px] font-bold text-indigo-700 font-medium font-sans">CẦN UPSELL (FOLLOW)</span>
                  <span className="bg-indigo-100 text-indigo-850 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {leads.filter(l => l.status === "upsell").length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {leads.filter(l => l.status === "upsell").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic leading-normal border-2 border-dashed rounded-xl">Chưa có ai</div>
                  ) : (
                    leads.filter(l => l.status === "upsell").map(l => (
                      <PipelineCard key={l.id} lead={l} onMove={(ns) => moveLeadPipeline(l.id, ns)} onDelete={() => deleteLead(l.id)} />
                    ))
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
            <div className="w-72 border-r border-gray-200 flex flex-col justify-between shrink-0 h-full" id="inbox_sidebar">
              <div className="p-4 border-b border-gray-150">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Tìm hộp thư khách hàng..." 
                    value={filterInbox}
                    onChange={(e) => setFilterInbox(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-200 bg-slate-50 rounded-lg text-xs"
                    id="inbox_sidebar_search"
                  />
                </div>
              </div>

              {/* Thread list scroll content */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100" id="inbox_thread_list">
                {inboxCustomers
                  .filter(c => c.name.toLowerCase().includes(filterInbox.toLowerCase()))
                  .map((cust) => {
                    const isActive = activeCustomer.id === cust.id;
                    return (
                      <div 
                        key={cust.id} 
                        onClick={() => handleSelectCustomer(cust)}
                        className={`p-4 flex items-start gap-3 cursor-pointer transition-colors text-left relative ${
                          isActive ? "bg-slate-50 border-l-4 border-blue-500" : "hover:bg-slate-50/40"
                        }`}
                        id={`inbox_thread_${cust.id}`}
                      >
                        <div className="text-2xl p-1 bg-white border rounded-full select-none relative shadow-xs shrink-0">
                          {cust.avatar}
                          {cust.status === "online" && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-slate-800 truncate">{cust.name}</span>
                            <span className="text-[9px] text-gray-400 font-mono">{cust.time}</span>
                          </div>
                          
                          <p className="text-[10px] text-gray-500 truncate mt-1 leading-normal select-none">{cust.lastMessage}</p>
                          
                          <div className="flex items-center gap-1.5 mt-2">
                            {cust.isVip && (
                              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[8px] font-semibold border border-amber-150 rounded-sm">
                                VIP
                              </span>
                            )}
                            {cust.unreadCount > 0 && (
                              <span className="w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-[8px] font-mono shrink-0">
                                {cust.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-150 text-center text-[10px] text-gray-400 font-mono select-none">
                Đồng bộ 4 kênh tin nhắn iGen
              </div>
            </div>

            {/* C-Col: Active chat logs dialogue screen */}
            <div className="flex-1 bg-white flex flex-col justify-between h-full relative" id="chat_main_screen">
              {/* Customer header info */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between" id="chat_header">
                <div className="flex items-center gap-3">
                  <div className="text-3xl p-1.5 bg-white border rounded-full relative shadow-sm select-none">
                    {activeCustomer.avatar}
                    {activeCustomer.status === "online" && (
                      <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                  </div>
                  <div className="text-left select-text">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase font-sans">
                      {activeCustomer.name}
                      {activeCustomer.isVip && <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-150 text-amber-600 text-[9px] rounded-md font-bold uppercase shrink-0 font-sans">KHÁCH VIP</span>}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-mono">Trực tuyến mạng xã hội • Đại lý phân phối iGen</p>
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
                  return (
                    <div 
                      key={h.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-end gap-2 max-w-[75%] relative">
                        {!isMe && (
                          <span className="text-xl p-1 bg-gray-50 border rounded-full select-none mr-1 shrink-0 shadow-xs">
                            {isAI ? "🤖" : "🎙️"}
                          </span>
                        )}

                        <div className={`p-3.5 rounded-2xl relative ${
                          isMe 
                            ? "bg-slate-900 border border-slate-700 text-white rounded-br-none text-right font-sans text-xs" 
                            : isAI
                              ? "bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-bl-none text-left font-sans text-xs"
                              : "bg-gray-100 text-gray-800 rounded-bl-none text-left font-sans text-xs"
                        }`}>
                          {isAI && (
                            <span className="text-[8px] font-mono block text-indigo-500 font-bold tracking-wider mb-1 uppercase">
                              ✦ iGen AI Assistant (Trả lời tự động)
                            </span>
                          )}
                          <p className="leading-relaxed font-sans select-text whitespace-pre-wrap">{h.text}</p>
                        </div>
                      </div>
                      
                      <span className="text-[8.5px] text-gray-400 font-mono mt-1.5 select-none font-sans">
                        {isMe ? "CRM Operator • " : ""}
                        {new Date(h.timestamp).toLocaleTimeString("vi-VN", { hour: "numeric", minute: "numeric" })}
                      </span>
                    </div>
                  );
                })}

                {/* Pulsing Loading active thinking response from AI */}
                {aiWaiting && (
                  <div className="flex items-start gap-2.5" id="ai_thinking_marker">
                    <span className="text-xl p-1 bg-gray-50 border border-indigo-150 rounded-full select-none shrink-0 shadow-xs animate-spin-slow">🤖</span>
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl rounded-bl-none">
                      <span className="text-[8px] font-mono block text-indigo-400 font-bold mb-1 uppercase tracking-widest">Trợ lý AI bận phân tích cấu hình...</span>
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
              <form onSubmit={handleSendChatMessage} className="p-4 border-t border-gray-150 bg-white" id="chat_input_section">
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder={`Gửi phản hồi cho ${activeCustomer.name}...`}
                    className="flex-1 text-left px-4 py-2.5 border border-gray-250 bg-slate-50/40 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 font-sans"
                    value={typeMessage}
                    onChange={(e) => setTypeMessage(e.target.value)}
                    disabled={aiWaiting}
                  />
                  <button 
                    type="submit"
                    disabled={aiWaiting || !typeMessage.trim()}
                    className={`p-3 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 ${
                      aiWaiting || !typeMessage.trim()
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95"
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>

            {/* R-Col: Config side-panel sidebar for custom AI assistant parameters */}
            <div className="w-72 border-l border-gray-200 bg-gray-55/35 p-5 text-xs text-left overflow-y-auto shrink-0 h-full flex flex-col justify-between" id="ai_assistant_config_side_panel">
              <div className="space-y-5">
                <h4 className="font-bold text-gray-800 text-sm font-sans tracking-tight flex items-center gap-2 uppercase">
                  <Sliders className="h-4.5 w-4.5 text-blue-500" />
                  Cấu hình trợ lý AI
                </h4>
                <p className="text-gray-400 text-xxs mt-1 leading-snug font-sans">Tham số hóa hành vi tự động trả lời, phân tích tâm lý khách hàng đồng bộ thời gian trễ.</p>

                {/* AI switchers */}
                <div className="space-y-4 pt-4 border-t" id="config_switches">
                  
                  {/* auto classify */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h5 className="font-bold text-slate-800 font-sans tracking-tight">Tự phân loại khách</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-normal">AI tự phân tich và tag nhóm hội thoại Khách VIP/Hỏi giá.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={aiConfig.autoClassify}
                        onChange={(e) => setAIConfig({ ...aiConfig, autoClassify: e.target.checked })}
                        className="sr-only peer" 
                      />
                      <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  {/* auto close deal */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h5 className="font-bold text-slate-800 font-sans tracking-tight">Tự động chốt đơn AI *</h5>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-normal">Hướng hội thoại xin địa chỉ, tạo vận đơn tự động lên ERP.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={aiConfig.autoCloseDeal}
                        onChange={(e) => setAIConfig({ ...aiConfig, autoCloseDeal: e.target.checked })}
                        className="sr-only peer" 
                      />
                      <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  {/* auto request feedback */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h5 className="font-bold text-slate-800 font-sans tracking-tight">Tự xin feedback quý</h5>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-normal">Lịch sự xin đánh giá sao sau khi khách hàng chào tạm biệt.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={aiConfig.autoFeedback}
                        onChange={(e) => setAIConfig({ ...aiConfig, autoFeedback: e.target.checked })}
                        className="sr-only peer" 
                      />
                      <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                </div>

                {/* delay slider config */}
                <div className="pt-4 border-t space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 font-sans">Thời gian trễ trả lời</span>
                    <strong className="font-mono bg-white px-2 py-0.5 border border-gray-150 rounded text-slate-650">{aiConfig.replyDelay} giây (s)</strong>
                  </div>
                  <input 
                    type="range" 
                    min={1} 
                    max={45} 
                    value={aiConfig.replyDelay}
                    onChange={(e) => setAIConfig({ ...aiConfig, replyDelay: parseInt(e.target.value) })}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-[9px] text-gray-400 block leading-normal text-left">Độ trễ giúp chatbot hành xử tương thích như người chăm sóc thật phục vụ hội thoại.</span>
                </div>

                {/* Custom active coreinstructions constraints */}
                <div className="pt-4 border-t space-y-2">
                  <label className="block font-bold text-slate-800">Cài đặt nâng cao (AI Prompts)</label>
                  <textarea 
                    placeholder="Nhập luật hành xử nghiêm ngặt cho AI..."
                    value={aiConfig.advancedInstructions}
                    onChange={(e) => setAIConfig({ ...aiConfig, advancedInstructions: e.target.value })}
                    className="w-full h-24 p-3 border border-gray-200 bg-white rounded-lg text-xxs leading-relaxed focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t font-mono text-center text-[10px] text-gray-400">
                Lưu tự động cấu hình trợ lý AI
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

// PIPELINE CARD widget representing a single potential lead
function PipelineCard({ lead, onMove, onDelete }: { key?: any; lead: LeadCard; onMove: (ns: "cold" | "warm" | "hot" | "won" | "upsell") => void; onDelete: () => void }) {
  return (
    <div className="bg-white border text-left border-gray-200 p-3.5 rounded-xl shadow-xs hover:shadow-md transition-all flex flex-col gap-2 relative group" id={`pipeline_card_${lead.id}`}>
      
      <div className="flex justify-between items-start gap-2">
        <div className="text-xl shrink-0 p-1 bg-slate-50 border rounded-full select-none">{lead.avatar}</div>
        <div className="text-xs flex-1">
          <h5 className="font-bold text-gray-800 leading-none truncate font-sans">{lead.customerName}</h5>
          <p className="text-[9px] text-gray-400 font-mono mt-1 leading-none truncate select-none">{lead.company}</p>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-2 flex items-center justify-between text-[11px] leading-none">
        <span className="text-gray-400">Dự án:</span>
        <strong className="text-indigo-600 font-bold font-mono">{lead.value.toLocaleString("vi-VN")} đ</strong>
      </div>
      <p className="text-[10px] text-gray-600 italic bg-slate-50/50 rounded p-1 flex items-center gap-1 leading-relaxed">
        <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
        <span className="truncate">{lead.lastInteraction}</span>
      </p>

      {/* Action triggers to swap pipeline */}
      <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] opacity-80 group-hover:opacity-100 transition-opacity">
        <button onClick={onDelete} className="text-red-500 hover:text-red-700 font-bold font-mono">Hủy</button>
        <div className="flex gap-1.5">
          {lead.status !== "cold" && (
            <button 
              onClick={() => {
                const stages: ("cold" | "warm" | "hot" | "won" | "upsell")[] = ["cold", "warm", "hot", "won", "upsell"];
                const currIdx = stages.indexOf(lead.status);
                onMove(stages[currIdx - 1]);
              }}
              className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-slate-700 rounded-md font-bold"
            >
              ←
            </button>
          )}
          {lead.status !== "upsell" && (
            <button 
              onClick={() => {
                const stages: ("cold" | "warm" | "hot" | "won" | "upsell")[] = ["cold", "warm", "hot", "won", "upsell"];
                const currIdx = stages.indexOf(lead.status);
                onMove(stages[currIdx + 1]);
              }}
              className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold"
            >
              →
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
