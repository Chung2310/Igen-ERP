import type { MarketingAutomationType } from "../api/marketing.api";
import { MARKETING_VARIABLE_REGISTRY, getVariablesForType } from "./marketingVariableRegistry";

type Props = {
  automationType: MarketingAutomationType;
  disabled: boolean;
  activeTarget: "subject" | "html";
  onInsert: (key: string) => void;
};

export default function MarketingVariablePalette({ automationType, disabled, activeTarget, onInsert }: Props) {
  return (
    <div className="mt-2 rounded-xl bg-slate-50 p-2">
      <p className="text-[11px] font-semibold text-slate-500">
        Kéo thả hoặc bấm để chèn thẻ thông tin vào {activeTarget === "subject" ? "tiêu đề" : "nội dung"}:
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {getVariablesForType(automationType).map((key) => (
          <button
            key={key}
            type="button"
            draggable={!disabled}
            disabled={disabled}
            onClick={() => onInsert(key)}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/marketing-variable", key);
              event.dataTransfer.effectAllowed = "copy";
            }}
            title={`Ví dụ: ${MARKETING_VARIABLE_REGISTRY[key].sample}`}
            className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
          >
            {MARKETING_VARIABLE_REGISTRY[key].label}
          </button>
        ))}
      </div>
    </div>
  );
}
