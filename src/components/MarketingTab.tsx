import React, { useState } from "react";
import { 
  Sparkles, 
  Send, 
  Trash2, 
  Check, 
  X, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  ThumbsUp, 
  Zap, 
  FileEdit,
  Eye,
  RefreshCw
} from "lucide-react";
import { MarketingSubTabType, MarketingConcept, ContentApprovalCard, PublishEvent } from "../types";

export default function MarketingTab() {
  const [subTab, setSubTab] = useState<MarketingSubTabType>("LÊN Ý TƯỞNG AI");

  // 1. AI Campaign Ideation States
  const [campaignInput, setCampaignInput] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [concepts, setConcepts] = useState<MarketingConcept[]>([
    {
      title: "Chiến dịch: Chạm Đột Phá - Sành điệu công nghệ X1",
      matchPercent: 92,
      summary: "Tạo các video ngắn trên TikTok hướng đến lối sống tích cực, nhấn mạnh khả năng kết nối không dây siêu mượt và tính năng đo nhịp tim tự động của thiết bị X1.",
      channels: ["TikTok Short Video", "Instagram Video Reels"],
      suggestedContent: "🎬 Kịch bản Reels: Một ngày bận rộn bắt đầu... Chạm nhẹ thiết bị đeo X1 để bật nhạc chạy bộ buổi sáng kết thúc ngày hiệu năng đỉnh cao."
    },
    {
      title: "Giải pháp chuyển đổi số - Tri ân doanh nghiệp",
      matchPercent: 88,
      summary: "Chiến dịch bài viết uy tín sâu trên LinkedIn & Facebook tri ân các đối tác đã số hóa quản lý Kho hàng nhờ iGen ERP.",
      channels: ["LinkedIn Article", "Facebook Post", "Email Newsletter"],
      suggestedContent: "✍️ Câu chuyện: Gặp gỡ thương hiệu thời trang G-Trend, từ bế tắc thất thoát tồn kho đến quản lý an nhàn tự động 100% nhờ iGen-Forecast."
    }
  ]);

  const handleGenerateIdeas = async (e: React.FormEvent) => {
    e.preventDefault();
    const topic = campaignInput.trim();
    if (!topic) return;

    setLoadingAI(true);
    try {
      const response = await fetch("/api/gemini/marketing-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignTopic: topic }),
      });
      const data = await response.json();
      if (data.concepts) {
        setConcepts(data.concepts);
      }
    } catch (err) {
      console.error(err);
      alert("Kết nối tới AI Marketing Tool thất bại. Hệ thống sẽ tự phục hồi.");
    } finally {
      setLoadingAI(false);
    }
  };

  // Prepopulate standard suggestions
  const quickSuggestions = [
    "Khai trương Showroom linh kiện thiết bị robot mới",
    "Ưu đãi Black Friday giảm giá cực sốc 45% tai nghe Pro Max",
    "Tuyển dụng chuyên viên AI Copywriter đãi ngộ cực khủng",
    "Tri ân hội viên VIP tặng mã voucher VIP-10 độc quyền"
  ];

  // 2. Content Approval and Pipeline States
  const [approvalCards, setApprovalCards] = useState<ContentApprovalCard[]>([
    { id: "mod-1", title: "Review Bàn phím Workspace V2", channel: "Facebook", contentType: "Hình ảnh kèm Caption", status: "pending", bodyText: "⌨️ Bạn đã chán cảnh gõ phím kẹt rít, mỏi nhức tay khi ngồi làm việc liên tục 8 tiếng? Nâng cấp phong cách bàn làm việc của bạn cùng Bàn phím cơ Workspace V2 - trải nghiệm lực gõ êm mượt, tối ưu cho năng suất cực hạn!", generatedAt: "Hôm nay, 09:30" },
    { id: "mod-2", title: "Khai phá Sức mạnh AI trong iGen ERP", channel: "LinkedIn", contentType: "Bài viết chuyên sâu (Pulse/Article)", status: "pending", bodyText: "📊 Thống kê cho thấy hơn 72% doanh nghiệp vừa và nhỏ tại Đông Nam Á vẫn đau đầu vì thông tin đứt quãng giữa CRM và Kho bãi... Hôm nay, hãng iGen ra mắt giải pháp Tích hợp Tự động AI hóa, kết hợp mô hình Gemini 3.5 dự báo thiếu hàng cực kỳ chính xác.", generatedAt: "Hôm qua, 15:00" },
    { id: "mod-3", title: "Trải nghiệm Đeo X1 Thể dục", channel: "TikTok", contentType: "Kịch bản Video ngắn 15s", status: "draft", bodyText: "🎬 [Mở đầu camera zoom cận cảnh thiết bị X1] Tiếng beep đếm nhịp tim đập. Giọng nói thoại: 'Đừng để mệt mỏi ngăn cản nhịp đập tiến bước của bạn...' Trải nghiệm thể dục năng động thông minh.", generatedAt: "Hôm nay, 10:15" },
    { id: "mod-4", title: "Công bố Chương trình Flash Sale Tháng 10", channel: "Facebook", contentType: "Hình ảnh Banner", status: "scheduled", bodyText: "🔥 ĐỘC QUYỀN TRÊN IGEN: GIỜ VÀNG SĂN SHOCK từ 12h-14h hôm nay! Giảm giá tới 40% cho tất cả thiết bị đeo thông minh và linh kiện phụ trợ robot.", generatedAt: "Hôm qua, 11:30" }
  ]);

  const approveContent = (id: string) => {
    setApprovalCards(approvalCards.map(c => c.id === id ? { ...c, status: "scheduled" } : c));
  };

  const rejectContent = (id: string) => {
    setApprovalCards(approvalCards.filter(c => c.id !== id));
  };

  const [promptMore, setPromptMore] = useState("");
  const handleAIGenerateMore = () => {
    if (!promptMore.trim()) return;
    const newCard: ContentApprovalCard = {
      id: "mod_" + Date.now(),
      title: "Bản tin phát nhanh: " + promptMore,
      channel: "Facebook",
      contentType: "Bài viết AI Copywriter soạn thảo",
      status: "draft",
      bodyText: `[AI Content Generator]: Về đề xuất "${promptMore}" - Hãy khởi tạo chiến dịch khuyến mãi, tri ân sâu sắc đến những quý đối tác. Chúng tôi cam kết đưa đến dịch vụ chăm sóc tốt bậc nhất toàn quốc.`,
      generatedAt: "Vừa xong"
    };
    setApprovalCards([newProductiveDraft(promptMore), ...approvalCards]);
    setPromptMore("");
  };

  const newProductiveDraft = (topic: string): ContentApprovalCard => {
    return {
      id: "mod_" + Date.now(),
      title: `Campaign: ${topic.slice(0, 30)}...`,
      channel: "Facebook",
      contentType: "AI tạo tự động",
      status: "pending",
      bodyText: `✨ Chào đón sự bức phá của dự án mới! ${topic} đang mở rộng cơ hội cho hàng nghìn doanh nghiệp toàn cầu tiếp cận chuyển đổi số. Đăng ký ngay hôm nay để nhận thông báo giải pháp tư vấn iGen ERP chi tiết!`,
      generatedAt: "Mới tạo"
    };
  };

  // 3. Publishing Calendar grid (October 2026 - custom-designed)
  const calendarEvents: PublishEvent[] = [
    { id: "cal-1", date: 4, title: "Facebook Post: Mua X1 tặng voucher", type: "Post", channel: "Facebook", status: "Published" },
    { id: "cal-2", date: 12, title: "LinkedIn: Số hóa kho cùng iGen", type: "Pulse Article", channel: "LinkedIn", status: "Approved" },
    { id: "cal-3", date: 18, title: "TikTok: Giới thiệu Workspace V2", type: "Video kịch bản", channel: "TikTok", status: "Draft" },
    { id: "cal-4", date: 25, title: "Facebook: Cảnh báo Laptop XPS", type: "Post", channel: "Facebook", status: "Draft" },
  ];

  const [selectedDay, setSelectedDay] = useState<number | null>(4);

  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="marketing_tab_wrapper">
      
      {/* Sub Tabs control header switcher */}
      <div className="border-b border-gray-200 bg-gray-50/50 p-2 text-xs flex justify-between shrink-0" id="marketing_sub_tabs_switch">
        <div className="flex gap-2">
          {["LÊN Ý TƯỞNG AI", "DUYỆT NỘI DUNG", "LỊCH ĐĂNG CONTENT"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab as MarketingSubTabType)}
              className={`px-4 py-2 bg-white rounded-lg border font-bold uppercase transition-all tracking-wide ${
                subTab === tab 
                  ? "bg-slate-800 text-white border-slate-800 shadow-xs" 
                  : "text-gray-500 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-purple-50 rounded-full border border-purple-200 text-purple-800 font-mono text-[10px]">
          <Zap className="h-3.5 w-3.5 text-purple-600 animate-bounce" />
          <span>Tích hợp AI Copywriter (Gemini Pro)</span>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto" id="marketing_tab_content">
        
        {/* SUB TAB 1: LÊN Ý TƯỞNG AI */}
        {subTab === "LÊN Ý TƯỞNG AI" && (
          <div className="space-y-6" id="ai_marketing_ideas_tab">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="ideation_grid">
              
              {/* Creator Form */}
              <div className="lg:col-span-2 bg-slate-50 border border-gray-200 p-6 rounded-2xl flex flex-col justify-between" id="ideation_campaign_form">
                <div>
                  <h4 className="font-bold text-gray-850 text-sm tracking-wide font-sans flex items-center gap-1.5 uppercase">
                    <Sparkles className="h-4.5 w-4.5 text-indigo-500 animate-pulse" />
                    Khởi tạo ý tưởng chiến dịch marketing
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 lines-clamp-2">Nhập mục tiêu chiến dịch của bạn. Gemini AI sẽ phân tích và trả về các ý tưởng bản nháp content hoàn chỉnh.</p>

                  <form onSubmit={handleGenerateIdeas} className="mt-5 space-y-4">
                    <textarea 
                      placeholder="Mô tả mục tiêu của bạn (Ex: Khởi động giới thiệu dòng Bàn phím cơ Workspace V2 phân khúc lập trình viên, chiết khấu 10%)..." 
                      className="w-full text-left h-28 p-4 border border-gray-200 bg-white rounded-xl text-xs font-sans focus:ring-2 focus:ring-blue-500"
                      value={campaignInput}
                      onChange={(e) => setCampaignInput(e.target.value)}
                    />
                    
                    {/* Quick suggestions chips bubble list */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-gray-400 font-mono uppercase tracking-wider block">Gợi ý chủ đề nhanh:</span>
                      <div className="flex flex-wrap gap-2">
                        {quickSuggestions.map((s, idx) => (
                          <button 
                            key={idx}
                            type="button"
                            onClick={() => setCampaignInput(s)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-gray-200 rounded-md text-[10px] text-gray-600 font-medium transition-colors cursor-pointer select-none"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </form>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
                  <button 
                    onClick={handleGenerateIdeas}
                    disabled={loadingAI || !campaignInput.trim()}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold font-sans flex items-center gap-2 select-none shadow-sm transition-all ${
                      loadingAI || !campaignInput.trim()
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95"
                    }`}
                  >
                    {loadingAI ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {loadingAI ? "AI Đang sáng tạo..." : "Phát sinh Ý tưởng từ AI"}
                  </button>
                </div>
              </div>

              {/* Content Pillars guidelines panel */}
              <div className="bg-white border p-6 rounded-2xl flex flex-col justify-between" id="content_pillars_advisory">
                <div>
                  <h4 className="font-bold text-gray-850 text-sm tracking-wide font-sans uppercase">
                    📚 Content Pillars Đề xuất
                  </h4>
                  <p className="text-xs text-gray-450 text-slate-500 mt-1">iGen AI định hướng phân chia 3 trụ cột nội dung để chiến dịch đạt hiệu năng cao nhất.</p>

                  <div className="space-y-4 mt-6 text-xs text-slate-650 text-left">
                    <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg">
                      <div className="flex justify-between items-center text-red-700 font-bold">
                        <span>Pillar A: Educate & Guides</span>
                        <span className="text-[10px]">35% tỉ trọng</span>
                      </div>
                      <p className="text-[10px] mt-1 leading-normal">Chia sẻ kiến thức bổ ích liên quan đến tư thế ngồi gõ bàn phím, hoặc cách tối ưu hóa vận hành hệ thống.</p>
                    </div>

                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                      <div className="flex justify-between items-center text-blue-700 font-bold">
                        <span>Pillar B: Storytelling & Social Proof</span>
                        <span className="text-[10px]">40% tỉ trọng</span>
                      </div>
                      <p className="text-[10px] mt-1 leading-normal">Phỏng vấn thực tế khách hàng cũ trung thành đang nâng hiệu suất cùng iGen ERP.</p>
                    </div>

                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                      <div className="flex justify-between items-center text-indigo-750 text-indigo-700 font-bold">
                        <span>Pillar C: Offers & Promotions</span>
                        <span className="text-[10px]">25% tỉ trọng</span>
                      </div>
                      <p className="text-[10px] mt-1 leading-normal font-sans text-left">Tạo sự thúc giục bằng cách công bố giờ vàng flash sale khẩn cấp.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 text-center text-[10px] text-gray-400 font-mono">
                  Phân tích bởi iGen Marketing Advisor
                </div>
              </div>

            </div>

            {/* Campaign concepts generator list */}
            <div className="space-y-4" id="campaign_draft_concepts_section">
              <span className="text-[10px] font-bold text-gray-500 font-mono uppercase tracking-wider block">Bản nháp ý tưởng sáng tạo ({concepts.length})</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="concepts_container">
                {concepts.map((concept, idx) => (
                  <div key={idx} className="p-5 bg-white border border-gray-250/70 hover:border-indigo-300 rounded-2xl transition-all shadow-xs text-left flex flex-col justify-between" id={`concept_card_${idx}`}>
                    <div>
                      <div className="flex justify-between items-center gap-4">
                        <span className="text-xs font-bold text-slate-800 font-sans tracking-tight leading-snug line-clamp-2">{concept.title}</span>
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-bold font-mono text-[10px]">
                          Phù hợp: {concept.matchPercent}%
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed">{concept.summary}</p>
                      
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {concept.channels.map((chan, cidx) => (
                          <span key={cidx} className="px-2 py-0.5 bg-slate-50 border border-gray-150 rounded-sm text-[9px] font-mono text-slate-500 uppercase tracking-wide">
                            {chan}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-gray-100 pt-4 bg-gray-50 p-4 rounded-xl border border-dashed">
                      <div className="flex items-center gap-1.5 text-indigo-650 text-indigo-600 font-bold mb-1.5">
                        <Zap className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-mono uppercase">Mẫu Content sinh ra từ AI:</span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-3 italic leading-relaxed font-sans">{concept.suggestedContent}</p>
                      
                      <div className="mt-3.5 flex justify-end gap-2 text-xs">
                        <button 
                          onClick={() => {
                            setApprovalCards([
                              {
                                id: "mod_cust_" + Date.now(),
                                title: concept.title,
                                channel: "Facebook",
                                contentType: "AI sinh ra từ Concept",
                                status: "pending",
                                bodyText: concept.suggestedContent,
                                generatedAt: "Mới phát sinh"
                              },
                              ...approvalCards
                            ]);
                            alert("Đã gửi bản nháp này sang cột Chờ duyệt!");
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold select-none text-[10px] transition-colors"
                        >
                          Chuyển sang Chờ duyệt 📋
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB 2: DUYỆT NỘI DUNG */}
        {subTab === "DUYỆT NỘI DUNG" && (
          <div className="space-y-6" id="moderation_pipeline_tab">
            
            {/* Quick Prompt generator row */}
            <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex gap-3 items-end" id="prompt_more_bar">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 font-mono uppercase mb-1.5">Prompt AI viết thêm bài đăng chủ đề mới:</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Viết 1 bài đăng thông báo Khai trương kho mới quận Bình Thạnh..." 
                  className="w-full text-left px-3.5 py-2 border border-gray-200 bg-white rounded-lg text-xs"
                  value={promptMore}
                  onChange={(e) => setPromptMore(e.target.value)}
                />
              </div>
              <button 
                onClick={handleAIGenerateMore}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                AI viết bài đăng mới
              </button>
            </div>

            {/* Content pipeline grid columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="moderation_columns">
              
              {/* DRAFT COLUMN (AI GENERATED) */}
              <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <span className="text-xs font-bold text-slate-700 tracking-wider">BẢN NHÁP (AI TẠO)</span>
                  <span className="bg-slate-200 text-slate-750 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {approvalCards.filter(c => c.status === "draft").length}
                  </span>
                </div>
                <div className="space-y-4 flex-1 overflow-y-auto">
                  {approvalCards.filter(c => c.status === "draft").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Chưa có bài viết nháp</div>
                  ) : (
                    approvalCards.filter(c => c.status === "draft").map(card => (
                      <ModerationPipCard 
                        key={card.id} 
                        card={card} 
                        onApprove={() => setApprovalCards(approvalCards.map(c => c.id === card.id ? { ...c, status: "pending" } : c))} 
                        onReject={() => rejectContent(card.id)} 
                      />
                    ))
                  )}
                </div>
              </div>

              {/* TO MODERATE (CHỜ QUẢN LÝ DUYỆT) */}
              <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <span className="text-xs font-bold text-amber-800 tracking-wider">CHỜ QUẢN LÝ DUYỆT</span>
                  <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {approvalCards.filter(c => c.status === "pending").length}
                  </span>
                </div>
                <div className="space-y-4 flex-1 overflow-y-auto">
                  {approvalCards.filter(c => c.status === "pending").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Hết bài duyệt chờ!</div>
                  ) : (
                    approvalCards.filter(c => c.status === "pending").map(card => (
                      <ModerationPipCard 
                        key={card.id} 
                        card={card} 
                        onApprove={() => approveContent(card.id)} 
                        onReject={() => rejectContent(card.id)} 
                      />
                    ))
                  )}
                </div>
              </div>

              {/* SCHEDULED CONTENT (ĐÃ LÊN LỊCH ĐĂNG) */}
              <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <span className="text-xs font-bold text-emerald-800 tracking-wider">LỊCH ĐĂNG CONTENT ĐÃ DUYỆT</span>
                  <span className="bg-emerald-100 text-emerald-850 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {approvalCards.filter(c => c.status === "scheduled").length}
                  </span>
                </div>
                <div className="space-y-4 flex-1 overflow-y-auto">
                  {approvalCards.filter(c => c.status === "scheduled").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic leading-normal">Kéo duyệt để lên lịch!</div>
                  ) : (
                    approvalCards.filter(c => c.status === "scheduled").map(card => (
                      <ModerationPipCard 
                        key={card.id} 
                        card={card} 
                        onApprove={() => {}} 
                        onReject={() => rejectContent(card.id)} 
                      />
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* SUB TAB 3: LỊCH ĐĂNG CONTENT */}
        {subTab === "LỊCH ĐĂNG CONTENT" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" id="publishing_calendar_block">
            {/* Left 2 Cols: Monthly grid view */}
            <div className="xl:col-span-2 bg-slate-50 border border-gray-200 p-6 rounded-2xl text-xs flex flex-col justify-between" id="calendar_grid_container">
              <div>
                <div className="flex justify-between items-center mb-5">
                  <h4 className="font-bold text-slate-800 text-sm font-sans tracking-tight flex items-center gap-2">
                    <Calendar className="h-4.5 w-4.5 text-blue-500" />
                    Lịch Xuất Bản Content • Tháng 10, 2026
                  </h4>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-md border text-[11px] font-mono select-none">
                    <button className="p-1 hover:bg-slate-100 rounded-sm">‹</button>
                    <span className="font-bold px-2">THÁNG 10, 2026</span>
                    <button className="p-1 hover:bg-slate-100 rounded-sm">›</button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 bg-gray-200 p-1 rounded-xl text-center font-bold tracking-wider text-slate-600 text-[10px] uppercase mb-1">
                  <div>T2</div>
                  <div>T3</div>
                  <div>T4</div>
                  <div>T5</div>
                  <div>T6</div>
                  <div>T7</div>
                  <div>CN</div>
                </div>

                {/* Grid squares rendering 35 items */}
                <div className="grid grid-cols-7 gap-1 font-mono text-[11px]" id="calendar_days_grid">
                  {/* Mock padded previous month days */}
                  <div className="h-16 p-2 bg-gray-150 text-gray-300 rounded-lg select-none text-left">28</div>
                  <div className="h-16 p-2 bg-gray-150 text-gray-300 rounded-lg select-none text-left">29</div>
                  <div className="h-16 p-2 bg-gray-150 text-gray-300 rounded-lg select-none text-left">30</div>

                  {Array.from({ length: 31 }).map((_, dIdx) => {
                    const dayNum = dIdx + 1;
                    const matchEvents = calendarEvents.filter(e => e.date === dayNum);
                    const isSelected = selectedDay === dayNum;
                    return (
                      <div 
                        key={dayNum}
                        onClick={() => setSelectedDay(dayNum)}
                        className={`h-16 p-2 text-left rounded-lg border transition-all cursor-pointer relative ${
                          isSelected 
                            ? "bg-blue-50 border-blue-400 text-blue-800" 
                            : "bg-white border-gray-100 hover:bg-gray-50"
                        }`}
                      >
                        <span className="font-bold font-semibold select-none text-[10px]">{dayNum}</span>
                        {matchEvents.length > 0 && (
                          <div className="absolute bottom-1 left-2.5 right-2.5 flex flex-col gap-0.5">
                            {matchEvents.map(e => (
                              <div key={e.id} className={`px-1 rounded-sm text-[8px] font-sans truncate font-bold uppercase tracking-wider ${
                                e.status === "Published" 
                                  ? "bg-green-500 text-white" 
                                  : e.status === "Approved" 
                                    ? "bg-blue-500 text-white" 
                                    : "bg-amber-400 text-white"
                              }`}>
                                {e.channel}: {e.status}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-150 rounded-b-xl select-none text-center text-[10px] text-gray-400 font-mono mt-4">
                Click chọn các ngày có gắn sự kiện để truy lục lịch truyền thông tương ứng của iGen ERP
              </div>
            </div>

            {/* Right Card: Day content schedule timeline detail */}
            <div className="bg-white border p-6 rounded-2xl flex flex-col justify-between" id="calendar_events_details_col">
              {selectedDay ? (
                <div>
                  <h4 className="font-bold text-gray-850 text-sm font-sans tracking-tight uppercase">
                    📅 Lịch đăng tải ngày {selectedDay}/10/2026
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">Danh sách chuỗi nội dung truyền thông cần vận hành trong ngày.</p>

                  <div className="h-64 overflow-y-auto mt-6 space-y-4 text-xs text-slate-650 text-left">
                    {calendarEvents.filter(e => e.date === selectedDay).length === 0 ? (
                      <div className="p-8 text-center bg-gray-50 text-gray-400 italic rounded-xl">
                        Không có lịch đăng tải nào được lập cho ngày này! Bạn có thể chuyển bản nháp sang Chờ đăng tải.
                      </div>
                    ) : (
                      calendarEvents.filter(e => e.date === selectedDay).map(event => (
                        <div key={event.id} className="p-4 bg-slate-50 border border-gray-150 rounded-xl relative flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="px-2 py-0.5 bg-slate-200 rounded-sm font-bold font-mono text-[9px] uppercase">
                              Kênh: {event.channel}
                            </span>
                            <span className={`px-2 py-0.5 rounded-sm font-bold font-mono text-[9px] uppercase text-white ${
                              event.status === "Published" 
                                ? "bg-green-500" 
                                : event.status === "Approved" 
                                  ? "bg-blue-600" 
                                  : "bg-amber-500"
                            }`}>
                              {event.status}
                            </span>
                          </div>
                          <h5 className="font-bold font-sans text-xs text-slate-800 leading-normal">{event.title}</h5>
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Định dạng: {event.type}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  Vui lòng click chọn một ngày có sự kiện trên lịch để quan sát.
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-150 flex flex-col gap-2">
                <button 
                  onClick={() => alert("Kích hoạt kết nốt Autopost tự động qua Meta & Tiktok APIs của iGen ERP!")}
                  className="w-full text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Kích hoạt Autopost đồng bộ
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// PIPELINE CARD widget component representing moderation cards
function ModerationPipCard({ card, onApprove, onReject }: { key?: any; card: ContentApprovalCard; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="bg-white border text-left border-gray-150/70 p-4 rounded-xl shadow-xs hover:shadow-md transition-all flex flex-col gap-2.5 relative group" id={`approval_card_${card.id}`}>
      
      {/* Category header */}
      <div className="flex justify-between items-center">
        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-150 rounded-sm text-[9px] font-mono font-bold text-indigo-700 tracking-wider">
          Phân phối: {card.channel}
        </span>
        <span className="text-[9px] text-gray-400 font-mono tracking-wide">{card.contentType}</span>
      </div>

      <h5 className="font-bold text-gray-800 leading-normal text-xs font-sans line-clamp-2">{card.title}</h5>
      <p className="text-xs text-gray-500 leading-relaxed font-sans mt-1 bg-slate-50/50 p-2.5 rounded-lg border border-dashed select-text">
        {card.bodyText}
      </p>

      <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[10px]">
        <span className="text-gray-400 font-mono">{card.generatedAt}</span>
        
        {/* Approve/Reject Controls action buttons */}
        <div className="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
          {card.status !== "scheduled" && (
            <button 
              onClick={onReject}
              className="p-1 px-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-md font-bold transition-all flex items-center gap-0.5 select-none"
            >
              <X className="h-3 w-3" />
              <span>Hủy</span>
            </button>
          )}

          {card.status !== "scheduled" && (
            <button 
              onClick={onApprove}
              className="p-1 px-2.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md font-bold transition-all flex items-center gap-0.5 select-none"
            >
              <Check className="h-3 w-3" />
              <span>Duyệt</span>
            </button>
          )}

          {card.status === "scheduled" && (
            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-sm text-[9px] font-bold font-mono">
              ✓ ĐÃ LÊN LỊCH
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
