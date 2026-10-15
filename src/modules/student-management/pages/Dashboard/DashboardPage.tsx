import React from 'react';
import { StatsGrid } from '../../components/Dashboard/StatsGrid';
import { WorkerOverviewDashboard } from '../../components/Dashboard/WorkerOverviewDashboard';
import { Student } from '../../types';

interface DashboardPageProps {
  formattedDate: string;
  onSelectStudent: (student: Student) => void;
  onNavigate: (view: string) => void;
  selectedCenter?: string;
}

export function DashboardPage({ formattedDate, onSelectStudent, onNavigate, selectedCenter }: DashboardPageProps) {
  return (
    <div className="flex flex-col gap-5 bg-[#F8FBFF] px-3 py-5 text-left sm:px-5 sm:py-6">
      <section className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="border-l-[3px] border-[#00ADFC] pl-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Tổng quan</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">Hôm nay: {formattedDate}</p>
        </div>
      </section>
      <section><StatsGrid selectedCenter={selectedCenter} /></section>
      <section><WorkerOverviewDashboard onSelectStudent={onSelectStudent} onNavigate={onNavigate} selectedCenter={selectedCenter} /></section>
    </div>
  );
}
