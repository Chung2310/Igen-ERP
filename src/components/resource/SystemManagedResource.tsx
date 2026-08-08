import React from "react";
import { ExternalLink, LockKeyhole } from "lucide-react";
import type { ResourceItem } from "../../types";

export function isSystemManagedResource(item: Pick<ResourceItem, "managedType">): boolean {
  return item.managedType === "system";
}

export function canMutateResourceItem(item: Pick<ResourceItem, "managedType" | "isFixed">): boolean {
  return !item.isFixed && !isSystemManagedResource(item);
}

interface SystemManagedResourceBadgeProps {
  item: Pick<ResourceItem, "managedType" | "sourceEntityLabel" | "sourceRoute">;
  showSourceLink?: boolean;
  compact?: boolean;
}

export const SystemManagedResourceBadge: React.FC<SystemManagedResourceBadgeProps> = ({
  item,
  showSourceLink = false,
  compact = false,
}) => {
  if (!isSystemManagedResource(item)) return null;
  const safeSourceRoute = item.sourceRoute?.startsWith("/") ? item.sourceRoute : "";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "text-[9px]" : "text-[11px]"}`}>
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-600">
        <LockKeyhole className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        Tạo bởi hệ thống
      </span>
      {item.sourceEntityLabel && (
        <span className="max-w-full truncate font-semibold text-slate-500" title={item.sourceEntityLabel}>
          {item.sourceEntityLabel}
        </span>
      )}
      {showSourceLink && safeSourceRoute && (
        <a
          href={safeSourceRoute}
          className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Mở nguồn
        </a>
      )}
    </div>
  );
};
