import { Search, Filter, GraduationCap, Phone } from 'lucide-react';
import { Student } from '../../types';
import { LuxuryCard } from '../ui/LuxuryCard';
import { cn, formatVND } from '../../lib/utils';

interface StudentListProps {
  students: Student[];
  onSelectStudent: (student: Student) => void;
}

export function StudentList({ students, onSelectStudent }: StudentListProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Tìm kiếm học viên..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-3 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors shadow-sm">
            <Filter className="w-4 h-4" /> Lọc
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {students.map((student) => {
          return (
            <LuxuryCard
              key={student.id}
              padding="none"
              className="group cursor-pointer hover:border-slate-300 transition-colors bg-white"
              onClick={() => onSelectStudent(student)}
              whileHover={{ y: -4 }}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-all">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[60%] justify-end">
                    {(Array.isArray(student.status) ? student.status : [student.status]).map((st) => (
                      <span
                        key={st}
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm whitespace-nowrap",
                          st === 'Đã đậu' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            st === 'Đang thi' ? "bg-teal-50 text-teal-700 border-teal-100" :
                              st === 'Đang học' ? "bg-sky-50 text-sky-700 border-sky-100" :
                                st === 'Chờ KSK' ? "bg-amber-50 text-amber-700 border-amber-100" :
                                  st === 'Thi lại' ? "bg-rose-50 text-rose-700 border-rose-100" :
                                    st === 'Đã KSK' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                      st === 'Đã nộp HS' ? "bg-cyan-50 text-cyan-700 border-cyan-100" :
                                        st === 'Nợ học phí' ? "bg-orange-50 text-orange-700 border-orange-100" :
                                          "bg-slate-50 text-slate-600 border-slate-100"
                        )}
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    {student.fullName}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> {student.phone}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-50">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-300 tracking-wider mb-0.5">Hạng bằng</p>
                    <p className="text-sm font-bold text-slate-700">{student.rank}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-300 tracking-wider mb-0.5">Ngày sinh</p>
                    <p className="text-sm font-medium text-slate-500">{student.birthday || 'N/A'}</p>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                    ID: {student.idCard?.slice(-4) || 'N/A'}
                  </span>
                  <div className="bg-brand-primary/5 px-2 py-1 rounded-lg">
                    <p className="text-[10px] font-bold text-brand-primary font-mono">{formatVND(student.fee)} VND</p>
                  </div>
                </div>
              </div>
            </LuxuryCard>
          );
        })}
      </div>
    </div>
  );
}
