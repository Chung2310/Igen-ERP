import React, { useState } from "react";
import { User, Mail, Save } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "../../pages/Toast";

export default function ProfileTab() {
  const { userProfile, updateProfileInfo } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || "");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Họ và tên không được để trống!");
      return;
    }
    setUpdatingProfile(true);
    try {
      await updateProfileInfo(displayName, userProfile?.photoURL || "");
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingProfile(false);
    }
  };

  return (
    <section className="rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 border-b border-outline-variant pb-3 text-balance text-sm font-semibold text-on-surface">
        <User className="size-4 text-primary" aria-hidden="true" />
        Cập nhật thông tin hồ sơ
      </h2>

      <form onSubmit={handleUpdateProfile} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5 text-left">
            <label htmlFor="settings-display-name" className="block text-xs font-medium text-on-surface-variant">Họ và tên <span aria-hidden="true" className="text-error">*</span></label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
              <input
                id="settings-display-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Họ và tên của bạn"
                className="h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest py-0 pl-11 pr-4 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="settings-email" className="block text-xs font-medium text-on-surface-variant">Địa chỉ email <span className="font-normal">(không thể đổi)</span></label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
              <input
                id="settings-email"
                type="email"
                disabled
                value={userProfile?.email || ""}
                className="h-10 w-full cursor-not-allowed rounded-md border border-outline-variant bg-surface py-0 pl-11 pr-4 text-sm text-on-surface-variant"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={updatingProfile}
            className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="size-4" aria-hidden="true" />
            <span>{updatingProfile ? "Đang lưu..." : "Lưu thay đổi"}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
