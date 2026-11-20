import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Building2,
  DoorClosed,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
  Wrench,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Layers,
  MapPin,
} from "lucide-react";
import { departmentService, DepartmentRecord, DepartmentInput } from "../../services/departmentService";
import { roomService, RoomRecord, RoomInput, RoomType, ROOM_TYPE_LABELS } from "../../services/roomService";
import { branchService, BranchRecord } from "../../services/branchService";
import { toast } from "../../pages/Toast";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { authService } from "../../services/authService";
import type { UserProfile } from "../../types";
import { SearchableSelect } from "./SearchableSelect";

export const DepartmentRoomManagementTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<"departments" | "rooms">("departments");

  // State cho Phòng ban
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptSearch, setDeptSearch] = useState("");
  const [editingDept, setEditingDept] = useState<DepartmentRecord | null>(null);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [managerAccounts, setManagerAccounts] = useState<UserProfile[]>([]);
  const [managerAccountsLoading, setManagerAccountsLoading] = useState(false);
  const [deptForm, setDeptForm] = useState<DepartmentInput>({
    code: "",
    name: "",
    description: "",
    managerName: "",
    isActive: true,
  });

  useEffect(() => {
    if (!isDeptModalOpen) return;
    let cancelled = false;
    setManagerAccounts([]);
    setManagerAccountsLoading(true);
    authService.getColleagues()
      .then((accounts) => {
        if (!cancelled) setManagerAccounts(accounts);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.message || "Không thể tải tài khoản trưởng bộ phận");
      })
      .finally(() => {
        if (!cancelled) setManagerAccountsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isDeptModalOpen]);

  const managerOptions = [
    { value: "", label: "Không chọn trưởng bộ phận" },
    ...((deptForm.managerUid || deptForm.managerName) && !managerAccounts.some((account) => account.uid === deptForm.managerUid)
      ? [{ value: deptForm.managerUid || "__legacy_manager__", label: `${deptForm.managerName || "Tài khoản đã lưu"} (đã lưu)` }]
      : []),
    ...managerAccounts.map((account) => ({
      value: account.uid,
      label: [account.displayName, account.email, account.branchName].filter(Boolean).join(" — "),
    })),
  ];

  // State cho Merge Phòng ban cũ
  const [isDeptMergeOpen, setIsDeptMergeOpen] = useState(false);
  const [unmappedDepts, setUnmappedDepts] = useState<Array<{ name: string; count: number }>>([]);
  const [selectedLegacyDepts, setSelectedLegacyDepts] = useState<string[]>([]);
  const [targetDeptId, setTargetDeptId] = useState<string>("");
  const [mergingDept, setMergingDept] = useState(false);

  // State cho Chi nhánh & Phòng
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");
  const [editingRoom, setEditingRoom] = useState<RoomRecord | null>(null);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomForm, setRoomForm] = useState<RoomInput>({
    branchId: "",
    code: "",
    name: "",
    type: "other",
    floor: "",
    description: "",
    isActive: true,
  });

  // State cho Merge Phòng thiết bị cũ
  const [isRoomMergeOpen, setIsRoomMergeOpen] = useState(false);
  const [unmappedRooms, setUnmappedRooms] = useState<Array<{ name: string; count: number }>>([]);
  const [selectedLegacyRooms, setSelectedLegacyRooms] = useState<string[]>([]);
  const [targetRoomId, setTargetRoomId] = useState<string>("");
  const [mergingRoom, setMergingRoom] = useState(false);

  // Confirm Delete
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "department" | "room";
    id: string;
    name: string;
  } | null>(null);

  // Fetch Departments
  const fetchDepartments = useCallback(async () => {
    try {
      setDeptLoading(true);
      const list = await departmentService.list();
      setDepartments(list);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải danh sách phòng ban");
    } finally {
      setDeptLoading(false);
    }
  }, []);

  // Fetch Branches
  const fetchBranches = useCallback(async () => {
    try {
      const list = await branchService.list();
      setBranches(list);
      if (list.length > 0 && !selectedBranchId) {
        setSelectedBranchId(list[0]._id);
      }
    } catch (err: any) {
      toast.error(err.message || "Không thể tải danh sách chi nhánh");
    }
  }, [selectedBranchId]);

  // Fetch Rooms
  const fetchRooms = useCallback(async () => {
    if (!selectedBranchId) {
      setRooms([]);
      return;
    }
    try {
      setRoomLoading(true);
      const list = await roomService.list({ branchId: selectedBranchId });
      setRooms(list);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải danh sách phòng");
    } finally {
      setRoomLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchDepartments();
    fetchBranches();
  }, [fetchDepartments, fetchBranches]);

  useEffect(() => {
    if (activeSubTab === "rooms") {
      fetchRooms();
    }
  }, [activeSubTab, selectedBranchId, fetchRooms]);

  // Handle Save Department
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await departmentService.update(editingDept._id, deptForm);
        toast.success("Cập nhật phòng ban thành công!");
      } else {
        await departmentService.create(deptForm);
        toast.success("Thêm phòng ban mới thành công!");
      }
      setIsDeptModalOpen(false);
      fetchDepartments();
    } catch (err: any) {
      toast.error(err.message || "Lỗi lưu phòng ban");
    }
  };

  // Toggle Department Active
  const handleToggleDeptActive = async (dept: DepartmentRecord) => {
    try {
      await departmentService.update(dept._id, { isActive: !dept.isActive });
      toast.success(
        dept.isActive ? `Đã ngừng sử dụng "${dept.name}"` : `Đã kích hoạt lại "${dept.name}"`
      );
      fetchDepartments();
    } catch (err: any) {
      toast.error(err.message || "Lỗi cập nhật trạng thái");
    }
  };

  // Open Merge Department Modal
  const handleOpenDeptMerge = async () => {
    try {
      const data = await departmentService.getUnmapped();
      setUnmappedDepts(data);
      setSelectedLegacyDepts([]);
      setTargetDeptId(departments[0]?._id || "");
      setIsDeptMergeOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Lỗi tải dữ liệu cũ");
    }
  };

  // Submit Merge Department
  const handleRunDeptMerge = async () => {
    if (selectedLegacyDepts.length === 0 || !targetDeptId) {
      toast.error("Vui lòng chọn ít nhất một tên phòng cũ và phòng ban chuẩn đích.");
      return;
    }
    try {
      setMergingDept(true);
      const res = await departmentService.merge(selectedLegacyDepts, targetDeptId);
      toast.success(
        `Đã chuẩn hóa thành công ${res.modifiedCount} hồ sơ nhân sự sang "${res.targetDepartment.name}"!`
      );
      setIsDeptMergeOpen(false);
      fetchDepartments();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi chuẩn hóa");
    } finally {
      setMergingDept(false);
    }
  };

  // Handle Save Room
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await roomService.update(editingRoom._id, roomForm);
        toast.success("Cập nhật phòng thành công!");
      } else {
        await roomService.create({ ...roomForm, branchId: selectedBranchId });
        toast.success("Thêm phòng mới thành công!");
      }
      setIsRoomModalOpen(false);
      fetchRooms();
    } catch (err: any) {
      toast.error(err.message || "Lỗi lưu phòng");
    }
  };

  // Toggle Room Active
  const handleToggleRoomActive = async (room: RoomRecord) => {
    try {
      await roomService.update(room._id, { isActive: !room.isActive });
      toast.success(
        room.isActive ? `Đã ngừng sử dụng phòng "${room.name}"` : `Đã kích hoạt lại "${room.name}"`
      );
      fetchRooms();
    } catch (err: any) {
      toast.error(err.message || "Lỗi cập nhật trạng thái");
    }
  };

  // Open Merge Room Modal
  const handleOpenRoomMerge = async () => {
    if (!selectedBranchId) return;
    try {
      const data = await roomService.getUnmapped(selectedBranchId);
      setUnmappedRooms(data);
      setSelectedLegacyRooms([]);
      setTargetRoomId(rooms[0]?._id || "");
      setIsRoomMergeOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Lỗi tải vị trí cũ");
    }
  };

  // Submit Merge Room
  const handleRunRoomMerge = async () => {
    if (selectedLegacyRooms.length === 0 || !targetRoomId) {
      toast.error("Vui lòng chọn vị trí cũ và phòng chuẩn đích.");
      return;
    }
    try {
      setMergingRoom(true);
      const res = await roomService.merge(selectedBranchId, selectedLegacyRooms, targetRoomId);
      toast.success(
        `Đã chuẩn hóa thành công ${res.modifiedCount} thiết bị sang phòng "${res.targetRoom.name}"!`
      );
      setIsRoomMergeOpen(false);
      fetchRooms();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi chuẩn hóa");
    } finally {
      setMergingRoom(false);
    }
  };

  // Delete Action
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "department") {
        await departmentService.delete(deleteConfirm.id);
        toast.success("Đã xóa phòng ban!");
        fetchDepartments();
      } else {
        await roomService.delete(deleteConfirm.id);
        toast.success("Đã xóa phòng!");
        fetchRooms();
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi xóa danh mục");
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Filtered Departments
  const filteredDepartments = useMemo(() => {
    const q = deptSearch.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.managerName && d.managerName.toLowerCase().includes(q))
    );
  }, [departments, deptSearch]);

  // Filtered Rooms
  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.floor && r.floor.toLowerCase().includes(q)) ||
        (r.type && r.type.toLowerCase().includes(q))
    );
  }, [rooms, roomSearch]);

  return (
    <div className="space-y-6">
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Danh mục Phòng & Phòng ban Dùng chung
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Chuẩn hóa danh sách phòng ban công ty và phòng cơ sở theo chi nhánh, tránh gõ tự do phân mảnh dữ liệu.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveSubTab("departments")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === "departments"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Phòng ban Doanh nghiệp ({departments.length})
          </button>
          <button
            onClick={() => setActiveSubTab("rooms")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === "rooms"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <DoorClosed className="w-4 h-4" />
            Phòng theo Chi nhánh
          </button>
        </div>
      </div>

      {/* SUBTAB 1: PHÒNG BAN */}
      {activeSubTab === "departments" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã, tên phòng ban, trưởng phòng..."
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenDeptMerge}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                title="Chuẩn hóa các tên gõ tự do cũ (như PKT, Kế Toán) vào phòng ban chuẩn"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                Chuẩn hóa tên cũ
              </button>

              <button
                onClick={() => {
                  setEditingDept(null);
                  setDeptForm({
                    code: "",
                    name: "",
                    description: "",
                    managerName: "",
                    isActive: true,
                  });
                  setIsDeptModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Thêm phòng ban
              </button>
            </div>
          </div>

          {/* Departments Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Mã</th>
                    <th className="px-4 py-3">Tên phòng ban</th>
                    <th className="px-4 py-3">Trưởng bộ phận</th>
                    <th className="px-4 py-3 text-center">Số nhân sự</th>
                    <th className="px-4 py-3">Mô tả</th>
                    <th className="px-4 py-3 text-center">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deptLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Đang tải danh mục phòng ban...
                      </td>
                    </tr>
                  ) : filteredDepartments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Chưa có phòng ban nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredDepartments.map((dept) => (
                      <tr key={dept._id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded">
                            {dept.code}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900">
                          {dept.name}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {dept.managerName || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            <Users className="w-3 h-3" />
                            {dept.employeeCount || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate">
                          {dept.description || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleDeptActive(dept)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                              dept.isActive
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                            title={dept.isActive ? "Bấm để ngừng sử dụng" : "Bấm để kích hoạt lại"}
                          >
                            {dept.isActive ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Đang dùng
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                Ngừng dùng
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingDept(dept);
                                setDeptForm({
                                  code: dept.code,
                                  name: dept.name,
                                  description: dept.description || "",
                                  managerUid: dept.managerUid || "",
                                  managerName: dept.managerName || "",
                                  isActive: dept.isActive,
                                });
                                setIsDeptModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "department",
                                  id: dept._id,
                                  name: dept.name,
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PHÒNG THEO CHI NHÁNH */}
      {activeSubTab === "rooms" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-700">Chi nhánh:</span>
              </div>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>

              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm mã phòng, tên phòng, tầng..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenRoomMerge}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                title="Chuẩn hóa các vị trí thiết bị cũ vào danh mục phòng chuẩn"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                Chuẩn hóa vị trí cũ
              </button>

              <button
                onClick={() => {
                  setEditingRoom(null);
                  setRoomForm({
                    branchId: selectedBranchId,
                    code: "",
                    name: "",
                    type: "clinic",
                    floor: "",
                    description: "",
                    isActive: true,
                  });
                  setIsRoomModalOpen(true);
                }}
                disabled={!selectedBranchId}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Thêm phòng mới
              </button>
            </div>
          </div>

          {/* Rooms Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Mã phòng</th>
                    <th className="px-4 py-3">Tên phòng</th>
                    <th className="px-4 py-3">Loại phòng</th>
                    <th className="px-4 py-3">Vị trí / Tầng</th>
                    <th className="px-4 py-3 text-center">Thiết bị tại phòng</th>
                    <th className="px-4 py-3">Ghi chú</th>
                    <th className="px-4 py-3 text-center">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roomLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        Đang tải danh sách phòng...
                      </td>
                    </tr>
                  ) : filteredRooms.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        Chưa có phòng nào tại chi nhánh này. Bấm "Thêm phòng mới" để tạo.
                      </td>
                    </tr>
                  ) : (
                    filteredRooms.map((room) => (
                      <tr key={room._id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded">
                            {room.code}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900">
                          {room.name}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-50 text-sky-700">
                            {ROOM_TYPE_LABELS[room.type] || room.type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {room.floor || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            <Wrench className="w-3 h-3" />
                            {room.equipmentCount || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate">
                          {room.description || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleRoomActive(room)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                              room.isActive
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                            title={room.isActive ? "Bấm để ngừng sử dụng" : "Bấm để kích hoạt lại"}
                          >
                            {room.isActive ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Đang dùng
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                Ngừng dùng
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingRoom(room);
                                setRoomForm({
                                  branchId: room.branchId,
                                  code: room.code,
                                  name: room.name,
                                  type: room.type,
                                  floor: room.floor || "",
                                  description: room.description || "",
                                  isActive: room.isActive,
                                });
                                setIsRoomModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "room",
                                  id: room._id,
                                  name: room.name,
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM / SỬA PHÒNG BAN */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              {editingDept ? "Chỉnh sửa Phòng ban" : "Thêm Phòng ban Mới"}
            </h3>

            <form onSubmit={handleSaveDepartment} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã phòng ban <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: KT, NS, CSKH"
                    value={deptForm.code}
                    onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={deptForm.isActive ? "true" : "false"}
                    onChange={(e) => setDeptForm({ ...deptForm, isActive: e.target.value === "true" })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="true">Đang hoạt động</option>
                    <option value="false">Ngừng sử dụng</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên phòng ban <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Phòng Kế toán, Ban Giám Đốc"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Trưởng bộ phận (tuỳ chọn)
                </label>
                <SearchableSelect
                  options={managerOptions}
                  value={deptForm.managerUid || (deptForm.managerName ? "__legacy_manager__" : "")}
                  disabled={managerAccountsLoading}
                  placeholder={managerAccountsLoading ? "Đang tải tài khoản..." : "Chọn trưởng bộ phận"}
                  searchPlaceholder="Tìm theo tên hoặc email..."
                  onChange={(uid) => {
                    if (uid === "__legacy_manager__" || (uid && uid === deptForm.managerUid)) return;
                    const account = managerAccounts.find((item) => item.uid === uid);
                    setDeptForm({
                      ...deptForm,
                      managerUid: account?.uid || "",
                      managerName: account?.displayName || account?.email || "",
                    });
                  }}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mô tả / Chức năng nhiệm vụ
                </label>
                <textarea
                  rows={2}
                  placeholder="Mô tả chức năng chính của phòng ban..."
                  value={deptForm.description || ""}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition"
                >
                  {editingDept ? "Lưu thay đổi" : "Tạo phòng ban"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHUẨN HÓA PHÒNG BAN CŨ (MERGE LEGACY) */}
      {isDeptMergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Chuẩn hóa Tên Phòng ban Lịch sử
                </h3>
                <p className="text-xs text-slate-500">
                  Gộp các tên gõ tự do trước đây về một phòng ban chuẩn duy nhất.
                </p>
              </div>
            </div>

            {unmappedDepts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                Tuyệt vời! Toàn bộ hồ sơ nhân sự đã được gắn với danh mục phòng ban chuẩn.
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    1. Chọn các chuỗi tên cũ cần gộp ({unmappedDepts.length} giá trị phát hiện):
                  </label>
                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                    {unmappedDepts.map((item) => {
                      const isChecked = selectedLegacyDepts.includes(item.name);
                      return (
                        <label
                          key={item.name}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-white transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLegacyDepts([...selectedLegacyDepts, item.name]);
                                } else {
                                  setSelectedLegacyDepts(
                                    selectedLegacyDepts.filter((s) => s !== item.name)
                                  );
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            <span className="font-semibold text-slate-800 font-mono">
                              "{item.name}"
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                            {item.count} nhân sự
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    2. Gộp tất cả các mục trên vào Phòng ban chuẩn:
                  </label>
                  <select
                    value={targetDeptId}
                    onChange={(e) => setTargetDeptId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                  >
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setIsDeptMergeOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition"
              >
                Đóng
              </button>
              {unmappedDepts.length > 0 && (
                <button
                  type="button"
                  disabled={mergingDept || selectedLegacyDepts.length === 0}
                  onClick={handleRunDeptMerge}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {mergingDept ? "Đang gộp..." : `Gộp ${selectedLegacyDepts.length} mục đã chọn`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM / SỬA PHÒNG THEO CHI NHÁNH */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DoorClosed className="w-5 h-5 text-blue-600" />
              {editingRoom ? "Chỉnh sửa Phòng" : "Thêm Phòng Chi nhánh Mới"}
            </h3>

            <form onSubmit={handleSaveRoom} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã phòng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: P101, KHO-01"
                    value={roomForm.code}
                    onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Loại phòng
                  </label>
                  <select
                    value={roomForm.type}
                    onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value as RoomType })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {Object.entries(ROOM_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên phòng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Phòng khám 1, Kho vật tư cơ sở"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vị trí / Tầng
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Tầng 1, Tầng lửng"
                    value={roomForm.floor || ""}
                    onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={roomForm.isActive ? "true" : "false"}
                    onChange={(e) => setRoomForm({ ...roomForm, isActive: e.target.value === "true" })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="true">Đang sử dụng</option>
                    <option value="false">Ngừng sử dụng</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ghi chú cơ sở vật chất
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú về thiết bị hoặc quy định của phòng..."
                  value={roomForm.description || ""}
                  onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition"
                >
                  {editingRoom ? "Lưu thay đổi" : "Tạo phòng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHUẨN HÓA VỊ TRÍ THIẾT BỊ CŨ */}
      {isRoomMergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Chuẩn hóa Vị trí Thiết bị Cũ
                </h3>
                <p className="text-xs text-slate-500">
                  Gộp các vị trí gõ tự do của thiết bị vào phòng chuẩn của chi nhánh.
                </p>
              </div>
            </div>

            {unmappedRooms.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                Tuyệt vời! Toàn bộ thiết bị tại chi nhánh này đã được chuẩn hóa vị trí phòng.
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    1. Chọn các vị trí cũ cần gộp:
                  </label>
                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                    {unmappedRooms.map((item) => {
                      const isChecked = selectedLegacyRooms.includes(item.name);
                      return (
                        <label
                          key={item.name}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-white transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLegacyRooms([...selectedLegacyRooms, item.name]);
                                } else {
                                  setSelectedLegacyRooms(
                                    selectedLegacyRooms.filter((s) => s !== item.name)
                                  );
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            <span className="font-semibold text-slate-800 font-mono">
                              "{item.name}"
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                            {item.count} thiết bị
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    2. Gộp vào Phòng chuẩn:
                  </label>
                  <select
                    value={targetRoomId}
                    onChange={(e) => setTargetRoomId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                  >
                    {rooms.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name} ({r.code}) {r.floor ? `- ${r.floor}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setIsRoomMergeOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition"
              >
                Đóng
              </button>
              {unmappedRooms.length > 0 && (
                <button
                  type="button"
                  disabled={mergingRoom || selectedLegacyRooms.length === 0}
                  onClick={handleRunRoomMerge}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {mergingRoom ? "Đang gộp..." : `Gộp ${selectedLegacyRooms.length} mục đã chọn`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      {deleteConfirm && (
        <ConfirmDialog
          isOpen={true}
          title={
            deleteConfirm.type === "department"
              ? "Xác nhận xóa Phòng ban"
              : "Xác nhận xóa Phòng chi nhánh"
          }
          description={`Bạn có chắc chắn muốn xóa "${deleteConfirm.name}" không? Nếu phòng ban/phòng này đang được sử dụng, hệ thống sẽ ngăn việc xóa để đảm bảo toàn vẹn dữ liệu.`}
          confirmLabel="Xác nhận xóa"
          cancelLabel="Hủy"
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteConfirm(null)}
          tone="danger"
        />
      )}
    </div>
  );
};
