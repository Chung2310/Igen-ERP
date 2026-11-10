const centeredColumns = new Set([
  "Trạng thái", "Ngày tạo hồ sơ", "Ngày sinh", "Ngày khám", "Tái khám", "Bắt đầu", "Kết thúc",
  "Ngày hẹn", "Hạn xử lý", "Lượt khám", "Lịch hẹn", "Chăm sóc", "Thời điểm", "Kiểm tra",
]);

export function ErpTableHead({ columns, selectAll, appearance = "default" }: {
  columns: string[];
  appearance?: "default" | "healthcare";
  selectAll?: { checked: boolean; disabled?: boolean; label: string; onChange: (checked: boolean) => void };
}) {
  const rowClass = appearance === "healthcare"
    ? "border-b border-outline-variant bg-surface-container-low text-sm font-medium text-on-surface-variant"
    : "border-b border-outline-variant bg-surface-container-low text-xs font-medium text-on-surface-variant";
  return (
    <thead>
      <tr className={rowClass}>
        {selectAll && <th scope="col" className={`w-10 text-left ${appearance === "healthcare" ? "px-3 py-3" : "px-4 py-2.5"}`}>
          <input type="checkbox" checked={selectAll.checked} disabled={selectAll.disabled} aria-label={selectAll.label}
            onChange={event => selectAll.onChange(event.target.checked)} className="size-4 accent-primary disabled:cursor-not-allowed" />
        </th>}
        {columns.map((column) => (
          <th key={column} scope="col" className={appearance === "healthcare"
            ? `px-3 py-3 font-medium text-on-surface ${column === "Thao tác" ? "text-right" : centeredColumns.has(column) ? "text-center" : "text-left"}`
            : "px-4 py-2.5 text-left font-medium text-on-surface-variant"}>{column}</th>
        ))}
      </tr>
    </thead>
  );
}
