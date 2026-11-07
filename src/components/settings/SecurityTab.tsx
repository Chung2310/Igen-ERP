import React, { useState } from "react";
import { Lock, Key, Eye, EyeOff } from "lucide-react";
import { authService } from "../../services/authService";
import { toast } from "../../pages/Toast";

export default function SecurityTab() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

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
      await authService.changePassword(newPassword);
      toast.success("Thay đổi mật khẩu thành công!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Thay đổi mật khẩu thất bại. Vui lòng thử lại.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <section className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 border-b border-outline-variant pb-3 text-balance text-sm font-semibold text-on-surface">
        <Lock className="size-4 text-primary" aria-hidden="true" />
        Thay đổi mật khẩu tài khoản
      </h2>

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5 text-left">
            <label htmlFor="settings-new-password" className="block text-xs font-medium text-on-surface-variant">Mật khẩu mới <span aria-hidden="true" className="text-error">*</span></label>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
              <input
                id="settings-new-password"
                type={showPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập tối thiểu 6 ký tự"
                className="h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest py-0 pl-11 pr-10 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="settings-confirm-password" className="block text-xs font-medium text-on-surface-variant">Xác nhận mật khẩu mới <span aria-hidden="true" className="text-error">*</span></label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
              <input
                id="settings-confirm-password"
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest py-0 pl-11 pr-4 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={updatingPassword}
            className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Lock className="h-4 w-4" />
            <span>{updatingPassword ? "Đang cập nhật..." : "Đổi mật khẩu"}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
