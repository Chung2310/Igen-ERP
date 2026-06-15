import React, { useState, useEffect } from "react";
import { 
  Building2, Plus, Save, Terminal, Key, Eye, EyeOff, Lock, 
  Trash2, FileEdit, CheckCircle, Copy, Globe, RefreshCw 
} from "lucide-react";
import { toast } from "../../pages/Toast";
import { socialIntegrationService, SocialIntegration } from "../../services/socialIntegrationService";

interface CompanyIntegrationsTabProps {
  userProfile: any;
}

export default function CompanyIntegrationsTab({ userProfile }: CompanyIntegrationsTabProps) {
  // Company integrations state
  const [companyIntegrations, setCompanyIntegrations] = useState<SocialIntegration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [submittingIntegration, setSubmittingIntegration] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingIntegrationId, setEditingIntegrationId] = useState<string | null>(null);

  // Form states for company integration
  const [compPlatform, setCompPlatform] = useState<"TikTok" | "Facebook" | "Zalo">("TikTok");
  const [compDisplayName, setCompDisplayName] = useState("");
  const [compUsername, setCompUsername] = useState("");
  const [compBlotatoAccountId, setCompBlotatoAccountId] = useState("");
  const [compAccessToken, setCompAccessToken] = useState("");
  const [showCompToken, setShowCompToken] = useState(false);
  const [compAppSecret, setCompAppSecret] = useState("");
  const [compVerifyToken, setCompVerifyToken] = useState("");
  const platformMeta = {
    TikTok: {
      displayPlaceholder: "Vi du: TikTok Cong ty",
      usernameLabel: "Ten tai khoan (Username)",
      usernamePlaceholder: "igen_business",
      tokenLabel: "Blotato API Key *",
      tokenPlaceholder: "Nhap Blotato API Key",
      tokenHelp: "Khoa API dung de dang bai qua trung gian Blotato.",
      activeClass: "border-black bg-black text-white shadow-sm",
    },
    Facebook: {
      displayPlaceholder: "Vi du: Fanpage Chinh thuc",
      usernameLabel: "Page ID / Username",
      usernamePlaceholder: "Vi du: 123456789012345 hoac igen.erp.fanpage",
      tokenLabel: "Page Access Token *",
      tokenPlaceholder: "Nhap Page Access Token",
      tokenHelp: "Nen luu Page ID that cua fanpage de dung on dinh cho cac luong Facebook.",
      activeClass: "border-[#1877F2] bg-[#1877F2] text-white shadow-sm",
    },
    Zalo: {
      displayPlaceholder: "Vi du: Zalo OA Shop",
      usernameLabel: "OA ID hoac Username",
      usernamePlaceholder: "OA ID hoac Username",
      tokenLabel: "Zalo Access Token *",
      tokenPlaceholder: "Nhap Zalo Access Token",
      tokenHelp: "Access Token cua Official Account.",
      activeClass: "border-[#0068ff] bg-[#0068ff] text-white shadow-sm",
    },
  } as const;
  const currentPlatformMeta = platformMeta[compPlatform];

  // Fetch company integrations
  const fetchCompanyIntegrations = async () => {
    setLoadingIntegrations(true);
    try {
      const data = await socialIntegrationService.getIntegrations();
      setCompanyIntegrations(data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi khi tải danh sách liên kết mạng xã hội");
    } finally {
      setLoadingIntegrations(false);
    }
  };

  useEffect(() => {
    fetchCompanyIntegrations();
  }, []);

  const handleSaveCompanyIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compDisplayName.trim()) {
      toast.error("Vui lòng nhập Tên hiển thị!");
      return;
    }
    if (!compAccessToken.trim()) {
      toast.error("Vui lòng nhập Access Token hoặc API Key!");
      return;
    }
    if (compPlatform === "TikTok" && !compBlotatoAccountId.trim()) {
      toast.error("TikTok yêu cầu Blotato Account ID!");
      return;
    }

    setSubmittingIntegration(true);
    try {
      const payload: Partial<SocialIntegration> = {
        platform: compPlatform,
        displayName: compDisplayName.trim(),
        username: compUsername.trim() || undefined,
        blotatoAccountId: compPlatform === "TikTok" ? compBlotatoAccountId.trim() : undefined,
        accessToken: compAccessToken.trim(),
        appSecret: compPlatform === "Facebook" ? compAppSecret.trim() : undefined,
        verifyToken: compPlatform === "Facebook" ? compVerifyToken.trim() : undefined,
        isConnected: true,
        createdBy: userProfile?.email || "system",
      };

      if (editingIntegrationId) {
        await socialIntegrationService.updateIntegration(editingIntegrationId, payload);
        toast.success("Cập nhật liên kết mạng xã hội thành công!");
      } else {
        await socialIntegrationService.createIntegration(payload);
        toast.success("Thêm liên kết mạng xã hội thành công!");
      }

      // Reset form and reload
      resetCompForm();
      fetchCompanyIntegrations();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi khi lưu thông tin liên kết");
    } finally {
      setSubmittingIntegration(false);
    }
  };

  const handleEditCompanyIntegration = (integration: SocialIntegration) => {
    if (!integration._id) return;
    setEditingIntegrationId(integration._id);
    setCompPlatform(integration.platform);
    setCompDisplayName(integration.displayName);
    setCompUsername(integration.username || "");
    setCompBlotatoAccountId(integration.blotatoAccountId || "");
    setCompAccessToken(integration.accessToken || "");
    setShowCompToken(false);
    setCompAppSecret(integration.appSecret || "");
    setCompVerifyToken(integration.verifyToken || "");
  };

  const handleDeleteCompanyIntegration = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa liên kết tài khoản mạng xã hội này? Hành động này không thể hoàn tác.")) {
      return;
    }
    setDeletingId(id);
    try {
      await socialIntegrationService.deleteIntegration(id);
      toast.success("Xóa liên kết thành công!");
      fetchCompanyIntegrations();
      if (editingIntegrationId === id) {
        resetCompForm();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi khi xóa liên kết");
    } finally {
      setDeletingId(null);
    }
  };

  const resetCompForm = () => {
    setEditingIntegrationId(null);
    setCompPlatform("TikTok");
    setCompDisplayName("");
    setCompUsername("");
    setCompBlotatoAccountId("");
    setCompAccessToken("");
    setShowCompToken(false);
    setCompAppSecret("");
    setCompVerifyToken("");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
          <div className="text-left">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-650" />
              Mạng xã hội Doanh nghiệp
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Quản lý các tài khoản mạng xã hội dùng chung của công ty. Các bài viết tự động đăng tải sẽ lấy cấu hình tại đây.
            </p>
          </div>
          {editingIntegrationId && (
            <button
              onClick={resetCompForm}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-gray-200"
            >
              <Plus className="h-3.5 w-3.5" /> Hủy sửa & Thêm mới
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left: Form to Add/Edit Integration */}
          <div className="xl:col-span-2 bg-gray-50/50 border border-gray-150 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider text-left">
              {editingIntegrationId ? "Chỉnh sửa tài khoản" : "Thêm tài khoản liên kết"}
            </h4>
            
            <form onSubmit={handleSaveCompanyIntegration} className="space-y-4 text-left">
              {/* Platform Select */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Nền tảng *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "TikTok", label: "TikTok" },
                    { value: "Facebook", label: "Facebook" },
                    { value: "Zalo", label: "Zalo" }
                  ].map((p) => (
                    <label key={p.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="compPlatform"
                        value={p.value}
                        checked={compPlatform === p.value}
                        onChange={() => {
                          if (!editingIntegrationId) {
                            setCompPlatform(p.value as any);
                          }
                        }}
                        disabled={!!editingIntegrationId}
                        className="sr-only peer"
                      />
                      <div className={`py-2 text-center rounded-xl border text-xs font-semibold transition-all ${
                        compPlatform === p.value
                          ? platformMeta[p.value as keyof typeof platformMeta].activeClass
                          : "border-gray-250 bg-white text-gray-500"
                      } ${editingIntegrationId ? "opacity-60 cursor-not-allowed" : "hover:border-gray-300"}`}>
                        {p.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Tên hiển thị kênh *</label>
                <input
                  type="text"
                  required
                  value={compDisplayName}
                  onChange={(e) => setCompDisplayName(e.target.value)}
                  placeholder={currentPlatformMeta.displayPlaceholder}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{currentPlatformMeta.usernameLabel}</label>
                <div className="relative">
                  {compPlatform === "TikTok" && <span className="absolute left-3.5 top-2.5 text-xs text-gray-400 font-bold select-none">@</span>}
                  <input
                    type="text"
                    value={compUsername}
                    onChange={(e) => setCompUsername(e.target.value)}
                    placeholder={currentPlatformMeta.usernamePlaceholder}
                    className={`w-full ${compPlatform === "TikTok" ? "pl-8" : "px-3.5"} py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all`}
                  />
                </div>
                {compPlatform === "Facebook" && (
                  <p className="text-[9px] text-gray-400 leading-normal">
                    Ưu tiên nhập Page ID thật của fanpage. Đây là trường backend đang dùng để gọi lại các luồng Facebook.
                  </p>
                )}
              </div>

              {/* Blotato Account ID (Only for TikTok) */}
              {compPlatform === "TikTok" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Blotato Account ID *</label>
                  <input
                    type="text"
                    required
                    value={compBlotatoAccountId}
                    onChange={(e) => setCompBlotatoAccountId(e.target.value)}
                    placeholder="Ví dụ: acc_60d5ec123456"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-mono text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all"
                  />
                  <p className="text-[9px] text-gray-400 leading-normal">
                    ID tài khoản TikTok được Blotato cấp. Xem trong trang cấu hình Blotato của bạn.
                  </p>
                </div>
              )}

              {/* Access Token / API Key */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{currentPlatformMeta.tokenLabel}</label>
                <div className="relative flex items-center">
                  <input
                    type={showCompToken ? "text" : "password"}
                    required
                    value={compAccessToken}
                    onChange={(e) => setCompAccessToken(e.target.value)}
                    placeholder={currentPlatformMeta.tokenPlaceholder}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-mono text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCompToken(!showCompToken)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showCompToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[9px] text-gray-400 leading-normal">{currentPlatformMeta.tokenHelp}</p>
              </div>

              {/* Facebook Message configurations: App Secret and Verify Token */}
              {compPlatform === "Facebook" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">App Secret</label>
                    <input
                      type="text"
                      value={compAppSecret}
                      onChange={(e) => setCompAppSecret(e.target.value)}
                      placeholder="Nhập Facebook App Secret (nếu dùng cho Message)"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-mono text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all"
                    />
                    <p className="text-[9px] text-gray-400 leading-normal">
                      App Secret của ứng dụng Facebook dùng để xác thực chữ ký tin nhắn.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Verify Token</label>
                    <input
                      type="text"
                      value={compVerifyToken}
                      onChange={(e) => setCompVerifyToken(e.target.value)}
                      placeholder="Nhập Webhook Verify Token (nếu dùng cho Message)"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-mono text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all"
                    />
                    <p className="text-[9px] text-gray-400 leading-normal">
                      Mã xác minh cấu hình trên Facebook Webhook dashboard.
                    </p>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submittingIntegration}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>{submittingIntegration ? "Đang lưu..." : editingIntegrationId ? "Cập nhật" : "Lưu liên kết"}</span>
                </button>
                {editingIntegrationId && (
                  <button
                    type="button"
                    onClick={resetCompForm}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all border border-gray-200 cursor-pointer"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Right: List of Connected Accounts */}
          <div className="xl:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Danh sách tài khoản ({companyIntegrations.length})
              </h4>
              <button
                onClick={fetchCompanyIntegrations}
                disabled={loadingIntegrations}
                className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-lg transition-all cursor-pointer border border-transparent hover:border-gray-200"
                title="Tải lại danh sách"
              >
                <RefreshCw className={`h-4 w-4 ${loadingIntegrations ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loadingIntegrations ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 bg-gray-50/30 border border-gray-150 rounded-2xl">
                <div className="w-6 h-6 border-2 border-indigo-650 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-gray-500">Đang tải danh sách tài khoản doanh nghiệp...</p>
              </div>
            ) : companyIntegrations.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 bg-gray-50/30 border border-gray-150 rounded-2xl text-center px-4">
                <Globe className="h-8 w-8 text-gray-300 mb-1" />
                <p className="text-xs font-bold text-gray-600">Chưa có liên kết doanh nghiệp nào</p>
                <p className="text-[10px] text-gray-400 max-w-xs">
                  Điền thông tin ở biểu mẫu bên trái để liên kết tài khoản đầu tiên phục vụ đăng bài viết marketing.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                {companyIntegrations.map((item) => (
                  <div
                    key={item._id}
                    className={`border rounded-2xl p-4 bg-white shadow-2xs flex flex-col justify-between gap-4 transition-all hover:shadow-xs ${editingIntegrationId === item._id ? "border-indigo-500 ring-2 ring-indigo-500/10" : "border-gray-200"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex gap-3">
                        {/* Platform Icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-bold ${
                          item.platform === "TikTok" ? "bg-black" : item.platform === "Facebook" ? "bg-blue-600" : "bg-[#0068ff]"
                        }`}>
                          {item.platform === "TikTok" ? "♪" : item.platform === "Facebook" ? "F" : "Z"}
                        </div>
                        <div className="text-left min-w-0">
                          <h5 className="text-xs font-bold text-gray-800 truncate" title={item.displayName}>
                            {item.displayName}
                          </h5>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">
                            {item.platform === "TikTok" ? `@${item.username || "n/a"}` : item.username || "n/a"}
                          </p>
                        </div>
                      </div>

                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded-full text-[9px] font-bold shrink-0">
                        <CheckCircle className="h-3 w-3" /> Đang chạy
                      </span>
                    </div>

                    {/* Details details */}
                    <div className="bg-gray-50/70 border border-gray-150/60 rounded-xl p-2.5 text-left text-[10px] space-y-1.5 font-mono text-gray-600">
                      {item.platform === "TikTok" && (
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-400">Blotato ID:</span>
                          <span className="font-semibold truncate max-w-[130px]">{item.blotatoAccountId}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">Token/Key:</span>
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">••••••••</span>
                          <button
                            onClick={() => {
                              if (item.accessToken) {
                                navigator.clipboard.writeText(item.accessToken);
                                toast.success("Đã sao chép token!");
                              }
                            }}
                            className="p-0.5 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 cursor-pointer"
                            title="Copy Token"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {item.platform === "Facebook" && item.appSecret && (
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-400">App Secret:</span>
                          <span className="font-semibold truncate max-w-[130px]">{item.appSecret}</span>
                        </div>
                      )}
                      {item.platform === "Facebook" && item.verifyToken && (
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-400">Verify Token:</span>
                          <span className="font-semibold truncate max-w-[130px]">{item.verifyToken}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-2 pt-1.5 border-t border-gray-150">
                        <span className="text-gray-400">Tạo bởi:</span>
                        <span className="truncate max-w-[140px]" title={item.createdBy}>{item.createdBy}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-gray-100 mt-1">
                      <button
                        onClick={() => handleEditCompanyIntegration(item)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                      >
                        <FileEdit className="h-3.5 w-3.5" /> Sửa
                      </button>
                      <button
                        onClick={() => item._id && handleDeleteCompanyIntegration(item._id)}
                        disabled={deletingId === item._id}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {deletingId === item._id ? "Đang xóa..." : "Xóa"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
