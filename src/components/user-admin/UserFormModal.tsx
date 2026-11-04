import React from "react";
import { User, Mail, Lock, X, RefreshCw, Link2, Upload, Eye } from "lucide-react";
import { CompanyProfile, UserProfile } from "../../types";
import { BranchRecord } from "../../services/branchService";
import { authService } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { AdminDatePicker } from "./AdminDatePicker";

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
  setUserJobDescriptionUploadToken: (val: string) => void;
  getAvailableRoles: () => Array<{ role: string; displayName: string; level: number }>;
  userProfile: UserProfile | null;
  companies: CompanyProfile[];
  branches: BranchRecord[];
  usersList: UserProfile[];
  onSubmit: (e: React.FormEvent) => void;
  submittingUser: boolean;
  lockRole?: boolean;
  lockCompany?: boolean;
  lockBranch?: boolean;
  lockParent?: boolean;
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
  setUserJobDescriptionUploadToken,
  getAvailableRoles,
  userProfile,
  companies,
  branches,
  usersList,
  onSubmit,
  submittingUser,
  lockRole = false,
  lockCompany = false,
  lockBranch = false,
  lockParent = false,
}: UserFormModalProps) {
  const [uploadingJobDescription, setUploadingJobDescription] = React.useState(false);
  const [showJobDescriptionPreview, setShowJobDescriptionPreview] = React.useState(false);
  const jobDescriptionFileInputRef = React.useRef<HTMLInputElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
    return () => { previousFocus?.focus(); };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showJobDescriptionPreview) { setShowJobDescriptionPreview(false); return; }
        if (document.querySelector('[role="dialog"][aria-label^="Chọn"]')) return;
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || !dialogRef.current || !dialogRef.current.contains(event.target as Node)) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), a[href]')).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); };
  }, [open, onClose, showJobDescriptionPreview]);

  if (!open) return null;

  const handleJobDescriptionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingJobDescription(true);
    try {
      const uploaded = await authService.uploadManagedFile(file, "hr.employee", userCompanyCode === "SYSTEM" ? undefined : userCompanyCode);
      setUserJobDescriptionLink(uploaded.url);
      setUserJobDescriptionUploadToken(uploaded.uploadToken);
      toast.success("Đã tải lên mô tả công việc.");
    } catch (error: any) {
      toast.error(error?.message || "Tải file mô tả công việc lên Cloudinary thất bại.");
    } finally {
      setUploadingJobDescription(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/45 p-3 sm:p-5">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="user-form-title" aria-describedby="user-form-description" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest text-on-surface shadow-xl sm:max-h-[calc(100dvh-2.5rem)]">
        {/* Modal Header */}
        <div className="relative flex shrink-0 items-center justify-between border-b border-outline-variant px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary-container text-primary">
              <User className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="user-form-title" className="text-balance text-base font-semibold">
                {editingUser ? "Sửa thông tin người dùng" : "Thêm người dùng mới"}
              </h3>
              <p id="user-form-description" className="mt-0.5 text-pretty text-xs text-on-surface-variant">
                {editingUser ? "Cập nhật hồ sơ, quyền hạn và công ty của tài khoản" : "Tạo tài khoản và gán doanh nghiệp"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            data-erp-modal-close aria-label="Đóng">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Content / Form */}
        <form autoComplete="off" onSubmit={onSubmit} className="flex min-h-0 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-4 gap-y-3 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
            {/* Họ và Tên */}
            <div className="contents">
              <div className="min-w-0 space-y-1 text-left">
                <label className="block text-xs font-medium text-on-surface-variant">Họ và Tên *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 size-4 text-on-surface-variant" aria-hidden="true" />
                  <input
                    aria-label="Họ và Tên"
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={userDisplayName}
                    onChange={(e) => setUserDisplayName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="min-w-0 space-y-1 text-left">
                <label className="block text-xs font-medium text-on-surface-variant">Địa chỉ Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 size-4 text-on-surface-variant" aria-hidden="true" />
                  <input
                    aria-label="Địa chỉ Email"
                    type="email" autoComplete="off"
                    required
                    placeholder="name@company.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              <div className="min-w-0 space-y-1 text-left">
                <label className="block text-xs font-medium text-on-surface-variant">Số điện thoại</label>
                <input aria-label="Số điện thoại" type="tel" name="phone" autoComplete="off" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} placeholder="0987654321" className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
              </div>

              <div className="min-w-0 space-y-1 text-left">
                <AdminDatePicker label="Ngày sinh" value={userBirthDate} onChange={setUserBirthDate} max={new Date().toLocaleDateString("sv-SE")} />
              </div>

              {/* Mật khẩu */}
              <div className="min-w-0 space-y-1 text-left">
                <label className="block text-xs font-medium text-on-surface-variant">Mật khẩu *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 size-4 text-on-surface-variant" aria-hidden="true" />
                  <input
                    aria-label="Mật khẩu"
                    type="password" autoComplete="off"
                    required={!editingUser}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  {editingUser && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Để trống nếu không cần đổi mật khẩu.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="contents">
              {/* Quyền hạn */}
              <div className="min-w-0 space-y-1 text-left">
                <label className="block text-xs font-medium text-on-surface-variant">Quyền hạn *</label>
                <select
                  aria-label="Quyền hạn"
                  disabled={lockRole}
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  {getAvailableRoles().map((r, index) => (
                    <option key={`${r.role}-${index}`} value={r.role}>
                      {r.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Doanh nghiệp */}
              <div className="min-w-0 space-y-1 text-left">
                <label className="block text-xs font-medium text-on-surface-variant">Doanh nghiệp *</label>
                {userProfile?.role === "superadmin" ? (
                  <select
                    aria-label="Doanh nghiệp"
                    value={userCompanyCode}
                    onChange={(e) => setUserCompanyCode(e.target.value)}
                    className="h-10 w-full cursor-pointer rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
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
                    aria-label="Doanh nghiệp"
                    type="text"
                    disabled
                    value={userProfile?.companyName || userProfile?.companyCode || ""}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface px-3 text-sm text-on-surface-variant"
                  />
                )}
              </div>
            </div>

            {/* Người quản lý trực tiếp */}
            {userRole === "pos_cashier" && userCompanyCode === "SYSTEM" && (
              <p className="text-xs text-amber-700">Vai trò thu ngân POS chỉ dùng trong một doanh nghiệp có chi nhánh.</p>
            )}

            {userCompanyCode && userCompanyCode !== "SYSTEM" && (
              <div className="min-w-0 space-y-1 text-left">
                <label className="block text-xs font-medium text-on-surface-variant">Chi nhánh{userRole === "pos_cashier" ? " *" : ""}</label>
                <select aria-label="Chi nhánh" required={userRole === "pos_cashier"} disabled={lockBranch} value={userBranchId} onChange={(e) => setUserBranchId(e.target.value)} className="h-10 w-full cursor-pointer rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-surface">
                  <option value="">{userRole === "pos_cashier" ? "Chọn chi nhánh (bắt buộc)" : "Không gán chi nhánh"}</option>
                  {branches.filter((branch) => branch.companyCode === userCompanyCode && branch.isActive).map((branch) => (
                    <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>
                  ))}
                </select>
                {userRole === "pos_cashier" && <p className="text-xs text-on-surface-variant">Thu ngân chỉ mở ca và bán hàng trong chi nhánh được gán.</p>}
              </div>
            )}

            {userCompanyCode && userCompanyCode !== "SYSTEM" && (userRole === "user" || lockParent) && (
              <div className="min-w-0 space-y-1 text-left">
                <label className="block text-xs font-medium text-on-surface-variant">
                  Người quản lý trực tiếp
                  <span className="ml-1 font-normal text-on-surface-variant">(tự chọn)</span>
                </label>
                {(() => {
                  const eligibleManagers = usersList.filter((u) => u.companyCode === userCompanyCode && (lockParent ? u.uid === userParentId : u.role === "manager"));
                  return eligibleManagers.length === 0 ? (
                    <div className="flex h-10 w-full items-center rounded-xl border border-dashed border-outline-variant bg-surface px-3 text-sm text-on-surface-variant">
                      Chưa có quản lý nào trong công ty này
                    </div>
                  ) : (
                    <div>
                      <select
                        aria-label="Người quản lý trực tiếp"
                        disabled={lockParent}
                        value={userParentId}
                        onChange={(e) => setUserParentId(e.target.value)}
                        className="h-10 w-full cursor-pointer rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                      >
                        <option value="">— Không có / Chọn sau —</option>
                        {eligibleManagers.map((mgr) => (
                          <option key={mgr.uid} value={mgr.uid}>
                            {`${mgr.displayName} (Manager${mgr.jobTitle ? " · " + mgr.jobTitle : ""}${mgr.department ? " · " + mgr.department : ""})`}
                          </option>
                        ))}
                      </select>
                      {userParentId && (
                        <div className="mt-1 flex w-max items-center gap-1 rounded-lg bg-primary-container px-2 py-0.5 text-xs text-primary">
                          <span>Cấp bậc mới:</span>
                          <span className="font-semibold tabular-nums">
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
              <div className="min-w-0 space-y-1 text-left">
                <label className="block text-xs font-medium text-on-surface-variant">
                  {userRole === "manager" ? "Phòng ban quản lý *" : "Phòng ban *"}
                </label>
                <input
                  aria-label={userRole === "manager" ? "Phòng ban quản lý" : "Phòng ban"}
                  type="text"
                  required
                  disabled={userRole === "user" && !!userParentId}
                  placeholder="Ví dụ: Phòng Kỹ Thuật"
                  value={userDepartment}
                  onChange={(e) => setUserDepartment(e.target.value)}
                  className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-surface disabled:text-on-surface-variant"
                />
                {userRole === "user" && !!userParentId && (
                  <p className="mt-0.5 text-xs text-primary">
                    Tự động điền theo phòng ban của quản lý trực tiếp.
                  </p>
                )}
              </div>
            )}

            <div className="min-w-0 space-y-1 text-left">
              <label className="block text-xs font-medium text-on-surface-variant">Trình độ</label>
              <input aria-label="Trình độ" type="text" value={userQualification} onChange={(e) => setUserQualification(e.target.value)} placeholder="Ví dụ: TESOL, Cử nhân Sư phạm" className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </div>
            <div className="min-w-0 space-y-1 text-left">
              <label className="block text-xs font-medium text-on-surface-variant">Lương tháng (VNĐ)</label>
              <input aria-label="Lương tháng (VNĐ)" type="number" min="0" step="1000" value={userMonthlySalary} onChange={(e) => setUserMonthlySalary(e.target.value)} className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="26000000" />
            </div>

            {/* Mô tả công việc */}
            <div className="min-w-0 space-y-1 text-left sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-on-surface-variant">Link mô tả công việc</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3.5 top-3 size-4 text-on-surface-variant" aria-hidden="true" />
                  <input
                    aria-label="Link mô tả công việc"
                    type="url"
                    placeholder="Dán link mô tả công việc hoặc tải file lên"
                    value={userJobDescriptionLink}
                    onChange={(e) => setUserJobDescriptionLink(e.target.value)}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
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
                  aria-label="Tải file mô tả công việc lên"
                  title="Tải file lên Google Drive"
                  className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
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
                    aria-label="Xem trước mô tả công việc"
                    title="Xem trước"
                    className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-outline-variant bg-primary-container text-primary hover:bg-primary-container/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Form Actions */}
          <div className="flex shrink-0 justify-end gap-2 border-t border-outline-variant bg-surface-container-lowest px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submittingUser}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
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
                 data-erp-modal-close aria-label="Đóng">
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
