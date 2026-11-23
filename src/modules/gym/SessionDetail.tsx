import { Camera, Dumbbell, PenLine, Scale } from "lucide-react";
import type { GymRecord } from "../../../shared/gym/types";
import { panel } from "./ui";

const attendanceLabels: Record<string, string> = { PRESENT: "Có mặt", ABSENT: "Vắng", LATE: "Đi muộn" };
const resultLabels: Record<string, string> = {
  durationMinutes: "Thời lượng (phút)", distanceKm: "Quãng đường (km)", paceSecondsPerKm: "Pace (giây/km)",
  averageHeartRate: "Nhịp tim trung bình", inclinePercent: "Độ dốc (%)", calories: "Calories", rpe: "RPE",
  rounds: "Số vòng", workSeconds: "Thời gian làm (giây)", restSeconds: "Thời gian nghỉ (giây)",
  distanceMetersPerRound: "Quãng đường/vòng (m)", repsPerRound: "REPS/vòng", reps: "REPS", side: "Bên tập", discomfort: "Mức khó chịu",
};
const measurementLabels: Record<string, string> = {
  weight: "Cân nặng (kg)", bodyFatPercentage: "Tỷ lệ mỡ (%)", muscleMass: "Khối lượng cơ (kg)", chest: "Vòng ngực (cm)",
  waist: "Vòng eo (cm)", hip: "Vòng hông (cm)", arm: "Vòng tay (cm)", thigh: "Vòng đùi (cm)", calf: "Bắp chân (cm)",
};

export default function SessionDetail({ session }: { session: GymRecord }) {
  const dateTime = session.performedAt && Number.isFinite(Date.parse(session.performedAt))
    ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(session.performedAt))
    : "—";
  return <div className="space-y-4">
    <div className="grid gap-3 rounded-md border border-outline-variant bg-surface-container-low p-4 text-sm sm:grid-cols-3">
      <div><span className="block text-xs text-on-surface-variant">Giáo án & ca tập</span><strong>{session.planSnapshot?.title || "Giáo án"}</strong><span className="block text-xs text-on-surface-variant">{session.planSnapshot?.session?.title || ""}</span></div>
      <div><span className="block text-xs text-on-surface-variant">Thời gian tập</span><strong>{dateTime}</strong></div>
      <div><span className="block text-xs text-on-surface-variant">Điểm danh</span><strong>{attendanceLabels[session.attendance] || session.attendance}</strong>{session.absenceReason && <span className="block text-xs text-on-surface-variant">{session.absenceReason}</span>}</div>
    </div>
    <section className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><Dumbbell className="size-4 text-primary" aria-hidden="true" />Kết quả bài tập ({session.exerciseLogs?.length || 0})</h3>
      {(session.exerciseLogs || []).map((exercise: GymRecord, index: number) => <div key={`${exercise.exerciseId}-${index}`} className={panel}>
        <h4 className="font-semibold">{index + 1}. {exercise.name}</h4>
        {exercise.result?.sets ? <div className="mt-2 space-y-1">{exercise.result.sets.map((set: GymRecord, setIndex: number) => <p key={setIndex} className="text-sm text-on-surface-variant">Hiệp {setIndex + 1}: {set.reps ?? "—"} reps · {set.weight ?? set.addedWeight ?? "—"} kg · RPE {set.rpe ?? "—"} · RIR {set.rir ?? "—"} · {set.completed === false ? "Chưa hoàn thành" : "Hoàn thành"}</p>)}</div>
          : exercise.result ? <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">{Object.entries(exercise.result).map(([key, value]) => <div key={key}><dt className="text-xs text-on-surface-variant">{resultLabels[key] || key}</dt><dd>{String(value)}</dd></div>)}</dl>
          : <p className="mt-2 text-sm text-on-surface-variant">{exercise.sets ?? "—"} hiệp · {exercise.reps ?? "—"} reps · {exercise.weight ?? "—"} kg</p>}
        {exercise.notes && <p className="mt-2 text-sm">{exercise.notes}</p>}
      </div>)}
    </section>
    {session.bodyMeasurement && <section className="space-y-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Scale className="size-4 text-primary" aria-hidden="true" />Chỉ số đo lường</h3><dl className="grid gap-2 sm:grid-cols-3">{Object.entries(session.bodyMeasurement).map(([key, value]) => <div key={key} className="rounded-md border border-outline-variant p-2"><dt className="text-xs text-on-surface-variant">{measurementLabels[key] || key}</dt><dd className="text-sm font-medium">{String(value)}</dd></div>)}</dl></section>}
    {Boolean(session.progressPhotos?.length) && <section className="space-y-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Camera className="size-4 text-primary" aria-hidden="true" />Ảnh tiến độ</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{session.progressPhotos.map((photo: GymRecord, index: number) => <img key={`${photo.photoUrl}-${index}`} src={photo.photoUrl} alt={`Ảnh tiến độ ${index + 1}`} className="aspect-square w-full rounded-md border border-outline-variant object-cover" />)}</div></section>}
    {(session.feeling || session.notes) && <section className="grid gap-3 sm:grid-cols-2">{session.feeling && <div className={panel}><h3 className="text-xs text-on-surface-variant">Cảm nhận sau buổi tập</h3><p className="mt-1 whitespace-pre-wrap text-sm">{session.feeling}</p></div>}{session.notes && <div className={panel}><h3 className="text-xs text-on-surface-variant">Ghi chú chuyên môn</h3><p className="mt-1 whitespace-pre-wrap text-sm">{session.notes}</p></div>}</section>}
    {session.customerSignature?.signatureUrl && <section className="space-y-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><PenLine className="size-4 text-primary" aria-hidden="true" />Chữ ký xác nhận</h3><div className="rounded-md border border-outline-variant p-3"><img src={session.customerSignature.signatureUrl} alt="Chữ ký khách hàng" className="max-h-40 max-w-full" /><p className="mt-2 text-xs text-on-surface-variant">{session.customerSignature.signerName || "Khách hàng"}</p></div></section>}
  </div>;
}
