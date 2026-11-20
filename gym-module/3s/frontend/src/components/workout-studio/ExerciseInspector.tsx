import { DAY_MINUTES, formatMinute, SLOT_MINUTES, snapMinute } from '../../services/workoutStudioModel';
import type { ScheduledExercise } from '../../types/workoutStudio';
import PrescriptionEditor from '../workouts/tracking/PrescriptionEditor';

interface Props {
  selected?: ScheduledExercise;
  days: number[];
  onUpdate: (patch: Partial<ScheduledExercise>) => void;
  onUnscheduled: () => void;
  readOnly?: boolean;
  onClose?: () => void;
}

export default function ExerciseInspector({ selected, days, onUpdate, onUnscheduled, readOnly, onClose }: Props) {
  if (!selected) {
    return (
      <div className="studio-inspector-empty">
        <h2>Lịch bài tập</h2>
        <p>Chọn một bài tập từ lịch tập để chỉnh sửa thuộc tính.</p>
        {onClose && (
          <button
            type="button"
            className="button button-secondary mt-3 min-h-[36px] text-xs font-bold cursor-pointer"
            onClick={onClose}
          >
            Quay lại lịch tập
          </button>
        )}
      </div>
    );
  }

  return (
    <aside className="studio-inspector" aria-label="Thuộc tính bài tập đã chọn">
      <header className="studio-inspector-header">
        <h2>Lịch bài tập</h2>
        <strong title={selected.name}>{selected.name}</strong>
      </header>
      <div className="studio-inspector-fields">
        <label>
          Ngày
          <select
            aria-label="Ngày của bài tập"
            value={selected.dayNumber}
            disabled={readOnly}
            onChange={(event) => onUpdate({ dayNumber: Number(event.target.value) })}
          >
            {days.map((day) => (
              <option key={day} value={day}>
                Ngày {day}
              </option>
            ))}
          </select>
        </label>
        <label>
          Giờ bắt đầu
          <input
            aria-label="Giờ bắt đầu"
            placeholder="Ví dụ: 08:00"
            type="time"
            step="900"
            value={formatMinute(selected.startMinute)}
            disabled={readOnly}
            onChange={(event) => {
              const [hour, minute] = event.target.value.split(':').map(Number);
              onUpdate({ startMinute: snapMinute(hour * 60 + minute) });
            }}
          />
        </label>
      </div>
      <div className="studio-inspector-duration">
        <span>Thời lượng</span>
        <div>
          <button
            type="button"
            aria-label="Giảm thời lượng 15 phút"
            disabled={readOnly || selected.durationMinutes <= SLOT_MINUTES}
            onClick={() => onUpdate({ durationMinutes: selected.durationMinutes - SLOT_MINUTES })}
          >
            −
          </button>
          <input
            aria-label="Thời lượng bài tập"
            placeholder="Ví dụ: 60 phút"
            type="number"
            min="15"
            max="1440"
            step="15"
            value={selected.durationMinutes}
            disabled={readOnly}
            onChange={(event) => onUpdate({ durationMinutes: Number(event.target.value) })}
          />
          <button
            type="button"
            aria-label="Tăng thời lượng 15 phút"
            disabled={readOnly || selected.startMinute + selected.durationMinutes >= DAY_MINUTES}
            onClick={() => onUpdate({ durationMinutes: selected.durationMinutes + SLOT_MINUTES })}
          >
            +
          </button>
        </div>
      </div>
      <div className="studio-inspector-tracking">
        <PrescriptionEditor
          exerciseName={selected.name}
          trackingType={selected.trackingType ?? 'UNCLASSIFIED'}
          value={selected.prescription ?? {}}
          disabled={readOnly}
          onChange={(prescription) => onUpdate({ prescription })}
        />
      </div>
      <div className="mt-4 flex gap-2">
        {onClose && (
          <button
            type="button"
            className="button button-primary flex-1 min-h-[42px] text-xs font-bold cursor-pointer"
            onClick={onClose}
          >
            Xong · Quay lại lịch
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            className="studio-inspector-danger min-h-[42px] cursor-pointer"
            onClick={onUnscheduled}
          >
            Bỏ khỏi lịch
          </button>
        )}
      </div>
    </aside>
  );
}
