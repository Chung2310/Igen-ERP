import { useRef, useState } from "react";

type OtpCodeInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export default function OtpCodeInput({ label, value, onChange, required = false }: OtpCodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, 5);

  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <span
        className="relative block w-full cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <span aria-hidden="true" className="flex gap-2">
          {Array.from({ length: 6 }, (_, index) => {
            const digit = value[index] ?? "";
            const active = focused && index === activeIndex && value.length < 6;
            return (
              <span
                key={index}
                className={[
                  "flex h-14 min-w-0 flex-1 items-center justify-center rounded-xl border-[1.5px] text-xl font-semibold transition-colors",
                  digit ? "border-emerald-200 bg-emerald-50 text-slate-900" : "border-slate-200 bg-slate-50",
                  active ? "border-emerald-600 bg-white ring-2 ring-emerald-100" : "",
                ].join(" ")}
              >
                {digit || (active ? <span className="h-6 w-0.5 rounded-full bg-emerald-600" /> : null)}
              </span>
            );
          })}
        </span>
        <input
          ref={inputRef}
          className="absolute inset-0 z-10 h-full w-full cursor-text rounded-xl border-0 bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          aria-label={`${label}, gồm 6 chữ số`}
          maxLength={6}
          required={required}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </span>
    </label>
  );
}
