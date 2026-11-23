import { Field, panel, secondary } from "./ui";

export default function RoadmapEditor({ strategy, phases, onStrategy, onPhases }: {
  strategy: Record<string, any>; phases: any[];
  onStrategy: (value: Record<string, any>) => void; onPhases: (value: any[]) => void;
}) {
  const updateStrategy = (key: string, value: unknown) => onStrategy({ ...strategy, [key]: value });
  const updateNutrition = (key: string, value: unknown) => onStrategy({ ...strategy, nutrition: { ...strategy.nutrition, [key]: value } });
  const updateBudget = (key: string, value: unknown) => onStrategy({ ...strategy, sessionBudget: { ...strategy.sessionBudget, [key]: value } });
  const updatePhase = (index: number, value: any) => onPhases(phases.map((phase, position) => position === index ? value : phase));
  const checkpoints = strategy.checkpoints || [];
  return <div className="space-y-4 border-t border-outline-variant pt-3">
    <section className={panel}>
      <h3 className="mb-3 text-sm font-semibold text-on-surface">Chiến lược huấn luyện & dinh dưỡng</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Tóm tắt mục tiêu" value={strategy.targetSummary || ""} onChange={value => updateStrategy("targetSummary", value)} /></div>
        <Field label="Số tuần ước tính" type="number" min={1} value={strategy.estimatedWeeks ?? ""} onChange={value => updateStrategy("estimatedWeeks", Number(value) || 0)} />
        <Field label="Số buổi mỗi tuần" type="number" min={1} value={strategy.sessionsPerWeek ?? ""} onChange={value => updateStrategy("sessionsPerWeek", Number(value) || 0)} />
        <Field label="Phương pháp tập luyện" multiline value={strategy.trainingMethod || ""} onChange={value => updateStrategy("trainingMethod", value)} />
        <Field label="Lịch tập phân chia" multiline value={strategy.trainingSplit || ""} onChange={value => updateStrategy("trainingSplit", value)} />
        <div className="sm:col-span-2"><Field label="Chiến lược cardio" multiline value={strategy.cardioProtocol || ""} onChange={value => updateStrategy("cardioProtocol", value)} /></div>
      </div>
      <h4 className="my-3 text-xs font-semibold text-on-surface">Phân bổ thời gian mỗi buổi</h4>
      <div className="grid gap-3 sm:grid-cols-4">
        {([["warmupMinutes", "Khởi động (phút)"], ["strengthMinutes", "Tập chính (phút)"], ["cardioMinutes", "Cardio (phút)"], ["cooldownMinutes", "Thả lỏng (phút)"]] as const).map(([key, label]) => <Field key={key} label={label} type="number" min={0} value={strategy.sessionBudget?.[key] ?? ""} onChange={value => updateBudget(key, Number(value) || 0)} />)}
      </div>
      <h4 className="my-3 text-xs font-semibold text-on-surface">Mục tiêu dinh dưỡng & calo hàng ngày</h4>
      <div className="grid gap-3 sm:grid-cols-4">
        {([["bmr", "BMR"], ["tdee", "TDEE"], ["targetCalories", "Calo mục tiêu"], ["calorieDeficitOrSurplus", "Thâm hụt / thặng dư"], ["proteinGrams", "Đạm (g)"], ["carbsGrams", "Carb (g)"], ["fatGrams", "Chất béo (g)"], ["waterLiters", "Nước (L)"]] as const).map(([key, label]) => <Field key={key} label={label} type="number" value={strategy.nutrition?.[key] ?? ""} onChange={value => updateNutrition(key, Number(value) || 0)} />)}
        <div className="sm:col-span-4"><Field label="Lời khuyên dinh dưỡng" multiline value={strategy.nutrition?.advice || ""} onChange={value => updateNutrition("advice", value)} /></div>
      </div>
      <div className="mt-3"><Field label="Các giả định do thiếu dữ liệu" multiline value={(strategy.assumptions || []).join("\n")} onChange={value => updateStrategy("assumptions", value.split("\n").map(item => item.trim()).filter(Boolean))} /></div>
    </section>

    <section className={panel}>
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-on-surface">Các mốc đánh giá</h3><button type="button" className={secondary} onClick={() => updateStrategy("checkpoints", [...checkpoints, { week: (checkpoints.length + 1) * 4, title: "", description: "" }])}>+ Thêm mốc</button></div>
      <div className="space-y-2">{checkpoints.map((checkpoint: any, index: number) => <div key={index} className="grid gap-2 rounded-md border border-outline-variant p-2 sm:grid-cols-[90px_1fr_1fr_auto]"><Field label="Tuần" type="number" min={1} value={checkpoint.week} onChange={value => updateStrategy("checkpoints", checkpoints.map((item: any, position: number) => position === index ? { ...item, week: Number(value) || 1 } : item))} /><Field label="Tiêu đề" value={checkpoint.title} onChange={value => updateStrategy("checkpoints", checkpoints.map((item: any, position: number) => position === index ? { ...item, title: value } : item))} /><Field label="Mô tả" value={checkpoint.description} onChange={value => updateStrategy("checkpoints", checkpoints.map((item: any, position: number) => position === index ? { ...item, description: value } : item))} /><button type="button" className={secondary} onClick={() => updateStrategy("checkpoints", checkpoints.filter((_: any, position: number) => position !== index))}>Xóa</button></div>)}</div>
    </section>

    <section className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-on-surface">Lộ trình phân kỳ ({phases.length} giai đoạn)</h3><button type="button" className={secondary} onClick={() => onPhases([...phases, { order: phases.length + 1, name: "", durationWeeks: 1, goals: [], weeks: [{ week: phases.reduce((sum, item) => sum + Number(item.durationWeeks || 0), 0) + 1, focus: "", sessionTargets: strategy.sessionsPerWeek || 3, sessions: [] }] }])}>+ Thêm giai đoạn</button></div>
      {phases.map((phase, index) => <div key={index} className={`${panel} space-y-3`}><div className="flex items-center justify-between"><strong className="text-sm">Giai đoạn {index + 1}</strong><button type="button" className={secondary} onClick={() => onPhases(phases.filter((_, position) => position !== index).map((item, position) => ({ ...item, order: position + 1 })))}>Xóa giai đoạn</button></div><div className="grid gap-2 sm:grid-cols-3"><Field label="Thứ tự" type="number" min={1} value={phase.order} onChange={value => updatePhase(index, { ...phase, order: Number(value) || 1 })} /><Field label="Tên giai đoạn" required value={phase.name || ""} onChange={value => updatePhase(index, { ...phase, name: value })} /><Field label="Thời lượng (tuần)" type="number" min={1} value={phase.durationWeeks} onChange={value => updatePhase(index, { ...phase, durationWeeks: Number(value) || 1 })} /></div>
        <div><div className="mb-2 flex items-center justify-between"><h4 className="text-xs font-semibold">Mục tiêu giai đoạn</h4><button type="button" className={secondary} onClick={() => updatePhase(index, { ...phase, goals: [...(phase.goals || []), ""] })}>+ Mục tiêu</button></div><div className="space-y-2">{(phase.goals || []).map((goal: string, goalIndex: number) => <div key={goalIndex} className="flex gap-2"><div className="flex-1"><Field label={`Mục tiêu ${goalIndex + 1}`} value={goal} onChange={value => updatePhase(index, { ...phase, goals: phase.goals.map((item: string, position: number) => position === goalIndex ? value : item) })} /></div><button type="button" className={secondary} onClick={() => updatePhase(index, { ...phase, goals: phase.goals.filter((_: string, position: number) => position !== goalIndex) })}>Xóa</button></div>)}</div></div>
        <div><div className="mb-2 flex items-center justify-between"><h4 className="text-xs font-semibold">Chi tiết các tuần huấn luyện</h4><button type="button" className={secondary} onClick={() => updatePhase(index, { ...phase, weeks: [...(phase.weeks || []), { week: Math.max(0, ...phases.flatMap(item => (item.weeks || []).map((week: any) => Number(week.week) || 0))) + 1, focus: "", sessionTargets: strategy.sessionsPerWeek || 3, sessions: [] }], durationWeeks: (phase.weeks || []).length + 1 })}>+ Tuần</button></div><div className="space-y-2">{(phase.weeks || []).map((week: any, weekIndex: number) => <div key={weekIndex} className="grid gap-2 rounded-md border border-outline-variant p-2 sm:grid-cols-[90px_1fr_110px_auto]"><Field label="Tuần" type="number" min={1} value={week.week} onChange={value => updatePhase(index, { ...phase, weeks: phase.weeks.map((item: any, position: number) => position === weekIndex ? { ...item, week: Number(value) || 1 } : item) })} /><Field label="Trọng tâm tuần" required value={week.focus || ""} onChange={value => updatePhase(index, { ...phase, weeks: phase.weeks.map((item: any, position: number) => position === weekIndex ? { ...item, focus: value } : item) })} /><Field label="Buổi mục tiêu" type="number" min={0} value={week.sessionTargets ?? ""} onChange={value => updatePhase(index, { ...phase, weeks: phase.weeks.map((item: any, position: number) => position === weekIndex ? { ...item, sessionTargets: Number(value) || 0 } : item) })} /><button type="button" className={secondary} onClick={() => updatePhase(index, { ...phase, weeks: phase.weeks.filter((_: any, position: number) => position !== weekIndex), durationWeeks: Math.max(1, phase.weeks.length - 1) })}>Xóa</button></div>)}</div></div>
      </div>)}
    </section>
  </div>;
}
