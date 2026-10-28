import { getAccessToken } from "./tokens";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  status: number; // 0 — нет связи с сервером
  fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function defaultMessage(status: number): string {
  if (status === 401) return "Неверный email или пароль, либо требуется вход";
  if (status === 403) return "Недостаточно прав для этого действия";
  if (status === 404) return "Не найдено";
  if (status === 409) return "Конфликт данных, обновите страницу и повторите";
  if (status === 422) return "Проверьте введённые данные";
  if (status >= 500) return "Ошибка сервера, попробуйте позже";
  return "Не удалось выполнить запрос";
}

/** Backend может вернуть ошибки полей массивом [{field, message}] или объектом {поле: сообщение}. */
function normalizeFieldErrors(raw: unknown): Record<string, string> | undefined {
  if (Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const item of raw as { field?: string; message?: string }[]) {
      if (item.field) out[item.field] = item.message ?? "Некорректное значение";
    }
    return out;
  }
  if (raw && typeof raw === "object") return raw as Record<string, string>;
  return undefined;
}

export async function apiRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте, что backend запущен");
  }

  if (!res.ok) {
    let data: { message?: string; fieldErrors?: unknown } = {};
    try {
      data = await res.json();
    } catch {
      /* тело ответа не JSON */
    }
    throw new ApiError(res.status, data.message ?? defaultMessage(res.status), normalizeFieldErrors(data.fieldErrors));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : "Неизвестная ошибка";
}
