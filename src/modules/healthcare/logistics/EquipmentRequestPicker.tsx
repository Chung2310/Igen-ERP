import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { Equipment, LogisticsList } from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { ErpModal } from "../../../components/common/ErpModal";
import {
  buttonClass,
  primaryClass,
  Field,
  Feedback,
  formError,
  useHealthcareQuery,
  type FormError,
} from "../ui";
import { cn } from "../../student-management/lib/utils";

export default function EquipmentRequestPicker({
  api,
  type,
  initialEquipment,
  onClose,
  onSaved,
}: {
  api: HealthcareApi;
  type: "borrow" | "return";
  initialEquipment?: Equipment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [requestType, setRequestType] = useState<"borrow" | "return">(type);
  const [selected, setSelected] = useState<Equipment | undefined>(initialEquipment);
  const [search, setSearch] = useState(
    initialEquipment ? `${initialEquipment.code} - ${initialEquipment.name}` : "",
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [error, setError] = useState<FormError>();
  const [requestKey] = useState(() => crypto.randomUUID());

  const comboboxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listboxId = useId();
  const errorId = useId();

  const queryTerm = selected && search === `${selected.code} - ${selected.name}` ? "" : search;
  const list = useHealthcareQuery<LogisticsList<Equipment>>(
    api,
    dropdownOpen
      ? `/logistics/equipment?${requestType === "borrow" ? "status=available" : "returnable=true"}&page=1&q=${encodeURIComponent(queryTerm)}`
      : null,
  );
  const items = list.data?.items || [];

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutside = (event: PointerEvent) => {
      if (!comboboxRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [dropdownOpen]);

  function selectEquipment(row: Equipment) {
    setSelected(row);
    setSearch(`${row.code} - ${row.name}`);
    setDropdownOpen(false);
    setActiveIndex(-1);
    setError((current) => (current?.fields.includes("equipment") ? undefined : current));
  }

  function clearEquipment() {
    setSelected(undefined);
    setSearch("");
    setActiveIndex(-1);
    setDropdownOpen(true);
    inputRef.current?.focus();
  }

  function switchType(next: "borrow" | "return") {
    if (next === requestType) return;
    setRequestType(next);
    setSelected(undefined);
    setSearch("");
    setActiveIndex(-1);
    setDropdownOpen(false);
    setError(undefined);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && dropdownOpen) {
      event.preventDefault();
      event.stopPropagation();
      setDropdownOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!dropdownOpen) {
        setDropdownOpen(true);
        setActiveIndex(0);
      } else if (items.length > 0) {
        setActiveIndex((current) => (current + 1) % items.length);
      }
      return;
    }
    if (event.key === "ArrowUp" && dropdownOpen && items.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? items.length - 1 : current - 1));
      return;
    }
    if (event.key === "Enter" && dropdownOpen && activeIndex >= 0 && items[activeIndex]) {
      event.preventDefault();
      selectEquipment(items[activeIndex]);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || persisted) return;
    if (!selected) {
      setError({ message: "Vui lòng chọn thiết bị.", fields: ["equipment"] });
      setDropdownOpen(true);
      inputRef.current?.focus();
      return;
    }
    const data = new FormData(event.currentTarget);
    const reason = String(data.get("reason") || "").trim();
    const expectedReturnDay = String(data.get("expectedReturnDay") || "").trim();
    setBusy(true);
    setError(undefined);
    try {
      await api.json(`/logistics/equipment/${selected._id}/requests`, {
        method: "POST",
        headers: { "Idempotency-Key": requestKey },
        body: JSON.stringify({
          type: requestType,
          reason,
          ...(requestType === "borrow" && expectedReturnDay ? { expectedReturnDay } : {}),
        }),
      });
      setPersisted(true);
      onSaved();
    } catch (err) {
      setError(formError(err));
    } finally {
      setBusy(false);
    }
  }

  const modalTitle = initialEquipment
    ? requestType === "borrow"
      ? "Yêu cầu mượn thiết bị"
      : "Yêu cầu trả thiết bị"
    : "Tạo phiếu mượn/trả thiết bị";

  const equipmentError = error?.fields.includes("equipment") ? error.message : undefined;

  return (
    <ErpModal
      native
      title={modalTitle}
      onClose={persisted ? onSaved : onClose}
      closeDisabled={busy}
      maxWidth="max-w-lg"
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="healthcare-logistics flex min-h-[340px] flex-col justify-between gap-4 [&_input]:!bg-surface-container-lowest [&_input]:!text-on-surface"
      >
        <fieldset disabled={busy} className="space-y-4">
          {!initialEquipment && (
            <div
              role="group"
              className="inline-flex gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-1"
              aria-label="Loại yêu cầu"
            >
              {(["borrow", "return"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={requestType === value}
                  className={cn(
                    buttonClass,
                    requestType === value && "border-primary bg-primary text-on-primary",
                  )}
                  onClick={() => switchType(value)}
                >
                  {value === "borrow" ? "Mượn thiết bị" : "Trả thiết bị"}
                </button>
              ))}
            </div>
          )}

          <div ref={comboboxRef} className="relative space-y-1.5">
            <label htmlFor={inputId} className="block text-sm font-medium text-on-surface">
              Thiết bị <span className="text-error" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                role="combobox"
                aria-expanded={dropdownOpen}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  dropdownOpen && activeIndex >= 0 && items[activeIndex]
                    ? `${listboxId}-opt-${items[activeIndex]._id}`
                    : undefined
                }
                aria-invalid={Boolean(equipmentError)}
                aria-describedby={equipmentError ? errorId : undefined}
                autoComplete="off"
                placeholder={
                  requestType === "borrow"
                    ? "Bấm để tìm và chọn thiết bị sẵn sàng..."
                    : "Bấm để tìm và chọn thiết bị cần trả..."
                }
                value={search}
                onFocus={() => setDropdownOpen(true)}
                onClick={() => setDropdownOpen(true)}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelected(undefined);
                  setActiveIndex(-1);
                  setDropdownOpen(true);
                }}
                onKeyDown={handleKeyDown}
                className="min-h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-2 pl-9 pr-16 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                {search && (
                  <button
                    type="button"
                    aria-label="Xóa thiết bị đã chọn"
                    onClick={clearEquipment}
                    className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={dropdownOpen ? "Đóng danh sách thiết bị" : "Mở danh sách thiết bị"}
                  tabIndex={-1}
                  onClick={() => setDropdownOpen((open) => !open)}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                >
                  <ChevronDown
                    className={cn("size-4 transition-transform duration-150", dropdownOpen && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {selected && (
              <p className="text-xs text-on-surface-variant">
                Đã chọn: <strong className="font-medium text-on-surface">{selected.name}</strong> ({selected.code}
                {selected.location ? ` · ${selected.location}` : ""})
              </p>
            )}
            {equipmentError && (
              <p id={errorId} role="alert" className="text-xs text-error">
                {equipmentError}
              </p>
            )}

            {dropdownOpen && (
              <div
                id={listboxId}
                role="listbox"
                aria-label="Danh sách thiết bị"
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-1 shadow-lg"
              >
                {list.loading && (
                  <p role="status" className="px-3 py-2.5 text-xs text-on-surface-variant">
                    Đang tải danh sách thiết bị…
                  </p>
                )}
                {list.error && (
                  <div className="p-2">
                    <Feedback error={list.error} onRetry={list.refresh} />
                  </div>
                )}
                {!list.loading && !list.error && items.length === 0 && (
                  <p role="status" className="px-3 py-2.5 text-xs text-on-surface-variant">
                    {requestType === "borrow"
                      ? "Không có thiết bị sẵn sàng để mượn."
                      : "Không có thiết bị đang sử dụng để yêu cầu trả."}
                  </p>
                )}
                {!list.loading &&
                  !list.error &&
                  items.map((row, index) => {
                    const isSelected = selected?._id === row._id;
                    const isActive = index === activeIndex;
                    return (
                      <button
                        key={row._id}
                        id={`${listboxId}-opt-${row._id}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectEquipment(row)}
                        className={cn(
                          "flex w-full cursor-pointer flex-col items-start rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : isActive
                              ? "bg-surface-container text-on-surface"
                              : "text-on-surface hover:bg-primary/5",
                        )}
                      >
                        <span className="font-medium">{row.name}</span>
                        <span className="text-xs text-on-surface-variant">
                          {row.code} · {row.location || "Chưa có vị trí"}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          <Field name="reason" label="Lý do" required error={error} />
          {requestType === "borrow" && (
            <Field name="expectedReturnDay" label="Ngày dự kiến trả" type="date" error={error} />
          )}
        </fieldset>

        <div className="mt-auto space-y-3">
          {!equipmentError && <Feedback error={error?.message} />}

          <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={persisted ? onSaved : onClose}
            >
              Đóng
            </button>
            <button type="submit" className={primaryClass} disabled={busy || persisted}>
              {busy
                ? "Đang gửi…"
                : requestType === "borrow"
                  ? "Gửi yêu cầu mượn"
                  : "Gửi yêu cầu trả"}
            </button>
          </div>
        </div>
      </form>
    </ErpModal>
  );
}
