import { Languages, UserRound } from "lucide-react";
import { HEYGEN_THEME } from "./heygenTheme";

export type HeyGenTab = "avatar" | "captions";

interface HeyGenVerticalToolbarProps {
  activeTab: HeyGenTab;
  onChangeTab: (tab: HeyGenTab) => void;
}

const TABS = [
  { id: "avatar", label: "Avatar", icon: UserRound },
  { id: "captions", label: "Captions", icon: Languages },
] as const;

export function HeyGenVerticalToolbar({ activeTab, onChangeTab }: HeyGenVerticalToolbarProps) {
  return (
    <div className={`flex h-full w-16 shrink-0 flex-col items-center border-l ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface} py-3 text-on-surface-variant`}>
      <div className="flex w-full flex-col gap-1.5 px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`group relative flex w-full flex-col items-center justify-center gap-1 rounded-lg py-2.5 transition-colors duration-150 cursor-pointer ${isActive ? "bg-primary/10 font-medium text-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"}`}
              title={tab.label}
            >
              {isActive ? <div className="absolute left-0 top-1/4 h-1/2 w-0.5 rounded-r bg-primary" /> : null}
              <Icon className="size-4" aria-hidden="true" />
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
