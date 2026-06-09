import React, { useRef, useEffect, useState } from "react";
import { Search, Send, Sliders, Zap, FileText, DollarSign, MessageSquare } from "lucide-react";
import { CustomerInbox, ChatMessage, AIChatConfig } from "../../types";

type OmniChatTabProps = {
  inboxCustomers: CustomerInbox[];
  activeCustomer: CustomerInbox | null;
  chatHistory: ChatMessage[];
  typeMessage: string;
  setTypeMessage: (val: string) => void;
  aiWaiting: boolean;
  aiConfig: AIChatConfig;
  setAIConfig: (config: AIChatConfig) => void;
  handleSelectCustomer: (cust: CustomerInbox) => void;
  handleSendChatMessage: (e: React.FormEvent) => void;
};

export const OmniChatTab: React.FC<OmniChatTabProps> = ({
  inboxCustomers,
  activeCustomer,
  chatHistory,
  typeMessage,
  setTypeMessage,
  aiWaiting,
  aiConfig,
  setAIConfig,
  handleSelectCustomer,
  handleSendChatMessage,
}) => {
  const [filterInbox, setFilterInbox] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống cuối khung chat khi có tin nhắn mới hoặc AI đang xử lý
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, aiWaiting]);

  return (
    <div className="flex h-full overflow-hidden" id="omni_inbox_layout">
      
      {/* L-Col: Inbox Customers list */}
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
              const isActive = activeCustomer?.id === cust.id;
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
                              : tag === "Khách VIP"
                                ? "bg-purple-55 bg-purple-50 text-purple-650 text-purple-600 border-purple-100"
                                : "bg-slate-50 text-slate-500 border-slate-150"
                          }`}>
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {cust.unreadCount > 0 && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-sm">
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
      <div className="flex-1 bg-slate-50/20 flex flex-col justify-between h-full overflow-hidden" id="chat_conversation_area">
        {!activeCustomer ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-white">
            <MessageSquare className="w-12 h-12 text-slate-200 mb-3 animate-pulse" />
            <h4 className="font-extrabold text-slate-700 text-sm font-sans mb-1">Chưa chọn cuộc hội thoại</h4>
            <p className="text-[11px] text-slate-400 leading-normal max-w-xs font-sans">Vui lòng chọn một cuộc trò chuyện từ danh sách bên trái hoặc nhắn tin từ thẻ cơ hội bán hàng để bắt đầu.</p>
          </div>
        ) : (
          <>
            {/* Active Customer Info Top Header */}
            <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between shrink-0" id="chat_header">
              <div className="flex items-center gap-3 text-left">
                <span className="text-2xl p-1 bg-slate-50 border border-slate-100 rounded-full select-none shadow-xxs">
                  {activeCustomer.avatar}
                </span>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 font-sans">
                    {activeCustomer.name}
                    {activeCustomer.isVip && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-extrabold rounded-md shadow-sm">VIP</span>
                    )}
                  </h4>
                  <p className="text-[9.5px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                    Đang trực tuyến • ID: {activeCustomer.id}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-[10px] font-bold font-mono">
                  HỘP THƯ CHÍNH
                </span>
              </div>
            </div>

            {/* Messages dialogue stream feed */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" id="chat_messages_stream" style={{ maxHeight: "calc(85vh - 200px)" }}>
              {chatHistory.map((h) => {
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
          </>
        )}
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
  );
};
