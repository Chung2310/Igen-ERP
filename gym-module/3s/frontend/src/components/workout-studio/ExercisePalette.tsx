import { Search, Dumbbell, Sparkles, Plus, GripVertical, Award, Layers } from 'lucide-react';
import type { Exercise } from '../../types';
import type { ScheduledExercise } from '../../types/workoutStudio';

interface Props {
  exercises: Exercise[];
  recommendations: Exercise[];
  unscheduled: ScheduledExercise[];
  query: string;
  muscleGroup: string;
  level: string;
  muscleGroups: string[];
  activeDay?: number;
  onQueryChange: (value: string) => void;
  onMuscleGroupChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onPlace: (exercise: Exercise) => void;
  onPlaceUnscheduled: (item: ScheduledExercise) => void;
  onClose?: () => void;
}

export default function ExercisePalette(props: Props) {
  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'BEGINNER': return 'Cơ bản';
      case 'INTERMEDIATE': return 'Trung cấp';
      case 'ADVANCED': return 'Nâng cao';
      default: return level;
    }
  };

  const getLevelClass = (level: string) => {
    switch (level) {
      case 'BEGINNER': return 'is-beginner';
      case 'INTERMEDIATE': return 'is-intermediate';
      case 'ADVANCED': return 'is-advanced';
      default: return 'is-neutral';
    }
  };

  return (
    <aside role="search" aria-label="Tìm bài tập trong Studio" className="studio-palette">
      {/* Header */}
      <div className="studio-palette-header">
        <div className="studio-palette-heading">
          <div className="studio-palette-icon">
            <Dumbbell aria-hidden="true" />
          </div>
          <div>
            <h2>Thư viện bài tập</h2>
          </div>
        </div>
        <span className="studio-palette-count">
          {props.exercises.length}
        </span>
      </div>

      {/* Filter and Search controls */}
      <div className="studio-palette-controls">
        <div className="studio-palette-search">
          <Search className="studio-palette-search-icon" aria-hidden="true" />
          <input
            aria-label="Tìm bài tập"
            placeholder="Tìm theo tên bài tập..."
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
          />
        </div>

        <div className="studio-palette-filters">
          <div className="studio-palette-filter">
            <select
              aria-label="Lọc nhóm cơ"
              value={props.muscleGroup}
              onChange={(event) => props.onMuscleGroupChange(event.target.value)}
            >
              <option value="">Tất cả nhóm cơ</option>
              {props.muscleGroups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
            <Layers className="studio-palette-filter-icon" aria-hidden="true" />
          </div>

          <div className="studio-palette-filter">
            <select
              aria-label="Lọc cấp độ bài tập"
              value={props.level}
              onChange={(event) => props.onLevelChange(event.target.value)}
            >
              <option value="">Tất cả cấp độ</option>
              <option value="BEGINNER">Cơ bản</option>
              <option value="INTERMEDIATE">Trung cấp</option>
              <option value="ADVANCED">Nâng cao</option>
            </select>
            <Award className="studio-palette-filter-icon" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Main Scrollable Area */}
      <div className="studio-palette-scroll">
        {/* Regular Exercises */}
        <div className="studio-exercise-list">
          {props.exercises.length === 0 ? (
            <div className="module-empty studio-palette-empty">
              Không tìm thấy bài tập nào
            </div>
          ) : (
            props.exercises.map((exercise) => (
              <div
                draggable
                onDragStart={(event) => event.dataTransfer.setData('exerciseId', exercise._id)}
                key={exercise._id}
                className="studio-exercise-option"
              >
                <div className="studio-exercise-main">
                  <GripVertical className="studio-drag-handle" aria-hidden="true" />
                  <div className="studio-exercise-copy">
                    <p className="studio-exercise-name">{exercise.name}</p>
                    <div className="studio-exercise-badges">
                      <span className="studio-exercise-badge">{exercise.muscleGroup}</span>
                      {exercise.level && (
                        <span className={`studio-exercise-badge ${getLevelClass(exercise.level)}`}>
                          {getLevelLabel(exercise.level)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => props.onPlace(exercise)}
                  aria-label={`Thêm bài ${exercise.name}`}
                  className="studio-add-button"
                >
                  <Plus aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Unscheduled List */}
        {props.unscheduled.length > 0 && (
          <section className="studio-palette-section is-unscheduled">
            <h3 className="studio-palette-section-heading">
              <span className="studio-unscheduled-dot"></span>
              Chưa xếp lịch
            </h3>
            <div className="studio-exercise-list">
              {props.unscheduled.map((item) => (
                <div
                  key={item.id}
                  className="studio-exercise-option is-unscheduled"
                >
                  <span className="studio-exercise-name">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => props.onPlaceUnscheduled(item)}
                    aria-label={`Xếp lịch bài ${item.name}`}
                    className="studio-add-button is-danger"
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
