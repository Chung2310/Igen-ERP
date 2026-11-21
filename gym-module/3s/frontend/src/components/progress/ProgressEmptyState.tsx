import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { GymEmptyIllustration, type GymEmptyIllustrationKind } from '../ui/GymEmptyIllustration';

export interface ProgressEmptyStateProps {
  icon?: LucideIcon;
  kind?: GymEmptyIllustrationKind;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function ProgressEmptyState({
  kind = 'progress',
  title,
  description,
  action,
}: ProgressEmptyStateProps) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-md border border-dashed border-[#d8e2f0] bg-white px-6 py-8 text-center">
      <GymEmptyIllustration kind={kind} />
      <h3 className="mt-3 text-sm font-semibold text-[#071629]">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-5 text-[#475569]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
