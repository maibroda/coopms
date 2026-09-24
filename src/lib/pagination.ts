export const DEFAULT_PAGE_SIZE = 25;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function parsePage(input: string | undefined): number {
  const n = Number(input);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
