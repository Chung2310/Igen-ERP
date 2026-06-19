import { MoreVertical, Pencil, Shield, SlidersHorizontal, Trash2, Wallet } from "lucide-react";
import { UserTableProps } from "./types";

export function UserListTable({
  users,
  currentUser,
  rolePermissionsList,
  balanceByUserId,
  userPage,
  totalUserPages,
  onPageChange,
  getAvailableRoles,
  onRoleChange,
  openActionMenuId,
  onToggleActionMenu,
  onEditUser,
  onDeleteUser,
  onOpenHeyGenEditor,
  onOpenBalance,
  setActiveTab,
  formatAvatarIds,
}: UserTableProps) {
  return (
    <div className="bg-white border border-gray-150 rounded-2xl shadow-xs max-w-full" style={{ overflow: "clip" }}>
      <div className="max-w-full overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[1180px] text-left border-collapse text-xs font-sans">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-bold text-gray-400 font-mono uppercase tracking-wider">
              <th className="p-4 pl-6">Thành viên</th>
              <th className="p-4">Địa chỉ email</th>
              {currentUser?.role === "superadmin" && <th className="p-4">Doanh nghiệp</th>}
              <th className="p-4">Ngày đăng ký</th>
              <th className="p-4">Quyền hạn (role)</th>
              {currentUser?.role === "superadmin" && <th className="p-4">Số dư</th>}
              <th className="p-4">HeyGen</th>
              <th className="p-4 pr-6 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-slate-700">
            {users.map((usr) => {
              const isSelf = usr.uid === currentUser?.uid;
              const userBalance = balanceByUserId[usr.uid];
              return (
                <tr key={usr.uid} className="hover:bg-slate-50/40 transition-colors">
                  <td className="p-4 pl-6 flex items-center gap-3">
                    {usr.photoURL && (usr.photoURL.startsWith("http") || usr.photoURL.startsWith("/")) ? (
                      <img src={usr.photoURL} alt={usr.displayName} className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-xs">
                        {(usr.displayName || usr.email || "US").slice(0, 2).toUpperCase()}
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
                  <td className="p-4 font-mono">{usr.email}</td>
                  {currentUser?.role === "superadmin" && (
                    <td className="p-4 font-semibold text-slate-700">
                      {usr.companyName ? (
                        <span title={usr.companyCode}>{usr.companyName}</span>
                      ) : (
                        <span className="text-gray-400 italic">Hệ thống ({usr.companyCode || "SYSTEM"})</span>
                      )}
                    </td>
                  )}
                  <td className="p-4 text-gray-400 font-mono">
                    {usr.createdAt ? new Date(usr.createdAt).toLocaleDateString("vi-VN") : "Hôm nay"}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.75 rounded-full font-bold font-mono text-[9px] uppercase tracking-wider flex items-center gap-1.5 w-max ${
                      usr.role === "superadmin"
                        ? "bg-rose-50 border border-rose-200 text-rose-800"
                        : usr.role === "admin"
                          ? "bg-amber-50 border border-amber-200 text-amber-800"
                          : usr.role === "manager"
                            ? "bg-blue-50 border border-blue-200 text-blue-800"
                            : usr.role === "user"
                              ? "bg-slate-50 border border-slate-200 text-slate-600"
                              : "bg-indigo-50 border border-indigo-200 text-indigo-700"
                    }`}>
                      <Shield className="h-3 w-3" />
                      {usr.role === "user" ? "user" : rolePermissionsList.find((rp) => rp.role === usr.role)?.displayName || usr.role}
                    </span>
                  </td>
                  {currentUser?.role === "superadmin" && (
                    <td className="p-4 min-w-[170px]">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenBalance(usr, userBalance);
                            setActiveTab("balance");
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-sky-900 transition hover:bg-sky-100"
                        >
                          <Wallet className="h-3.5 w-3.5 text-sky-600" />
                          <span className="text-xs font-bold">
                            {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(userBalance?.balance || 0)} Credit
                          </span>
                        </button>
                      </div>
                    </td>
                  )}
                  <td className="p-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-600">Avatar(s): <span className="font-mono">{formatAvatarIds(usr)}</span></p>
                      <p className="text-[10px] text-slate-600">Giọng đọc: <span className="font-mono">{usr.heygenAccess?.voiceId || "-"}</span></p>
                      <p className="text-[10px] text-slate-400">{usr.heygenAccess?.apiKey ? "Có khóa API riêng" : "Dùng khóa API hệ thống"}</p>
                    </div>
                  </td>
                  <td className="p-4 pr-6">
                    <div className="flex items-center justify-end gap-3">
                      <select
                        disabled={isSelf || usr.role === "superadmin" || (usr.role === "admin" && currentUser?.role === "admin")}
                        value={usr.role}
                        onChange={(e) => onRoleChange(usr.uid, usr.displayName, e.target.value as any)}
                        className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer ${
                          isSelf || usr.role === "superadmin" || (usr.role === "admin" && currentUser?.role === "admin")
                            ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400"
                            : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300"
                        }`}
                      >
                        {[
                          ...getAvailableRoles(),
                          ...(!getAvailableRoles().some((r) => r.role === usr.role)
                            ? [{ role: usr.role, displayName: usr.role.toUpperCase(), level: 99 }]
                            : []),
                        ].map((r, index) => (
                          <option key={`${usr.uid}-${r.role}-${index}`} value={r.role}>{r.displayName}</option>
                        ))}
                      </select>

                      <div className="relative" data-action-menu>
                        <button
                          type="button"
                          onClick={() => onToggleActionMenu(usr.uid)}
                          className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition"
                          title="Thao tác"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {openActionMenuId === usr.uid && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                            <button
                              type="button"
                              onClick={() => onEditUser(usr)}
                              disabled={isSelf || usr.role === "superadmin"}
                              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 transition flex items-center gap-2.5 border-b border-gray-100 disabled:opacity-50"
                            >
                              <Pencil className="h-3.5 w-3.5 text-indigo-600" />
                              Sửa thông tin
                            </button>
                            {currentUser?.role === "superadmin" && (
                              <button
                                type="button"
                                onClick={() => onOpenHeyGenEditor(usr)}
                                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-cyan-50 transition flex items-center gap-2.5 border-b border-gray-100"
                              >
                                <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-600" />
                                Cấu hình HeyGen
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onDeleteUser(usr)}
                              disabled={isSelf || usr.role === "superadmin"}
                              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition flex items-center gap-2.5 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              Xóa tài khoản
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[11px] font-mono text-slate-500">
          Trang {userPage} / {totalUserPages} · Hiển thị {users.length} tài khoản
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange((prev) => Math.max(1, Number(prev) - 1))}
            disabled={userPage === 1}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Trang trước
          </button>
          {Array.from({ length: totalUserPages }, (_, index) => index + 1)
            .slice(Math.max(0, userPage - 3), Math.min(totalUserPages, userPage + 2))
            .map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={`h-9 min-w-9 rounded-xl px-3 text-[11px] font-bold transition ${
                  page === userPage ? "bg-slate-900 text-white" : "border border-gray-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}
          <button
            type="button"
            onClick={() => onPageChange((prev) => Math.min(totalUserPages, Number(prev) + 1))}
            disabled={userPage === totalUserPages}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      </div>
    </div>
  );
}
