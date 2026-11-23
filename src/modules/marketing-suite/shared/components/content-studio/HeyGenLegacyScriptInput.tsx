import { HEYGEN_THEME } from "./heygenTheme";

interface HeyGenLegacyScriptInputProps {
  value: string;
  onChange: (val: string) => void;
  title?: string;
  placeholder?: string;
}

export function HeyGenLegacyScriptInput({
  value,
  onChange,
  title = "Kịch bản phát thanh",
  placeholder = "Nhập nội dung văn bản để avatar phát biểu...",
}: HeyGenLegacyScriptInputProps) {
  return (
    <div className={`space-y-2 border-t ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} px-4 py-3`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-on-surface-variant">{title}</h4>
        <span className="text-xs font-medium tabular-nums text-on-surface-variant">{(value || "").length} ký tự</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-20 max-h-36 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
      />
    </div>
  );
}
