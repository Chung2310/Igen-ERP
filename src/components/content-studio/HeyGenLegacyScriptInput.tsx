import { HEYGEN_THEME } from "./heygenTheme";

interface HeyGenLegacyScriptInputProps {
  value: string;
  onChange: (val: string) => void;
}

export function HeyGenLegacyScriptInput({ value, onChange }: HeyGenLegacyScriptInputProps) {
  return (
    <div className={`border-t ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} px-4 py-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Kịch bản phát thanh (Avatar III)</h4>
        <span className="text-[10px] font-bold text-slate-400">{(value || "").length} ký tự</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nhập nội dung văn bản để avatar phát biểu..."
        className="w-full min-h-[80px] max-h-[140px] rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 shadow-sm transition-all duration-200 placeholder:text-slate-400"
      />
    </div>
  );
}
