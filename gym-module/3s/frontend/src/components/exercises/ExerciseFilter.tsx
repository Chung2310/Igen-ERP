import { Search, X, RotateCcw, RefreshCw } from 'lucide-react';
import CustomSelect from '../ui/CustomSelect';

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

      <CustomSelect
        className="exercise-filter-select"
        ariaLabel="Nhóm cơ"
        value={muscleGroup || ''}
        onChange={(val) => onMuscleGroupChange?.(val)}
        options={[
          { value: '', label: 'Tất cả nhóm cơ' },
          ...muscleGroups.map((group) => ({ value: group, label: group })),
        ]}
      />

      <CustomSelect
        className="exercise-filter-select"
        ariaLabel="Cấp độ"
        value={level}
        onChange={(val) => onLevelChange(val)}
        options={[
          { value: '', label: 'Tất cả cấp độ' },
          { value: 'BEGINNER', label: 'Cơ bản' },
          { value: 'INTERMEDIATE', label: 'Trung cấp' },
          { value: 'ADVANCED', label: 'Nâng cao' },
        ]}
      />

      <CustomSelect
        className="exercise-filter-select"
        ariaLabel="Cách ghi nhận"
        value={trackingType}
        onChange={(val) => onTrackingTypeChange(val)}
        options={[
          { value: '', label: 'Tất cả cách ghi nhận' },
          { value: 'UNCLASSIFIED', label: 'Chưa phân loại' },
          { value: 'STRENGTH', label: 'Sức mạnh · mức tạ' },
          { value: 'BODYWEIGHT', label: 'Trọng lượng cơ thể' },
          { value: 'CARDIO', label: 'Cardio' },
          { value: 'INTERVAL', label: 'Interval' },
          { value: 'MOBILITY', label: 'Mobility' },
        ]}
      />

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
