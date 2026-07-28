import { Users, Stethoscope, CheckCircle2, FolderIcon, BookOpen, GraduationCap, Trophy, RotateCcw, Wallet, UserX, UserCheck } from 'lucide-react';
import { LuxuryCard } from '../ui/LuxuryCard';
import { useStudents } from '../../hooks/useStudents';
import { useAuth } from '../../../../context/AuthContext';
import { useEntityLabel } from '../../hooks/useEntityLabel';

export function StatsGrid({ selectedCenter }: { selectedCenter?: string }) {
  const { students, loading } = useStudents(selectedCenter === 'all' ? undefined : selectedCenter);
  const { userProfile: user } = useAuth();
  const entityLabel = useEntityLabel();
  const totalLabel = `Tổng ${entityLabel.singular}`;

  const mockStats = [
    { label: totalLabel, value: 15, icon: Users, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
    { label: 'Chờ KSK', value: 2, icon: Stethoscope, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Đã KSK', value: 2, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Đã nộp HS', value: 2, icon: FolderIcon, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    { label: 'Đang học', value: 4, icon: BookOpen, color: 'text-sky-500', bg: 'bg-sky-50' },
    { label: 'Đang thi', value: 2, icon: GraduationCap, color: 'text-teal-500', bg: 'bg-teal-50' },
    { label: 'Đã đậu', value: 1, icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Thi lại', value: 1, icon: RotateCcw, color: 'text-rose-500', bg: 'bg-rose-50' },
    { label: 'Nghỉ học', value: 0, icon: UserX, color: 'text-slate-500', bg: 'bg-slate-100' },
    { label: 'Còn nợ học phí', value: 15, icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  // Trạng thái riêng quy trình lái xe
  const DRIVING_STATS = ['Chờ KSK', 'Đã KSK', 'Đã nộp HS'];

  const getRealStats = () => {
    if (!user) return mockStats;

    const hasStatus = (s: (typeof students)[number], st: string) =>
      Array.isArray(s.status) ? s.status.includes(st as (typeof s.status)[number]) : s.status === st;

    if (entityLabel.preset === 'worker') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);

      const newWorkersCount = students.filter(s => {
        if (!s.registrationDate) return false;
        const parts = s.registrationDate.split('/').map(Number);
        if (parts.length < 3) return false;
        const regDate = new Date(parts[2], parts[1] - 1, parts[0]);
        return regDate >= thirtyDaysAgo;
      }).length;

      return [
        { label: 'Tổng lao động', value: students.length, icon: Users, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
        { label: 'Mới đăng ký (30 ngày)', value: newWorkersCount, icon: BookOpen, color: 'text-sky-500', bg: 'bg-sky-50' },
        { label: 'Đã tiếp nhận / Đi làm', value: students.filter(s => hasStatus(s, 'Đã đậu') || hasStatus(s, 'Đang học')).length, icon: UserCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      ];
    }

    const statsMap: Record<string, number> = {
      [totalLabel]: students.length,
      'Chờ KSK': students.filter(s => hasStatus(s, 'Chờ KSK')).length,
      'Đã KSK': students.filter(s => hasStatus(s, 'Đã KSK')).length,
      'Đã nộp HS': students.filter(s => hasStatus(s, 'Đã nộp HS')).length,
      'Đang học': students.filter(s => hasStatus(s, 'Đang học')).length,
      'Đang thi': students.filter(s => hasStatus(s, 'Đang thi')).length,
      'Đã đậu': students.filter(s => hasStatus(s, 'Đã đậu')).length,
      'Thi lại': students.filter(s => hasStatus(s, 'Thi lại')).length,
      'Nghỉ học': students.filter(s => hasStatus(s, 'Nghỉ học')).length,
      'Còn nợ học phí': students.filter(s => hasStatus(s, 'Nợ học phí')).length,
    };

    const isDriving = false;

    return mockStats
      .map(stat => ({
        ...stat,
        value: statsMap[stat.label as keyof typeof statsMap] ?? 0
      }))
      .filter(stat => {
        // Chỉ hiển thị các trạng thái lái xe khi cơ sở là đào tạo lái xe
        if (DRIVING_STATS.includes(stat.label)) {
          return isDriving;
        }
        if (entityLabel.preset !== "student") {
          const nonStudentHiddenStats = ["Đang học", "Đang thi", "Đã đậu", "Thi lại", "Nghỉ học", "Còn nợ học phí"];
          if (nonStudentHiddenStats.includes(stat.label)) return false;
        }
        return true;
      });
  };

  const displayStats = getRealStats();
  const count = displayStats.length;

  const getLayoutConfig = () => {
    switch (count) {
      case 7:
        return {
          gridClass: "grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4",
          getItemClass: (idx: number) => idx === 6 ? "col-span-2 md:col-span-1" : ""
        };
      case 8:
        return {
          gridClass: "grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4",
          getItemClass: () => ""
        };
      case 9:
        return {
          gridClass: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4",
          getItemClass: (idx: number) => idx === 8 ? "col-span-2 md:col-span-1 lg:col-span-1" : ""
        };
      case 10:
        return {
          gridClass: "grid grid-cols-2 md:grid-cols-5 gap-4",
          getItemClass: () => ""
        };
      default:
        return {
          gridClass: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4",
          getItemClass: () => ""
        };
    }
  };

  const { gridClass, getItemClass } = getLayoutConfig();

  return (
    <div className={gridClass}>
      {displayStats.map((stat, idx) => (
        <LuxuryCard
          key={idx}
          padding="none"
          className={`p-2.5 px-3 flex items-center gap-2.5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer border border-slate-200 ${getItemClass(idx)}`}
        >
          <div className={`p-2 rounded-lg ${stat.bg} ${stat.color} transition-transform duration-300 group-hover:scale-110 shrink-0`}>
            <stat.icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 leading-tight tracking-tight">
              {loading && user ? '...' : stat.value}
            </p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-slate-700 transition-colors">
              {stat.label}
            </p>
          </div>
        </LuxuryCard>
      ))}
    </div>
  );
}
