import type { TemplateVariableConfig } from "./templateEditorTypes";

export const TEMPLATE_VARIABLE_MIME = "text/template-variable";

type Props = {
  variables: TemplateVariableConfig[];
  disabled: boolean;
  activeTarget: "subject" | "html";
  onInsert: (key: string) => void;
};

export default function TemplateVariablePalette({ variables, disabled, activeTarget, onInsert }: Props) {
  return (
    <div className="mt-2 rounded-xl bg-slate-50 p-2">
      <p className="text-[11px] font-semibold text-slate-500">
        Kéo thả hoặc bấm để chèn thẻ thông tin vào {activeTarget === "subject" ? "tiêu đề" : "nội dung"}:
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {variables.map((variable) => (
          <button
            key={variable.key}
            type="button"
            draggable={!disabled}
            disabled={disabled}
            onClick={() => onInsert(variable.key)}
            onDragStart={(event) => {
              event.dataTransfer.setData(TEMPLATE_VARIABLE_MIME, variable.key);
              event.dataTransfer.effectAllowed = "copy";
            }}
            title={`Ví dụ: ${variable.sample}`}
            className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
          >
            {variable.label}
          </button>
        ))}
      </div>
    </div>
  );
}
