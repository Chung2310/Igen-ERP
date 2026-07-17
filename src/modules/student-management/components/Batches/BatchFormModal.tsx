import React, { useState, useEffect } from 'react';
import { School, Tag, BookOpen, GraduationCap, Clock, CalendarRange, Calendar, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { ErpModal, ErpField, ErpInput, ErpSelect } from '../Erp/ErpUI';
import { Course, ManagedUser, BatchStatus, Batch } from '../../types';

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 5, label: 'T6' },
  { value: 4, label: 'T5' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
].sort((a, b) => {
  // Sort Monday (1) to Saturday (6), then Sunday (0)
  const valA = a.value === 0 ? 7 : a.value;
  const valB = b.value === 0 ? 7 : b.value;
  return valA - valB;
});

export interface BatchForm {
  code: string;
  courseId: string;
  instructorId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  location: string;
  startDate: string;
  endDate: string;
  status: BatchStatus;
}

const EMPTY_FORM: BatchForm = {
  code: '',
  courseId: '',
  instructorId: '',
  daysOfWeek: [],
  startTime: '18:00',
  endTime: '20:00',
  location: '',
  startDate: '',
  endDate: '',
  status: 'Sắp khai giảng',
};

interface BatchFormModalProps {
  isOpen: boolean;
  editingId: string | null;
  batchToEdit?: Batch;
  onClose: () => void;
  courses: Course[];
  instructors: ManagedUser[];
  onSuccess: () => void;
}

export function BatchFormModal({
  isOpen,
  editingId,
  batchToEdit,
  onClose,
  courses,
  instructors,
  onSuccess,
}: BatchFormModalProps) {
  const [form, setForm] = useState<BatchForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingId && batchToEdit) {
      setForm({
        code: batchToEdit.code,
        courseId: batchToEdit.courseId,
        instructorId: batchToEdit.instructorId || '',
        daysOfWeek: batchToEdit.daysOfWeek || [],
        startTime: batchToEdit.startTime,
        endTime: batchToEdit.endTime,
        location: batchToEdit.location || '',
        startDate: batchToEdit.startDate,
        endDate: batchToEdit.endDate,
        status: batchToEdit.status,
      });
    } else {
      setForm({ ...EMPTY_FORM, courseId: courses[0]?.id || '' });
    }
  }, [editingId, batchToEdit, courses]);

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.courseId || !form.startDate || !form.endDate) {
      toast.error('Vui lòng nhập đầy đủ thông tin lớp học.');
      return;
    }
    if (form.daysOfWeek.length === 0) {
      toast.error('Vui lòng chọn ít nhất một ngày học trong tuần.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { ...form, code: form.code.toUpperCase() };
      if (editingId) {
        await apiFetch(`/batches/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success(`Đã cập nhật lớp ${payload.code}.`);
      } else {
        await apiFetch('/batches', { method: 'POST', body: JSON.stringify(payload) });
        toast.success(`Đã mở lớp ${payload.code} thành công!`);
      }
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi lưu lớp học.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ErpModal title={editingId ? 'Chỉnh sửa lớp học' : 'Mở lớp mới'} onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Thông tin lớp học */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="w-1.5 h-4 bg-brand-primary rounded-full"></div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <School className="w-4 h-4 text-brand-primary" />
              Thông tin lớp học
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ErpField label="Mã lớp">
              <div className="relative">
                <ErpInput
                  type="text"
                  required
                  placeholder="Ví dụ: K32"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="pl-10"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Tag className="w-4 h-4" />
                </div>
              </div>
            </ErpField>
            <ErpField label="Khóa học">
              <div className="relative">
                <ErpSelect
                  required
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  className="pl-10"
                >
                  <option value="" disabled>-- Chọn khóa học --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                  ))}
                </ErpSelect>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 z-10">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
            </ErpField>
          </div>

          <ErpField label="Giảng viên phụ trách">
            <div className="relative">
              <ErpSelect
                value={form.instructorId}
                onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
                className="pl-10"
              >
                <option value="">— Chưa gán giảng viên —</option>
                {instructors.map((i) => (
                  <option key={i.uid} value={i.uid}>{i.displayName} (Nhân viên)</option>
                ))}
              </ErpSelect>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 z-10">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
          </ErpField>
        </div>

        {/* Section 2: Lịch học & Khung giờ */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="w-1.5 h-4 bg-brand-primary rounded-full"></div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-brand-primary" />
              Lịch học & Khung giờ
            </h4>
          </div>

          <ErpField label="Ngày học trong tuần">
            <div className="grid grid-cols-7 gap-1.5 mt-1">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    "py-3 rounded-xl text-[11px] font-black transition-all border cursor-pointer text-center",
                    form.daysOfWeek.includes(d.value)
                      ? "bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/25 scale-[1.02]"
                      : "bg-slate-50 text-slate-550 border-slate-200 hover:bg-slate-100 hover:border-slate-300 active:scale-95"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </ErpField>

          <div className="grid grid-cols-2 gap-4">
            <ErpField label="Giờ bắt đầu">
              <div className="relative">
                <ErpInput
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="pl-10"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
            </ErpField>
            <ErpField label="Giờ kết thúc">
              <div className="relative">
                <ErpInput
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="pl-10"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
            </ErpField>
          </div>
        </div>

        {/* Section 3: Thời gian & Địa điểm */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="w-1.5 h-4 bg-brand-primary rounded-full"></div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <CalendarRange className="w-4 h-4 text-brand-primary" />
              Thời gian & Địa điểm
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ErpField label="Ngày khai giảng">
              <div className="relative">
                <ErpInput
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="pl-10"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
            </ErpField>
            <ErpField label="Ngày kết thúc">
              <div className="relative">
                <ErpInput
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="pl-10"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
            </ErpField>
          </div>

          <ErpField label="Địa điểm (tùy chọn)">
            <div className="relative">
              <ErpInput
                type="text"
                placeholder="Ví dụ: Phòng 201"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="pl-10"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <MapPin className="w-4 h-4" />
              </div>
            </div>
          </ErpField>
        </div>

        {/* Custom submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-gradient-to-r from-brand-primary to-sky-600 hover:from-brand-primary/95 hover:to-sky-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <School className="w-4.5 h-4.5" />
          )}
          {isSubmitting ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Khai giảng lớp'}
        </button>
      </form>
    </ErpModal>
  );
}
