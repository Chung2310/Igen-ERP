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
    <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-medium text-slate-800">
        <User className="h-4 w-4 text-brand-primary" />
        Cập nhật thông tin hồ sơ
      </h3>

      <form onSubmit={handleUpdateProfile} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-slate-600">Họ và tên <span className="text-rose-500">*</span></label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Họ và tên của bạn"
                className="h-10 w-full rounded-xl border border-sky-100 bg-white py-0 pl-11 pr-4 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-slate-600">Địa chỉ email <span className="font-normal text-slate-400">(không thể đổi)</span></label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                disabled
                value={userProfile?.email || ""}
                className="h-10 w-full cursor-not-allowed select-none rounded-xl border border-slate-200 bg-slate-50 py-0 pl-11 pr-4 text-sm font-normal text-slate-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={updatingProfile}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>{updatingProfile ? "Đang lưu..." : "Lưu thay đổi"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
