import React from 'react';
import { Loader2, Save, Calendar, Trophy, Plus, Trash2 } from 'lucide-react';
import { Student } from '../../../types';
import { cn, toInputDate, toDisplayDate } from '../../../lib/utils';

type StudentExam = NonNullable<Student['exams']>[number];

interface ExamsTabProps {
  examData: StudentExam[];
  setExamData: React.Dispatch<React.SetStateAction<StudentExam[]>>;
  isEditingExams: boolean;
  setIsEditingExams: (val: boolean) => void;
  isUpdatingExams: boolean;
  handleUpdateExams: () => Promise<void>;
}

export function ExamsTab({
  examData,
  setExamData,
  isEditingExams,
  setIsEditingExams,
  isUpdatingExams,
  handleUpdateExams
}: ExamsTabProps) {
  const [focusedInput, setFocusedInput] = React.useState<{ idx: number, field: 'theory' | 'simulation' | 'practice' } | null>(null);
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Lịch sử và Kết quả thi</h3>
          <p className="text-slate-500 text-sm mt-1">Ghi nhận chi tiết kết quả thi Tốt nghiệp và Sát hạch quốc gia.</p>
        </div>
        <div className="flex gap-2">
          {isEditingExams && (
            <button 
              onClick={() => {
                const newExam: StudentExam = {
                  id: `e${Date.now()}`,
                  name: 'Kỳ thi mới',
                  date: new Date().toLocaleDateString('vi-VN'),
                  type: 'Sát hạch',
                  status: 'Sắp thi',
                  result: { theory: 0, practice: 0, simulation: 0, overall: 'Chưa có' }
                };
                setExamData(prev => [...prev, newExam]);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all"
            >
              <Plus className="w-4 h-4" /> Thêm đợt thi
            </button>
          )}
          <button 
            onClick={() => {
              if (isEditingExams) {
                handleUpdateExams();
              } else {
                setIsEditingExams(true);
              }
            }}
            disabled={isUpdatingExams}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95",
              isEditingExams 
                ? "bg-slate-900 text-white hover:bg-black" 
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
            )}
          >
            {isUpdatingExams ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditingExams ? <Save className="w-4 h-4" /> : <Calendar className="w-4 h-4" />)}
            {isEditingExams ? (isUpdatingExams ? "Đang lưu..." : "Lưu kết quả") : "Cập nhật kỳ thi"}
          </button>
        </div>
      </div>

      {/* Summary of Last Result */}
      {!isEditingExams && (
        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 group-hover:scale-110 transition-transform">
            <Trophy className="w-32 h-32" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xl border border-white/20">
              <Trophy className="w-10 h-10 text-cyan-400" />
            </div>
            <div className="text-center md:text-left flex-1">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Kết quả mới nhất</p>
              <h4 className="text-2xl font-black">{examData.length > 0 ? examData[examData.length-1].name : "Chưa có dữ liệu thi"}</h4>
              <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
                {[
                  { label: 'Lý thuyết', val: examData.length > 0 ? `${examData[examData.length-1].result?.theory || '--'}` : '--' },
                  { label: 'Mô phỏng', val: examData.length > 0 ? `${examData[examData.length-1].result?.simulation || '--'}` : '--' },
                  { label: 'Thực hành', val: examData.length > 0 ? `${examData[examData.length-1].result?.practice || '--'}` : '--' }
                ].map((item, i) => (
                  <div key={i} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-center min-w-[100px]">
                    <p className="text-[9px] font-bold text-white/50 uppercase tracking-tight">{item.label}</p>
                    <p className="text-sm font-bold text-white mt-0.5">{item.val}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-8 py-4 bg-emerald-500 rounded-3xl text-center shadow-xl shadow-emerald-500/20">
              <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest">Tổng quát</p>
              <p className="text-xl font-black text-white mt-1">
                {examData.length > 0 ? (examData[examData.length-1].result?.overall || 'CHỜ KQ') : '--'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Exam History List / Editor */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kỳ thi / Ngày</th>
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Loại</th>
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">LT (35đ)</th>
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Sim (50đ)</th>
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Sa hình</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Tổng kết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {examData.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs italic">Chưa ghi nhận lịch sử thi.</td></tr>
              ) : examData.map((exam, idx: number) => (
                <tr key={exam.id || idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    {isEditingExams ? (
                      <div className="space-y-1">
                        <input 
                          className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-800"
                          value={exam.name}
                          placeholder="Tên kỳ thi..."
                          onChange={(e) => {
                            const newExams = [...examData];
                            newExams[idx].name = e.target.value;
                            setExamData(newExams);
                          }}
                        />
                        <input 
                          type="date"
                          className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 relative font-semibold text-slate-800"
                          value={toInputDate(exam.date)}
                          onChange={(e) => {
                            const newExams = [...examData];
                            newExams[idx].date = e.target.value;
                            setExamData(newExams);
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-slate-800">{exam.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{toDisplayDate(exam.date)}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {isEditingExams ? (
                      <select 
                        className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1 py-1"
                        value={exam.type}
                        onChange={(e) => {
                          const newExams = [...examData];
                          newExams[idx].type = e.target.value as 'Tốt nghiệp' | 'Sát hạch';
                          setExamData(newExams);
                        }}
                      >
                        <option value="Tốt nghiệp">Tốt nghiệp</option>
                        <option value="Sát hạch">Sát hạch</option>
                      </select>
                    ) : (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">{exam.type}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {isEditingExams ? (
                      <input 
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9-]*"
                        className="w-12 text-sm font-bold text-center bg-slate-50 border border-slate-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 outline-none rounded-lg px-1 py-1 transition-all"
                        value={
                          focusedInput?.idx === idx && focusedInput?.field === 'theory' && exam.result?.theory === 0
                            ? ''
                            : exam.result?.theory ?? 0
                        }
                        onFocus={(e) => {
                          setFocusedInput({ idx, field: 'theory' });
                          e.target.select();
                        }}
                        onBlur={() => setFocusedInput(null)}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9-]/g, '');
                          const newExams = [...examData];
                          newExams[idx].result.theory = val === '' ? 0 : (parseInt(val) || 0);
                          setExamData(newExams);
                        }}
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-700">{exam.result?.theory || '--'}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {isEditingExams ? (
                      <input 
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9-]*"
                        className="w-12 text-sm font-bold text-center bg-slate-50 border border-slate-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 outline-none rounded-lg px-1 py-1 transition-all"
                        value={
                          focusedInput?.idx === idx && focusedInput?.field === 'simulation' && exam.result?.simulation === 0
                            ? ''
                            : exam.result?.simulation ?? 0
                        }
                        onFocus={(e) => {
                          setFocusedInput({ idx, field: 'simulation' });
                          e.target.select();
                        }}
                        onBlur={() => setFocusedInput(null)}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9-]/g, '');
                          const newExams = [...examData];
                          newExams[idx].result.simulation = val === '' ? 0 : (parseInt(val) || 0);
                          setExamData(newExams);
                        }}
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-700">{exam.result?.simulation || '--'}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {isEditingExams ? (
                      <input 
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9-]*"
                        className="w-12 text-sm font-bold text-center bg-slate-50 border border-slate-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 outline-none rounded-lg px-1 py-1 transition-all"
                        value={
                          focusedInput?.idx === idx && focusedInput?.field === 'practice' && exam.result?.practice === 0
                            ? ''
                            : exam.result?.practice ?? 0
                        }
                        onFocus={(e) => {
                          setFocusedInput({ idx, field: 'practice' });
                          e.target.select();
                        }}
                        onBlur={() => setFocusedInput(null)}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9-]/g, '');
                          const newExams = [...examData];
                          newExams[idx].result.practice = val === '' ? 0 : (parseInt(val) || 0);
                          setExamData(newExams);
                        }}
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-700">{exam.result?.practice || '--'}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditingExams ? (
                      <div className="flex items-center justify-end gap-2">
                        <select 
                          className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1 py-1"
                          value={exam.result?.overall}
                          onChange={(e) => {
                            const newExams = [...examData];
                            if (newExams[idx].result) {
                              newExams[idx].result.overall = e.target.value as 'Đậu' | 'Trượt' | 'Chưa có' | 'Sắp thi' | 'Vắng thi';
                            }
                            setExamData(newExams);
                          }}
                        >
                          <option value="Đậu">Đậu</option>
                          <option value="Trượt">Trượt</option>
                          <option value="Sắp thi">Sắp thi</option>
                          <option value="Vắng thi">Vắng thi</option>
                        </select>
                        <button 
                          onClick={() => {
                            setExamData(prev => prev.filter((_, i) => i !== idx));
                          }}
                          title="Xóa"
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        exam.result?.overall === 'Đậu' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                        exam.result?.overall === 'Chưa có' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                        "bg-rose-50 text-rose-600 border border-rose-100"
                      )}>
                        {exam.result?.overall || 'CHỜ KQ'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
