import type { ElementType } from "react";

export interface Menu3DIconPalette {
  light: string;
  dark: string;
  edge: string;
}

interface Menu3DIconProps {
  icon: ElementType;
  palette: Menu3DIconPalette;
  className?: string;
}

export function Menu3DIcon({ icon: Icon, palette, className }: Menu3DIconProps) {
  return (
    <span aria-hidden="true" className={`relative inline-block shrink-0 transition-transform group-hover:scale-105 ${className ?? ""}`}>
      <span
        className="absolute inset-x-[1px] top-[2px] bottom-0 rounded-[6px]"
        style={{ backgroundColor: palette.edge, boxShadow: "0 2px 3px rgba(31, 41, 55, 0.19)" }}
      />
      <span
        className="absolute inset-x-[1px] top-0 bottom-[3px] rounded-[6px] border border-white/30"
        style={{ backgroundImage: `linear-gradient(145deg, ${palette.light}, ${palette.dark})` }}
      />
      <span className="absolute inset-x-[3px] top-[2px] h-[5px] rounded-t-[4px] bg-white/25" />
      <Icon
        className="absolute left-[4px] top-[3px] h-4 w-4 text-white drop-shadow-[0_1px_1px_rgba(30,20,60,0.55)]"
        strokeWidth={2.2}
      />
    </span>
  );
}
