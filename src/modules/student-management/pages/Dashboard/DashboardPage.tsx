import React from 'react';
import { StatsGrid } from '../../components/Dashboard/StatsGrid';
import { ScheduleCalendar } from '../../components/Dashboard/ScheduleCalendar';
import { DrivingDashboardTables } from '../../components/Dashboard/DrivingDashboardTables';
import { LuxuryButton } from '../../components/ui/LuxuryButton';
import { Plus } from 'lucide-react';
import { Student } from '../../types';

interface DashboardPageProps {
  formattedDate: string;
  onSelectStudent: (student: Student) => void;
  onNavigate: (view: string) => void;
  selectedCenter?: string;
}

export function DashboardPage({ formattedDate, onSelectStudent, onNavigate, selectedCenter }: DashboardPageProps) {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tổng quan</h1>
          <p className="text-slate-400 text-xs font-medium mt-0.5">Hôm nay: {formattedDate}</p>
        </div>
      </section>
      <section><StatsGrid selectedCenter={selectedCenter} /></section>
      <section><ScheduleCalendar selectedCenter={selectedCenter} /></section>
      <section><DrivingDashboardTables onSelectStudent={onSelectStudent} onNavigate={onNavigate} selectedCenter={selectedCenter} /></section>
    </div>
  );
}
