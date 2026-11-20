import React, { useState, useMemo } from 'react';
import { Search, Dumbbell, Plus, ExternalLink } from 'lucide-react';
import type { Exercise } from '../../types';

interface StudioQuickLibraryProps {
  library: Exercise[];
  activeDay: number;
  onPlaceExercise: (exercise: Exercise) => void;
  onOpenFullModal: () => void;
  readOnly?: boolean;
}

export default function StudioQuickLibrary({
  library,
  activeDay,
  onPlaceExercise,
  onOpenFullModal,
  readOnly = false,
}: StudioQuickLibraryProps) {
  const [query, setQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('');

  const muscleGroups = useMemo(() => {
    return [...new Set(library.map((e) => e.muscleGroup).filter(Boolean))].sort();
  }, [library]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('vi');
    return library.filter((e) => {
      const matchName = !q || e.name.toLocaleLowerCase('vi').includes(q);
      const matchMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
      return matchName && matchMuscle;
    });
  }, [library, query, selectedMuscle]);

  return (
    <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
            <Dumbbell size={15} />
          </div>
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 m-0">
            Thư viện bài tập ({library.length})
          </h3>
        </div>

        <button
          type="button"
          onClick={onOpenFullModal}
          className="flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-800 bg-transparent border-none cursor-pointer p-0"
        >
          <span>Mở rộng</span>
          <ExternalLink size={12} />
        </button>
      </div>

      {/* Search & Muscle filter */}
      <div className="space-y-1.5">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm bài tập nhanh..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 bg-slate-50 focus:bg-white transition-all"
          />
        </div>

        <select
          value={selectedMuscle}
          onChange={(e) => setSelectedMuscle(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-sky-500"
        >
          <option value="">Tất cả nhóm cơ ({library.length})</option>
          {muscleGroups.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Exercise list */}
      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs font-semibold">
            Không tìm thấy bài tập
          </div>
        ) : (
          filtered.slice(0, 30).map((exercise) => (
            <div
              key={exercise._id}
              className="p-2 rounded-xl border border-slate-200/70 hover:border-sky-300 bg-slate-50/50 hover:bg-sky-50/20 flex items-center justify-between gap-2 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white text-slate-600 border border-slate-200">
                    {exercise.muscleGroup || 'Toàn thân'}
                  </span>
                  <span className="text-[9px] font-semibold text-indigo-600">
                    {exercise.defaultTrackingType || 'STRENGTH'}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 m-0 truncate">
                  {exercise.name}
                </h4>
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onPlaceExercise(exercise)}
                  className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] cursor-pointer shadow-xs transition-colors shrink-0"
                  title={`Thêm vào Ngày ${activeDay}`}
                >
                  <Plus size={12} />
                  <span>+ Ngày {activeDay}</span>
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
