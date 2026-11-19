interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  itemLabel?: string;
  loading?: boolean;
  onPageChange: (page: number) => void | Promise<void>;
}

type PageItem = number | `ellipsis-${number}`;

function visiblePageItems(page: number, totalPages: number): PageItem[] {
  const visiblePages = [...new Set([1, totalPages, page - 1, page, page + 1])]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((first, second) => first - second);

  return visiblePages.flatMap((candidate, index) => {
    const previous = visiblePages[index - 1];
    if (previous === undefined || candidate - previous === 1) return [candidate];
    if (candidate - previous === 2) return [previous + 1, candidate];
    return [`ellipsis-${previous}` as const, candidate];
  });
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  itemLabel = 'mục',
  loading = false,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const items = visiblePageItems(currentPage, totalPages);
  const firstItem = totalItems !== undefined && pageSize ? (currentPage - 1) * pageSize + 1 : undefined;
  const lastItem = totalItems !== undefined && pageSize ? Math.min(currentPage * pageSize, totalItems) : undefined;

  return (
    <nav className="pagination" aria-label="Phân trang">
      {firstItem !== undefined && lastItem !== undefined && (
        <span className="pagination-summary">Hiển thị {firstItem}–{lastItem} trên {totalItems} {itemLabel}</span>
      )}
      <div className="pagination-controls">
        <button
          type="button"
          aria-label="Trang trước"
          disabled={loading || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Trang trước
        </button>
        <div className="pagination-pages" aria-label="Chọn trang">
          {items.map((item) => typeof item === 'number' ? (
            <button
              type="button"
              className="pagination-page"
              aria-label={`Trang ${item}`}
              aria-current={item === currentPage ? 'page' : undefined}
              disabled={loading}
              key={item}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ) : <span className="pagination-ellipsis" aria-hidden="true" key={item}>…</span>)}
        </div>
        <button
          type="button"
          aria-label="Trang sau"
          disabled={loading || currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Trang sau
        </button>
      </div>
    </nav>
  );
}
