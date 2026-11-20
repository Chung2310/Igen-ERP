import type { LucideIcon } from 'lucide-react';

export interface ProgressMetricCardProps {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  iconColor?: string;
  featured?: boolean;
}

export default function ProgressMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  iconColor,
}: ProgressMetricCardProps) {
  return (
    <article className="pt-metric-card">
      <div>
        <div className="pt-metric-label">{label}</div>
        <div className={`pt-metric-val ${iconColor ? `text-[${iconColor}]` : 'text-[#003b70]'}`}>{value}</div>
        <div className="pt-metric-sub text-slate-500">{hint}</div>
      </div>
      <div className={`pt-metric-icon ${iconColor ? '' : 'bg-sky-50 text-sky-600'}`}>
        <Icon size={20} />
      </div>
    </article>
  );
}
