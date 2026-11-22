import { apiRequest, clearTokens, getTokens, type Tokens } from "@/shared/api";

// Контракт по ТЗ (FR-AUTH-001..003). В текущем backend эти endpoints ещё не реализованы.
export function login(email: string, password: string): Promise<Tokens> {
  return apiRequest<Tokens>("POST", "/auth/login", { auth: false, body: { email, password } });
}

export function register(email: string, password: string, displayName: string): Promise<unknown> {
  return apiRequest<unknown>("POST", "/auth/register", { auth: false, body: { email, password, displayName } });
}

/** Отзывает refresh token на сервере; локальные токены удаляются в любом случае. */
export async function logout(): Promise<void> {
  const tokens = getTokens();
  try {
    if (tokens) await apiRequest("POST", "/auth/logout", { body: { refreshToken: tokens.refreshToken } });
  } catch {
    /* сервер недоступен или токен уже недействителен: выходим локально */
  } finally {
    clearTokens();
  }
}
