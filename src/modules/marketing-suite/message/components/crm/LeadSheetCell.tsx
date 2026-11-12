import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import type { LeadIntakeFieldType } from "../../../../../../shared/marketing-suite/lead-intake";
import { cn } from "../../../../student-management/lib/utils";
import { formatLeadCellDisplay, parseMultiSelectValue } from "./leadSheetUtils";

export type CellDirection = "up" | "down" | "left" | "right";

interface LeadSheetCellProps {
  cellId: string;
  label: string;
  value: string;
  type: LeadIntakeFieldType;
  options?: string[];
  editable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onNavigate?: (direction: CellDirection) => void;
  onSave: (nextValue: string) => Promise<void>;
}

const inlineInputClass =
  "h-9 w-full min-w-0 bg-surface-container-lowest px-2.5 py-1.5 text-sm text-on-surface outline-none focus:outline-none";

export const LeadSheetCell: React.FC<LeadSheetCellProps> = ({
  cellId,
  label,
  value,
  type,
  options = [],
  editable = true,
  isSelected = false,
  onSelect,
  onNavigate,
  onSave,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useLayoutEffect(() => {
    if (!popoverOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(240, Math.min(340, rect.width + 64));
    const estimatedHeight = type === "long_text" ? 210 : Math.min(280, Math.max(140, options.length * 36 + 64));
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const openAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    const top = openAbove
      ? Math.max(12, rect.top - estimatedHeight - 4)
      : Math.min(window.innerHeight - estimatedHeight - 12, rect.bottom + 4);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    setPopoverCoords({ top, left, width });
  }, [popoverOpen, options.length, type]);

  useEffect(() => {
    if (!popoverOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !popoverRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setPopoverOpen(false);
        setDraft(value);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPopoverOpen(false);
        setDraft(value);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [popoverOpen, value]);

  useEffect(() => {
    if (!editing) return;
    if (type === "single_select") selectRef.current?.focus();
    else inputRef.current?.focus();
  }, [editing, type]);

  useEffect(() => {
    if (!popoverOpen) return;
    if (type === "long_text") {
      textareaRef.current?.focus();
    } else if (type === "multi_select") {
      requestAnimationFrame(() => {
        const firstInteractive = popoverRef.current?.querySelector<HTMLElement>("input, button");
        firstInteractive?.focus();
      });
    }
  }, [popoverOpen, type]);

  async function commitValue(nextRaw: string, moveAfter?: CellDirection) {
    const next = nextRaw.trim();
    if (saving) return;
    if (next === value.trim()) {
      setEditing(false);
      setPopoverOpen(false);
      if (moveAfter) onNavigate?.(moveAfter);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
      setPopoverOpen(false);
      if (moveAfter) onNavigate?.(moveAfter);
    } catch {
      // Parent displays the inline alert and keeps current draft open.
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    if (!editable || saving) return;
    onSelect?.();
    if (type === "checkbox") {
      const nextValue = value.trim().toLowerCase() === "có" ? "Không" : "Có";
      void commitValue(nextValue);
      return;
    }
    if (type === "multi_select" || type === "long_text") {
      setDraft(value);
      setPopoverOpen(true);
      return;
    }
    setDraft(value);
    setEditing(true);
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowUp") { event.preventDefault(); onNavigate?.("up"); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); onNavigate?.("down"); return; }
    if (event.key === "ArrowLeft") { event.preventDefault(); onNavigate?.("left"); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); onNavigate?.("right"); return; }
    if (event.key === "F2") {
      event.preventDefault();
      startEdit();
    }
  }

  const isNumeric = type === "number" || type === "currency";
  const formattedDisplay = formatLeadCellDisplay(value, type);

  if (type === "checkbox") {
    const checked = value.trim().toLowerCase() === "có" || value.trim().toLowerCase() === "true";
    const explicitNo = value.trim().toLowerCase() === "không" || value.trim().toLowerCase() === "false";
    return (
      <div className={cn(
        "relative flex min-h-10 items-center justify-center px-2 py-1",
        isSelected && "bg-primary/5 outline-1 -outline-offset-1 outline-primary",
      )}>
        <button
          ref={triggerRef}
          type="button"
          data-sheet-cell={cellId}
          disabled={!editable || saving}
          onClick={startEdit}
          onFocus={onSelect}
          onKeyDown={handleTriggerKeyDown}
          aria-pressed={checked}
          aria-label={`${label}: ${checked ? "Có" : explicitNo ? "Không" : "Chưa chọn"}`}
          className={cn(
            "inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50",
            checked
              ? "border-primary/40 bg-primary-container text-on-primary-container"
              : explicitNo
                ? "border-outline-variant bg-surface-container text-on-surface-variant"
                : "border-transparent bg-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low",
          )}
        >
          <span className={cn(
            "flex size-3.5 items-center justify-center rounded border",
            checked ? "border-primary bg-primary text-on-primary" : "border-outline bg-surface-container-lowest",
          )}>
            {checked && <Check aria-hidden="true" className="size-2.5 stroke-[3]" />}
          </span>
          <span>{checked ? "Có" : explicitNo ? "Không" : ""}</span>
        </button>
        {saving && <Loader2 aria-hidden="true" className="absolute right-1.5 top-1.5 size-3 animate-spin text-primary" />}
      </div>
    );
  }

  if (editing && type === "single_select") {
    return (
      <div className="relative flex min-h-10 items-center bg-surface-container-lowest outline-1 -outline-offset-1 outline-primary">
        <select
          ref={selectRef}
          aria-label={`Chọn ${label}`}
          value={draft}
          disabled={saving}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            void commitValue(next);
          }}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(value);
              setEditing(false);
              triggerRef.current?.focus();
            }
          }}
          className="h-9 w-full cursor-pointer border-0 bg-transparent px-2 text-sm text-on-surface outline-none"
        >
          <option value="">— Trống —</option>
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="relative flex min-h-10 items-center bg-surface-container-lowest outline-1 -outline-offset-1 outline-primary">
        <input
          ref={inputRef}
          type={type === "date" ? "date" : type === "email" ? "email" : type === "phone" ? "tel" : "text"}
          inputMode={isNumeric ? "decimal" : undefined}
          aria-label={`Sửa ${label}`}
          value={draft}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commitValue(draft)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commitValue(draft, "down");
            } else if (event.key === "Tab") {
              event.preventDefault();
              void commitValue(draft, event.shiftKey ? "left" : "right");
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDraft(value);
              setEditing(false);
              triggerRef.current?.focus();
            }
          }}
          className={cn(inlineInputClass, isNumeric && "text-right tabular-nums")}
        />
        {saving && <Loader2 aria-hidden="true" className="mr-2 size-3.5 shrink-0 animate-spin text-primary" />}
      </div>
    );
  }

  const selectedTags = type === "multi_select" ? parseMultiSelectValue(value) : [];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-sheet-cell={cellId}
        disabled={!editable}
        onClick={startEdit}
        onFocus={onSelect}
        onKeyDown={handleTriggerKeyDown}
        aria-label={`Sửa ${label}${formattedDisplay ? `: ${formattedDisplay}` : ""}`}
        title={formattedDisplay || `Bấm để nhập ${label}`}
        className={cn(
          "group/cell relative flex min-h-10 w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-sm font-normal text-on-surface transition-colors focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-primary",
          editable ? "cursor-cell hover:bg-primary/5" : "cursor-default",
          isSelected && "bg-primary/5 outline-1 -outline-offset-1 outline-primary",
          isNumeric && "justify-end text-right tabular-nums",
        )}
      >
        {type === "single_select" && formattedDisplay ? (
          <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md border border-outline-variant bg-surface-container-low px-2 py-0.5 text-xs text-on-surface">
            <span className="truncate">{formattedDisplay}</span>
          </span>
        ) : type === "multi_select" && selectedTags.length > 0 ? (
          <span className="flex max-w-full flex-wrap items-center gap-1 overflow-hidden">
            {selectedTags.slice(0, 2).map(tag => (
              <span key={tag} className="inline-flex max-w-32 truncate rounded-md bg-primary-container px-1.5 py-0.5 text-xs text-on-primary-container">
                {tag}
              </span>
            ))}
            {selectedTags.length > 2 && (
              <span className="text-xs tabular-nums text-on-surface-variant">+{selectedTags.length - 2}</span>
            )}
          </span>
        ) : formattedDisplay ? (
          <span className={cn("w-full truncate", isNumeric && "text-right tabular-nums")}>
            {formattedDisplay}
          </span>
        ) : (
          <span className="h-4 w-full" aria-hidden="true" />
        )}

        {(type === "single_select" || type === "multi_select") && editable && (
          <ChevronDown
            aria-hidden="true"
            className="ml-auto size-3.5 shrink-0 text-on-surface-variant opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100"
          />
        )}
        {saving && <Loader2 aria-hidden="true" className="ml-auto size-3.5 shrink-0 animate-spin text-primary" />}
      </button>

      {popoverOpen && popoverCoords && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Chỉnh sửa ${label}`}
          style={{ top: popoverCoords.top, left: popoverCoords.left, width: popoverCoords.width }}
          className="fixed z-40 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-left text-on-surface shadow-lg"
        >
          <p className="mb-2 text-xs font-medium text-on-surface-variant">{label}</p>
          {type === "long_text" ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                aria-label={label}
                rows={4}
                value={draft}
                disabled={saving}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    void commitValue(draft);
                  }
                }}
                placeholder="Nhập nội dung…"
                className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-on-surface-variant">Ctrl + Enter để lưu</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => { setPopoverOpen(false); setDraft(value); triggerRef.current?.focus(); }}
                    className="rounded-md border border-outline-variant px-2.5 py-1 text-xs text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-1 focus-visible:outline-primary"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void commitValue(draft)}
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-on-primary hover:opacity-90 focus-visible:outline-1 focus-visible:outline-primary disabled:opacity-50"
                  >
                    {saving ? "Đang lưu…" : "Lưu"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {options.length === 0 ? (
                  <p className="py-2 text-xs text-on-surface-variant">Chưa có danh sách lựa chọn cho cột này.</p>
                ) : options.map(option => {
                  const selectedSet = new Set(parseMultiSelectValue(draft));
                  const active = selectedSet.has(option);
                  return (
                    <label
                      key={option}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active ? "bg-primary/10 text-on-surface" : "hover:bg-surface-container-low",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(event) => {
                          const next = new Set(parseMultiSelectValue(draft));
                          if (event.target.checked) next.add(option);
                          else next.delete(option);
                          setDraft([...next].join(", "));
                        }}
                        className="size-4 accent-primary"
                      />
                      <span className="min-w-0 flex-1 break-words">{option}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-1.5 border-t border-outline-variant pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setDraft("")}
                  className="mr-auto text-xs text-on-surface-variant hover:text-on-surface focus-visible:outline-1 focus-visible:outline-primary"
                >
                  Xóa chọn
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => { setPopoverOpen(false); setDraft(value); triggerRef.current?.focus(); }}
                  className="rounded-md border border-outline-variant px-2.5 py-1 text-xs text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-1 focus-visible:outline-primary"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void commitValue(draft)}
                  className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-on-primary hover:opacity-90 focus-visible:outline-1 focus-visible:outline-primary disabled:opacity-50"
                >
                  {saving ? "Đang lưu…" : "Áp dụng"}
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
};
