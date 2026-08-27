import React from "react";
import { X } from "lucide-react";
import type { Worker } from "../types";

type Props = {
  workers: Worker[];
  value: string;
  disabled?: boolean;
  onChange: (workerId: string) => void;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm transition-all focus:border-cyan-600 focus:outline-none disabled:bg-slate-50 disabled:opacity-60";

const workerLabel = (worker?: Worker) =>
  worker ? `${worker.fullName}${worker.phone ? ` · ${worker.phone}` : ""}` : "";

export function WorkerSearchSelect({ workers, value, disabled = false, onChange }: Props) {
  const selected = workers.find((worker) => worker._id === value);
  const [query, setQuery] = React.useState(() => workerLabel(selected));
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setQuery(workerLabel(selected) || (value ? value : ""));
  }, [selected, value]);

  React.useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
  const matches = workers
    .filter((worker) => {
      if (!normalizedQuery || selected) return true;
      return `${worker.fullName} ${worker.phone || ""}`
        .toLocaleLowerCase("vi-VN")
        .includes(normalizedQuery);
    })
    .slice(0, 10);

  const selectWorker = (worker: Worker) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setQuery(workerLabel(worker));
    setOpen(false);
    onChange(worker._id);
  };

  const clear = () => {
    setQuery("");
    setOpen(true);
    onChange("");
  };

  return (
    <div className="relative">
      <input
        aria-label="Người lao động"
        aria-autocomplete="list"
        aria-controls="worker-search-listbox"
        aria-expanded={open}
        autoComplete="off"
        className={inputClass}
        disabled={disabled}
        placeholder="Tìm theo tên hoặc số điện thoại"
        role="combobox"
        value={query}
        onBlur={() => {
          closeTimer.current = setTimeout(() => setOpen(false), 100);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => setOpen(true)}
      />
      {value && !disabled && (
        <button
          aria-label="Xóa người lao động đã chọn"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          type="button"
          onClick={clear}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {open && !disabled && !selected && (
        <div
          id="worker-search-listbox"
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {matches.length ? matches.map((worker) => (
            <button
              key={worker._id}
              role="option"
              aria-selected="false"
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-cyan-50 focus:bg-cyan-50 focus:outline-none"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectWorker(worker)}
            >
              <span className="block font-semibold text-slate-800">{worker.fullName}</span>
              {worker.phone && <span className="block text-xs text-slate-500">{worker.phone}</span>}
            </button>
          )) : (
            <p className="px-3 py-3 text-sm text-slate-500">Không tìm thấy người lao động phù hợp.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkerSearchSelect;
