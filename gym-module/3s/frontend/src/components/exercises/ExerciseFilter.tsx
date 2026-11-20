import { Search, X, RotateCcw, RefreshCw } from 'lucide-react';

interface ExerciseFilterProps {
  keyword: string;
  muscleGroup?: string;
  level: string;
  trackingType: string;
  muscleGroups?: string[];
  onKeywordChange: (value: string) => void;
  onMuscleGroupChange?: (value: string) => void;
  onLevelChange: (value: string) => void;
  onTrackingTypeChange: (value: string) => void;
  onFilter: () => void;
  onClear: () => void;
}

export default function ExerciseFilter({
  keyword,
  muscleGroup,
  level,
  trackingType,
  muscleGroups = [],
  onKeywordChange,
  onMuscleGroupChange,
  onLevelChange,
  onTrackingTypeChange,
  onFilter,
  onClear,
}: ExerciseFilterProps) {
  return (
    <div className="module-toolbar exercise-toolbar" role="search" aria-label="Bộ lọc bài tập">
      <div className="exercise-filter-search">
        <Search size={16} className="exercise-filter-search-icon" aria-hidden="true" />
        <input
          aria-label="Tìm kiếm bài tập"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onFilter();
            }
          }}
          placeholder="Tìm theo tên bài tập..."
          className="exercise-filter-input"
        />
        {keyword && (
          <button
            type="button"
            className="exercise-filter-clear-input"
            onClick={() => onKeywordChange('')}
            aria-label="Xóa từ khóa tìm kiếm"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <select
        className="exercise-filter-select"
        aria-label="Nhóm cơ"
        value={muscleGroup || ''}
        onChange={(e) => onMuscleGroupChange?.(e.target.value)}
      >
        <option value="">Tất cả nhóm cơ</option>
        {muscleGroups.map((group) => (
          <option key={group} value={group}>{group}</option>
        ))}
      </select>

      <select
        className="exercise-filter-select"
        aria-label="Cấp độ"
        value={level}
        onChange={(e) => onLevelChange(e.target.value)}
      >
        <option value="">Tất cả cấp độ</option>
        <option value="BEGINNER">Cơ bản</option>
        <option value="INTERMEDIATE">Trung cấp</option>
        <option value="ADVANCED">Nâng cao</option>
      </select>

      <select
        className="exercise-filter-select"
        aria-label="Cách ghi nhận"
        value={trackingType}
        onChange={(event) => onTrackingTypeChange(event.target.value)}
      >
        <option value="">Tất cả cách ghi nhận</option>
        <option value="UNCLASSIFIED">Chưa phân loại</option>
        <option value="STRENGTH">Sức mạnh · mức tạ</option>
        <option value="BODYWEIGHT">Trọng lượng cơ thể</option>
        <option value="CARDIO">Cardio</option>
        <option value="INTERVAL">Interval</option>
        <option value="MOBILITY">Mobility</option>
      </select>

      <button type="button" className="button button-secondary exercise-filter-submit" onClick={onFilter}>
        <RefreshCw size={15} /> Lọc bài tập
      </button>

      {(keyword || muscleGroup || level || trackingType) && (
        <button type="button" className="exercise-filter-reset" onClick={onClear}>
          <RotateCcw size={13} /> Xóa lọc
        </button>
      )}
    </div>
  );
}
