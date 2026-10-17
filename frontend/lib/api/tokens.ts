export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const KEY = "hd.tokens";

export function getTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(t: Tokens): void {
  window.localStorage.setItem(KEY, JSON.stringify(t));
}

export function clearTokens(): void {
  window.localStorage.removeItem(KEY);
}
