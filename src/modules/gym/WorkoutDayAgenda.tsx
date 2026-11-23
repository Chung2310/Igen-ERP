import { Pencil, Plus, Trash2 } from "lucide-react";
import { GymEmptyState, primary, secondary } from "./ui";

export type AgendaItem = {
  key: string; name: string; muscleGroup?: string; trackingType: string;
  durationMinutes: number; startMinute?: number;
  prescription: Record<string, string | number>;
};
const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const trackingLabel: Record<string, string> = { STRENGTH: "Tạ / Kháng lực", BODYWEIGHT: "Bodyweight", CARDIO: "Cardio", INTERVAL: "Interval", MOBILITY: "Giãn cơ" };
const details = (item: AgendaItem) => {
  const p = item.prescription || {};
  return [
    p.sets !== undefined && `${p.sets} hiệp`,
    p.reps !== undefined && `${p.reps} reps`,
    (p.targetWeight ?? p.addedWeight) !== undefined && `${p.targetWeight ?? p.addedWeight} kg`,
    p.restSeconds !== undefined && `Nghỉ ${p.restSeconds}s`,
    p.targetRpe !== undefined && `RPE ${p.targetRpe}`,
    p.rounds !== undefined && `${p.rounds} vòng`,
    p.durationMinutes !== undefined && item.trackingType === "CARDIO" && `${p.durationMinutes} phút`,
  ].filter(Boolean) as string[];
};

export default function WorkoutDayAgenda({ day, items, onAdd, onEdit, onUnschedule, onRemove }: {
  day: number; items: AgendaItem[]; onAdd: () => void;
  onEdit: (item: AgendaItem) => void; onUnschedule: (item: AgendaItem) => void; onRemove: (item: AgendaItem) => void;
}) {
  if (!items.length) return <div className="flex min-h-52 flex-col items-center justify-center rounded-md border border-dashed border-outline-variant bg-surface-container-lowest text-center"><GymEmptyState kind="training" title={`Chưa có bài tập cho Ngày ${day}`} /><p className="text-xs text-on-surface-variant">Chọn bài từ thư viện hoặc xếp bài chưa có lịch.</p><button type="button" className={primary} onClick={onAdd}><Plus className="size-4" aria-hidden="true" /> Thêm bài tập vào Ngày {day}</button></div>;
  return <div className="space-y-2">{[...items].sort((a, b) => (a.startMinute || 0) - (b.startMinute || 0)).map(item => {
    const start = item.startMinute || 0;
    return <article key={item.key} className="flex flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3"><div className="min-w-14 rounded-md bg-surface-container-low px-2 py-1.5 text-center text-xs tabular-nums"><strong className="block">{clock(start)}</strong><span className="text-on-surface-variant">{item.durationMinutes}p</span></div><div className="min-w-0"><p className="flex flex-wrap gap-1.5 text-xs text-on-surface-variant"><span>{trackingLabel[item.trackingType] || item.trackingType}</span>{item.muscleGroup && <span>· {item.muscleGroup}</span>}<span>· {clock(start)}–{clock(start + item.durationMinutes)}</span></p><h3 className="truncate text-sm font-semibold text-on-surface">{item.name}</h3><div className="mt-1 flex flex-wrap gap-1">{details(item).length ? details(item).map((value, index) => <span key={index} className="rounded border border-outline-variant bg-surface-container-low px-1.5 py-0.5 text-xs text-on-surface-variant">{value}</span>) : <span className="text-xs text-on-surface-variant">Chưa cài đặt thông số hiệp/lần</span>}</div></div></div>
      <div className="flex shrink-0 gap-1.5"><button type="button" className={secondary} onClick={() => onEdit(item)} aria-label={`Sửa ${item.name}`}><Pencil className="size-4" /> Sửa</button><button type="button" className={secondary} onClick={() => onUnschedule(item)}>Chưa xếp</button><button type="button" className={secondary} onClick={() => onRemove(item)} aria-label={`Xóa ${item.name}`}><Trash2 className="size-4" /></button></div>
    </article>;
  })}</div>;
}
