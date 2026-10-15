import React from "react";

interface DashboardSectionCardProps {
  title: string;
  icon: React.ElementType;
  gradientFrom: string;
  gradientTo: string;
  children: React.ReactNode;
  charts?: React.ReactNode;
}

export function DashboardSectionCard({
  title,
  icon: Icon,
  gradientFrom,
  gradientTo,
  children,
  charts,
}: DashboardSectionCardProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white shadow-sm`}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
          {title}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {children}
      </div>
      {charts && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{charts}</div>}
    </div>
  );
}
