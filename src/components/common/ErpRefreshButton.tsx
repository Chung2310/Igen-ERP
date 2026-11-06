import type { ButtonHTMLAttributes, ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  loading?: boolean;
  iconOnly?: boolean;
};

export function ErpRefreshButton({ children = "Làm mới", loading = false, iconOnly = false, className, disabled, type = "button", ...props }: Props) {
  return <button
    type={type}
    disabled={disabled || loading}
    aria-label={iconOnly ? "Làm mới" : undefined}
    className={cn("inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60", iconOnly && "size-9 px-0", className)}
    {...props}
  >
    <RefreshCw aria-hidden="true" className="size-3.5 text-primary" />
    {!iconOnly && <span>{children}</span>}
  </button>;
}
