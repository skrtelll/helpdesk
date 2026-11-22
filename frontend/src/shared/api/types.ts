/** Страница списка, как её отдаёт backend (PageResponse). page — с нуля. */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
