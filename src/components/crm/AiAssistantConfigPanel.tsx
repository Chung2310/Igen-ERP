import React from "react";
import { Sliders, Zap, MessageSquare, Clock3 } from "lucide-react";
import { AIChatConfig } from "../../types";

interface AiAssistantConfigPanelProps {
  localConfig: AIChatConfig;
  setLocalConfig: (config: AIChatConfig) => void;
  savingConfig: boolean;
  handleSaveConfig: () => void;
  driveLink: string;
  setDriveLink: (link: string) => void;
  syncingDrive: boolean;
  handleSyncDrive: () => void;
  clearingKnowledge: boolean;
  handleClearKnowledge: () => void;
  knowledgeHealth: any;
  loadingAIHealth: boolean;
  refreshAIHealth: () => void;
  testQuestion: string;
  setTestQuestion: (q: string) => void;
  testReply: any;
  testingAI: boolean;
  handleTestAIReply: () => void;
  aiReplyLogs: any[];
  handleFeedback: (logId: string, feedback: "good" | "bad" | "needs_fix") => void;
  handleApplyToAll?: () => void;
  copyingConfig?: boolean;
}

export const AiAssistantConfigPanel: React.FC<AiAssistantConfigPanelProps> = ({
  localConfig,
  setLocalConfig,
  savingConfig,
  handleSaveConfig,
  driveLink,
  setDriveLink,
  syncingDrive,
  handleSyncDrive,
  clearingKnowledge,
  handleClearKnowledge,
  knowledgeHealth,
  loadingAIHealth,
  refreshAIHealth,
  testQuestion,
  setTestQuestion,
  testReply,
  testingAI,
  handleTestAIReply,
  aiReplyLogs,
  handleFeedback,
  handleApplyToAll,
  copyingConfig,
}) => {
  const knowledgeDocuments = Array.isArray(knowledgeHealth?.documents) ? knowledgeHealth.documents : [];
  const detectedTopics = Array.isArray(knowledgeHealth?.detectedTopics) ? knowledgeHealth.detectedTopics : [];
  const knowledgeWarnings = Array.isArray(knowledgeHealth?.warnings) ? knowledgeHealth.warnings : [];

  return (
    <div className="w-80 border-l border-slate-100 bg-white p-5 text-xs text-left overflow-y-auto shrink-0 h-full flex flex-col justify-between shadow-sm animate-slide-in-right" id="ai_assistant_config_side_panel">
      <div className="space-y-5">
        <h4 className="font-extrabold text-slate-800 text-sm font-sans tracking-tight flex items-center gap-2 uppercase">
          <Sliders className="h-4 w-4 text-blue-600" />
          Cấu hình trợ lý AI
        </h4>
        <p className="text-slate-400 text-[10px] leading-relaxed font-sans">
          Tham số hóa hành vi tự động trả lời tin nhắn & bình luận, phân tích tâm lý khách hàng đồng bộ thời gian trễ.
        </p>

        {/* AI switchers */}
        <div className="space-y-4 pt-4 border-t border-slate-100" id="config_switches">
          {/* auto reply status */}
          <div className="flex justify-between items-start gap-4 pb-3 border-b border-slate-100/50">
            <div>
              <h5 className="font-extrabold text-blue-600 font-sans tracking-tight text-xs flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 fill-blue-600/20 text-blue-600" />
                Tự động trả lời AI (Chat)
              </h5>
              <p className="text-[9.5px] text-slate-400 mt-0.5 leading-normal">
                Cho phép bot AI trả lời tin nhắn từ Facebook Messenger và Zalo.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={localConfig.enabled}
                onChange={(e) => setLocalConfig({ ...localConfig, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>

          {/* comment reply status */}
          <div className="flex justify-between items-start gap-4 pb-3 border-b border-slate-100/50">
            <div>
              <h5 className="font-extrabold text-blue-600 font-sans tracking-tight text-xs flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5 fill-blue-600/20 text-blue-600" />
                Tự động trả lời Bình luận FB
              </h5>
              <p className="text-[9.5px] text-slate-400 mt-0.5 leading-normal">
                Cho phép bot AI tự trả lời bình luận trên các bài viết Facebook.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={localConfig.commentReplyEnabled || false}
                onChange={(e) => setLocalConfig({ ...localConfig, commentReplyEnabled: e.target.checked })}
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
                checked={localConfig.autoClassify}
                onChange={(e) => setLocalConfig({ ...localConfig, autoClassify: e.target.checked })}
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
                checked={localConfig.autoCloseDeal}
                onChange={(e) => setLocalConfig({ ...localConfig, autoCloseDeal: e.target.checked })}
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
                checked={localConfig.autoFeedback}
                onChange={(e) => setLocalConfig({ ...localConfig, autoFeedback: e.target.checked })}
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
            <strong className="font-mono bg-slate-50 px-2 py-0.5 border border-slate-200 rounded text-slate-600">
              {localConfig.replyDelay} giây (s)
            </strong>
          </div>
          <input
            type="range"
            min={1}
            max={45}
            value={localConfig.replyDelay}
            onChange={(e) => setLocalConfig({ ...localConfig, replyDelay: parseInt(e.target.value) })}
            className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 animate-pulse-slow"
          />
          <span className="text-[9px] text-slate-400 block leading-normal text-left">
            Độ trễ giúp chatbot hành xử tương thích như người chăm sóc thật phục vụ hội thoại.
          </span>
        </div>

        {/* Custom active coreinstructions constraints */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <label className="block font-extrabold text-slate-700">Cài đặt nâng cao (AI Prompts)</label>
          <textarea
            placeholder="Nhập luật hành xử nghiêm ngặt cho AI..."
            value={localConfig.advancedInstructions}
            onChange={(e) => setLocalConfig({ ...localConfig, advancedInstructions: e.target.value })}
            className="w-full h-24 p-3 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl text-xs leading-relaxed focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-200"
          />
        </div>

        {/* Google Drive Link Sync */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <label className="block font-extrabold text-slate-700 flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            Đồng bộ thư mục/tài liệu Google Drive
          </label>
          <p className="text-[9px] text-slate-400 leading-normal">
            Hỗ trợ dán đường dẫn <b>Thư mục Google Drive</b> hoặc <b>Google Doc/Sheet</b> công khai. Hệ thống sẽ quét toàn bộ thư mục và tự động đọc, chuẩn hóa dữ liệu thành FAQs.
          </p>
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Dán link Thư mục Google Drive hoặc Google Doc..."
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

        {/* AI QA and Knowledge Health */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="block font-extrabold text-slate-700">Kiểm định AI trước khi bật bot</label>
            <button
              type="button"
              onClick={refreshAIHealth}
              disabled={loadingAIHealth}
              className="px-2 py-1 rounded-lg border border-slate-200 text-[8px] font-bold text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50"
            >
              {loadingAIHealth ? "Đang quét..." : "Quét lại"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-slate-500 font-bold uppercase">Chế độ hiện tại</span>
              <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                knowledgeHealth?.mode === "trained" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}>
                {knowledgeHealth?.mode === "trained" ? "Đã học tài liệu" : "Trả lời mặc định"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[9px]">
              <div className="bg-white border border-slate-100 rounded-lg p-2">
                <p className="text-slate-400">Tài liệu</p>
                <strong className="text-slate-700">{knowledgeHealth?.documentsCount ?? 0}</strong>
              </div>
              <div className="bg-white border border-slate-100 rounded-lg p-2">
                <p className="text-slate-400">Khối tri thức AI</p>
                <strong className="text-slate-700">{knowledgeHealth?.chunksCount ?? 0}</strong>
              </div>
            </div>
            {detectedTopics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {detectedTopics.map((topic: any) => (
                  <span key={topic.key} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[8px] font-bold">
                    {topic.label}
                  </span>
                ))}
              </div>
            )}
            {knowledgeDocuments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[8px] font-extrabold uppercase text-slate-400">Nguồn tài liệu đang học</p>
                <div className="space-y-1.5">
                  {knowledgeDocuments.map((doc: any, idx: number) => (
                    <div key={`${doc.title}-${idx}`} className="rounded-lg border border-slate-100 bg-white px-2 py-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[9px] font-bold text-slate-700 leading-snug line-clamp-2">{doc.title}</p>
                        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold text-slate-500">
                          v{doc.version ?? 1}
                        </span>
                      </div>
                      <p className="mt-1 text-[8px] text-slate-400">
                        {doc.sourceType === "google_doc" ? "Google Drive" : "Tài liệu nhập tay"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {knowledgeWarnings.map((warning: string, idx: number) => (
              <p key={idx} className="text-[9px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 leading-normal">
                {warning}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <textarea
              value={testQuestion}
              onChange={(e) => setTestQuestion(e.target.value)}
              className="w-full h-20 p-2.5 border border-slate-200 bg-white rounded-xl text-[10px] leading-relaxed focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
              placeholder="Nhập câu hỏi mẫu để kiểm tra cách AI trả lời..."
            />
            <button
              type="button"
              onClick={handleTestAIReply}
              disabled={testingAI}
              className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-[10px] disabled:opacity-50"
            >
              {testingAI ? "AI đang trả lời thử..." : "Test câu trả lời AI"}
            </button>
          </div>

          {testReply && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-[10px] space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-indigo-700">Preview trả lời</span>
                <span className="text-[8px] font-bold text-indigo-500 uppercase">{testReply.mode} • {testReply.contextMatches} matches</span>
              </div>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{testReply.text}</p>
            </div>
          )}

          {aiReplyLogs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-extrabold text-slate-500 uppercase">Log phản hồi gần nhất</p>
              {aiReplyLogs.map((log) => (
                <div key={log._id} className="rounded-xl border border-slate-150 bg-white p-2.5 text-[9px] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 truncate">{log.channel} • {log.mode}</span>
                    <span className="text-slate-400 font-mono">{log.latencyMs}ms</span>
                  </div>
                  <p className="text-slate-500 line-clamp-2">{log.customerMessage}</p>
                  <p className="text-slate-700 line-clamp-2">{log.aiResponse}</p>
                  <div className="flex gap-1 pt-1">
                    <button type="button" onClick={() => handleFeedback(log._id, "good")} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">Đúng</button>
                    <button type="button" onClick={() => handleFeedback(log._id, "needs_fix")} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">Cần sửa</button>
                    <button type="button" onClick={() => handleFeedback(log._id, "bad")} className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold">Sai</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Training knowledge base input */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block font-extrabold text-slate-700">Dữ liệu huấn luyện AI</label>
            <div className="flex items-center gap-2">
              {localConfig.trainingKnowledge && localConfig.trainingKnowledge.trim().length > 0 && (
                <span className="text-[8px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  {localConfig.trainingKnowledge.includes("Q:") ? "FAQ đã chuẩn hóa" : "Dữ liệu tùy chỉnh"}
                </span>
              )}
              <button
                type="button"
                onClick={handleClearKnowledge}
                disabled={clearingKnowledge || syncingDrive}
                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[9px] transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                {clearingKnowledge ? "Đang xóa..." : "Xóa tài liệu"}
              </button>
            </div>
          </div>
          <textarea
            placeholder={"Nhập thông tin sản phẩm, chính sách bán hàng, bảng giá...\nHoặc bấm 'Đồng bộ & Tạo FAQ' ở trên để AI tự động tạo từ Google Doc.\n\nVí dụ:\nQ: Gói dịch vụ cơ bản giá bao nhiêu?\nA: Dạ, gói cơ bản có giá 500.000đ/tháng ạ."}
            value={localConfig.trainingKnowledge}
            onChange={(e) => setLocalConfig({ ...localConfig, trainingKnowledge: e.target.value })}
            className="w-full h-48 p-3 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl text-xs leading-relaxed focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-200 font-sans"
          />
          <p className="text-[9px] text-slate-400 leading-normal flex-wrap">
            Bot sẽ sử dụng dữ liệu trên để trả lời khách hàng. Bạn có thể chỉnh sửa trực tiếp hoặc đồng bộ lại từ Google Drive.
          </p>
        </div>
      </div>

      {/* Save config button */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={savingConfig}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/15 disabled:opacity-50 cursor-pointer"
        >
          {savingConfig ? (
            <>
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
              Đang lưu cấu hình...
            </>
          ) : (
            <>Lưu cấu hình trợ lý AI</>
          )}
        </button>
        {handleApplyToAll && (
          <button
            type="button"
            onClick={handleApplyToAll}
            disabled={savingConfig || copyingConfig}
            className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 active:scale-[0.98] rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {copyingConfig ? "Đang đồng bộ..." : "Đồng bộ cho Fanpage khác"}
          </button>
        )}
        <div className="font-mono text-center text-[9px] text-slate-400 select-none">
          Cấu hình trợ lý AI
        </div>
      </div>
    </div>
  );
};
