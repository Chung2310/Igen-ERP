import { Activity, MoreVertical, Pencil, Shield, Trash2 } from "lucide-react";
import { UserTableProps } from "./types";
import { getRoleDisplayName } from "../../utils/permissionUtils";
import { StyledSelect } from "../common/StyledSelect";

export function UserListTable({
  users,
  currentUser,
  rolePermissionsList,
  userPage,
  totalUserPages,
  onPageChange,
  getAvailableRoles,
  onRoleChange,
  openActionMenuId,
  onToggleActionMenu,
  onEditUser,
  onDeleteUser,
  onViewActivity,
}: UserTableProps) {
  return (
    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest shadow-xs">
      <div className="min-h-0 max-w-full flex-1 overflow-auto overscroll-contain">
        <table className="w-full min-w-[900px] border-collapse text-left font-sans text-sm">
          <thead>
            <tr className="bg-surface text-xs font-medium text-on-surface-variant">
              <th className="px-3 py-2.5">Thành viên</th>
              <th className="px-3 py-2.5">Địa chỉ email</th>
              {currentUser?.role === "superadmin" && <th className="px-3 py-2.5">Doanh nghiệp</th>}
              <th className="px-3 py-2.5">Ngày đăng ký</th>
              <th className="px-3 py-2.5">Vai trò</th>
              <th className="px-3 py-2.5 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-on-surface">
            {users.map((usr) => {
              const isSelf = usr.uid === currentUser?.uid;
              return (
                <tr key={usr.uid} className="transition-colors hover:bg-surface">
                  <td className="flex items-center gap-2.5 px-3 py-2.5">
                    {usr.photoURL && (usr.photoURL.startsWith("http") || usr.photoURL.startsWith("/")) ? (
                      <img src={usr.photoURL} alt={usr.displayName} className="h-8 w-8 rounded-full border border-gray-200 object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-xs font-bold text-indigo-700">
                        {(usr.displayName || usr.email || "US").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate font-medium text-on-surface" title={usr.displayName}>
                        {usr.displayName}
                        {isSelf && (
                          <span className="rounded-md bg-cyan-50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">
                            Bạn
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-on-surface-variant">UID: {usr.uid.slice(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-normal" title={usr.email}>{usr.email}</td>
                  {currentUser?.role === "superadmin" && (
                    <td className="px-3 py-2.5 font-normal text-on-surface">
                      {usr.companyName ? (
                        <span title={usr.companyCode}>{usr.companyName}</span>
                      ) : (
                        <span className="italic text-gray-400">Hệ thống ({usr.companyCode || "SYSTEM"})</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5 font-normal tabular-nums text-on-surface-variant">
                    {usr.createdAt ? new Date(usr.createdAt).toLocaleDateString("vi-VN") : "Hôm nay"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`flex w-max items-center gap-1.5 rounded-full px-2.5 py-0.75 text-xs font-medium ${
                        usr.role === "superadmin"
                          ? "border border-rose-200 bg-rose-50 text-rose-800"
                          : usr.role === "admin"
                            ? "border border-amber-200 bg-amber-50 text-amber-800"
                            : usr.role === "manager"
                              ? "border border-blue-200 bg-blue-50 text-blue-800"
                              : usr.role === "user"
                                ? "border border-slate-200 bg-slate-50 text-slate-600"
                                : "border border-indigo-200 bg-indigo-50 text-indigo-700"
                      }`}
                    >
                      <Shield className="h-3 w-3" />
                      {getRoleDisplayName(usr.role, rolePermissionsList.find((rp) => rp.role === usr.role)?.displayName)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <StyledSelect
                        ariaLabel={`Vai trò của ${usr.displayName || usr.email}`}
                        disabled={isSelf || usr.role === "superadmin" || (usr.role === "admin" && currentUser?.role === "admin")}
                        value={usr.role}
                        onChange={(value) => onRoleChange(usr.uid, usr.displayName, value as any)}
                        appearance="erp"
                        className="min-w-52 max-w-72 rounded-md text-xs"
                        options={[
                          ...getAvailableRoles(),
                          ...(!getAvailableRoles().some((r) => r.role === usr.role) ? [{ role: usr.role, displayName: getRoleDisplayName(usr.role), level: 99 }] : []),
                        ].map((r) => ({ value: r.role, label: r.displayName }))}
                      />

                      <div className="relative" data-action-menu>
                        <button
                          type="button"
                          onClick={() => onToggleActionMenu(usr.uid)}
                          className="rounded-md border border-outline-variant bg-surface-container-lowest p-2 text-on-surface-variant transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                          title="Thao tác"
                          aria-label={`Thao tác với ${usr.displayName || usr.email}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {openActionMenuId === usr.uid && (
                          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                            <button type="button" onClick={() => onViewActivity(usr)} className="flex w-full items-center gap-2.5 border-b border-gray-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-cyan-50"><Activity className="h-3.5 w-3.5 text-cyan-600" />Xem hoạt động</button>
                            <button
                              type="button"
                              onClick={() => onEditUser(usr)}
                              disabled={usr.role === "superadmin" && !isSelf && currentUser?.role !== "superadmin"}
                              className="flex w-full items-center gap-2.5 border-b border-gray-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-indigo-50 disabled:opacity-50"
                            >
                              <Pencil className="h-3.5 w-3.5 text-indigo-600" />
                              Sửa thông tin
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteUser(usr)}
                              disabled={isSelf || usr.role === "superadmin"}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
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
      <div className="flex shrink-0 flex-col gap-2 border-t border-outline-variant bg-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-normal tabular-nums text-on-surface-variant">
          Trang {userPage} / {totalUserPages} · Hiển thị {users.length} tài khoản
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange((prev) => Math.max(1, Number(prev) - 1))}
            disabled={userPage === 1}
            className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
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
                className={`h-9 min-w-9 rounded-md px-3 text-xs font-medium transition-colors ${
                  page === userPage ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface hover:bg-surface"
                }`}
              >
                {page}
              </button>
            ))}
          <button
            type="button"
            onClick={() => onPageChange((prev) => Math.min(totalUserPages, Number(prev) + 1))}
            disabled={userPage === totalUserPages}
            className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      </div>
    </div>
  );
}
