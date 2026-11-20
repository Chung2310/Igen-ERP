import type { ReactNode } from 'react';
export interface DataItem { _id?: string; id?: string;[key: string]: unknown }
export interface DataColumn<T extends DataItem = DataItem> { key: string; label: string; render?: (item: T) => ReactNode }
interface DataListProps<T extends DataItem> { columns: DataColumn<T>[]; items: T[]; emptyMessage?: string; renderActions?: (item: T) => ReactNode }
function display(value: unknown): ReactNode { return typeof value === 'string' || typeof value === 'number' ? value : value == null || value === '' ? '—' : String(value); }
export default function DataList<T extends DataItem>({ columns, items, emptyMessage = 'Chưa có dữ liệu.', renderActions }: DataListProps<T>) {
  if (!items.length) return <div className="empty-state">{emptyMessage}</div>;
  const cell = (item: T, column: DataColumn<T>) => column.render ? column.render(item) : display(item[column.key]);
  return <><div className="data-table-wrap"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}{renderActions && <th className="w-px whitespace-nowrap text-right">Thao tác</th>}</tr></thead><tbody>{items.map((item) => <tr key={item._id || item.id}>{columns.map((column) => <td key={column.key}>{cell(item, column)}</td>)}{renderActions && <td className="w-px whitespace-nowrap text-right">{renderActions(item)}</td>}</tr>)}</tbody></table></div><div className="data-cards">{items.map((item) => <article className="data-card" key={item._id || item.id}>{columns.map((column) => <div className="data-card-row" key={column.key}><span>{column.label}</span><strong>{cell(item, column)}</strong></div>)}{renderActions && <div className="data-card-actions">{renderActions(item)}</div>}</article>)}</div></>;
}
