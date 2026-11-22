export type TicketStatus = "NEW" | "IN_PROGRESS" | "WAITING_FOR_USER" | "RESOLVED" | "CLOSED" | "CANCELLED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const STATUSES: TicketStatus[] = ["NEW", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED", "CANCELLED"];
export const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export interface PersonRef {
  id: string;
  displayName: string;
}

/** Заявка в списках (GET /tickets, GET /support/queue): без описания и version. */
export interface TicketSummary {
  id: string;
  number: string; // HD-1000
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: { code: string; name: string };
  assignee: PersonRef | null;
  createdAt: string; // ISO-8601 UTC
  updatedAt: string;
}

/** Полная заявка (GET /tickets/{id}, POST /tickets). */
export interface Ticket extends TicketSummary {
  description: string;
  author: PersonRef;
  version: number;
  resolvedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  WAITING_FOR_USER: "Ждём ответа",
  RESOLVED: "Решена",
  CLOSED: "Закрыта",
  CANCELLED: "Отменена",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  CRITICAL: "Критический",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}
