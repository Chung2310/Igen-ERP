import React, { useRef } from "react";

export const parseDigits = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(/\D/g, "");
  return clean ? Number(clean) : 0;
};

export const formatCurrencyInput = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null || val === "") return "";
  const clean = String(val).replace(/\D/g, "");
  if (!clean) return "";
  return Number(clean).toLocaleString("vi-VN");
};

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number | string | undefined | null;
  onChange: (value: number, formatted: string) => void;
  allowEmpty?: boolean;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onChange,
      allowEmpty = false,
      placeholder = "0",
      className = "",
      disabled = false,
      ...rest
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLInputElement | null>(null);

    // Combine forwarded ref and internal ref
    const setRef = (node: HTMLInputElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const rawVal = input.value;
      const cursorPos = input.selectionStart ?? rawVal.length;

      // Count actual digits before cursor in raw input
      const digitsBeforeCursor = rawVal.slice(0, cursorPos).replace(/\D/g, "").length;

      const cleanDigits = rawVal.replace(/\D/g, "");

      if (!cleanDigits) {
        onChange(0, allowEmpty ? "" : "0");
        return;
      }

      const numericVal = Number(cleanDigits);
      const formatted = numericVal.toLocaleString("vi-VN");

      onChange(numericVal, formatted);

      // Restore cursor position smoothly after reformat
      if (typeof input.setSelectionRange === "function") {
        requestAnimationFrame(() => {
          let newPos = 0;
          let countedDigits = 0;
          for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
              countedDigits++;
            }
            if (countedDigits === digitsBeforeCursor) {
              newPos = i + 1;
              break;
            }
          }
          if (countedDigits < digitsBeforeCursor) {
            newPos = formatted.length;
          }
          input.setSelectionRange(newPos, newPos);
        });
      }
    };

    // Calculate display string
    const displayValue = React.useMemo(() => {
      if (value === undefined || value === null || value === "") {
        return allowEmpty ? "" : "0";
      }
      const num = typeof value === "number" ? value : parseDigits(value);
      if (num === 0 && allowEmpty && value === "") {
        return "";
      }
      return num.toLocaleString("vi-VN");
    }, [value, allowEmpty]);

    return (
      <input
        {...rest}
        ref={setRef}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={displayValue}
        placeholder={placeholder}
        onChange={handleChange}
        className={className}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export default CurrencyInput;
