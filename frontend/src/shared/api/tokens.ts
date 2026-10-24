export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const KEY = "hd.tokens";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tokens).accessToken : null;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: Tokens): void {
  window.localStorage.setItem(KEY, JSON.stringify(tokens));
}
