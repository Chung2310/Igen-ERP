import React, { useState, useRef } from "react";
import { X, Plus, Sparkles, FileText, Tags, Trash2 } from "lucide-react";

interface AttributeChipInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
}

export function AttributeChipInput({
  values,
  onChange,
  suggestions = [],
  placeholder = "Nhập giá trị rồi nhấn Enter hoặc phẩy (,)...",
  disabled = false,
}: AttributeChipInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState<"chips" | "text">("chips");
  const [rawText, setRawText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter out suggestions that are already added
  const availableSuggestions = suggestions.filter(
    (s) => !values.some((v) => v.toLowerCase().trim() === s.toLowerCase().trim())
  );

  const addValues = (newVals: string[]) => {
    const clean = newVals
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (clean.length === 0) return;

    // Deduplicate against existing values
    const currentLower = new Set(values.map((v) => v.toLowerCase().trim()));
    const toAdd: string[] = [];
    for (const val of clean) {
      const lower = val.toLowerCase();
      if (!currentLower.has(lower) && !toAdd.some((t) => t.toLowerCase() === lower)) {
        toAdd.push(val);
      }
    }

    if (toAdd.length > 0) {
      onChange([...values, ...toAdd]);
    }
  };

  const removeValue = (indexToRemove: number) => {
    onChange(values.filter((_, idx) => idx !== indexToRemove));
  };

  const clearAll = () => {
    onChange([]);
    setInputValue("");
    setRawText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        const parts = inputValue.split(/[,\n\r]+/);
        addValues(parts);
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && values.length > 0) {
      removeValue(values.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted && (pasted.includes(",") || pasted.includes("\n"))) {
      e.preventDefault();
      const parts = pasted.split(/[,\n\r]+/);
      addValues(parts);
      setInputValue("");
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      const parts = inputValue.split(/[,\n\r]+/);
      addValues(parts);
      setInputValue("");
    }
  };

  const switchToTextMode = () => {
    setRawText(values.join(", "));
    setMode("text");
  };

  const switchToChipsMode = (text: string) => {
    const parts = text.split(/[,\n\r]+/).map((s) => s.trim()).filter(Boolean);
    const unique = Array.from(new Set(parts));
    onChange(unique);
    setMode("chips");
  };

  return (
    <div className="space-y-2">
      {/* Header action bar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">Các giá trị lựa chọn</span>
          <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
            {values.length} giá trị
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={mode === "chips" ? switchToTextMode : () => switchToChipsMode(rawText)}
            className="flex items-center gap-1 text-[11px] font-medium text-cyan-700 hover:text-cyan-900 transition-colors"
          >
            {mode === "chips" ? (
              <>
                <FileText className="h-3 w-3" />
                <span>Nhập hàng loạt (Văn bản)</span>
              </>
            ) : (
              <>
                <Tags className="h-3 w-3" />
                <span>Chuyển sang dạng thẻ (Tags)</span>
              </>
            )}
          </button>
          {values.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-600 transition-colors ml-1"
              title="Xóa tất cả giá trị"
            >
              <Trash2 className="h-3 w-3" />
              <span>Xóa hết</span>
            </button>
          )}
        </div>
      </div>

      {mode === "text" ? (
        <div>
          <textarea
            rows={3}
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              const parts = e.target.value.split(/[,\n\r]+/).map((s) => s.trim()).filter(Boolean);
              onChange(Array.from(new Set(parts)));
            }}
            placeholder="Dán hoặc nhập danh sách giá trị cách nhau bằng dấu phẩy hoặc xuống dòng..."
            className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Mẹo: Bạn có thể copy một cột Excel hoặc danh sách từ nhà sản xuất rồi dán trực tiếp vào đây.
          </p>
        </div>
      ) : (
        /* Chips interactive container */
        <div
          onClick={() => inputRef.current?.focus()}
          className="min-h-[72px] w-full rounded-lg border border-slate-200 bg-white p-2 text-xs transition focus-within:border-cyan-600 focus-within:ring-2 focus-within:ring-cyan-100 cursor-text flex flex-wrap items-center gap-1.5"
        >
          {values.map((val, idx) => (
            <span
              key={`${val}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50/90 px-2.5 py-1 text-xs font-medium text-cyan-900 shadow-2xs transition-all hover:bg-cyan-100/90"
            >
              <span>{val}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  removeValue(idx);
                }}
                className="rounded p-0.5 text-cyan-600 hover:bg-cyan-200 hover:text-cyan-900 transition-colors"
                title={`Xóa ${val}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          <div className="inline-flex items-center flex-1 min-w-[150px]">
            <input
              ref={inputRef}
              type="text"
              disabled={disabled}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onBlur={handleBlur}
              placeholder={values.length === 0 ? placeholder : "Thêm giá trị khác..."}
              className="w-full bg-transparent py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            {inputValue.trim() && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const parts = inputValue.split(/[,\n\r]+/);
                  addValues(parts);
                  setInputValue("");
                  inputRef.current?.focus();
                }}
                className="ml-1 inline-flex items-center gap-0.5 rounded bg-cyan-700 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-cyan-800"
              >
                <Plus className="h-3 w-3" />
                Thêm
              </button>
            )}
          </div>
        </div>
      )}

      {/* Suggested values pills */}
      {availableSuggestions.length > 0 && mode === "chips" && (
        <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Gợi ý giá trị phổ biến (click để thêm nhanh):
            </span>
            {availableSuggestions.length > 1 && (
              <button
                type="button"
                onClick={() => addValues(availableSuggestions)}
                className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900 hover:underline"
              >
                + Thêm tất cả ({availableSuggestions.length})
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableSuggestions.map((suggested) => (
              <button
                key={suggested}
                type="button"
                disabled={disabled}
                onClick={() => addValues([suggested])}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="h-2.5 w-2.5 text-cyan-600" />
                <span>{suggested}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
