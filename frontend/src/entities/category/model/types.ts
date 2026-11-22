/** Активная категория (GET /categories). */
export interface Category {
  code: string;
  name: string;
  description: string | null;
}
