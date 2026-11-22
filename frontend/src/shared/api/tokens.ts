export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const KEY = "hd.tokens";

/**
 * ВРЕМЕННО, пока в backend нет JWT: backend принимает заголовок X-User-Id при APP_DEV_AUTH_HEADER=true.
 * Задаётся в .env.local как NEXT_PUBLIC_DEV_USER_ID=<uuid пользователя из БД>.
 */
export const DEV_USER_ID: string = process.env.NEXT_PUBLIC_DEV_USER_ID || "";

export function getTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: Tokens): void {
  window.localStorage.setItem(KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  window.localStorage.removeItem(KEY);
}

export function hasCredentials(): boolean {
  return getTokens() !== null || DEV_USER_ID !== "";
}
