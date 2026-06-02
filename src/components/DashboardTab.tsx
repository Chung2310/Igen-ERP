import React, { useState } from "react";
import { 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Users, 
  PackageCheck, 
  BrainCircuit, 
  Activity, 
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare
} from "lucide-react";

export default function DashboardTab() {
  const [selectedInsight, setSelectedInsight] = useState<number | null>(null);

  // Business advisor recommendations
  const insights = [
    {
      id: 1,
      title: "🔴 Dự báo thiếu hụt hàng tồn kho",
      message: "Dựa trên nhu cầu 30 ngày tới từ AI Forecast, 'Laptop Dell XPS 15' sẽ cạn kho trong 3 ngày. Khuyến nghị đặt thêm 50 đơn vị ngay lập tức.",
      impact: "Tránh tổn thất 350,000,000đ doanh thu",
      action: "Chuẩn bị đơn nhập kho"
    },
    {
      id: 2,
      title: "⚡ Trợ lý AI đang giảm tải 78% Omni-Inbox",
      message: "Trong tổng số 420 hội thoại, AI Assistant đã trực tiếp giải đáp 328 trường hợp và phân loại chính xác các Lead Nóng cho Sale chốt đơn.",
      impact: "Tiết kiệm 85 giờ làm việc của nhân sự",
      action: "Cấu hình nâng cao AI"
    },
    {
      id: 3,
      title: "📈 Ý tưởng Marketing được duyệt có tỷ lệ tương tác cao",
      message: "Chiến dịch 'Chạm Đột Phá' được AI đề xuất cho thấy mức điểm tương đồng 95%. Hệ thống khuyên bạn kích hoạt lịch đăng trên TikTok ngay hôm nay.",
      impact: "Dự kiến thu hút 12,000 lượt tương tác",
      action: "Xác nhận lên lịch"
    }
  ];

  // Dummy monthly reports for revenue chart
  const revenuePoints = [
    { month: "T4", rev: 1200, ai: 40 },
    { month: "T5", rev: 1450, ai: 48 },
    { month: "T6", rev: 1700, ai: 55 },
    { month: "T7", rev: 2100, ai: 68 },
    { month: "T8", rev: 2300, ai: 72 },
    { month: "T9", rev: 2840, ai: 78 }
  ];

  return (
    <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2" id="dashboard_tab_view">
      {/* Title Header with date action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" id="dashboard_tab_subheader">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 font-sans tracking-tight">Hệ thống Tổng quan Doanh nghiệp</h2>
          <p className="text-sm text-gray-500 mt-1">iGen ERP Enterprise Hub • Chỉ số điều hành thông minh thời gian thực</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg">
          <Activity className="h-4 w-4 text-blue-500" />
          <span>Cập nhật ngày: Hôm nay, 10/2026</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" id="dashboard_kpi_grid">
        {/* Doanh thu */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-blue-500" />
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-medium text-xs font-sans tracking-wide uppercase">Doanh thu tháng này</span>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-800 font-mono">2,840,000,000 đ</h3>
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-semibold mt-1">
              <ArrowUpRight className="h-4 w-4" />
              <span>+12.5% so với tháng trước</span>
            </div>
          </div>
        </div>

        {/* Lead */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-medium text-xs font-sans tracking-wide uppercase">Cơ hội bán hàng mới</span>
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-800 font-mono">1,480 Leads</h3>
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-semibold mt-1">
              <ArrowUpRight className="h-4 w-4" />
              <span>+18.2% tăng trưởng ấm</span>
            </div>
          </div>
        </div>

        {/* Tiết kiệm vận hành */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-medium text-xs font-sans tracking-wide uppercase">Chi phí vận hành kho</span>
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-600 group-hover:text-white">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-800 font-mono">940,000,000 đ</h3>
            <div className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold mt-1">
              <ArrowDownRight className="h-4 w-4" />
              <span>-4.2% tiết kiệm tối ưu hóa</span>
            </div>
          </div>
        </div>

        {/* AI Trợ lý */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-medium text-xs font-sans tracking-wide uppercase">Hiệu suất Tự động hóa AI</span>
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-150 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
              <BrainCircuit className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-800 font-mono">78.4%</h3>
            <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold mt-1">
              <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
              <span>+3.2% tự động phản hồi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts & Advisory Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard_details_grid">
        {/* Sales & AI Automation Growth chart - CUSTOM BEAUTIFUL SVG */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs lg:col-span-2 flex flex-col justify-between" id="dashboard_chart_card">
          <div>
            <h4 className="text-base font-bold text-gray-800 font-sans">Tăng trưởng Doanh thu & Tự động hóa AI</h4>
            <p className="text-xs text-gray-400 mt-1">Khảo sát 6 tháng gần nhất từ khi kích hoạt iGen AI Copilot</p>
          </div>
          
          {/* Custom SVG Line & Area Chart */}
          <div className="h-64 my-6 relative flex items-end">
            <svg className="w-full h-full" viewBox="0 0 500 240" preserveAspectRatio="none">
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="#F3F4F6" strokeWidth={1} />
              <line x1="0" y1="100" x2="500" y2="100" stroke="#F3F4F6" strokeWidth={1} />
              <line x1="0" y1="160" x2="500" y2="160" stroke="#F3F4F6" strokeWidth={1} />
              <line x1="0" y1="220" x2="500" y2="220" stroke="#E5E7EB" strokeWidth={1.5} />

              {/* Area Background */}
              <path 
                d="M 10 220 L 10 180 L 100 160 L 200 135 L 300 100 L 400 80 L 490 40 L 490 220 Z" 
                fill="url(#colorRevenue)" 
              />

              {/* Revenue Line */}
              <path 
                d="M 10 180 L 100 160 L 200 135 L 300 100 L 400 80 L 490 40" 
                fill="none" 
                stroke="#3B82F6" 
                strokeWidth={3} 
                strokeLinecap="round"
              />

              {/* AI automation Rate line */}
              <path 
                d="M 10 210 L 100 195 L 200 180 L 300 150 L 400 140 L 490 120" 
                fill="none" 
                stroke="#6366F1" 
                strokeWidth={2} 
                strokeDasharray="4 4"
                strokeLinecap="round"
              />

              {/* Data points */}
              <circle cx={490} cy={40} r={5} fill="#3B82F6" stroke="#FFFFFF" strokeWidth={2} />
              <circle cx={490} cy={120} r={4} fill="#6366F1" stroke="#FFFFFF" strokeWidth={2} />
            </svg>

            {/* Top Revenue Indicator popover overlay */}
            <div className="absolute top-2 right-12 bg-gray-900 text-white rounded-lg px-2.5 py-1 text-[10px] font-mono flex items-center gap-1 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>Doanh thu cao kỷ lục: 2.84B đ</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-4" id="chart_legend">
            <div className="flex gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-blue-500 rounded-sm" />
                <span className="text-gray-500">Doanh thu Doanh nghiệp (tỷ đồng)</span>
              </div>
              <div className="flex items-center gap-1.5 mr-2">
                <span className="w-3 h-0.5 border-t-2 border-indigo-500 border-dashed inline-block" />
                <span className="text-gray-500">Tỷ lệ Automation (%)</span>
              </div>
            </div>
            <div className="flex text-[10px] text-gray-400 font-mono gap-10">
              {revenuePoints.map((p, idx) => (
                <span key={idx}>{p.month}</span>
              ))}
            </div>
          </div>
        </div>

        {/* AI Advisor Panel */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between" id="dashboard_advisory_card">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-gray-800 font-sans flex items-center gap-1.5">
                <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
                Đề xuất Enterprise AI
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md">LIVE INSIGHTS</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Thuật toán máy học tự động quét tìm rủi ro & cơ hội trong hôm nay</p>

            <div className="space-y-4 mt-5" id="advisory_list">
              {insights.map((insight, index) => {
                const isSelected = selectedInsight === index;
                return (
                  <div 
                    key={insight.id}
                    onClick={() => setSelectedInsight(isSelected ? null : index)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? "border-indigo-200 bg-indigo-50/40 shadow-xs" 
                        : "border-gray-100 bg-gray-50/30 hover:bg-gray-50/70"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-semibold text-gray-800 select-none">{insight.title}</span>
                      <span className="text-[9px] font-mono bg-white px-2 py-0.5 rounded-sm shadow-xs border border-gray-100 text-slate-500 shrink-0">AI Core</span>
                    </div>
                    <p className={`text-xs text-gray-500 mt-1 leading-normal transition-all duration-300 overflow-hidden ${
                      isSelected ? "max-h-24 opacity-100" : "max-h-5 opacity-80"
                    }`}>
                      {insight.message}
                    </p>
                    {isSelected && (
                      <div className="mt-3.5 pt-2.5 border-t border-indigo-100 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-gray-400 font-mono">Lợi ích: <strong className="text-indigo-600">{insight.impact}</strong></span>
                        <button className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-semibold flex items-center transition-all">
                          Thực thi ngay
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-150 text-center text-xs text-gray-400 font-medium">
            AI liên tục tối ưu hóa quy trình doanh nghiệp
          </div>
        </div>
      </div>
    </div>
  );
}
