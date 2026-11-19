import React, { useState, useMemo } from 'react';
import { X, Search, Dumbbell, Plus, Sparkles, Filter } from 'lucide-react';
import type { Exercise } from '../../types';

interface ExerciseLibraryModalProps {
  open: boolean;
  onClose: () => void;
  library: Exercise[];
  recommendations?: Exercise[];
  activeDay: number;
  onSelectExercise: (exercise: Exercise) => void;
}

export default function ExerciseLibraryModal({
  open,
  onClose,
  library,
  recommendations = [],
  activeDay,
  onSelectExercise,
}: ExerciseLibraryModalProps) {
  const [query, setQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  const muscleGroups = useMemo(() => {
    return [...new Set(library.map((e) => e.muscleGroup).filter(Boolean))].sort();
  }, [library]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('vi');
    return library.filter((e) => {
      const matchName = !q || e.name.toLocaleLowerCase('vi').includes(q);
      const matchMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
      const matchLevel = !selectedLevel || e.level === selectedLevel;
      return matchName && matchMuscle && matchLevel;
    });
  }, [library, query, selectedMuscle, selectedLevel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Dumbbell size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">
                Thư viện bài tập
              </h3>
              <p className="text-xs text-slate-500 m-0">
                Chọn bài tập để thêm vào Ngày {activeDay}
              </p>
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

        {/* Search & Filters */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-2.5 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm bài tập theo tên..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 bg-slate-50 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedMuscle}
              onChange={(e) => setSelectedMuscle(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-sky-500 flex-1"
            >
              <option value="">Tất cả nhóm cơ ({library.length})</option>
              {muscleGroups.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-sky-500 flex-1"
            >
              <option value="">Tất cả độ khó</option>
              <option value="BEGINNER">Cơ bản (Beginner)</option>
              <option value="INTERMEDIATE">Trung cấp (Intermediate)</option>
              <option value="ADVANCED">Nâng cao (Advanced)</option>
            </select>
          </div>
        </div>

        {/* List of Exercises */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm font-bold">Không tìm thấy bài tập phù hợp</p>
              <p className="text-xs">Hãy thử từ khóa hoặc bộ lọc khác</p>
            </div>
          ) : (
            filtered.map((exercise) => (
              <div
                key={exercise._id}
                className="p-3 rounded-xl border border-slate-200/80 hover:border-sky-300 bg-slate-50/50 hover:bg-sky-50/30 flex items-center justify-between gap-3 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                      {exercise.muscleGroup || 'Toàn thân'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                      {exercise.level === 'BEGINNER' ? 'Cơ bản' : exercise.level === 'ADVANCED' ? 'Nâng cao' : 'Trung cấp'}
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-600">
                      {exercise.defaultTrackingType || 'STRENGTH'}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 m-0">
                    {exercise.name}
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectExercise(exercise);
                    onClose();
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors shrink-0"
                >
                  <Plus size={14} /> Thêm
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-slate-500">
            Hiển thị {filtered.length} bài tập
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
