// Реализация Api поверх REST /api/v1 (Spring Boot backend).
// ВАЖНО: пути и формы тел запросов собраны по ТЗ и должны быть сверены с
// docs/HelpDesk_System_API_Documentation.md (приоритет у API-документации).
import type { Api } from "./types";
import { ApiError } from "./types";
import { clearTokens, getTokens, setTokens, type Tokens } from "./tokens";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1").replace(/\/$/, "");

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

type Params = Record<string, string | number | boolean | undefined | null>;

function qs(params?: Params): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function normalizeFieldErrors(raw: unknown): Record<string, string> | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const item of raw as { field?: string; message?: string }[]) {
      if (item.field) out[item.field] = item.message ?? "Некорректное значение";
    }
    return out;
  }
  if (typeof raw === "object") return raw as Record<string, string>;
  return undefined;
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const t = getTokens();
  if (!t) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: t.refreshToken }),
        });
        if (!res.ok) return false;
        setTokens((await res.json()) as Tokens);
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

async function request<T>(method: string, path: string, opts: { params?: Params; body?: unknown } = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const tokens = getTokens();
  if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}${qs(opts.params)}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && retry && tokens && !path.startsWith("/auth/")) {
    if (await refreshTokens()) return request<T>(method, path, opts, false);
    clearTokens();
    onUnauthorized();
  }

  if (!res.ok) {
    let data: { code?: string; message?: string; fieldErrors?: unknown } = {};
    try {
      data = await res.json();
    } catch {
      /* тело не JSON */
    }
    throw new ApiError(res.status, data.code ?? "UNKNOWN", data.message ?? res.statusText, normalizeFieldErrors(data.fieldErrors));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(path: string, params?: Params) => request<T>("GET", path, { params });
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, { body });
const patch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body });

export const httpApi: Api = {
  async register(email, password, displayName) {
    await post("/auth/register", { email, password, displayName });
  },
  async login(email, password) {
    setTokens(await post<Tokens>("/auth/login", { email, password }));
  },
  async logout() {
    const t = getTokens();
    try {
      if (t) await post("/auth/logout", { refreshToken: t.refreshToken });
    } finally {
      clearTokens();
    }
  },
  me: () => get("/users/me"),
  updateMe: (displayName) => patch("/users/me", { displayName }),

  listCategories: (includeInactive) => get("/categories", { includeInactive }),

  listTickets: (q) => get("/tickets", { ...q }),
  supportQueue: (q) => get("/support/queue", { ...q }),
  myTickets: (q) => get("/support/my-tickets", { ...q }),
  createTicket: (input) => post("/tickets", input),
  getTicket: (id) => get(`/tickets/${id}`),
  takeTicket: (id, version) => post(`/tickets/${id}/take`, { version }),
  assignTicket: (id, assigneeId, version) => post(`/tickets/${id}/assign`, { assigneeId, version }),
  changeStatus: (id, status, version) => post(`/tickets/${id}/status`, { status, version }),
  updateTicket: (id, p, version) => patch(`/tickets/${id}`, { ...p, version }),

  listComments: (id) => get(`/tickets/${id}/comments`),
  addComment: (id, body, internal) => post(`/tickets/${id}/comments`, { body, internal }),
  listHistory: (id) => get(`/tickets/${id}/history`),

  listUsers: (q) => get("/admin/users", { ...q }),
  updateUser: (id, p) => patch(`/admin/users/${id}`, p),
  createCategory: (input) => post("/admin/categories", input),
  updateCategory: (id, p) => patch(`/admin/categories/${id}`, p),
};
