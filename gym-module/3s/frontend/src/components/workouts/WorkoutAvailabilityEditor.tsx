import type { WorkoutAvailabilitySlot } from '../../types/workoutAvailability';
import {
  minuteLabel,
  weekdayLabel,
} from '../../services/workoutAvailability';

interface Props {
  value: WorkoutAvailabilitySlot[];
  disabled?: boolean;
  onChange(value: WorkoutAvailabilitySlot[]): void;
}

const days = [1, 2, 3, 4, 5, 6, 7];
const startMinuteOptions = Array.from({ length: 96 }, (_, index) => index * 15);
const endMinuteOptions = Array.from({ length: 96 }, (_, index) => (index + 1) * 15);
const sortSlots = (slots: WorkoutAvailabilitySlot[]) => [...slots].sort((left, right) => (
  left.dayNumber - right.dayNumber || left.startMinute - right.startMinute
));

export default function WorkoutAvailabilityEditor({ value, disabled, onChange }: Props) {
  const addSlot = (dayNumber: number) => {
    onChange(sortSlots([...value, { dayNumber, startMinute: 1080, endMinute: 1140 }]));
  };

  const updateSlot = (target: WorkoutAvailabilitySlot, changes: Partial<WorkoutAvailabilitySlot>) => {
    onChange(sortSlots(value.map((slot) => (slot === target ? { ...slot, ...changes } : slot))));
  };

  const removeSlot = (target: WorkoutAvailabilitySlot) => {
    onChange(value.filter((slot) => slot !== target));
  };

  return <section className="workout-availability" aria-labelledby="workout-availability-title">
    <header className="workout-availability-heading">
      <div>
        <h3 id="workout-availability-title">Thời gian rảnh của học viên</h3>
        <p>Lịch này lặp lại mỗi tuần và chỉ dùng cho lần tạo giáo án hiện tại.</p>
      </div>
    </header>
    <div className="workout-availability-days">
      {days.map((dayNumber) => {
        const dayLabel = weekdayLabel(dayNumber);
        const daySlots = value.filter((slot) => slot.dayNumber === dayNumber);
        return <article className="workout-availability-day" key={dayNumber}>
          <div className="workout-availability-day-heading">
            <strong>{dayLabel}</strong>
            <button
              type="button"
              className="workout-availability-add"
              disabled={disabled}
              onClick={() => addSlot(dayNumber)}
            >
              Thêm khung giờ {dayLabel}
            </button>
          </div>
          {daySlots.length === 0
            ? <p className="workout-availability-empty">Chưa có khung giờ</p>
            : <div className="workout-availability-slot-list">
              {daySlots.map((slot, index) => {
                const slotNumber = index + 1;
                return <div className="workout-availability-slot" key={`${dayNumber}-${index}-${slot.startMinute}`}>
                  <label className="module-field">
                    Bắt đầu
                    <select
                      aria-label={`Bắt đầu ${dayLabel}, khung ${slotNumber}`}
                      disabled={disabled}
                      value={slot.startMinute}
                      onChange={(event) => updateSlot(slot, {
                        startMinute: Number(event.target.value),
                      })}
                    >
                      {startMinuteOptions.map((minute) => <option key={minute} value={minute}>
                        {minuteLabel(minute)}
                      </option>)}
                    </select>
                  </label>
                  <span className="workout-availability-separator" aria-hidden="true">đến</span>
                  <label className="module-field">
                    Kết thúc
                    <select
                      aria-label={`Kết thúc ${dayLabel}, khung ${slotNumber}`}
                      disabled={disabled}
                      value={slot.endMinute}
                      onChange={(event) => updateSlot(slot, {
                        endMinute: Number(event.target.value),
                      })}
                    >
                      {endMinuteOptions.map((minute) => <option key={minute} value={minute}>
                        {minuteLabel(minute)}
                      </option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="workout-availability-remove"
                    aria-label={`Xóa khung giờ ${dayLabel}, khung ${slotNumber}`}
                    disabled={disabled}
                    onClick={() => removeSlot(slot)}
                  >
                    Xóa
                  </button>
                </div>;
              })}
            </div>}
        </article>;
      })}
    </div>
  </section>;
}
