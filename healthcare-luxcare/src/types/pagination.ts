export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  status?: "success";
  data: T[];
  pagination: PaginationMeta;
}

export const emptyPagination: PaginationMeta = { page: 1, limit: 20, total: 0, totalPages: 0 };
