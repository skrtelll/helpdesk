import { apiRequest } from "@/shared/api";
import type { User } from "../model/types";

export function getMe(): Promise<User> {
  return apiRequest<User>("GET", "/users/me");
}
