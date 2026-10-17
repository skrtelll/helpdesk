import { ApiError } from "./api/types";
import type { HistoryEventType, Priority, Role, Status } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  WAITING_FOR_USER: "Ждём ответа",
  RESOLVED: "Решена",
  CLOSED: "Закрыта",
  CANCELLED: "Отменена",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  CRITICAL: "Критический",
};

export const ROLE_LABEL: Record<Role, string> = {
  USER: "Пользователь",
  SUPPORT: "Поддержка",
  ADMIN: "Администратор",
};

export const EVENT_LABEL: Record<HistoryEventType, string> = {
  TICKET_CREATED: "Заявка создана",
  STATUS_CHANGED: "Статус изменён",
  PRIORITY_CHANGED: "Приоритет изменён",
  CATEGORY_CHANGED: "Категория изменена",
  ASSIGNEE_CHANGED: "Исполнитель изменён",
  COMMENT_ADDED: "Добавлен комментарий",
  TICKET_RESOLVED: "Заявка решена",
  TICKET_REOPENED: "Заявка переоткрыта",
  TICKET_CLOSED: "Заявка закрыта",
  TICKET_CANCELLED: "Заявка отменена",
};

export function transitionLabel(from: Status, to: Status): string {
  if (to === "CANCELLED") return "Отменить заявку";
  if (to === "CLOSED") return "Закрыть заявку";
  if (from === "RESOLVED" && to === "IN_PROGRESS") return "Переоткрыть";
  if (to === "WAITING_FOR_USER") return "Ждать ответа пользователя";
  if (to === "RESOLVED") return "Отметить решённой";
  return "Вернуть в работу";
}

const ERROR_TEXT: Record<string, string> = {
  UNAUTHORIZED: "Неверный email или пароль, либо требуется вход.",
  FORBIDDEN: "Недостаточно прав для этого действия.",
  USER_DISABLED: "Учётная запись отключена.",
  NOT_FOUND: "Не найдено.",
  VALIDATION_FAILED: "Проверьте введённые данные.",
  EMAIL_ALREADY_EXISTS: "Пользователь с таким email уже зарегистрирован.",
  INVALID_STATUS_TRANSITION: "Такой переход статуса недопустим.",
  TICKET_TERMINAL: "Заявка закрыта или отменена, изменения невозможны.",
  ALREADY_ASSIGNED: "Заявку уже взял другой сотрудник.",
  VERSION_CONFLICT: "Заявку изменили в другом месте. Данные обновлены, повторите действие.",
  LAST_ADMIN: "Нельзя отключить или понизить последнего активного администратора.",
  CATEGORY_CODE_EXISTS: "Категория с таким кодом уже есть.",
  INVALID_ASSIGNEE: "Исполнитель должен быть включённым сотрудником поддержки или администратором.",
  CATEGORY_INACTIVE: "Нельзя выбрать неактивную категорию.",
};

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return ERROR_TEXT[e.code] ?? e.message;
  if (e instanceof TypeError) return "Нет связи с сервером.";
  return e instanceof Error ? e.message : "Неизвестная ошибка.";
}

export function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "—";
}
