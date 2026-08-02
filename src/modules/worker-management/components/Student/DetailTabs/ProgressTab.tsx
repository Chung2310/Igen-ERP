import React from "react";
import { motion } from "motion/react";
import { Check, Loader2, Save, Sparkles, Trophy } from "lucide-react";
import { Student } from "../../../types";
import { cn, toInputDate, toDisplayDate } from "../../../lib/utils";
import { useEntityLabel } from "../../../hooks/useEntityLabel";

export interface ProgressData {
  theory: { completed: boolean; score: number; lastDate: string };
  sim: { completed: boolean; lastDate: string };
  cabin: { hoursDone: number; totalHours: number };
  dat: { kmDone: number; totalKm: number };
  practice: { hoursDone: number; totalHours: number };
}

interface ProgressTabProps {
  student: Student;
  progressData: ProgressData;
  setProgressData: React.Dispatch<React.SetStateAction<ProgressData>>;
  isEditingProgress: boolean;
  setIsEditingProgress: (val: boolean) => void;
  isUpdatingProgress: boolean;
  handleUpdateProgress: () => Promise<void>;
}

export function ProgressTab({
  student,
  progressData,
  setProgressData,
  isEditingProgress,
  setIsEditingProgress,
  isUpdatingProgress,
  handleUpdateProgress,
}: ProgressTabProps) {
  const entityLabel = useEntityLabel();
  const todayStr = React.useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Tiến độ đào tạo</h3>
          <p className="text-slate-500 text-sm mt-1">
            Cập nhật và theo dõi các cột mốc học tập của {entityLabel.singular}.
          </p>
        </div>
        <button
          onClick={() => {
            if (isEditingProgress) {
              handleUpdateProgress();
            } else {
              setIsEditingProgress(true);
            }
          }}
          disabled={isUpdatingProgress}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95",
            isEditingProgress
              ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"
              : "bg-slate-900 text-white hover:bg-slate-800",
          )}
        >
          {isUpdatingProgress ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isEditingProgress ? (
            <>
              <Save className="w-4 h-4" /> Lưu tiến độ
            </>
          ) : (
            "Cập nhật tiến độ"
          )}
        </button>
      </div>

      {/* Procedural Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Phase 1: Foundation */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Giai đoạn 1: Đào tạo cơ bản
            </h4>
          </div>

          <ProgressControlCard
            label="Lý thuyết & Pháp luật"
            isEditing={isEditingProgress}
            checked={progressData.theory.completed}
            onCheck={() =>
              setProgressData((p) => ({
                ...p,
                theory: { ...p.theory, completed: !p.theory.completed },
              }))
            }
            info={
              isEditingProgress ? (
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    placeholder="Điểm"
                    value={progressData.theory.score}
                    onChange={(e) =>
                      setProgressData((p) => ({
                        ...p,
                        theory: {
                          ...p.theory,
                          score: parseInt(e.target.value) || 0,
                        },
                      }))
                    }
                    className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 shrink-0"
                  />
                  <input
                    type="date"
                    max={todayStr}
                    value={toInputDate(progressData.theory.lastDate)}
                    onChange={(e) =>
                      setProgressData((p) => ({
                        ...p,
                        theory: { ...p.theory, lastDate: e.target.value },
                      }))
                    }
                    className="flex-1 min-w-0 relative px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  />
                </div>
              ) : progressData.theory.completed ? (
                `Đạt ${progressData.theory.score}đ • ${toDisplayDate(progressData.theory.lastDate)}`
              ) : (
                "Chưa hoàn thành"
              )
            }
          />

          <ProgressControlCard
            label="Ôn tập Mô phỏng (Sim)"
            isEditing={isEditingProgress}
            checked={progressData.sim.completed}
            onCheck={() =>
              setProgressData((p) => ({
                ...p,
                sim: { ...p.sim, completed: !p.sim.completed },
              }))
            }
            info={
              isEditingProgress ? (
                <input
                  type="date"
                  max={todayStr}
                  value={toInputDate(progressData.sim.lastDate)}
                  onChange={(e) =>
                    setProgressData((p) => ({
                      ...p,
                      sim: { ...p.sim, lastDate: e.target.value },
                    }))
                  }
                  className="w-full mt-2 relative px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
              ) : progressData.sim.completed ? (
                `Cập nhật: ${toDisplayDate(progressData.sim.lastDate)}`
              ) : (
                "Cần ôn 120 tình huống"
              )
            }
          />
        </div>

        {/* Phase 2: Practical */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Giai đoạn 2: Kỹ năng lái xe
            </h4>
          </div>

          <ProgressControlCard
            label="Học Cabin điện tử"
            isEditing={isEditingProgress}
            progress={{
              current: progressData.cabin.hoursDone,
              total: progressData.cabin.totalHours,
              unit: "h",
            }}
            onValueChange={(val) =>
              setProgressData((p) => ({
                ...p,
                cabin: { ...p.cabin, hoursDone: val },
              }))
            }
          />

          <ProgressControlCard
            label="Đường trường (DAT)"
            isEditing={isEditingProgress}
            progress={{
              current: progressData.dat.kmDone,
              total: progressData.dat.totalKm,
              unit: "km",
            }}
            onValueChange={(val) =>
              setProgressData((p) => ({ ...p, dat: { ...p.dat, kmDone: val } }))
            }
          />
        </div>

        {/* Phase 3: Advanced */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Giai đoạn 3: Sa hình & Tốt nghiệp
            </h4>
          </div>

          <ProgressControlCard
            label="Thực hành Sa hình"
            isEditing={isEditingProgress}
            progress={{
              current: progressData.practice.hoursDone,
              total: progressData.practice.totalHours,
              unit: "h",
            }}
            onValueChange={(val) =>
              setProgressData((p) => ({
                ...p,
                practice: { ...p.practice, hoursDone: val },
              }))
            }
          />

          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col items-center justify-center text-center">
            <Trophy className="w-8 h-8 text-slate-300 mb-3" />
            <h5 className="text-sm font-bold text-slate-700">
              Chứng chỉ Tốt nghiệp
            </h5>
            <p className="text-[10px] text-slate-400 mt-1">
              Tự động kích hoạt khi {entityLabel.singular} hoàn thành mọi hạng
              mục đào tạo.
            </p>
          </div>
        </div>

        {/* AI Suggestions for Progress */}
        <div className="bg-cyan-600 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 group-hover:scale-110 transition-transform">
            <Sparkles className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10">
            <h4 className="text-white font-bold mb-2">
              Đề xuất lộ trình tiếp theo
            </h4>
            <p className="text-cyan-100 text-xs leading-relaxed opacity-80 mb-6">
              {(
                Array.isArray(student.status)
                  ? student.status.includes("Đang học")
                  : student.status === "Đang học"
              )
                ? `Dựa trên tiến độ hiện tại, ${entityLabel.singular} cần tập trung chạy đủ km DAT để kịp tiến độ khóa thi tháng sau.`
                : "Vui lòng hoàn tất khám sức khỏe để nộp hồ sơ đăng ký thi."}
            </p>
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest backdrop-blur-md transition-all">
              Xem chi tiết đề xuất
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProgressControlCardProps {
  label: string;
  isEditing: boolean;
  checked?: boolean;
  onCheck?: () => void;
  info?: React.ReactNode;
  progress?: { current: number; total: number; unit?: string };
  onValueChange?: (val: number) => void;
}

function ProgressControlCard({
  label,
  isEditing,
  checked,
  onCheck,
  info,
  progress,
  onValueChange,
}: ProgressControlCardProps) {
  const percent = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
      {progress && (
        <div className="absolute bottom-0 left-0 h-1 bg-slate-50 w-full">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            className={cn(
              "h-full transition-all duration-1000",
              percent >= 100 ? "bg-emerald-500" : "bg-cyan-500",
            )}
          />
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {checked !== undefined && (
              <button
                onClick={onCheck}
                disabled={!isEditing}
                className={cn(
                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                  checked
                    ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100"
                    : "bg-white border-slate-200",
                )}
              >
                {checked && <Check className="w-4 h-4" />}
              </button>
            )}
            <div>
              <p className="text-sm font-bold text-slate-800">{label}</p>
              {info && !isEditing && (
                <p className="text-xs text-slate-400 mt-0.5">{info}</p>
              )}
            </div>
          </div>

          {(info || isEditing) && isEditing && (
            <div className="mt-4">{info}</div>
          )}

          {progress && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {isEditing
                    ? `Tổng yêu cầu: ${progress.total}${progress.unit}`
                    : `Tiến độ: ${Math.round(percent)}%`}
                </p>
                <p className="text-sm font-black text-slate-800">
                  {progress.current}/{progress.total}
                  {progress.unit}
                </p>
              </div>

              {isEditing && (
                <input
                  type="range"
                  min="0"
                  max={progress.total}
                  value={progress.current}
                  onChange={(e) => onValueChange?.(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                />
              )}
            </div>
          )}
        </div>

        {!isEditing && progress && percent >= 100 && (
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Check className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
