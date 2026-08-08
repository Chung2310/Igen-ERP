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
    <div className="flex flex-col gap-5 text-left">
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tổng quan</h1>
          <p className="text-slate-400 text-xs font-medium mt-0.5">Hôm nay: {formattedDate}</p>
        </div>
      </section>
      <section><StatsGrid selectedCenter={selectedCenter} /></section>
      <section><WorkerOverviewDashboard onSelectStudent={onSelectStudent} onNavigate={onNavigate} selectedCenter={selectedCenter} /></section>
    </div>
  );
}
