import React from "react";

interface DashboardSectionCardProps {
  title: string;
  icon: React.ElementType;
  gradientFrom: string;
  gradientTo: string;
  children: React.ReactNode;
}

export function DashboardSectionCard({
  title,
  icon: Icon,
  gradientFrom,
  gradientTo,
  children,
}: DashboardSectionCardProps) {
  return (
    <div className="flex flex-col gap-4 bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-3xl p-5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  );
}
