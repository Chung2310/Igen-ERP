/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Video,
  X,
  Check,
  Search,
  AlertCircle,
} from "lucide-react";
import type { EmployeeNode, UserProfile } from "../../types";
import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";

export interface CalendarMeetingPayload {
  _id?: string;
  id?: string;
  companyCode: string;
  branchId?: string;
  type: "meeting" | "reminder" | "event";
  title: string;
  description?: string;
  location?: string;
  meetingLink?: string;
  participants?: string[];
  participantNames?: string[];
  startDate: string;
  endDate: string;
  creatorId: string;
  employeeName?: string;
  status: "approved" | "completed" | "active";
}

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: Date | null;
  editingItem?: CalendarMeetingPayload | null;
  selectedCompanyCode: string;
  employees: EmployeeNode[];
  usersList: UserProfile[];
  userProfile: UserProfile | null;
}

export function CreateMeetingModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  editingItem,
  selectedCompanyCode,
  employees,
  usersList,
  userProfile,
}: CreateMeetingModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"meeting" | "reminder" | "event">("meeting");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Normalize initial date YYYY-MM-DD
  const formatInitialDate = (d?: Date | null) => {
    const target = d || new Date();
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, "0");
    const day = String(target.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    if (!isOpen) return;
    void Promise.resolve().then(() => {
      if (editingItem) {
        setTitle(editingItem.title || "");
        setType(
          editingItem.type === "meeting" || editingItem.type === "reminder" || editingItem.type === "event"
            ? editingItem.type
            : "meeting"
        );
        const start = new Date(editingItem.startDate);
        const end = new Date(editingItem.endDate);
        setDate(formatInitialDate(start));
        const sH = String(start.getHours()).padStart(2, "0");
        const sM = String(start.getMinutes()).padStart(2, "0");
        const eH = String(end.getHours()).padStart(2, "0");
        const eM = String(end.getMinutes()).padStart(2, "0");
        setStartTime(`${sH}:${sM}`);
        setEndTime(`${eH}:${eM}`);
        setIsAllDay(sH === "00" && sM === "00" && eH === "23" && eM === "59");
        setLocation(editingItem.location || "");
        setMeetingLink(editingItem.meetingLink || "");
        setSelectedParticipants(editingItem.participants || []);
        setDescription(editingItem.description || "");
      } else {
        setTitle("");
        setType("meeting");
        setDate(formatInitialDate(initialDate));
        setStartTime("09:00");
        setEndTime("10:00");
        setIsAllDay(false);
        setLocation("");
        setMeetingLink("");
        setSelectedParticipants(userProfile?.uid ? [userProfile.uid] : []);
        setDescription("");
      }
      setFormError("");
      setMemberSearch("");
    });
  }, [editingItem, initialDate, isOpen, userProfile?.uid]);

  // Merge employees and usersList for selectable members
  const selectableMembers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string; avatar?: string }>();
    employees.forEach((emp) => {
      if (emp.id) {
        map.set(emp.id, {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          avatar: emp.avatar,
        });
      }
    });
    usersList.forEach((u) => {
      const uid = u.uid || (u as any)._id;
      if (uid && !map.has(uid)) {
        map.set(uid, {
          id: uid,
          name: u.displayName || u.email,
          email: u.email,
          avatar: u.photoURL,
        });
      }
    });
    return Array.from(map.values());
  }, [employees, usersList]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return selectableMembers;
    const q = memberSearch.toLowerCase();
    return selectableMembers.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [selectableMembers, memberSearch]);

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Vui lòng nhập tiêu đề cuộc họp hoặc lịch hẹn.");
      return;
    }
    if (!date) {
      setFormError("Vui lòng chọn ngày diễn ra.");
      return;
    }

    if (!isAllDay && startTime >= endTime) {
      setFormError("Thời gian kết thúc phải lớn hơn thời gian bắt đầu.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    const startDateTime = isAllDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
    const endDateTime = isAllDay ? `${date}T23:59:59` : `${date}T${endTime}:00`;

    const participantNames = selectedParticipants
      .map((id) => selectableMembers.find((m) => m.id === id)?.name || "")
      .filter(Boolean);

    const payload = {
      companyCode: selectedCompanyCode,
      type,
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      meetingLink: meetingLink.trim(),
      participants: selectedParticipants,
      participantNames,
      startDate: new Date(startDateTime).toISOString(),
      endDate: new Date(endDateTime).toISOString(),
      creatorId: userProfile?.uid || "SYSTEM",
      employeeName: userProfile?.displayName || "Quản trị viên",
      status: "approved",
    };

    try {
      const isEditing = Boolean(editingItem?._id || editingItem?.id);
      const url = isEditing
        ? `/api/v1/crud/hr-calendar-events/${editingItem?._id || editingItem?.id}`
        : `/api/v1/crud/hr-calendar-events`;
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.details || "Không thể lưu lịch hẹn.");
      }

      toast.success(isEditing ? "Đã cập nhật lịch họp thành công!" : "Đã tạo lịch họp mới thành công!");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Lỗi khi lưu lịch họp:", err);
      const msg = getApiErrorMessage(err, "Không thể lưu thông tin lịch họp. Hãy thử lại.");
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-modal-title"
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest text-on-surface shadow-2xl animate-in fade-in zoom-in duration-200"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {type === "meeting" ? <Video className="size-5" /> : <CalendarDays className="size-5" />}
            </span>
            <div>
              <h2 id="meeting-modal-title" className="text-base font-semibold text-balance">
                {editingItem ? "Chỉnh sửa lịch họp / hẹn" : "Tạo lịch họp / lịch hẹn"}
              </h2>
              <p className="text-xs text-on-surface-variant text-pretty">
                Thêm lịch họp, phỏng vấn hoặc lịch hẹn vào lịch làm việc
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Đóng hộp thoại"
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Tiêu đề */}
            <div className="space-y-1">
              <label htmlFor="meeting-title" className="block text-xs font-semibold text-on-surface">
                Tiêu đề cuộc họp / lịch hẹn <span className="text-rose-500">*</span>
              </label>
              <input
                id="meeting-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Họp giao ban đầu tuần, Phỏng vấn ứng viên..."
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Phân loại sự kiện */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-on-surface">Phân loại</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "meeting", label: "Lịch họp nội bộ", icon: Video },
                  { value: "reminder", label: "Lịch hẹn đối tác", icon: Clock },
                  { value: "event", label: "Sự kiện chung", icon: CalendarDays },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = type === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setType(cat.value as any)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ngày và Giờ */}
            <div className="space-y-2 rounded-xl border border-outline-variant bg-surface-container/30 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">Thời gian diễn ra</span>
                <label className="flex items-center gap-2 text-xs font-medium text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="size-4 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span>Cả ngày</span>
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <label htmlFor="meeting-date" className="block text-[11px] font-medium text-on-surface-variant mb-1">
                    Ngày
                  </label>
                  <input
                    id="meeting-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none"
                  />
                </div>

                {!isAllDay && (
                  <>
                    <div>
                      <label htmlFor="meeting-start-time" className="block text-[11px] font-medium text-on-surface-variant mb-1">
                        Giờ bắt đầu
                      </label>
                      <input
                        id="meeting-start-time"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="meeting-end-time" className="block text-[11px] font-medium text-on-surface-variant mb-1">
                        Giờ kết thúc
                      </label>
                      <input
                        id="meeting-end-time"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Địa điểm & Link họp online */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="meeting-location" className="block text-xs font-semibold text-on-surface">
                  Địa điểm trực tiếp
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 size-4 text-on-surface-variant/60" />
                  <input
                    id="meeting-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Phòng họp 1, Tầng 2..."
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="meeting-link" className="block text-xs font-semibold text-on-surface">
                  Link họp trực tuyến
                </label>
                <div className="relative">
                  <Video className="absolute left-3 top-2.5 size-4 text-on-surface-variant/60" />
                  <input
                    id="meeting-link"
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="Google Meet, Zoom, MS Teams..."
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Thành viên tham gia */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-on-surface">
                  Người tham gia ({selectedParticipants.length})
                </label>
                {selectedParticipants.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedParticipants([])}
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    Bỏ chọn tất cả
                  </button>
                )}
              </div>

              {/* Selected chips */}
              {selectedParticipants.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pb-1">
                  {selectedParticipants.map((pid) => {
                    const member = selectableMembers.find((m) => m.id === pid);
                    return (
                      <span
                        key={pid}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary"
                      >
                        <span>{member?.name || pid}</span>
                        <button
                          type="button"
                          onClick={() => toggleParticipant(pid)}
                          className="hover:opacity-75 cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Search & Select List */}
              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
                <div className="flex items-center border-b border-outline-variant px-2.5 py-1.5">
                  <Search className="size-3.5 text-on-surface-variant/60 mr-2" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Tìm tên hoặc email nhân viên..."
                    className="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-outline-variant/40">
                  {filteredMembers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-on-surface-variant">
                      Không tìm thấy nhân viên phù hợp
                    </div>
                  ) : (
                    filteredMembers.map((member) => {
                      const isSelected = selectedParticipants.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleParticipant(member.id)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition cursor-pointer hover:bg-surface-container ${
                            isSelected ? "bg-primary/5 text-primary font-medium" : "text-on-surface"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="truncate font-medium">{member.name}</p>
                            <p className="truncate text-[10px] text-on-surface-variant">{member.email}</p>
                          </div>
                          <span
                            className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                              isSelected
                                ? "border-primary bg-primary text-on-primary"
                                : "border-outline-variant bg-surface-container-lowest"
                            }`}
                          >
                            {isSelected && <Check className="size-3 stroke-[3]" />}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Nội dung / Mô tả cuộc họp */}
            <div className="space-y-1">
              <label htmlFor="meeting-desc" className="block text-xs font-semibold text-on-surface">
                Nội dung / Chương trình họp
              </label>
              <textarea
                id="meeting-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nêu các mục tiêu, tài liệu chuẩn bị, chương trình nghị sự..."
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <footer className="flex items-center justify-end gap-2.5 border-t border-outline-variant bg-surface-container/20 px-5 py-3.5">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-on-primary shadow-xs hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 transition cursor-pointer"
            >
              {submitting ? (
                <span>Đang lưu...</span>
              ) : editingItem ? (
                <span>Cập nhật lịch</span>
              ) : (
                <span>Tạo lịch họp / hẹn</span>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
