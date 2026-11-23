import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { ErpModal } from "../../components/common/ErpModal";
import type { GymRecord } from "../../../shared/gym/types";
import { Dropdown } from "./GymDropdown";
import { GymEmptyState, primary } from "./ui";

export default function WorkoutLibraryModal({ exercises, recommendations, day, onPlace, onClose }: {
  exercises: GymRecord[]; recommendations: GymRecord[]; day: number;
  onPlace: (exercise: GymRecord) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("");
  const [level, setLevel] = useState("");
  const groups = useMemo(() => [...new Set(exercises.map(item => String(item.muscleGroup || "")).filter(Boolean))].sort(), [exercises]);
  const filtered = useMemo(() => exercises.filter(item =>
    (!search || String(item.name).toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")))
    && (!muscle || item.muscleGroup === muscle) && (!level || item.level === level)), [exercises, search, muscle, level]);
  const add = (exercise: GymRecord) => { onPlace(exercise); onClose(); };
  return <ErpModal native title="Thư viện bài tập" onClose={onClose} maxWidth="max-w-2xl">
    <div className="space-y-3">
      <p className="text-xs text-on-surface-variant">Chọn bài tập để thêm vào Ngày {day}</p>
      <div className="relative"><Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" /><input autoFocus aria-label="Tìm bài tập trong thư viện" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm bài tập theo tên..." className="w-full rounded-md border border-outline-variant bg-surface-container-lowest py-2 pl-8 pr-2 text-sm text-on-surface focus:border-primary focus:outline-none" /></div>
      <div className="grid gap-2 sm:grid-cols-2"><Dropdown aria-label="Nhóm cơ" className="w-full" value={muscle} onChange={setMuscle} options={[{ value: "", label: `Tất cả nhóm cơ (${exercises.length})` }, ...groups.map(group => ({ value: group, label: group }))]} /><Dropdown aria-label="Độ khó" className="w-full" value={level} onChange={setLevel} options={[{ value: "", label: "Tất cả độ khó" }, { value: "BEGINNER", label: "Cơ bản" }, { value: "INTERMEDIATE", label: "Trung cấp" }, { value: "ADVANCED", label: "Nâng cao" }]} /></div>
      {!search && !muscle && !level && recommendations.length > 0 && <section className="space-y-1.5"><h3 className="text-sm font-semibold">Bài tập gợi ý</h3><div className="flex flex-wrap gap-1.5">{recommendations.map(item => <button key={item._id} type="button" className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs text-primary hover:bg-primary/10" onClick={() => add(item)}>{item.name} +</button>)}</div></section>}
      <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">{filtered.length ? filtered.map(exercise => <div key={exercise._id} className="flex items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-lowest p-2.5"><div className="min-w-0"><p className="text-xs text-on-surface-variant">{exercise.muscleGroup || "Toàn thân"} · {exercise.level || "Cơ bản"} · {exercise.defaultTrackingType || "STRENGTH"}</p><strong className="text-sm text-on-surface">{exercise.name}</strong></div><button type="button" className={primary} onClick={() => add(exercise)} aria-label={`Thêm ${exercise.name} vào Ngày ${day}`}><Plus className="size-3.5" /> Ngày {day}</button></div>) : <GymEmptyState kind="training" filtered={Boolean(search || muscle || level)} title={search || muscle || level ? "Không tìm thấy bài tập phù hợp." : "Chưa có bài tập trong thư viện."} />}</div>
    </div>
  </ErpModal>;
}
