import { apiRequest } from "@/shared/api";
import type { Category } from "../model/types";

export function listCategories(): Promise<Category[]> {
  return apiRequest<Category[]>("GET", "/categories");
}
