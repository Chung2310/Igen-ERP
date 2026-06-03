import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { UserProfile } from "../types";
import { toast } from "./Toast";
import { Users, Shield, RefreshCw } from "lucide-react";

export default function UserAdminTab() {
  const { userProfile } = useAuth();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await authService.getAllUsers();
      setUsersList(data);
    } catch (error) {
      console.error("Lỗi khi tải danh sách user:", error);
      toast.error("Không thể tải danh sách tài khoản người dùng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (targetUid: string, targetName: string, newRole: "user" | "admin" | "superadmin") => {
    if (targetUid === userProfile?.uid) {
      toast.warning("Bạn không thể tự thay đổi vai trò của chính mình!");
      return;
    }

    try {
      await authService.updateUserRole(targetUid, newRole);
      toast.success(`Đã cập nhật quyền hạn cho "${targetName}" thành ${newRole.toUpperCase()}!`);
      // Cập nhật lại list ở client
      setUsersList((prev) =>
        prev.map((u) => (u.uid === targetUid ? { ...u, role: newRole } : u))
      );
    } catch (error) {
      console.error("Lỗi cập nhật quyền:", error);
      toast.error("Lỗi khi cập nhật quyền hạn người dùng.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="user_admin_tab_wrapper">
      
      {/* Header section */}
      <div className="border-b border-gray-200 bg-gray-50/50 p-4 flex justify-between items-center shrink-0" id="user_admin_header">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-150">
            <Users className="h-5 w-5 text-indigo-650" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm font-sans tracking-tight uppercase">
              Quản trị Tài khoản & Phân quyền
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">Quản lý và cấp quyền hạn cho tất cả thành viên trong hệ thống ERP.</p>
          </div>
        </div>

        <button 
          onClick={fetchUsers}
          disabled={loading}
          className="p-2 px-3.5 bg-white hover:bg-slate-100 border border-gray-205 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Tải lại danh sách
        </button>
      </div>

      {/* Main List Area */}
      <div className="flex-1 p-6 overflow-y-auto" id="user_admin_content">
        {loading ? (
          <div className="h-48 flex flex-col items-center justify-center text-center">
            <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin mb-3" />
            <span className="text-xs font-bold font-mono text-indigo-800 uppercase tracking-widest">Đang tải danh sách tài khoản...</span>
          </div>
        ) : usersList.length === 0 ? (
          <div className="p-12 text-center bg-gray-50 text-gray-400 italic rounded-2xl border border-dashed">
            Không tìm thấy tài khoản nào trong hệ thống!
          </div>
        ) : (
          <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-bold text-gray-400 font-mono uppercase tracking-wider">
                  <th className="p-4 pl-6">Thành viên</th>
                  <th className="p-4">Địa chỉ Email</th>
                  <th className="p-4">Ngày đăng ký</th>
                  <th className="p-4">Quyền hạn (Role)</th>
                  <th className="p-4 pr-6 text-center">Hành động cấp quyền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-slate-700">
                {usersList.map((usr) => {
                  const isSelf = usr.uid === userProfile?.uid;
                  return (
                    <tr key={usr.uid} className="hover:bg-slate-50/40 transition-colors">
                      {/* Name / Avatar */}
                      <td className="p-4 pl-6 flex items-center gap-3">
                        {usr.photoURL ? (
                          <img 
                            src={usr.photoURL} 
                            alt={usr.displayName} 
                            className="w-8 h-8 rounded-full object-cover border border-gray-200" 
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-xs">
                            {usr.displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {usr.displayName}
                            {isSelf && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 rounded-sm text-[8px] font-bold font-mono">
                                BẠN
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono block mt-0.5">UID: {usr.uid.slice(0, 8)}...</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="p-4 font-mono">{usr.email}</td>

                      {/* Created At */}
                      <td className="p-4 text-gray-400 font-mono">
                        {usr.createdAt instanceof Date ? usr.createdAt.toLocaleDateString("vi-VN") : "Hôm nay"}
                      </td>

                      {/* Current Role Badge */}
                      <td className="p-4">
                        <span className={`px-2.5 py-0.75 rounded-full font-bold font-mono text-[9px] uppercase tracking-wider flex items-center gap-1.5 w-max ${
                          usr.role === "superadmin"
                            ? "bg-rose-50 border border-rose-200 text-rose-800"
                            : usr.role === "admin"
                              ? "bg-amber-50 border border-amber-200 text-amber-800"
                              : "bg-slate-50 border border-slate-200 text-slate-600"
                        }`}>
                          <Shield className="h-3 w-3" />
                          {usr.role}
                        </span>
                      </td>

                      {/* Role Modify Selector */}
                      <td className="p-4 pr-6">
                        <div className="flex justify-center">
                          <select
                            disabled={isSelf}
                            value={usr.role}
                            onChange={(e) => handleRoleChange(usr.uid, usr.displayName, e.target.value as any)}
                            className={`p-1.5 px-2.5 border border-gray-200 rounded-lg text-xs font-medium outline-none bg-white focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                              isSelf ? "opacity-50 cursor-not-allowed bg-gray-50" : ""
                            }`}
                          >
                            <option value="user">USER (Chỉ xem)</option>
                            <option value="admin">ADMIN (Quản lý)</option>
                            <option value="superadmin">SUPERADMIN (Toàn quyền)</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
