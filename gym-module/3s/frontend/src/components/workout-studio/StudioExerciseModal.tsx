import React from 'react';
import { X, Clock, Calendar, Dumbbell, Trash2, CalendarMinus, Check, Sparkles } from 'lucide-react';
import { formatMinute, snapMinute, SLOT_MINUTES, DAY_MINUTES } from '../../services/workoutStudioModel';
import type { ScheduledExercise } from '../../types/workoutStudio';
import PrescriptionEditor from '../workouts/tracking/PrescriptionEditor';

interface StudioExerciseModalProps {
  open: boolean;
  item: ScheduledExercise | null;
  days: number[];
  onClose: () => void;
  onUpdate: (patch: Partial<ScheduledExercise>) => void;
  onUnscheduled: () => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export default function StudioExerciseModal({
  open,
  item,
  days,
  onClose,
  onUpdate,
  onUnscheduled,
  onRemove,
  readOnly = false,
}: StudioExerciseModalProps) {
  if (!open || !item) return null;

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [hour, minute] = e.target.value.split(':').map(Number);
    if (!isNaN(hour) && !isNaN(minute)) {
      onUpdate({ startMinute: snapMinute(hour * 60 + minute) });
    }
  };

  const getTrackingTypeBadge = (type: string) => {
    switch (type) {
      case 'STRENGTH':
        return { label: 'Kháng lực / Tạ (Strength)', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'BODYWEIGHT':
        return { label: 'Tự thân (Bodyweight)', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'CARDIO':
        return { label: 'Tim mạch (Cardio)', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'INTERVAL':
        return { label: 'Ngắt quãng (Interval / HIIT)', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'MOBILITY':
        return { label: 'Dẻo dai / Giãn cơ (Mobility)', bg: 'bg-sky-50 text-sky-700 border-sky-200' };
      default:
        return { label: type, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const badge = getTrackingTypeBadge(item.trackingType || 'STRENGTH');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-600 text-white shadow-xs">
              <Dumbbell size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${badge.bg}`}>
                  {badge.label}
                </span>
                {item.muscleGroup && (
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {item.muscleGroup}
                  </span>
                )}
              </div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">
                {item.name}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Day & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            {/* Day Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-sky-600" /> Ngày tập:
              </label>
              <select
                value={item.dayNumber}
                disabled={readOnly}
                onChange={(e) => onUpdate({ dayNumber: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 outline-none bg-white focus:border-sky-500"
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    Ngày {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Clock size={13} className="text-amber-600" /> Giờ bắt đầu:
              </label>
              <input
                type="time"
                step="900"
                value={formatMinute(item.startMinute)}
                disabled={readOnly}
                onChange={handleTimeChange}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 outline-none bg-white focus:border-sky-500"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Thời lượng (phút):
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={readOnly || item.durationMinutes <= SLOT_MINUTES}
                  onClick={() => onUpdate({ durationMinutes: Math.max(15, item.durationMinutes - SLOT_MINUTES) })}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold cursor-pointer disabled:opacity-30"
                >
                  −
                </button>
                <input
                  type="number"
                  min="15"
                  max="360"
                  step="15"
                  value={item.durationMinutes}
                  disabled={readOnly}
                  onChange={(e) => onUpdate({ durationMinutes: Math.max(15, Number(e.target.value)) })}
                  className="w-full px-1.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-center text-slate-800 outline-none bg-white focus:border-sky-500"
                />
                <button
                  type="button"
                  disabled={readOnly || item.startMinute + item.durationMinutes >= DAY_MINUTES}
                  onClick={() => onUpdate({ durationMinutes: item.durationMinutes + SLOT_MINUTES })}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold cursor-pointer disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Prescription Form Section */}
          <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100">
            <h4 className="text-xs font-black uppercase tracking-wider text-sky-900 m-0 mb-3 flex items-center gap-1.5">
              <Sparkles size={14} className="text-sky-600" /> Thông số bài tập chi tiết (Prescriptions)
            </h4>
            <PrescriptionEditor
              exerciseName={item.name}
              trackingType={item.trackingType || 'STRENGTH'}
              value={item.prescription || {}}
              onChange={(prescription) => onUpdate({ prescription })}
              disabled={readOnly}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Ghi chú riêng cho bài tập này:
            </label>
            <textarea
              rows={2}
              placeholder="Ví dụ: Giữ thẳng lưng, hạ chậm 3 giây, thở đều..."
              value={item.notes || ''}
              disabled={readOnly}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-normal text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all bg-white resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => {
                onUnscheduled();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-amber-700 hover:bg-amber-100/70 border border-amber-300 bg-amber-50 font-bold text-xs cursor-pointer transition-colors"
            >
              <CalendarMinus size={14} /> Chưa xếp lịch
            </button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => {
                onRemove();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-700 hover:bg-rose-100/70 border border-rose-200 bg-rose-50 font-bold text-xs cursor-pointer transition-colors"
            >
              <Trash2 size={14} /> Xóa bài
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
          >
            <Check size={15} /> Xong
          </button>
        </div>
      </div>
    </div>
  );
}
