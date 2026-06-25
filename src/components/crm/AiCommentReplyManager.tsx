import React, { useState, useEffect } from "react";
import { 
  MessageSquare, Zap, RefreshCw, Terminal, Send, CheckCircle, 
  HelpCircle, Save, Sliders, Play, ExternalLink, ChevronDown, ChevronUp,
  Facebook
} from "lucide-react";
import { toast } from "../../pages/Toast";
import { getAccessToken } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import { AIChatConfig } from "../../types";

interface AiCommentReplyManagerProps {
  facebookPages?: Array<{ _id: string; displayName: string; username: string; isMock?: boolean }>;
  selectedFacebookPageId?: string;
  setSelectedFacebookPageId?: (val: string) => void;
}

export function AiCommentReplyManager({
  facebookPages = [],
  selectedFacebookPageId = "",
  setSelectedFacebookPageId = () => {},
}: AiCommentReplyManagerProps) {
  const { userProfile, updateAiAutoReplyConfig } = useAuth();
  
  // Local config matching database settings
  const [localConfig, setLocalConfig] = useState<AIChatConfig>({
    enabled: false,
    commentReplyEnabled: false,
    autoClassify: true,
    autoCloseDeal: false,
    autoFeedback: false,
    replyDelay: 15,
    advancedInstructions: "",
    trainingKnowledge: "",
    model: "gemini-3.5-flash"
  });

  const [savingConfig, setSavingConfig] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [knowledgeHealth, setKnowledgeHealth] = useState<any>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Simulator states
  const [simMessage, setSimMessage] = useState("Shop ơi gói dịch vụ cơ bản có giá bao nhiêu thế? Có chính sách bảo hành không?");
  const [simPostId, setSimPostId] = useState("123456789012345_67890");
  const [simulating, setSimulating] = useState(false);

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<any>(null);

  // Expanded post card states
  const [expandedPosts, setExpandedPosts] = useState<{ [key: string]: boolean }>({});

  // Sync settings from userProfile
  useEffect(() => {
    if (userProfile?.aiAutoReplyConfig) {
      setLocalConfig({
        enabled: userProfile.aiAutoReplyConfig.enabled ?? false,
        commentReplyEnabled: userProfile.aiAutoReplyConfig.commentReplyEnabled ?? false,
        autoClassify: userProfile.aiAutoReplyConfig.autoClassify ?? true,
        autoCloseDeal: userProfile.aiAutoReplyConfig.autoCloseDeal ?? false,
        autoFeedback: userProfile.aiAutoReplyConfig.autoFeedback ?? false,
        replyDelay: userProfile.aiAutoReplyConfig.replyDelay ?? 15,
        advancedInstructions: userProfile.aiAutoReplyConfig.advancedInstructions ?? "",
        trainingKnowledge: userProfile.aiAutoReplyConfig.trainingKnowledge ?? "",
        model: userProfile.aiAutoReplyConfig.model || "gemini-3.5-flash"
      });
    }
  }, [userProfile]);

  // Fetch AI Reply Logs specifically for facebook_comment
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/v1/facebook/debug-ai-logs?channel=facebook_comment&limit=30", {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setLogs(data.logs || []);
        
        // Auto expand the first few posts initially
        const uniquePostIds = Array.from(new Set((data.logs || []).map((l: any) => l.postId || "unknown_post"))) as string[];
        const initialExpanded: { [key: string]: boolean } = {};
        uniquePostIds.forEach((id, index) => {
          initialExpanded[id] = index === 0; // Expand first post by default
        });
        setExpandedPosts(initialExpanded);
      } else {
        toast.error(data.message || "Không thể tải nhật ký phản hồi.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi tải nhật ký phản hồi.");
    } finally {
      setLoadingLogs(false);
    }
  };

  // Fetch AI Health & training status
  const fetchAIHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch("/api/v1/gemini/ai-health", {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setKnowledgeHealth(data.data || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHealth(false);
    }
  };

  // Fetch Facebook Page diagnostics
  const fetchDiagnostics = async () => {
    try {
      const query = selectedFacebookPageId ? `?pageId=${encodeURIComponent(selectedFacebookPageId)}` : "";
      const res = await fetch(`/api/v1/facebook/messenger/diagnostics/page${query}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setDiagnostics(data.data || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void fetchLogs();
    void fetchAIHealth();
    void fetchDiagnostics();
  }, [selectedFacebookPageId]);

  // Save config
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await updateAiAutoReplyConfig(localConfig);
      toast.success("Đã cập nhật cấu hình tự động trả lời bình luận Facebook!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi khi lưu cấu hình.");
    } finally {
      setSavingConfig(false);
    }
  };

  // Send mock webhook comment event to test flow end-to-end
  const handleSimulateComment = async () => {
    if (!simMessage.trim()) {
      toast.error("Vui lòng nhập nội dung bình luận giả lập.");
      return;
    }
    if (!simPostId.trim()) {
      toast.error("Vui lòng nhập Post ID bài viết.");
      return;
    }
    setSimulating(true);
    const mockPageId = selectedFacebookPageId || diagnostics?.resolvedPageId || "123456789012345";
    const mockCommentId = `mock_comment_${Date.now()}`;
    const mockSenderId = "987654321098765";

    const payload = {
      object: "page",
      entry: [
        {
          id: mockPageId,
          time: Math.floor(Date.now() / 1000),
          changes: [
            {
              field: "feed",
              value: {
                item: "comment",
                verb: "add",
                comment_id: mockCommentId,
                parent_id: simPostId.trim(),
                post_id: simPostId.trim(),
                sender_id: mockSenderId,
                message: simMessage,
                created_time: Math.floor(Date.now() / 1000)
              }
            }
          ]
        }
      ]
    };

    try {
      const res = await fetch("/api/v1/facebook/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      if (res.ok) {
        toast.success("Đã gửi sự kiện bình luận giả lập thành công! Hãy tải lại Logs sau vài giây.");
        setTimeout(() => {
          void fetchLogs();
        }, 1500);
      } else {
        toast.error(`Giả lập thất bại: ${text}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi gửi webhook giả lập.");
    } finally {
      setSimulating(false);
    }
  };

  // Log feedbacks
  const handleFeedback = async (logId: string, feedback: "good" | "bad" | "needs_fix") => {
    try {
      const res = await fetch(`/api/v1/crud/ai-reply-logs/${logId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ feedback }),
      });
      if (res.ok) {
        toast.success("Đã ghi nhận phản hồi của bạn.");
        void fetchLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const togglePostExpanded = (postId: string) => {
    setExpandedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [showSimulator, setShowSimulator] = useState(false);
  const [expandedContexts, setExpandedContexts] = useState<{ [key: string]: boolean }>({});

  const toggleContextExpanded = (logId: string) => {
    setExpandedContexts(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  // Filter logs by search query
  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (log.postId && log.postId.toLowerCase().includes(query)) ||
      (log.customerMessage && log.customerMessage.toLowerCase().includes(query)) ||
      (log.aiResponse && log.aiResponse.toLowerCase().includes(query))
    );
  });

  // Grouping logs by postId
  const groupedLogs = filteredLogs.reduce((acc: { [key: string]: any[] }, log) => {
    const key = log.postId || "unknown_post";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(log);
    return acc;
  }, {});

  const postIds = Object.keys(groupedLogs);

  return (
    <div className="space-y-6 text-left" id="ai_comment_reply_manager_container">
      {/* Header Info Panel */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
          <div className="text-left">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-650" />
              Tự động trả lời Bình luận Facebook
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Phân tách quản lý các phản hồi tự động theo từng bài viết cụ thể trên Fanpage Facebook của bạn.
            </p>
          </div>

          {/* Facebook Page Switcher */}
          {facebookPages && facebookPages.length > 0 && (
            <div className="flex items-center gap-2 min-w-[200px]" id="comment_page_switcher">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Trang:</span>
              <div className="relative flex-1">
                <select
                  value={selectedFacebookPageId}
                  onChange={(e) => setSelectedFacebookPageId(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl text-[11px] font-bold text-gray-700 outline-none cursor-pointer focus:ring-4 focus:ring-indigo-650/10 focus:border-indigo-650 transition-all duration-200 appearance-none"
                >
                  {facebookPages.map((page) => (
                    <option key={page.username} value={page.username}>
                      {page.displayName} {page.isMock ? "(Demo)" : ""}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-indigo-650">
                  <Facebook className="h-3.5 w-3.5" />
                </div>
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="h-3 w-3" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left Column: Config settings & Tri thuc status */}
          <div className="xl:col-span-2 bg-gray-50/50 border border-gray-150 rounded-2xl p-5 space-y-5">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider text-left flex items-center gap-2 border-b border-gray-200 pb-2">
              <Sliders className="h-4 w-4 text-indigo-650" />
              Cấu hình hoạt động
            </h4>
            
            <div className="space-y-4 text-left">
              {/* Toggles */}
              <div className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="text-left">
                  <h4 className="text-xs font-bold text-gray-800">Trả lời bình luận FB</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">Cho phép AI phản hồi bình luận.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={localConfig.commentReplyEnabled}
                    onChange={(e) => setLocalConfig({ ...localConfig, commentReplyEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-indigo-650" />
                </label>
              </div>

              <div className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="text-left">
                  <h4 className="text-xs font-bold text-gray-800">Trả lời Chat trực tiếp</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">Cho phép AI phản hồi tin nhắn.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={localConfig.enabled}
                    onChange={(e) => setLocalConfig({ ...localConfig, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-indigo-650" />
                </label>
              </div>

              {/* Delay setting */}
              <div className="space-y-2 p-3 bg-white border border-gray-200 rounded-xl">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-700">Độ trễ gửi câu trả lời</span>
                  <strong className="font-mono bg-gray-50 px-2 py-0.5 border border-gray-200 rounded text-gray-600">
                    {localConfig.replyDelay} giây (s)
                  </strong>
                </div>
                <input
                  type="range"
                  min={1}
                  max={45}
                  value={localConfig.replyDelay}
                  onChange={(e) => setLocalConfig({ ...localConfig, replyDelay: parseInt(e.target.value) })}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                />
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {savingConfig ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Lưu cấu hình auto-reply
              </button>
            </div>

            {/* Tri thuc RAG health status */}
            <div className="pt-4 border-t border-gray-200 text-left">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trạng thái tri thức RAG</h5>
                <button
                  onClick={fetchAIHealth}
                  disabled={loadingHealth}
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-indigo-650 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingHealth ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-gray-400 text-[10px]">Chế độ hoạt động</span>
                  <strong className={`mt-1 text-[11px] font-bold ${
                    knowledgeHealth?.mode === "trained" ? "text-green-700" : "text-amber-700"
                  }`}>
                    {knowledgeHealth?.mode === "trained" ? "Đã huấn luyện" : "Mặc định hệ thống"}
                  </strong>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-gray-400 text-[10px]">Vector Chunks</span>
                  <strong className="mt-1 text-sm text-gray-700 font-mono">
                    {knowledgeHealth?.chunksCount ?? 0}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Webhook simulator & Grouped Logs */}
          <div className="xl:col-span-3 space-y-4">
            
            {/* Testing Mode Toggle Panel */}
            <div className="flex justify-between items-center bg-gray-50/80 border border-gray-150 rounded-2xl px-4 py-3">
              <div className="text-left">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  Bộ kiểm thử giả lập comment
                </span>
                <p className="text-[9px] text-gray-500 mt-0.5">Giả lập gửi webhook bình luận để thử nghiệm phản hồi.</p>
              </div>
              <button
                onClick={() => setShowSimulator(!showSimulator)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                  showSimulator
                    ? "bg-slate-800 border-slate-800 text-white"
                    : "bg-white border-gray-250 text-gray-700 hover:bg-gray-50 shadow-2xs"
                }`}
              >
                {showSimulator ? "Ẩn công cụ" : "Hiện công cụ"}
              </button>
            </div>

            {/* Simulator card */}
            {showSimulator && (
              <div className="bg-gray-50/50 border border-gray-150 rounded-2xl p-5 space-y-3 text-left animate-fade-in transition-all">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b border-gray-200 pb-2">
                  <Play className="h-4 w-4 text-indigo-650" />
                  Bộ kiểm thử giả lập comment (Webhook simulator)
                </h4>
                
                <p className="text-[10px] text-gray-500 leading-normal">
                  Gửi payload giả lập để kiểm tra trực tiếp luồng phản hồi AI theo từng ID bài đăng cụ thể.
                </p>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="w-1/3">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Post ID bài viết</label>
                      <input
                        type="text"
                        value={simPostId}
                        onChange={(e) => setSimPostId(e.target.value)}
                        placeholder="Post ID..."
                        className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-650 rounded-xl text-xs outline-none transition-all font-mono"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Nội dung bình luận</label>
                      <input
                        type="text"
                        value={simMessage}
                        onChange={(e) => setSimMessage(e.target.value)}
                        placeholder="Nhập nội dung bình luận..."
                        className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-650 rounded-xl text-xs outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleSimulateComment}
                      disabled={simulating}
                      className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {simulating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Gửi comment giả lập
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Grouped Logs List */}
            <div className="space-y-4 text-left">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider shrink-0">
                  Quản lý phản hồi theo bài viết
                </h4>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Tìm theo Post ID, comment..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-200 focus:border-indigo-650 rounded-xl text-[10px] outline-none transition-all w-full sm:w-48 focus:sm:w-60 shadow-2xs"
                  />
                  <button
                    onClick={fetchLogs}
                    disabled={loadingLogs}
                    className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-xl transition-all cursor-pointer border border-gray-200 shrink-0 bg-white"
                    title="Tải lại nhật ký"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {loadingLogs ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 bg-gray-50/30 border border-gray-150 rounded-2xl">
                  <div className="w-6 h-6 border-2 border-indigo-650 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-gray-500">Đang tải nhật ký phản hồi...</p>
                </div>
              ) : postIds.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 bg-gray-50/30 border border-gray-150 rounded-2xl text-center px-4">
                  <HelpCircle className="h-8 w-8 text-gray-300 mb-1" />
                  <p className="text-xs font-bold text-gray-600">Chưa có nhật ký phản hồi nào</p>
                  <p className="text-[10px] text-gray-400 max-w-xs leading-normal">
                    {searchQuery ? "Không tìm thấy phản hồi khớp với từ khóa tìm kiếm." : "Hãy gửi bình luận giả lập bên trên hoặc bình luận thực tế trên fanpage để sinh nhật ký."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {postIds.map((postId) => {
                    const postLogs = groupedLogs[postId];
                    const isExpanded = !!expandedPosts[postId];
                    
                    return (
                      <div key={postId} className="border border-gray-200 rounded-2xl bg-white shadow-2xs overflow-hidden hover:border-gray-300 transition-all">
                        {/* Post Header Bar (Click to toggle collapse) */}
                        <div 
                          onClick={() => togglePostExpanded(postId)}
                          className="flex items-center justify-between p-3.5 bg-gray-50/70 border-b border-gray-150 hover:bg-gray-50 cursor-pointer select-none transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <MessageSquare className="h-4.5 w-4.5 text-indigo-650 shrink-0" />
                            <div className="text-left min-w-0">
                              <span className="text-[11px] font-bold text-gray-800 truncate block font-mono">
                                Bài viết ID: {postId}
                              </span>
                              <span className="text-[9px] text-gray-400 font-semibold block mt-0.5">
                                Tổng số {postLogs.length} phản hồi tự động
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {postId !== "unknown_post" && (
                              <a 
                                href={`https://facebook.com/${postId}`} 
                                target="_blank" 
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()} // Avoid expanding/collapsing when clicking link
                                className="p-1.5 hover:bg-gray-200 text-gray-455 hover:text-indigo-650 rounded-lg transition-all"
                                title="Xem trên Facebook"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                          </div>
                        </div>

                        {/* Collapsible log entries under this post */}
                        {isExpanded && (
                          <div className="p-3.5 space-y-3 bg-white/50 border-t-0">
                            {postLogs.map((log) => (
                              <div key={log._id} className="border border-gray-150 rounded-xl p-3 bg-gray-50/20 hover:bg-gray-50/50 transition-colors space-y-2.5">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className={`px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                    (log.status === "sent" || log.status === "success")
                                      ? "bg-green-50 border border-green-200 text-green-700" 
                                      : "bg-red-50 border border-red-200 text-red-700"
                                  }`}>
                                    {(log.status === "sent" || log.status === "success") ? "Thành công" : "Thất bại"}
                                  </span>
                                  <span className="font-mono text-gray-400">
                                    {log.latencyMs}ms | {new Date(log.createdAt).toLocaleTimeString("vi-VN")}
                                  </span>
                                </div>

                                <div className="space-y-2 text-xs text-left">
                                  <div className="bg-white border border-gray-150 rounded-lg p-2.5 shadow-2xs">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Khách bình luận:</p>
                                    <p className="text-gray-700 font-sans mt-0.5">{log.customerMessage}</p>
                                  </div>
                                  <div className="bg-indigo-50/25 border border-indigo-100/50 rounded-lg p-2.5 shadow-2xs">
                                    <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">AI trả lời:</p>
                                    <p className="text-gray-800 font-sans font-semibold mt-0.5">{log.aiResponse}</p>
                                  </div>
                                </div>

                                {/* Collapsible RAG context matching */}
                                {log.contextPreview && (
                                  <div className="border border-gray-150 rounded-lg overflow-hidden bg-white shadow-3xs">
                                    <button
                                      onClick={() => toggleContextExpanded(log._id)}
                                      className="w-full px-2.5 py-1.5 flex justify-between items-center text-[9px] font-bold text-gray-500 hover:bg-slate-50 transition-colors"
                                    >
                                      <span className="flex items-center gap-1">
                                        <Terminal className="h-3 w-3 text-indigo-500 shrink-0" />
                                        Nguồn tri thức đối chiếu RAG ({log.contextMatches || 0} khớp)
                                      </span>
                                      {expandedContexts[log._id] ? (
                                        <ChevronUp className="h-3 w-3 text-gray-400" />
                                      ) : (
                                        <ChevronDown className="h-3 w-3 text-gray-400" />
                                      )}
                                    </button>
                                    {expandedContexts[log._id] && (
                                      <div className="p-2 border-t border-gray-150 text-[10px] text-gray-600 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed bg-slate-50/40">
                                        {log.contextPreview}
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex justify-between items-center text-[10px] pt-1">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleFeedback(log._id, "good")}
                                      className="px-2 py-0.5 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-bold transition-all active:scale-95 cursor-pointer text-[9px]"
                                    >
                                      Đúng
                                    </button>
                                    <button
                                      onClick={() => handleFeedback(log._id, "needs_fix")}
                                      className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold transition-all active:scale-95 cursor-pointer text-[9px]"
                                    >
                                      Cần sửa
                                    </button>
                                    <button
                                      onClick={() => handleFeedback(log._id, "bad")}
                                      className="px-2 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold transition-all active:scale-95 cursor-pointer text-[9px]"
                                    >
                                      Sai
                                    </button>
                                  </div>
                                  
                                  <span className="font-mono text-gray-400 text-[9px] truncate max-w-[120px]" title={log.commentId}>
                                    CmtID: {log.commentId || "n/a"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
