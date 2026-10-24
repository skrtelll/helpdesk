import { apiRequest, type Tokens } from "@/shared/api";

// Пути аутентификации собраны по ТЗ; сверьте с API-документацией.
export function login(email: string, password: string): Promise<Tokens> {
  return apiRequest<Tokens>("POST", "/auth/login", { email, password });
}

export function register(email: string, password: string, displayName: string): Promise<unknown> {
  return apiRequest<unknown>("POST", "/auth/register", { email, password, displayName });
}
