// Mock-реализация Api: имитирует backend целиком (RBAC, ownership, state machine, version,
// внутренние комментарии, историю). Данные живут в localStorage браузера.
// Демо-аккаунты (пароль password123): admin@ / support@ / user@helpdesk.test
import type {
  Category, HistoryEvent, HistoryEventType, Page, Priority, Role, Status, Ticket, TicketComment, TicketQuery, User, UserRef,
} from "../types";
import { ACTIVE, TERMINAL } from "../types";
import { isAllowed, transitionExists } from "../workflow";
import { clearTokens, getTokens, setTokens } from "./tokens";
import { ApiError, type Api } from "./types";

interface DbUser { id: string; email: string; password: string; displayName: string; role: Role; enabled: boolean; createdAt: string }
interface DbTicket {
  id: string; number: string; title: string; description: string; status: Status; priority: Priority;
  categoryId: string; authorId: string; assigneeId: string | null; version: number;
  createdAt: string; updatedAt: string; resolvedAt: string | null; closedAt: string | null; cancelledAt: string | null;
}
interface DbComment { id: string; ticketId: string; authorId: string; body: string; internal: boolean; createdAt: string }
interface DbHistory {
  id: string; ticketId: string; actorId: string; type: HistoryEventType;
  oldValue: string | null; newValue: string | null; internal: boolean; createdAt: string;
}
interface Db { users: DbUser[]; categories: Category[]; tickets: DbTicket[]; comments: DbComment[]; history: DbHistory[]; seq: number }

const KEY = "hd.mock.db";
const RANK: Record<Priority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

// ---------------------------------------------------------------- хранилище
function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
const nowIso = () => new Date().toISOString();
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

function seed(): Db {
  const users: DbUser[] = [
    { id: "u-admin", email: "admin@helpdesk.test", password: "password123", displayName: "Анна Админова", role: "ADMIN", enabled: true, createdAt: ago(20000) },
    { id: "u-support", email: "support@helpdesk.test", password: "password123", displayName: "Сергей Поддержкин", role: "SUPPORT", enabled: true, createdAt: ago(19000) },
    { id: "u-user", email: "user@helpdesk.test", password: "password123", displayName: "Ольга Пользователева", role: "USER", enabled: true, createdAt: ago(18000) },
  ];
  const cat = (n: number, code: string, name: string, description: string): Category => ({ id: `c-${n}`, code, name, description, active: true });
  const categories = [
    cat(1, "ACCOUNT", "Учётная запись", "Учётная запись и аутентификация: пароль, вход, блокировка"),
    cat(2, "NETWORK", "Сеть", "Сеть, VPN, Wi-Fi, доступ в интернет"),
    cat(3, "ACCESS", "Доступ", "Права на ресурсы и системы"),
    cat(4, "SOFTWARE", "Программы", "Установка, обновление и сбои программного обеспечения"),
    cat(5, "HARDWARE", "Оборудование", "Компьютеры, периферия, мобильные устройства"),
    cat(6, "OTHER", "Прочее", "Всё остальное; категория по умолчанию для новых заявок"),
  ];
  const t = (n: number, title: string, description: string, status: Status, priority: Priority, categoryId: string, assigneeId: string | null, minAgo: number): DbTicket => ({
    id: `t-${n}`, number: `HD-${1000 + n}`, title, description, status, priority, categoryId, authorId: "u-user", assigneeId,
    version: 0, createdAt: ago(minAgo), updatedAt: ago(minAgo - 5),
    resolvedAt: status === "RESOLVED" ? ago(minAgo - 5) : null, closedAt: null, cancelledAt: null,
  });
  const tickets = [
    t(0, "Не подключается VPN", "После обновления Windows VPN-клиент выдаёт ошибку 809.", "NEW", "MEDIUM", "c-6", null, 300),
    t(1, "Нет доступа к CRM", "Вчера работал, сегодня пишет «доступ запрещён».", "IN_PROGRESS", "HIGH", "c-3", "u-support", 200),
    t(2, "Не устанавливается Office", "Установщик останавливается на 40%.", "RESOLVED", "LOW", "c-4", "u-support", 100),
  ];
  const history: DbHistory[] = tickets.map((x) => ({
    id: uid("h"), ticketId: x.id, actorId: "u-user", type: "TICKET_CREATED", oldValue: null, newValue: "NEW", internal: false, createdAt: x.createdAt,
  }));
  const comments: DbComment[] = [
    { id: "cm-1", ticketId: "t-1", authorId: "u-support", body: "Проверяю права в CRM, вернусь с ответом.", internal: false, createdAt: ago(150) },
    { id: "cm-2", ticketId: "t-1", authorId: "u-support", body: "Группа CRM-Users не назначена, нужна заявка в ИБ.", internal: true, createdAt: ago(140) },
  ];
  return { users, categories, tickets, comments, history, seq: 1003 };
}

let cache: Db | null = null;
function db(): Db {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw) as Db;
      return cache;
    }
  } catch {
    /* повреждённые данные: пересоздаём */
  }
  cache = seed();
  commit();
  return cache;
}
function commit(): void {
  window.localStorage.setItem(KEY, JSON.stringify(cache));
}

const delay = () => new Promise<void>((r) => setTimeout(r, 120));
async function guard<T>(fn: () => T): Promise<T> {
  await delay();
  return fn();
}

// ---------------------------------------------------------------- авторизация и права
function authUser(): DbUser {
  const t = getTokens();
  const id = t && t.accessToken.startsWith("mock:") ? t.accessToken.slice(5) : null;
  const u = id ? db().users.find((x) => x.id === id) : undefined;
  if (!u) throw new ApiError(401, "UNAUTHORIZED", "Требуется вход");
  if (!u.enabled) throw new ApiError(403, "USER_DISABLED", "Пользователь отключён");
  return u;
}
const forbidden = () => new ApiError(403, "FORBIDDEN", "Недостаточно прав");
function requireStaff(u: DbUser): void {
  if (u.role === "USER") throw forbidden();
}
function requireAdmin(u: DbUser): void {
  if (u.role !== "ADMIN") throw forbidden();
}

// ---------------------------------------------------------------- преобразования
function toUser(u: DbUser): User {
  return { id: u.id, email: u.email, displayName: u.displayName, role: u.role, enabled: u.enabled, createdAt: u.createdAt };
}
function ref(id: string): UserRef {
  const u = db().users.find((x) => x.id === id);
  return { id, displayName: u ? u.displayName : "—" };
}
function toTicket(t: DbTicket): Ticket {
  const c = db().categories.find((x) => x.id === t.categoryId)!;
  return {
    id: t.id, number: t.number, title: t.title, description: t.description, status: t.status, priority: t.priority,
    category: { ...c }, author: ref(t.authorId), assignee: t.assigneeId ? ref(t.assigneeId) : null, version: t.version,
    createdAt: t.createdAt, updatedAt: t.updatedAt, resolvedAt: t.resolvedAt, closedAt: t.closedAt, cancelledAt: t.cancelledAt,
  };
}
function toComment(c: DbComment): TicketComment {
  const a = db().users.find((x) => x.id === c.authorId);
  return { id: c.id, ticketId: c.ticketId, author: ref(c.authorId), authorRole: a ? a.role : "USER", body: c.body, internal: c.internal, createdAt: c.createdAt };
}
function toHistory(h: DbHistory): HistoryEvent {
  return { id: h.id, type: h.type, actor: ref(h.actorId), oldValue: h.oldValue, newValue: h.newValue, internal: h.internal, createdAt: h.createdAt };
}

function findTicket(u: DbUser, id: string): DbTicket {
  const t = db().tickets.find((x) => x.id === id);
  // чужая заявка для USER = 404 (ТЗ, раздел 3)
  if (!t || (u.role === "USER" && t.authorId !== u.id)) throw new ApiError(404, "NOT_FOUND", "Заявка не найдена");
  return t;
}
function checkMutable(t: DbTicket, version: number): void {
  if (TERMINAL.includes(t.status)) throw new ApiError(409, "TICKET_TERMINAL", "Заявка в терминальном статусе");
  if (t.version !== version) throw new ApiError(409, "VERSION_CONFLICT", "Версия заявки устарела");
}
function touch(t: DbTicket): void {
  t.version += 1;
  t.updatedAt = nowIso();
}
function log(t: DbTicket, actor: DbUser, type: HistoryEventType, oldValue: string | null, newValue: string | null, internal = false): void {
  db().history.push({ id: uid("h"), ticketId: t.id, actorId: actor.id, type, oldValue, newValue, internal, createdAt: nowIso() });
}
function applyStatus(t: DbTicket, actor: DbUser, to: Status): void {
  const from = t.status;
  t.status = to;
  if (to === "RESOLVED") t.resolvedAt = nowIso();
  if (from === "RESOLVED" && to === "IN_PROGRESS") t.resolvedAt = null;
  if (to === "CLOSED") t.closedAt = nowIso();
  if (to === "CANCELLED") t.cancelledAt = nowIso();
  let type: HistoryEventType = "STATUS_CHANGED";
  if (to === "RESOLVED") type = "TICKET_RESOLVED";
  else if (to === "CLOSED") type = "TICKET_CLOSED";
  else if (to === "CANCELLED") type = "TICKET_CANCELLED";
  else if (from === "RESOLVED" && to === "IN_PROGRESS") type = "TICKET_REOPENED";
  log(t, actor, type, from, to);
}

function validationError(fields: Record<string, string>): ApiError {
  return new ApiError(422, "VALIDATION_FAILED", "Ошибка валидации", fields);
}
function paginate<T>(rows: T[], q: { page?: number; size?: number }): Page<T> {
  const page = q.page ?? 0;
  const size = q.size ?? 20;
  if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100) {
    throw new ApiError(422, "VALIDATION_FAILED", "Недопустимые параметры пагинации");
  }
  return { items: rows.slice(page * size, (page + 1) * size), page, size, totalItems: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / size)) };
}
function matches(t: DbTicket, q: TicketQuery): boolean {
  return (!q.status || t.status === q.status) && (!q.priority || t.priority === q.priority)
    && (!q.categoryId || t.categoryId === q.categoryId) && (!q.unassigned || t.assigneeId === null);
}
const byCreatedDesc = (a: DbTicket, b: DbTicket) => b.createdAt.localeCompare(a.createdAt);

// ---------------------------------------------------------------- API
export const mockApi: Api = {
  register: (email, password, displayName) => guard(() => {
    const errors: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Некорректный email";
    if (password.length < 8) errors.password = "Минимум 8 символов";
    if (displayName.trim().length < 1 || displayName.length > 100) errors.displayName = "От 1 до 100 символов";
    if (Object.keys(errors).length) throw validationError(errors);
    if (db().users.some((x) => x.email.toLowerCase() === email.toLowerCase())) {
      throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "Email уже занят");
    }
    db().users.push({ id: uid("u"), email, password, displayName: displayName.trim(), role: "USER", enabled: true, createdAt: nowIso() });
    commit();
  }),

  login: (email, password) => guard(() => {
    const u = db().users.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!u || u.password !== password) throw new ApiError(401, "UNAUTHORIZED", "Неверный email или пароль");
    if (!u.enabled) throw new ApiError(403, "USER_DISABLED", "Пользователь отключён");
    setTokens({ accessToken: `mock:${u.id}`, refreshToken: `mock-refresh:${u.id}` });
  }),

  logout: () => guard(() => clearTokens()),
  me: () => guard(() => toUser(authUser())),

  updateMe: (displayName) => guard(() => {
    const u = authUser();
    if (displayName.trim().length < 1 || displayName.length > 100) throw validationError({ displayName: "От 1 до 100 символов" });
    u.displayName = displayName.trim();
    commit();
    return toUser(u);
  }),

  listCategories: (includeInactive) => guard(() => {
    const u = authUser();
    const rows = includeInactive && u.role === "ADMIN" ? db().categories : db().categories.filter((c) => c.active);
    return rows.map((c) => ({ ...c })).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }),

  listTickets: (q) => guard(() => {
    const u = authUser();
    const rows = db().tickets.filter((t) => (u.role === "USER" ? t.authorId === u.id : true) && matches(t, q)).sort(byCreatedDesc);
    const p = paginate(rows, q);
    return { ...p, items: p.items.map(toTicket) };
  }),

  supportQueue: (q) => guard(() => {
    requireStaff(authUser());
    const rows = db().tickets
      .filter((t) => ACTIVE.includes(t.status) && matches(t, q))
      .sort((a, b) => RANK[b.priority] - RANK[a.priority] || a.createdAt.localeCompare(b.createdAt));
    const p = paginate(rows, q);
    return { ...p, items: p.items.map(toTicket) };
  }),

  myTickets: (q) => guard(() => {
    const u = authUser();
    requireStaff(u);
    const rows = db().tickets
      .filter((t) => t.assigneeId === u.id && (q.status ? t.status === q.status : ACTIVE.includes(t.status)) && matches({ ...t, status: t.status }, { ...q, status: undefined }))
      .sort(byCreatedDesc);
    const p = paginate(rows, q);
    return { ...p, items: p.items.map(toTicket) };
  }),

  createTicket: (input) => guard(() => {
    const u = authUser();
    const errors: Record<string, string> = {};
    if (input.title.trim().length < 1 || input.title.length > 200) errors.title = "От 1 до 200 символов";
    if (input.description.trim().length < 1) errors.description = "Опишите проблему";
    if (Object.keys(errors).length) throw validationError(errors);
    const other = db().categories.find((c) => c.code === "OTHER")!;
    const n = db().seq++;
    const t: DbTicket = {
      id: uid("t"), number: `HD-${n}`, title: input.title.trim(), description: input.description.trim(), status: "NEW", priority: "MEDIUM",
      categoryId: other.id, authorId: u.id, assigneeId: null, version: 0, createdAt: nowIso(), updatedAt: nowIso(),
      resolvedAt: null, closedAt: null, cancelledAt: null,
    };
    db().tickets.push(t);
    log(t, u, "TICKET_CREATED", null, "NEW");
    commit();
    return toTicket(t);
  }),

  getTicket: (id) => guard(() => toTicket(findTicket(authUser(), id))),

  takeTicket: (id, version) => guard(() => {
    const u = authUser();
    requireStaff(u);
    const t = findTicket(u, id);
    if (TERMINAL.includes(t.status)) throw new ApiError(409, "TICKET_TERMINAL", "Заявка в терминальном статусе");
    if (t.assigneeId) throw new ApiError(409, "ALREADY_ASSIGNED", "Заявку уже взяли");
    if (t.status !== "NEW") throw new ApiError(409, "INVALID_STATUS_TRANSITION", "Взять можно только новую заявку");
    if (t.version !== version) throw new ApiError(409, "VERSION_CONFLICT", "Версия заявки устарела");
    t.assigneeId = u.id;
    applyStatus(t, u, "IN_PROGRESS");
    log(t, u, "ASSIGNEE_CHANGED", null, u.displayName);
    touch(t);
    commit();
    return toTicket(t);
  }),

  assignTicket: (id, assigneeId, version) => guard(() => {
    const u = authUser();
    requireAdmin(u);
    const t = findTicket(u, id);
    checkMutable(t, version);
    const a = db().users.find((x) => x.id === assigneeId);
    if (!a || !a.enabled || a.role === "USER") throw new ApiError(422, "INVALID_ASSIGNEE", "Недопустимый исполнитель");
    const old = t.assigneeId ? ref(t.assigneeId).displayName : null;
    t.assigneeId = a.id;
    if (t.status === "NEW") applyStatus(t, u, "IN_PROGRESS");
    log(t, u, "ASSIGNEE_CHANGED", old, a.displayName);
    touch(t);
    commit();
    return toTicket(t);
  }),

  changeStatus: (id, status, version) => guard(() => {
    const u = authUser();
    const t = findTicket(u, id);
    if (TERMINAL.includes(t.status)) throw new ApiError(409, "TICKET_TERMINAL", "Заявка в терминальном статусе");
    if (!transitionExists(t.status, status)) throw new ApiError(409, "INVALID_STATUS_TRANSITION", `Переход ${t.status} → ${status} недопустим`);
    if (!isAllowed(u, t.authorId, t.status, status)) throw forbidden();
    if (t.version !== version) throw new ApiError(409, "VERSION_CONFLICT", "Версия заявки устарела");
    applyStatus(t, u, status);
    touch(t);
    commit();
    return toTicket(t);
  }),

  updateTicket: (id, patch, version) => guard(() => {
    const u = authUser();
    requireStaff(u);
    const t = findTicket(u, id);
    checkMutable(t, version);
    if (patch.categoryId && patch.categoryId !== t.categoryId) {
      const c = db().categories.find((x) => x.id === patch.categoryId);
      if (!c) throw validationError({ categoryId: "Категория не найдена" });
      if (!c.active) throw new ApiError(422, "CATEGORY_INACTIVE", "Категория неактивна");
      const old = db().categories.find((x) => x.id === t.categoryId)!;
      t.categoryId = c.id;
      log(t, u, "CATEGORY_CHANGED", old.code, c.code);
    }
    if (patch.priority && patch.priority !== t.priority) {
      log(t, u, "PRIORITY_CHANGED", t.priority, patch.priority);
      t.priority = patch.priority;
    }
    touch(t);
    commit();
    return toTicket(t);
  }),

  listComments: (id) => guard(() => {
    const u = authUser();
    const t = findTicket(u, id);
    return db().comments
      .filter((c) => c.ticketId === t.id && (u.role !== "USER" || !c.internal))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toComment);
  }),

  addComment: (id, body, internal) => guard(() => {
    const u = authUser();
    const t = findTicket(u, id);
    if (TERMINAL.includes(t.status)) throw new ApiError(409, "TICKET_TERMINAL", "Заявка в терминальном статусе");
    if (internal && u.role === "USER") throw forbidden();
    if (body.trim().length < 1) throw validationError({ body: "Комментарий не может быть пустым" });
    const c: DbComment = { id: uid("cm"), ticketId: t.id, authorId: u.id, body: body.trim(), internal, createdAt: nowIso() };
    db().comments.push(c);
    log(t, u, "COMMENT_ADDED", null, null, internal);
    // BR-013: публичный комментарий USER в WAITING_FOR_USER возвращает заявку в работу
    if (u.role === "USER" && t.status === "WAITING_FOR_USER") {
      applyStatus(t, u, "IN_PROGRESS");
      touch(t);
    }
    commit();
    return toComment(c);
  }),

  listHistory: (id) => guard(() => {
    const u = authUser();
    const t = findTicket(u, id);
    return db().history
      .filter((h) => h.ticketId === t.id && (u.role !== "USER" || !h.internal))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toHistory);
  }),

  listUsers: (q) => guard(() => {
    requireAdmin(authUser());
    const rows = [...db().users].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const p = paginate(rows, q);
    return { ...p, items: p.items.map(toUser) };
  }),

  updateUser: (id, patch) => guard(() => {
    requireAdmin(authUser());
    const target = db().users.find((x) => x.id === id);
    if (!target) throw new ApiError(404, "NOT_FOUND", "Пользователь не найден");
    const newRole = patch.role ?? target.role;
    const newEnabled = patch.enabled ?? target.enabled;
    const wasActiveAdmin = target.role === "ADMIN" && target.enabled;
    const stillActiveAdmin = newRole === "ADMIN" && newEnabled;
    if (wasActiveAdmin && !stillActiveAdmin && !db().users.some((x) => x.id !== target.id && x.role === "ADMIN" && x.enabled)) {
      throw new ApiError(409, "LAST_ADMIN", "Нельзя оставить систему без активного ADMIN");
    }
    target.role = newRole;
    target.enabled = newEnabled;
    commit();
    return toUser(target);
  }),

  createCategory: (input) => guard(() => {
    requireAdmin(authUser());
    const errors: Record<string, string> = {};
    if (!/^[A-Z][A-Z0-9_]{0,49}$/.test(input.code)) errors.code = "Заглавные латинские буквы, цифры и _ (до 50)";
    if (input.name.trim().length < 1 || input.name.length > 100) errors.name = "От 1 до 100 символов";
    if (Object.keys(errors).length) throw validationError(errors);
    if (db().categories.some((c) => c.code === input.code)) throw new ApiError(409, "CATEGORY_CODE_EXISTS", "Код уже существует");
    const c: Category = { id: uid("c"), code: input.code, name: input.name.trim(), description: input.description?.trim() || null, active: true };
    db().categories.push(c);
    commit();
    return { ...c };
  }),

  updateCategory: (id, patch) => guard(() => {
    requireAdmin(authUser());
    const c = db().categories.find((x) => x.id === id);
    if (!c) throw new ApiError(404, "NOT_FOUND", "Категория не найдена");
    if (patch.name !== undefined) {
      if (patch.name.trim().length < 1 || patch.name.length > 100) throw validationError({ name: "От 1 до 100 символов" });
      c.name = patch.name.trim();
    }
    if (patch.description !== undefined) c.description = patch.description.trim() || null;
    if (patch.active !== undefined) c.active = patch.active;
    commit();
    return { ...c };
  }),
};

/** Сброс демо-данных (кнопка на странице входа в mock-режиме). */
export function resetMockData(): void {
  window.localStorage.removeItem(KEY);
  cache = null;
  clearTokens();
}
