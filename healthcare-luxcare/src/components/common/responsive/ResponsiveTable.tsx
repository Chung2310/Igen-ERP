import React from "react";
import { useIsMobile } from "../../../hooks/useMediaQuery";

/**
 * Mô tả một cột dữ liệu, dùng chung cho cả hai chế độ hiển thị.
 *
 * Trên desktop mỗi cột là một `<th>`/`<td>`; trên mobile mỗi cột trở thành một
 * cặp nhãn–giá trị bên trong card, trừ khi được đánh dấu `primary`/`actions`.
 */
export interface ResponsiveColumn<T> {
  /** Khoá duy nhất trong phạm vi bảng. */
  key: string;
  /** Nội dung ô tiêu đề (desktop) và nhãn của cặp nhãn–giá trị (mobile). */
  header: React.ReactNode;
  /** Render nội dung ô cho một dòng. */
  render: (row: T, index: number) => React.ReactNode;
  /** Cột làm tiêu đề card trên mobile. Nên có đúng một cột như vậy. */
  primary?: boolean;
  /** Cột hành động — trên mobile dồn xuống chân card. */
  actions?: boolean;
  /** Ẩn hẳn trên mobile (thông tin phụ, không đáng chiếm chỗ). */
  hideOnMobile?: boolean;
  headerClassName?: string;
  cellClassName?: string;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  /** Khoá React cho mỗi dòng. */
  rowKey: (row: T, index: number) => string;
  /** Chiều rộng tối thiểu của bảng trên desktop, ví dụ "1180px". */
  minWidth?: string;
  onRowClick?: (row: T, index: number) => void;
  /** Hiển thị khi không có dữ liệu. */
  emptyMessage?: React.ReactNode;
  className?: string;
}

/**
 * Bảng dữ liệu hai chế độ: `<table>` trên desktop, danh sách card trên mobile.
 *
 * Đường render desktop giữ nguyên cấu trúc bảng truyền thống để không thay đổi
 * trải nghiệm hiện tại; chỉ dưới breakpoint md (767px) mới chuyển sang card.
 */
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  minWidth,
  onRowClick,
  emptyMessage = "Không có dữ liệu.",
  className = "",
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (rows.length === 0) {
    return <div className="p-6 text-center text-sm text-on-surface-variant">{emptyMessage}</div>;
  }

  if (isMobile) {
    const primary = columns.find((col) => col.primary);
    const actions = columns.filter((col) => col.actions);
    const details = columns.filter((col) => !col.primary && !col.actions && !col.hideOnMobile);

    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {rows.map((row, index) => (
          <div
            key={rowKey(row, index)}
            onClick={onRowClick ? () => onRowClick(row, index) : undefined}
            className={`rounded-xl border border-outline-variant bg-surface-container-low p-4 ${
              onRowClick ? "cursor-pointer active:bg-surface-container" : ""
            }`}
          >
            {primary && <div className="mb-3 text-sm font-semibold text-on-surface">{primary.render(row, index)}</div>}

            {details.length > 0 && (
              <dl className="flex flex-col gap-2">
                {details.map((col) => (
                  <div key={col.key} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-xs font-medium text-on-surface-variant">{col.header}</dt>
                    <dd className="min-w-0 text-right text-sm text-on-surface">{col.render(row, index)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {actions.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant pt-3">
                {actions.map((col) => (
                  <React.Fragment key={col.key}>{col.render(row, index)}</React.Fragment>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-left font-sans text-xs" style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            {columns.map((col) => (
              <th key={col.key} className={col.headerClassName ?? "p-4"}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant text-on-surface">
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              className={`transition-colors hover:bg-surface-container-low ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={col.cellClassName ?? "p-4"}>
                  {col.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ResponsiveTable;
