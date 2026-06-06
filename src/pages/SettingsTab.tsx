import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Lock,
  Key,
  Eye,
  EyeOff,
  Sparkles,
  Save,
  Terminal,
  Bell,
  Image as ImageIcon,
  CheckCircle,
  Sliders,
  Laptop,
  Link,
  Unlink,
  ExternalLink,
  Facebook,
  AlertTriangle,
  Copy,
  FileEdit
} from "lucide-react";
import { auth } from "../config/firebase";
import { updatePassword } from "firebase/auth";
import { toast } from "./Toast";
import { FacebookIntegration } from "../types";

export default function SettingsTab() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { userProfile, updateProfileInfo, uploadAvatar } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || "");
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Sub-tabs in Settings
  const [activeSubTab, setActiveSubTab] = useState<"profile" | "security" | "erp" | "integrations">("profile");
  const { dark } = useTheme();

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [aiModel, setAiModel] = useState("gemini-2.5-flash");
  const [autoBackup, setAutoBackup] = useState(true);

  // Facebook integration form states
  const [fbPageId, setFbPageId] = useState("");
  const [fbPageName, setFbPageName] = useState("");
  const [fbPageToken, setFbPageToken] = useState("");
  const [connectingFb, setConnectingFb] = useState(false);
  const [disconnectingFb, setDisconnectingFb] = useState(false);
  const [showConnectedToken, setShowConnectedToken] = useState(false);
  const [isEditingFb, setIsEditingFb] = useState(false);
  const { saveFacebookIntegration, removeFacebookIntegration } = useAuth();

  // Đồng bộ thông tin liên kết Facebook từ userProfile lên các ô nhập liệu
  React.useEffect(() => {
    if (userProfile?.facebookIntegration) {
      setFbPageId(userProfile.facebookIntegration.pageId || "");
      setFbPageName(userProfile.facebookIntegration.pageName || "");
      setFbPageToken(userProfile.facebookIntegration.pageAccessToken || "");
    } else {
      setFbPageId("");
      setFbPageName("");
      setFbPageToken("");
    }
  }, [userProfile?.facebookIntegration]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp tin hình ảnh hợp lệ!");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Kích thước hình ảnh không được vượt quá 5MB!");
      return;
    }

    setUploading(true);
    try {
      const downloadURL = await uploadAvatar(file);
      setPhotoURL(downloadURL);
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Họ và tên không được để trống!");
      return;
    }
    setUpdatingProfile(true);
    try {
      await updateProfileInfo(displayName, photoURL);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      toast.error("Mật khẩu mới không được để trống!");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải chứa ít nhất 6 ký tự!");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }

    setUpdatingPassword(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updatePassword(currentUser, newPassword);
        toast.success("Thay đổi mật khẩu thành công!");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error("Không tìm thấy thông tin phiên đăng nhập.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/requires-recent-login") {
        toast.error("Hành động này yêu cầu bạn phải đăng nhập lại gần đây để xác thực.");
      } else {
        toast.error("Thay đổi mật khẩu thất bại. Vui lòng thử lại.");
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  const getFormattedDate = () => {
    if (!userProfile?.createdAt) return "Chưa cập nhật";

    let date: Date;
    if (typeof userProfile.createdAt.toDate === "function") {
      date = userProfile.createdAt.toDate();
    } else if (userProfile.createdAt.seconds) {
      date = new Date(userProfile.createdAt.seconds * 1000);
    } else {
      date = new Date(userProfile.createdAt);
    }

    if (isNaN(date.getTime())) {
      return "Chưa cập nhật";
    }

    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const formattedDate = getFormattedDate();

  return (
    <div className="h-full flex flex-col font-sans overflow-y-auto pr-2 pb-6" id="settings_tab_container">

      {/* Title Header with Glassmorphism Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-indigo-650" />
            Cài đặt Hệ thống & Cá nhân
          </h2>
          <p className="text-xs text-gray-500 mt-1">Cấu hình thông tin hồ sơ của bạn và tùy chỉnh tham số vận hành của iGen ERP.</p>
        </div>
        <div className="flex gap-2 bg-gray-150/70 p-1 rounded-xl border border-gray-200 max-w-fit">
          <button
            onClick={() => setActiveSubTab("profile")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === "profile"
              ? "bg-white text-gray-800 shadow-xs"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            Hồ sơ cá nhân
          </button>
          <button
            onClick={() => setActiveSubTab("security")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === "security"
              ? "bg-white text-gray-800 shadow-xs"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            Bảo mật
          </button>
          <button
            onClick={() => setActiveSubTab("erp")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === "erp"
              ? "bg-white text-gray-800 shadow-xs"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            Cấu hình ERP
          </button>
          <button
            onClick={() => setActiveSubTab("integrations")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === "integrations"
              ? "bg-white text-gray-800 shadow-xs"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            🔗 Liên kết MXH
          </button>
        </div>
      </div>

      {/* Main Settings Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left Column: Quick Profile Card */}
        <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col items-center text-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-80" />

          <div className="relative mt-10 cursor-pointer group" onClick={handleAvatarClick}>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            {uploading ? (
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gray-100 flex items-center justify-center relative z-10">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg relative z-10 group-hover:opacity-90 transition-opacity"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-3xl shadow-lg border-4 border-white relative z-10 select-none group-hover:bg-indigo-700 transition-colors">
                {displayName.slice(0, 2).toUpperCase() || "AD"}
              </div>
            )}
            <div className="absolute bottom-0 right-0 z-20 w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <ImageIcon className="h-4 w-4 text-gray-500" />
            </div>
          </div>

          <div className="space-y-1 relative z-10 mt-2">
            <h3 className="text-base font-bold text-gray-800">{displayName}</h3>
            <p className="text-xs text-gray-500">{userProfile?.email}</p>
            <div className="pt-2 flex justify-center">
              <span className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-[9px] uppercase border tracking-wider ${userProfile?.role === "superadmin"
                ? "bg-rose-50 border-rose-200 text-rose-600"
                : userProfile?.role === "admin"
                  ? "bg-amber-50 border-amber-200 text-amber-600"
                  : "bg-slate-50 border-slate-200 text-slate-600"
                }`}>
                Quyền hạn: {userProfile?.role}
              </span>
            </div>
          </div>

          <div className="w-full border-t border-gray-100 pt-4 mt-2 space-y-3 text-left text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-gray-400">
                <Calendar className="h-4 w-4" />
                Ngày tham gia
              </span>
              <span className="font-semibold text-gray-700">{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Right Columns: Settings Forms */}
        <div className="lg:col-span-2 space-y-6">

          {/* SubTab 1: Profile Settings */}
          {activeSubTab === "profile" && (
            <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs">
              <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                <User className="h-5 w-5 text-blue-500" />
                Cập nhật thông tin hồ sơ
              </h3>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Họ và Tên *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Họ và tên của bạn"
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Địa chỉ Email (Không được đổi)</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-300" />
                      <input
                        type="email"
                        disabled
                        value={userProfile?.email || ""}
                        className="w-full pl-11 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-400 outline-none cursor-not-allowed select-none"
                      />
                    </div>
                  </div>
                </div>



                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    <span>{updatingProfile ? "Đang lưu..." : "Lưu thay đổi"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SubTab 2: Security & Password */}
          {activeSubTab === "security" && (
            <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs">
              <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                <Lock className="h-5 w-5 text-amber-500" />
                Thay đổi mật khẩu tài khoản
              </h3>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Mật khẩu mới *</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nhập tối thiểu 6 ký tự"
                        className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Xác nhận mật khẩu mới *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="px-5 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Lock className="h-4 w-4" />
                    <span>{updatingPassword ? "Đang cập nhật..." : "Đổi mật khẩu"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SubTab 3: ERP System Config */}
          {activeSubTab === "erp" && (
            <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs space-y-6">

              {/* Preferences Section */}
              <div>
                <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Sliders className="h-5 w-5 text-purple-500" />
                  Cài đặt hiển thị & Thông báo
                </h3>

                <div className="space-y-4">


                  {/* Email notification toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                        <Bell className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-800">Nhận thông báo qua Email</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">Nhận các báo cáo tóm tắt hàng ngày qua email đăng ký.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={(e) => {
                          setEmailNotifications(e.target.checked);
                          toast.success(e.target.checked ? "Đã bật thông báo qua email" : "Đã tắt thông báo qua email");
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* AI Copilot & Data Settings */}
              <div>
                <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  Mô hình Trợ lý AI & Dữ liệu
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Phiên bản Gemini API</label>
                    <select
                      value={aiModel}
                      onChange={(e) => {
                        setAiModel(e.target.value);
                        toast.success(`Đã đổi mô hình AI sang: ${e.target.value}`);
                      }}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Tốc độ tối ưu)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Đọc hiểu nâng cao)</option>
                      <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Thử nghiệm)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-150 rounded-xl mt-4 md:mt-0">
                    <div className="flex items-center gap-2.5">
                      <Laptop className="h-4.5 w-4.5 text-gray-500" />
                      <div>
                        <h4 className="text-[11px] font-bold text-gray-800">Auto-Backup Dữ liệu</h4>
                        <p className="text-[9px] text-gray-400">Sao lưu tự động sang Firestore</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoBackup}
                        onChange={(e) => setAutoBackup(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* SubTab 4: Social Media Integrations */}
          {activeSubTab === "integrations" && (
            <div className="space-y-6">

              {/* Facebook Page Autopost */}
              <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs">
                <h3 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                    <Facebook className="h-4 w-4 text-white" />
                  </span>
                  Facebook Page Autopost
                </h3>
                <p className="text-xs text-gray-500 mb-5">Kết nối Facebook Page để tự động đăng bài viết marketing đã được duyệt lên trang doanh nghiệp.</p>

                {userProfile?.facebookIntegration?.isConnected && !isEditingFb ? (
                  /* Connected State */
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-blue-50/50 border border-blue-200/80 rounded-xl">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/10">
                        <Facebook className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-800 truncate">{userProfile.facebookIntegration.pageName}</h4>
                          {userProfile.facebookIntegration.isMock && (
                            <span className="px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-700 rounded-full text-[9px] font-bold font-mono shrink-0">DEMO</span>
                          )}
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 border border-green-300 text-green-700 rounded-full text-[10px] font-bold shrink-0">
                            <CheckCircle className="h-3 w-3" /> Đang hoạt động
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-mono mt-1">
                          Kết nối lúc: {userProfile.facebookIntegration.connectedAt
                            ? (typeof userProfile.facebookIntegration.connectedAt === 'string'
                              ? new Date(userProfile.facebookIntegration.connectedAt).toLocaleString('vi-VN')
                              : 'Vừa xong')
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Chi tiết thông tin cấu hình liên kết */}
                    <div className="space-y-3.5 bg-gray-50 border border-gray-150 rounded-xl p-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Facebook Page ID</span>
                        <div className="relative">
                          <Terminal className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            readOnly
                            value={userProfile.facebookIntegration.pageId}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-mono text-gray-700 outline-none cursor-default"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Page Access Token</span>
                        <div className="relative flex items-center">
                          <Key className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                          <input
                            type={showConnectedToken ? "text" : "password"}
                            readOnly
                            value={userProfile.facebookIntegration.pageAccessToken}
                            className="w-full pl-11 pr-24 py-3 bg-white border border-gray-200 rounded-xl text-xs font-mono text-gray-700 outline-none cursor-default"
                          />
                          <div className="absolute right-2 flex gap-1">
                            <button
                              type="button"
                              onClick={() => setShowConnectedToken(!showConnectedToken)}
                              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                              title={showConnectedToken ? "Ẩn Token" : "Hiện Token"}
                            >
                              {showConnectedToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(userProfile.facebookIntegration.pageAccessToken);
                                toast.success("Đã sao chép Access Token vào bộ nhớ tạm!");
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                              title="Sao chép Token"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-800">Lưu ý quan trọng</p>
                        <p className="text-amber-700 mt-0.5">Sau khi kết nối, các bài viết marketing ở trạng thái <b>ĐÃ LÊN LỊCH</b> (Scheduled) sẽ được tự động đăng trực tiếp lên Facebook Page này khi đến giờ hẹn.</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setIsEditingFb(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <FileEdit className="h-4 w-4" />
                        Chỉnh sửa liên kết
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setDisconnectingFb(true);
                          try {
                            await removeFacebookIntegration();
                          } finally {
                            setDisconnectingFb(false);
                          }
                        }}
                        disabled={disconnectingFb}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Unlink className="h-4 w-4" />
                        {disconnectingFb ? "Đang hủy..." : "Hủy liên kết"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Not Connected / Editing State */
                  <div className="space-y-4">
                    {isEditingFb && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2 text-xs">
                        <Sliders className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-blue-800">Đang chỉnh sửa cấu hình liên kết</p>
                          <p className="text-blue-700 mt-0.5">Bạn đang cập nhật trực tiếp thông tin Facebook Page đã lưu. Nhấn Cập nhật để lưu đè lên dữ liệu cũ.</p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Tên Facebook Page *</label>
                        <div className="relative">
                          <Facebook className="absolute left-3.5 top-3.5 h-4 w-4 text-blue-400" />
                          <input
                            type="text"
                            value={fbPageName}
                            onChange={(e) => setFbPageName(e.target.value)}
                            placeholder="iGen Tech - Giải pháp ERP"
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Facebook Page ID *</label>
                        <div className="relative">
                          <Terminal className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            value={fbPageId}
                            onChange={(e) => setFbPageId(e.target.value)}
                            placeholder="Ví dụ: 1234567890"
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Page Access Token *</label>
                      <div className="relative">
                        <Key className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                        <input
                          type="password"
                          value={fbPageToken}
                          onChange={(e) => setFbPageToken(e.target.value)}
                          placeholder="EAA... (lấy từ Facebook Developers)"
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Lấy Page Access Token tại <span className="font-mono text-blue-600">developers.facebook.com/tools/explorer</span>
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
                      {/* Kết nối / Cập nhật */}
                      <button
                        type="button"
                        onClick={async () => {
                          if (!fbPageId.trim() || !fbPageName.trim() || !fbPageToken.trim()) {
                            toast.error("Vui lòng điền đầy đủ Tên Page, Page ID và Page Access Token!");
                            return;
                          }
                          setConnectingFb(true);
                          try {
                            const integration: FacebookIntegration = {
                              isConnected: true,
                              pageId: fbPageId.trim(),
                              pageName: fbPageName.trim(),
                              pageAccessToken: fbPageToken.trim(),
                              connectedAt: new Date().toISOString(),
                              isMock: false
                            };
                            await saveFacebookIntegration(integration);
                            setIsEditingFb(false);
                          } finally {
                            setConnectingFb(false);
                          }
                        }}
                        disabled={connectingFb}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                      >
                        <Link className="h-4 w-4" />
                        {connectingFb ? "Đang lưu..." : (isEditingFb ? "Cập nhật tài khoản" : "Kết nối tài khoản")}
                      </button>

                      {/* Kết nối Demo (Chỉ hiện khi chưa liên kết và không trong chế độ sửa) */}
                      {!isEditingFb && (
                        <button
                          type="button"
                          onClick={async () => {
                            setConnectingFb(true);
                            try {
                              const integration: FacebookIntegration = {
                                isConnected: true,
                                pageId: "102938475610293",
                                pageName: "iGen Tech Demo Page",
                                pageAccessToken: "EAA_mock_token_igen_erp_demo_123456789",
                                connectedAt: new Date().toISOString(),
                                isMock: true
                              };
                              await saveFacebookIntegration(integration);
                            } finally {
                              setConnectingFb(false);
                            }
                          }}
                          disabled={connectingFb}
                          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                        >
                          <Sparkles className="h-4 w-4" />
                          Kết nối Demo (1-Click)
                        </button>
                      )}

                      {/* Hủy bỏ chỉnh sửa */}
                      {isEditingFb && (
                        <button
                          type="button"
                          onClick={() => setIsEditingFb(false)}
                          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all border border-gray-200 cursor-pointer"
                        >
                          Hủy bỏ
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* TikTok Autopost */}
              <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs" id="tiktok_integration_section">
                <h3 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white text-sm font-black shrink-0">
                    ♪
                  </span>
                  TikTok Autopost
                  {!userProfile?.tiktokIntegration?.isConnected && (
                    <span className="px-2 py-0.5 bg-purple-100 border border-purple-300 text-purple-700 rounded-full text-[9px] font-bold font-mono">MOCK READY</span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 mb-5">
                  Kết nối tài khoản TikTok để tự động đăng video ngắn marketing. Hỗ trợ Mock Mode để test ngay mà không cần TikTok Developer App.
                </p>

                {userProfile?.tiktokIntegration?.isConnected ? (
                  /* Connected State */
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-slate-50/80 border border-slate-200 rounded-xl">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-black flex items-center justify-center shrink-0 shadow-md text-white text-xl font-black">
                        ♪
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-800 truncate">
                            {userProfile.tiktokIntegration.displayName}
                          </h4>
                          <span className="text-[11px] text-gray-500 font-mono">@{userProfile.tiktokIntegration.username}</span>
                          {userProfile.tiktokIntegration.isMock && (
                            <span className="px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-700 rounded-full text-[9px] font-bold font-mono shrink-0">DEMO</span>
                          )}
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 border border-green-300 text-green-700 rounded-full text-[10px] font-bold shrink-0">
                            <CheckCircle className="h-3 w-3" /> Đang hoạt động
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-mono mt-1">
                          Kết nối lúc: {userProfile.tiktokIntegration.connectedAt
                            ? (typeof userProfile.tiktokIntegration.connectedAt === 'string'
                              ? new Date(userProfile.tiktokIntegration.connectedAt).toLocaleString('vi-VN')
                              : 'Vừa xong')
                            : 'N/A'}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Quyền riêng tư mặc định: <span className="font-mono font-bold">{userProfile.tiktokIntegration.privacyLevel || 'SELF_ONLY'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-800">Lưu ý về TikTok API</p>
                        <p className="text-amber-700 mt-0.5">
                          {userProfile.tiktokIntegration.isMock
                            ? "Đang chạy ở chế độ Demo — bài đăng được giả lập, không thật sự lên TikTok. Kết nối API thật khi có TikTok Developer App."
                            : "Bài đăng sẽ được đăng ở chế độ Private cho đến khi TikTok duyệt Developer App của bạn."}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2 border-t border-gray-100">
                      <TikTokConnectSection />
                    </div>
                  </div>
                ) : (
                  /* Not Connected State */
                  <div className="space-y-5">
                    {/* Hướng dẫn tạo Developer App */}
                    <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
                      <p className="font-bold text-blue-800 flex items-center gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Chưa có TikTok Developer App? Tạo miễn phí tại:
                      </p>
                      <ol className="text-blue-700 space-y-1 ml-4 list-decimal">
                        <li>Truy cập <span className="font-mono bg-blue-100 px-1 rounded">developers.tiktok.com</span> → Đăng nhập bằng TK TikTok</li>
                        <li>Tạo App → Thêm sản phẩm <b>Content Posting API</b></li>
                        <li>Lấy <b>Client Key</b> và <b>Client Secret</b> → điền vào <span className="font-mono bg-blue-100 px-1 rounded">.env</span></li>
                        <li>Đăng ký redirect URI: <span className="font-mono bg-blue-100 px-1 rounded">http://localhost:5173/tiktok-callback</span></li>
                      </ol>
                      <p className="text-blue-600 mt-2">
                        📋 Trong khi chờ, dùng <b>Demo Mode</b> bên dưới để test toàn bộ flow đăng bài.
                      </p>
                    </div>

                    {/* Demo 1-Click */}
                    <TikTokConnectSection />
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}

// Component kết nối TikTok — tách ra để dùng useAuth hook trực tiếp
function TikTokConnectSection() {
  const { saveTikTokIntegration, removeTikTokIntegration, userProfile } = useAuth();
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  const handleConnectDemo = async () => {
    setConnecting(true);
    try {
      await saveTikTokIntegration({
        isConnected: true,
        username: 'igen_tech_demo',
        displayName: 'iGen Tech Demo',
        avatarUrl: '',
        connectedAt: new Date().toISOString(),
        privacyLevel: 'SELF_ONLY',
        isMock: true,
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await removeTikTokIntegration();
    } finally {
      setDisconnecting(false);
    }
  };

  if (userProfile?.tiktokIntegration?.isConnected) {
    return (
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={disconnecting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
      >
        <Unlink className="h-4 w-4" />
        {disconnecting ? 'Đang hủy...' : 'Hủy liên kết TikTok'}
      </button>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Demo 1-Click */}
      <button
        type="button"
        onClick={handleConnectDemo}
        disabled={connecting}
        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-slate-800 to-black hover:from-slate-700 hover:to-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
        id="tiktok_demo_connect_btn"
      >
        <Sparkles className="h-4 w-4" />
        {connecting ? 'Đang kết nối...' : '🎬 Kết nối Demo TikTok (1-Click)'}
      </button>

      {/* Real Connect - disabled khi chưa có client key */}
      <button
        type="button"
        disabled
        title="Cần điền VITE_TIKTOK_CLIENT_KEY vào .env trước"
        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 text-gray-400 rounded-xl text-xs font-bold border border-dashed border-gray-300 cursor-not-allowed"
      >
        <Link className="h-4 w-4" />
        Kết nối TikTok thật
        <span className="text-[9px] bg-gray-200 px-1.5 py-0.5 rounded font-mono">Cần API Key</span>
      </button>
    </div>
  );
}

