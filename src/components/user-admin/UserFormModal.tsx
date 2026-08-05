import React from "react";
import { User, Mail, Lock, X, RefreshCw, Link2, Upload, Eye } from "lucide-react";
import { CompanyProfile, UserProfile } from "../../types";
import { BranchRecord } from "../../services/branchService";
import { authService } from "../../services/authService";
import { toast } from "../../pages/Toast";

export interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  editingUser: UserProfile | null;
  userDisplayName: string;
  setUserDisplayName: (val: string) => void;
  userEmail: string;
  userPhone: string;
  setUserPhone: (val: string) => void;
  userBirthDate: string;
  setUserBirthDate: (val: string) => void;
  setUserEmail: (val: string) => void;
  userPassword: string;
  setUserPassword: (val: string) => void;
  userRole: string;
  setUserRole: (val: string) => void;
  userCompanyCode: string;
  setUserCompanyCode: (val: string) => void;
  userBranchId: string;
  setUserBranchId: (val: string) => void;
  userParentId: string;
  setUserParentId: (val: string) => void;
  userDepartment: string;
  userQualification: string;
  setUserDepartment: (val: string) => void;
  setUserQualification: (val: string) => void;
  userJobDescriptionLink: string;
  userMonthlySalary: string;
  setUserMonthlySalary: (val: string) => void;
  setUserJobDescriptionLink: (val: string) => void;
  getAvailableRoles: () => Array<{ role: string; displayName: string; level: number }>;
  userProfile: UserProfile | null;
  companies: CompanyProfile[];
  branches: BranchRecord[];
  usersList: UserProfile[];
  onSubmit: (e: React.FormEvent) => void;
  submittingUser: boolean;
}

export function UserFormModal({
  open,
  onClose,
  editingUser,
  userDisplayName,
  setUserDisplayName,
  userEmail,
  setUserEmail,
  userPhone,
  setUserPhone,
  userBirthDate,
  setUserBirthDate,
  userPassword,
  setUserPassword,
  userRole,
  setUserRole,
  userCompanyCode,
  setUserCompanyCode,
  userBranchId,
  setUserBranchId,
  userParentId,
  setUserParentId,
  userDepartment,
  setUserDepartment,
  userQualification,
  setUserQualification,
  userJobDescriptionLink,
  userMonthlySalary,
  setUserMonthlySalary,
  setUserJobDescriptionLink,
  getAvailableRoles,
  userProfile,
  companies,
  branches,
  usersList,
  onSubmit,
  submittingUser,
}: UserFormModalProps) {
  const [uploadingJobDescription, setUploadingJobDescription] = React.useState(false);
  const [showJobDescriptionPreview, setShowJobDescriptionPreview] = React.useState(false);
  const jobDescriptionFileInputRef = React.useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleJobDescriptionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingJobDescription(true);
    try {
      const url = await authService.uploadFile(file);
      setUserJobDescriptionLink(url);
      toast.success("Đã tải lên mô tả công việc.");
    } catch (error: any) {
      toast.error(error?.message || "Tải file mô tả công việc lên Cloudinary thất bại.");
    } finally {
      setUploadingJobDescription(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-6 flex justify-between items-center relative shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-650 rounded-xl shadow-lg shadow-indigo-500/20">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider font-sans">
                {editingUser ? "Sửa thông tin người dùng" : "Thêm người dùng mới"}
              </h3>
              <p className="text-[10px] text-slate-350 font-mono mt-0.5">
                {editingUser ? "Cập nhật hồ sơ, quyền hạn và công ty của tài khoản" : "Tạo tài khoản và gán doanh nghiệp"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content / Form */}
        <form autoComplete="off" onSubmit={onSubmit} className="flex flex-col min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* Họ và Tên */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 text-left sm:col-span-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Họ và Tên *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={userDisplayName}
                    onChange={(e) => setUserDisplayName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Địa chỉ Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="email" autoComplete="off"
                    required
                    placeholder="name@company.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono font-medium"
                  />
                </div>
              </div>

'              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Số điện thoại</label>
                <input type="tel" name="phone" autoComplete="off" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} placeholder="0987654321" className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Ngày sinh</label>
                <input type="date" value={userBirthDate} onChange={(e) => setUserBirthDate(e.target.value)} className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
              </div>

              {/* Mật khẩu */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mật khẩu *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="password" autoComplete="off"
                    required={!editingUser}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  {editingUser && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Để trống nếu không cần đổi mật khẩu.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Quyền hạn */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Quyền hạn *</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none"
                >
                  {getAvailableRoles().map((r, index) => (
                    <option key={`${r.role}-${index}`} value={r.role}>
                      {r.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Doanh nghiệp */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Doanh nghiệp *</label>
                {userProfile?.role === "superadmin" ? (
                  <select
                    value={userCompanyCode}
                    onChange={(e) => setUserCompanyCode(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none"
                  >
                    <option value="SYSTEM">Hệ thống (SYSTEM)</option>
                    {companies.map((c) => (
                      <option key={c.id || c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={userProfile?.companyName || userProfile?.companyCode || ""}
                    className="w-full px-3.5 py-2 border border-gray-150 bg-gray-50 text-gray-500 rounded-xl text-xs outline-none"
                  />
                )}
              </div>
            </div>

            {/* Người quản lý trực tiếp */}
'            {userCompanyCode && userCompanyCode !== "SYSTEM" && (
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Chi nhánh</label>
                <select value={userBranchId} onChange={(e) => setUserBranchId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none">
                  <option value="">Không gán chi nhánh</option>
                  {branches.filter((branch) => branch.companyCode === userCompanyCode && branch.isActive).map((branch) => (
                    <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>
                  ))}
                </select>
              </div>
            )}

'            {userCompanyCode && userCompanyCode !== "SYSTEM" && userRole === "user" && (
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Người quản lý trực tiếp
                  <span className="ml-1.5 font-normal normal-case text-gray-400">(tự chọn — xác định cấp bậc trong sơ đồ nhân sự)</span>
                </label>
                {(() => {
                  const eligibleManagers = usersList.filter(
                    (u) => u.companyCode === userCompanyCode && u.role === "manager"
                  );
                  return eligibleManagers.length === 0 ? (
                    <div className="w-full px-3.5 py-2 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 italic bg-gray-50/60">
                      Chưa có quản lý nào trong công ty này
                    </div>
                  ) : (
                    <div>
                      <select
                        value={userParentId}
                        onChange={(e) => setUserParentId(e.target.value)}
                        className="w-full p-2 pl-3.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none"
                      >
                        <option value="">— Không có / Chọn sau —</option>
                        {eligibleManagers.map((mgr) => (
                          <option key={mgr.uid} value={mgr.uid}>
                            {`${mgr.displayName} (Manager${mgr.jobTitle ? " · " + mgr.jobTitle : ""}${mgr.department ? " · " + mgr.department : ""})`}
                          </option>
                        ))}
                      </select>
                      {userParentId && (
                        <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg w-max">
                          <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Cấp bậc nhân viên mới:</span>
                          <span className="text-[10px] font-bold text-indigo-700 font-mono">
                            Level {(() => {
                              const rawL = (usersList.find((u) => u.uid === userParentId)?.level ?? 0) + 1;
                              return userProfile?.role === "superadmin" ? rawL : rawL - 1;
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Phòng ban */}
            {(userRole === "user" || userRole === "manager") && (
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  {userRole === "manager" ? "Phòng ban quản lý *" : "Phòng ban *"}
                </label>
                <input
                  type="text"
                  required
                  disabled={userRole === "user" && !!userParentId}
                  placeholder="Ví dụ: Phòng Kỹ Thuật"
                  value={userDepartment}
                  onChange={(e) => setUserDepartment(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-50 disabled:text-gray-450"
                />
                {userRole === "user" && !!userParentId && (
                  <p className="text-[10px] text-indigo-650 font-mono mt-0.5">
                    Tự động điền theo phòng ban của quản lý trực tiếp.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Trình độ giáo viên</label>
              <input type="text" value={userQualification} onChange={(e) => setUserQualification(e.target.value)} placeholder="Ví dụ: TESOL, Cử nhân Sư phạm" className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 text-left"><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Lương tháng (VNĐ)</label><input type="number" min="0" step="1000" value={userMonthlySalary} onChange={(e) => setUserMonthlySalary(e.target.value)} className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs outline-none" placeholder="26000000" /></div>
            </div>

            {/* Mô tả công việc */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Link mô tả công việc</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="url"
                    placeholder="Dán link mô tả công việc hoặc tải file lên"
                    value={userJobDescriptionLink}
                    onChange={(e) => setUserJobDescriptionLink(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <input
                  ref={jobDescriptionFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleJobDescriptionFileChange}
                />
                <button
                  type="button"
                  onClick={() => jobDescriptionFileInputRef.current?.click()}
                  disabled={uploadingJobDescription}
                  title="Tải file lên Google Drive"
                  className="shrink-0 p-2 px-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50"
                >
                  {uploadingJobDescription ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </button>
                {userJobDescriptionLink && (
                  <button
                    type="button"
                    onClick={() => setShowJobDescriptionPreview(true)}
                    title="Xem trước"
                    className="shrink-0 p-2 px-3 border border-indigo-200 bg-indigo-50 rounded-xl text-indigo-650 hover:bg-indigo-100 transition-all cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Form Actions */}
          <div className="flex gap-3 justify-end p-6 border-t border-gray-100 bg-white shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submittingUser}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {submittingUser ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Đang đăng ký...
                </>
              ) : (
                "Lưu người dùng"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Job Description Link Preview Embed Modal */}
      {showJobDescriptionPreview && userJobDescriptionLink && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 h-[85vh] text-left">
            <div className="flex items-center justify-between p-4 border-b border-slate-150 bg-slate-50/50">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="h-5 w-5 text-blue-600 shrink-0" />
                <span className="text-sm font-bold text-gray-800 truncate max-w-lg">Mô tả công việc</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={userJobDescriptionLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition bg-white"
                >
                  Mở trong tab mới
                </a>
                <button
                  type="button"
                  onClick={() => setShowJobDescriptionPreview(false)}
                  className="p-2 hover:bg-gray-200 rounded-xl text-gray-500 hover:text-gray-800 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 relative">
              <iframe
                src={
                  userJobDescriptionLink.includes("drive.google.com")
                    ? userJobDescriptionLink.replace("/edit", "/preview").replace("/view", "/preview")
                    : userJobDescriptionLink
                }
                className="w-full h-full border-0 rounded-2xl bg-white shadow-sm"
                allow="autoplay"
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
