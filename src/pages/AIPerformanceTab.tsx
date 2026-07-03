import React, { useState } from "react";
import { 
  BarChart, 
  TrendingUp, 
  BrainCircuit, 
  Users, 
  Clock, 
  ThumbsUp, 
  Sparkles, 
  Activity, 
  Cpu, 
  CheckCircle,
  RefreshCw,
  Terminal,
  ActivityIcon
} from "lucide-react";

export default function AIPerformanceTab() {
  const [logs, setLogs] = useState([
    { id: "log-1", service: "CRM Omni-Inbox Bot", metric: "Tự động phân loại Ng. Thi Mai VIP", value: "SUCCESS", latency: "1.2s" },
    { id: "log-2", service: "Marketing Ideas Generator", metric: "Tạo 3 Concept 'Giảm giá cực sốc X1'", value: "TOKENS: 14.5k", latency: "2.1s" },
    { id: "log-3", service: "Inventory Demand Forecast", metric: "Phân tích xu hướng 30 ngày cho Acer Pro", value: "ANALYZED", latency: "0.8s" },
    { id: "log-4", service: "Onboarding Task Auto-Router", metric: "Phân phối công việc thiết lập kho cho H.G.Huy", value: "ROUTED", latency: "0.5s" }
  ]);

  const [simLoading, setSimLoading] = useState(false);

  const handleTriggerTelemetryScan = () => {
    setSimLoading(true);
    setTimeout(() => {
      const newLog = {
        id: "log_" + Date.now(),
        service: "CRM Chat Proxy Agent",
        metric: "Tương tác hội thoại 'Nguyễn Thị Mai'",
        value: "COMPLETED",
        latency: "1.1s"
      };
      setLogs([newLog, ...logs.slice(0, 3)]);
      setSimLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 text-left" id="ai_performance_tab_wrapper">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" id="ai_perf_subheader">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 font-sans tracking-tight">Trung tâm Giám sát Hiệu suất AI</h1>
          <p className="text-sm text-gray-500 mt-1">iGen ERP AI-Core Performance Analyser • Kiểm thử tự động hóa và đo lường điện năng xử lý</p>
        </div>
        <button 
          onClick={handleTriggerTelemetryScan}
          disabled={simLoading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 self-start select-none shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${simLoading ? "animate-spin" : ""}`} />
          {simLoading ? "Đang truy vấn mô hình..." : "Quét Hệ thống AI"}
        </button>
      </div>

      {/* Numerical Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5" id="ai_perf_stats_grid">
        
        {/* Cost saved */}
        <div className="bg-white border border-gray-200 p-5 rounded-2xl flex flex-col justify-between hover:shadow-lg transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
          <div className="flex items-center justify-between text-xs font-semibold uppercase font-mono tracking-wider text-slate-400">
            <span>Giảm tải thời gian lặp lại</span>
            <span className="p-1 px-2.5 bg-blue-50 text-blue-600 rounded-md font-bold">78.4%</span>
          </div>
          <div className="my-4">
            <h3 className="text-2xl font-bold font-mono text-blue-600">328 cuộc thoại</h3>
            <p className="text-[11px] text-gray-500 leading-normal mt-1.5 font-sans">Được trợ lý AI xử lý trực tiếp không cần operator can thiệp trong tuần này.</p>
          </div>
        </div>

        {/* Speed comparer */}
        <div className="bg-white border border-gray-200 p-5 rounded-2xl flex flex-col justify-between hover:shadow-lg transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-gray-400 tracking-wider font-mono">
            <span>Thời gian trễ phục vụ</span>
            <span className="text-indigo-600">AI vs Human</span>
          </div>
          <div className="my-4">
            <h3 className="text-2xl font-bold font-mono text-indigo-600">1.2 giây (s) vs 4.5m</h3>
            <p className="text-[11px] text-gray-500 leading-normal mt-1.5 font-sans">Thời gian phản hồi bình quân của Chatbot so với tổng đài viên tiêu chuẩn.</p>
          </div>
        </div>

        {/* CSAT index */}
        <div className="bg-white border border-gray-200 p-5 rounded-2xl flex flex-col justify-between hover:shadow-lg transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-gray-400 tracking-wider font-mono">
            <span>Chất lượng hài lòng (CSAT)</span>
            <span className="text-emerald-600 font-bold">★ 4.88 / 5.00</span>
          </div>
          <div className="my-4">
            <h3 className="text-2xl font-bold font-mono text-emerald-600">95% Tương thích</h3>
            <p className="text-[11px] text-gray-500 leading-normal mt-1.5 font-sans">Tỉ lệ phản hồi xuất sắc được khách hàng đánh giá 5 sao đối với phễu hỗ trợ AI.</p>
          </div>
        </div>

      </div>

      {/* Comprehensive diagrams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="ai_perf_workload_grid">
        
        {/* Workload breakdown - CUSTOM SVG */}
        <div className="lg:col-span-2 bg-white p-6 border border-gray-200 rounded-2xl flex flex-col justify-between" id="workload_diagram_card">
          <div>
            <h4 className="font-bold text-gray-800 text-sm tracking-wide font-sans uppercase">Phân bổ nguồn lực hội thoại • AI vs Con người</h4>
            <p className="text-xs text-gray-400 mt-1">Biểu thị nguồn lực chăm sóc ròng từ tháng 4 đến tháng 9</p>
          </div>

          <div className="h-64 my-6 relative flex items-end">
            <svg className="w-full h-full" viewBox="0 0 500 240" preserveAspectRatio="none">
              {/* Stacked Bars chart custom */}
              {/* Mo 4 */}
              <rect x={40} y={120} width={25} height={115} fill="#D1D5DB" rx={3} />
              <rect x={40} y={40} width={25} height={80} fill="#6366F1" rx={3} />

              {/* Mo 5 */}
              <rect x={120} y={110} width={25} height={125} fill="#D1D5DB" rx={3} />
              <rect x={120} y={35} width={25} height={75} fill="#6366F1" rx={3} />

              {/* Mo 6 */}
              <rect x={200} y={90} width={25} height={145} fill="#D1D5DB" rx={3} />
              <rect x={200} y={25} width={25} height={65} fill="#6366F1" rx={3} />

              {/* Mo 7 */}
              <rect x={280} y={70} width={25} height={165} fill="#D1D5DB" rx={3} />
              <rect x={280} y={20} width={25} height={50} fill="#6366F1" rx={3} />

              {/* Mo 8 */}
              <rect x={360} y={50} width={25} height={185} fill="#D1D5DB" rx={3} />
              <rect x={360} y={15} width={25} height={35} fill="#6366F1" rx={3} />

              {/* Mo 9 */}
              <rect x={440} y={30} width={25} height={205} fill="#D1D5DB" rx={3} />
              <rect x={440} y={10} width={25} height={20} fill="#6366F1" rx={3} />

              {/* Baseline */}
              <line x1={0} y1={235} x2={500} y2={235} stroke="#E5E7EB" strokeWidth={1.5} />
            </svg>
          </div>

          <div className="flex items-center justify-between border-t pt-4 text-xs font-semibold" id="workload_chart_legend">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-indigo-500 rounded-sm" />
                <span className="text-gray-500">iGen AI (Tự động hóa)</span>
              </div>
            </div>
            <div className="flex gap-14 font-mono text-gray-400 text-[10px]">
              <span>T4</span>
              <span>T5</span>
              <span>T6</span>
              <span>T7</span>
              <span>T8</span>
              <span>T9</span>
            </div>
          </div>
        </div>

        {/* Telemetry Core Activity Logs board */}
        <div className="bg-white border border-gray-200 text-gray-800 p-6 rounded-2xl flex flex-col justify-between" id="telemetry_logs_board">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h4 className="font-bold text-xs tracking-wide font-mono text-indigo-600 flex items-center gap-1.5 uppercase select-none">
                <Terminal className="h-4.5 w-4.5 text-indigo-500" />
                AI Agent Telemetry logs
              </h4>
              <span className="text-[8px] font-mono text-gray-400 uppercase">PORT: 3000 // EXPRESS</span>
            </div>

            <div className="space-y-4 mt-5 font-mono text-[10px] text-gray-650" id="telemetry_logs_list">
              {logs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl leading-relaxed">
                  <div className="flex justify-between items-center text-gray-700 font-bold mb-1">
                    <span className="truncate max-w-[130px]">{log.service}</span>
                    <span className="text-xxs text-emerald-650 shrink-0 font-bold">{log.value}</span>
                  </div>
                  <p className="text-gray-500 text-[9.5px] truncate select-text">{log.metric}</p>
                  <div className="flex justify-between items-center mt-2 text-[8px] text-gray-400 border-t border-slate-100 pt-1.5">
                    <span>TRANSACT_ID: {log.id}</span>
                    <span>ĐỘ TRỄ: {log.latency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-gray-400 leading-normal text-center pt-4 border-t border-gray-100 font-mono select-none">
            Mô hình: gemini-3.5-flash-latest • iGen AI active
          </p>
        </div>

      </div>

    </div>
  );
}
