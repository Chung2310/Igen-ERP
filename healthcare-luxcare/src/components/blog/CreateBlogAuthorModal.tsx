import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  UserPlus,
  ShieldCheck,
  Building,
  Mail,
  Lock,
  User,
  Phone,
  Briefcase,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Crown,
} from "lucide-react";
import { authService } from "../../services/authService";
import { CompanyProfile, UserProfile } from "../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateBlogAuthorModal({ open, onClose, onSuccess }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<"create" | "assign">("create");

  // Form tạo mới
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyCode, setCompanyCode] = useState("SYSTEM");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("Ban Biên Tập");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Danh sách công ty & người dùng
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUserKeyword, setSearchUserKeyword] = useState("");

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    // Tải danh sách công ty
    authService
      .getAllCompanies()
      .then((data) => {
        setCompanies(data || []);
      })
      .catch((err) => console.error("Error fetching companies:", err));
  }, [open]);

  // Tải danh sách người dùng khi mở tab assign hoặc đổi công ty
  useEffect(() => {
    if (!open || activeSubTab !== "assign") return;
    setLoadingUsers(true);
    authService
      .getAllUsers(companyCode && companyCode !== "all" ? companyCode : undefined)
      .then((users) => {
        setUsersList(users || []);
      })
      .catch((err) => console.error("Error fetching users:", err))
      .finally(() => setLoadingUsers(false));
  }, [open, activeSubTab, companyCode]);

  if (!open) return null;

  // Xử lý tạo mới tài khoản Ban Biên Tập
  const handleCreateNewAuthor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !email.trim() || !password) {
      setErrorMsg("Vui lòng điền đầy đủ các thông tin bắt buộc (*)");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Mật khẩu phải từ 6 ký tự trở lên");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const finalCompanyCode = companyCode || "SYSTEM";
      const targetCompany = companies.find((c) => c.code === finalCompanyCode);
      const companyName = finalCompanyCode === "SYSTEM" ? "Toàn hệ thống" : targetCompany ? targetCompany.name : finalCompanyCode;

      await authService.registerUserForCompany(
        displayName.trim(),
        email.trim(),
        password,
        "blog_editor" as any,
        finalCompanyCode,
        companyName,
        undefined,
        undefined,
        "Ban Biên Tập",
        "Truyền Thông Nội Bộ",
        phone.trim() || undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      setSuccessMsg(`Tạo tài khoản Ban Biên Tập cho "${displayName}" thành công!`);
      setDisplayName("");
      setEmail("");
      setPassword("");
      setPhone("");
      setJobTitle("Ban Biên Tập");

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Error creating blog author:", err);
      setErrorMsg(err.message || "Lỗi khi tạo tài khoản Ban Biên Tập");
    } finally {
      setSubmitting(false);
    }
  };

  // Gán role Ban Biên Tập cho user có sẵn
  const handleAssignRole = async (targetUser: UserProfile) => {
    try {
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      await authService.updateUser(targetUser.uid, {
        role: "blog_editor",
      });

      setSuccessMsg(`Đã nâng cấp quyền Ban Biên Tập cho "${targetUser.displayName}"!`);
      // Cập nhật local list
      setUsersList((prev) =>
        prev.map((u) => (u.uid === targetUser.uid ? { ...u, role: "blog_editor" as any } : u)),
      );

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Error updating user role:", err);
      setErrorMsg(err.message || "Lỗi khi gán quyền Ban Biên Tập");
    } finally {
      setSubmitting(false);
    }
  };

  // Thu hồi quyền Ban Biên Tập
  const handleRevokeRole = async (targetUser: UserProfile) => {
    if (!window.confirm(`Hạ vai trò của "${targetUser.displayName}" về Nhân viên thường?`)) return;

    try {
      setSubmitting(true);
      await authService.updateUser(targetUser.uid, {
        role: "user",
      });
      setSuccessMsg(`Đã thu hồi quyền Ban Biên Tập của "${targetUser.displayName}".`);
      setUsersList((prev) =>
        prev.map((u) => (u.uid === targetUser.uid ? { ...u, role: "user" as any } : u)),
      );
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi khi thu hồi quyền");
    } finally {
      setSubmitting(false);
    }
  };

  // Lọc người dùng
  const filteredUsers = usersList.filter((u) => {
    if (!searchUserKeyword.trim()) return true;
    const kw = searchUserKeyword.toLowerCase();
    return u.displayName?.toLowerCase().includes(kw) || u.email?.toLowerCase().includes(kw);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Cấp Quyền Ban Biên Tập Blog</h3>
              <p className="text-xs text-white/80">
                Chỉ Superadmin mới có quyền tạo và phân quyền tài khoản đăng bài này
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab chuyển đổi: Tạo mới vs Gán quyền */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab("create");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeSubTab === "create"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Tạo tài khoản Ban Biên Tập mới</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("assign");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeSubTab === "assign"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Gán quyền cho tài khoản có sẵn</span>
          </button>
        </div>

        {/* Thông báo kết quả */}
        {errorMsg && (
          <div className="m-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="m-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Nội dung Tab */}
        <div className="p-5">
          {activeSubTab === "create" ? (
            /* ================= TAB 1: TẠO MỚI ================= */
            <form onSubmit={handleCreateNewAuthor} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Họ và tên */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên tác giả / Ban biên tập *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Văn An"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Email đăng nhập */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email đăng nhập *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="editor@luxcare.vn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Mật khẩu */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu đăng nhập *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="Tối thiểu 6 ký tự..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Doanh nghiệp */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phạm vi doanh nghiệp
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <option value="SYSTEM">🌐 Toàn hệ thống (Không thuộc công ty nào)</option>
                      {companies.map((c) => (
                        <option key={c.id || c.code} value={c.code}>
                          🏢 {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Số điện thoại */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại (tùy chọn)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="0912345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Chức vụ */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Chức danh hiển thị
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tổng biên tập / Tác giả tin tức"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Thông tin quyền */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Đặc quyền Role Ban Biên Tập (blog_editor):</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Tài khoản này có toàn quyền gửi bài viết/tin nhắn văn bản vào Kênh Blog chung, ghim
                    thông báo quan trọng và quản trị bài viết. Tất cả tài khoản khác chỉ có quyền xem.
                  </p>
                </div>
              </div>

              {/* Nút hành động */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Crown className="w-4 h-4" />
                      <span>Tạo tài khoản Ban Biên Tập</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* ================= TAB 2: GÁN QUYỀN CHO USER CÓ SẴN ================= */
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm nhân viên theo tên, email..."
                    value={searchUserKeyword}
                    onChange={(e) => setSearchUserKeyword(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <select
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  className="p-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                >
                  <option value="all">Tất cả doanh nghiệp</option>
                  {companies.map((c) => (
                    <option key={c.id || c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Danh sách người dùng */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                {loadingUsers ? (
                  <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                    <span>Đang tải danh sách thành viên...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Không tìm thấy thành viên phù hợp
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isEditor = u.role === "blog_editor" || u.role === "blog_author";
                    return (
                      <div
                        key={u.uid}
                        className="pt-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                              {u.displayName}
                            </span>
                            {isEditor && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                Ban Biên Tập
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                        </div>

                        {isEditor ? (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleRevokeRole(u)}
                            className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-lg font-semibold text-[11px] transition-colors whitespace-nowrap"
                          >
                            Thu hồi quyền
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleAssignRole(u)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold text-[11px] transition-colors whitespace-nowrap shadow-xs"
                          >
                            + Cấp quyền Ban Biên Tập
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
