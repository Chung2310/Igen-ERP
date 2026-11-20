export interface PaginationQuery {
  page?: unknown;
  limit?: unknown;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const positiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
};

export function parsePagination(
  input: PaginationQuery,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
) {
  const defaultPage = defaults.page ?? 1;
  const defaultLimit = defaults.limit ?? 20;
  const maxLimit = defaults.maxLimit ?? 100;
  const page = positiveInteger(input.page, defaultPage);
  const limit = Math.min(positiveInteger(input.limit, defaultLimit), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
}
