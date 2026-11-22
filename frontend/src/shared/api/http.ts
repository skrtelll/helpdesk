import { DEV_USER_ID, clearTokens, getTokens, saveTokens, type Tokens } from "./tokens";

// Запросы идут на тот же origin: Next.js проксирует /api/v1/* на backend (см. next.config.mjs), CORS не нужен.
const BASE = (process.env.NEXT_PUBLIC_API_URL || "/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  status: number; // 0 — нет связи с сервером
  code: string;
  fieldErrors?: Record<string, string>;

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

let onUnauthorized: () => void = () => {};
/** Вызывается, когда сессия окончательно недействительна (refresh не удался). */
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

type Params = Record<string, string | number | boolean | undefined | null>;
interface Options {
  params?: Params;
  body?: unknown;
  /** false — для login/register/refresh: без Authorization и без попытки refresh */
  auth?: boolean;
}

function defaultMessage(status: number): string {
  if (status === 401) return "Требуется вход";
  if (status === 403) return "Недостаточно прав для этого действия";
  if (status === 404) return "Не найдено";
  if (status === 409) return "Конфликт данных, обновите страницу и повторите";
  if (status === 422) return "Проверьте введённые данные";
  if (status >= 500) return "Ошибка сервера, попробуйте позже";
  return "Не удалось выполнить запрос";
}

/** Backend отдаёт fieldErrors массивом [{field, message}]. */
function normalizeFieldErrors(raw: unknown): Record<string, string> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const item of raw as { field?: string; message?: string }[]) {
    if (item.field) out[item.field] = item.message ?? "Некорректное значение";
  }
  return out;
}

function buildUrl(path: string, params?: Params): string {
  const sp = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ""}`;
}

async function rawFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Нет связи с сервером. Проверьте, что backend запущен");
  }
}

let refreshing: Promise<boolean> | null = null;

/** Обновляет пару токенов (refresh ротируется). Параллельные вызовы делят один запрос. */
async function refreshTokens(): Promise<boolean> {
  const current = getTokens();
  if (!current) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await rawFetch(`${BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) return false;
        saveTokens((await res.json()) as Tokens);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function send<T>(method: string, path: string, opts: Options, canRetry: boolean): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const tokens = getTokens();
  if (opts.auth !== false) {
    if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
    else if (DEV_USER_ID) headers["X-User-Id"] = DEV_USER_ID;
  }
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await rawFetch(buildUrl(path, opts.params), {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && opts.auth !== false && tokens) {
    if (canRetry && (await refreshTokens())) return send<T>(method, path, opts, false);
    clearTokens();
    onUnauthorized();
  }

  if (!res.ok) {
    let data: { code?: string; message?: string; fieldErrors?: unknown } = {};
    try {
      data = await res.json();
    } catch {
      /* тело ответа не JSON */
    }
    throw new ApiError(res.status, data.code ?? "UNKNOWN", data.message ?? defaultMessage(res.status), normalizeFieldErrors(data.fieldErrors));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiRequest<T>(method: "GET" | "POST" | "PATCH", path: string, opts: Options = {}): Promise<T> {
  return send<T>(method, path, opts, true);
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : "Неизвестная ошибка";
}
