export type TicketStatus = "NEW" | "IN_PROGRESS" | "WAITING_FOR_USER" | "RESOLVED" | "CLOSED" | "CANCELLED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Ticket {
  id: string;
  number: string; // например HD-1000
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string; // ISO-8601 UTC
  updatedAt: string;
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
