import React from 'react';
import { ArrowLeft, CheckCircle2, Save, Sliders, Calendar, Dumbbell, Target } from 'lucide-react';

interface Props {
  title: string;
  goal: string;
  level: string;
  durationDays: number;
  dirty: boolean;
  saving: boolean;
  contextLabel?: string;
  readOnly?: boolean;
  onBack: () => void;
  onTitleChange: (value: string) => void;
  onGoalChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onDurationDaysChange: (value: number) => void;
  onSave: () => void;
  onOpenSettings?: () => void;
  activeWeek?: number;
  activeDay?: number;
  dayItemsCount?: number;
  totalScheduledCount?: number;
  unscheduledCount?: number;
}

export default function StudioHeader(props: Props) {
  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'BEGINNER':
        return { label: 'Cơ bản', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'INTERMEDIATE':
        return { label: 'Trung cấp', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'ADVANCED':
        return { label: 'Nâng cao', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      default:
        return { label: level || 'Cơ bản', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const levelBadge = getLevelBadge(props.level);

  return (
    <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs mb-3.5 space-y-2.5">
      {/* Top Main Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Về danh sách giáo án"
            onClick={props.onBack}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft size={17} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${levelBadge.bg}`}>
                {levelBadge.label}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-900 text-white">
                {props.durationDays} NGÀY
              </span>
              {props.contextLabel && (
                <span className="text-[11px] font-semibold text-slate-500">
                  • {props.contextLabel}
                </span>
              )}
            </div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 m-0 truncate">
              {props.title || 'Giáo án mới'}
            </h1>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
          <span
            role="status"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              props.dirty
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            <CheckCircle2 size={13} />
            <span className="hidden sm:inline">{props.dirty ? 'Chưa lưu' : 'Đã lưu'}</span>
          </span>

          {props.onOpenSettings && (
            <button
              type="button"
              onClick={props.onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer shadow-xs transition-colors"
            >
              <Sliders size={14} className="text-sky-600" />
              <span>Cài đặt</span>
            </button>
          )}

          <button
            type="button"
            disabled={props.saving || props.readOnly}
            onClick={props.onSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            <span>{props.saving ? 'Đang lưu...' : 'Lưu giáo án'}</span>
          </button>
        </div>
      </div>

      {/* Sub Bar: Compact Info & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-500">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-slate-700">
            <Calendar size={13} className="text-sky-600" />
            <span>
              Tuần {props.activeWeek || 1} · Ngày {props.activeDay || 1} ({props.dayItemsCount ?? 0} bài)
            </span>
          </div>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <div className="flex items-center gap-1 text-slate-700">
            <Dumbbell size={13} className="text-indigo-600" />
            <span>{props.totalScheduledCount ?? 0} bài đã xếp</span>
          </div>
          {props.unscheduledCount !== undefined && props.unscheduledCount > 0 && (
            <>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                {props.unscheduledCount} bài chưa xếp
              </span>
            </>
          )}
        </div>

        {props.goal && (
          <div className="flex items-center gap-1 text-slate-600 text-[11px] truncate max-w-md">
            <Target size={12} className="text-emerald-600 shrink-0" />
            <span className="truncate">{props.goal}</span>
          </div>
        )}
      </div>
    </div>
  );
}
