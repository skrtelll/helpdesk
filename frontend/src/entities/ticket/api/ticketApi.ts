import { apiRequest, type Page } from "@/shared/api";
import type { Ticket, TicketPriority, TicketStatus, TicketSummary } from "../model/types";

export interface TicketQuery {
  page?: number; // с 0
  size?: number; // не больше 100
  priority?: TicketPriority;
  category?: string; // categories.code
  /** "поле,направление"; поля: createdAt, updatedAt, priority, status */
  sort?: string;
  /** только GET /tickets */
  status?: TicketStatus;
  search?: string;
  /** только GET /support/queue */
  unassigned?: boolean;
}

/** GET /tickets: USER получает только свои заявки, SUPPORT/ADMIN — все (документация, п. 7.3). */
export function listTickets(q: TicketQuery = {}): Promise<Page<TicketSummary>> {
  return apiRequest<Page<TicketSummary>>("GET", "/tickets", {
    params: { page: q.page, size: q.size, status: q.status, priority: q.priority, category: q.category, search: q.search, sort: q.sort },
  });
}

/**
 * GET /support/queue (SUPPORT/ADMIN, п. 7.6): активные заявки. Без `sort` порядок задаёт backend:
 * приоритет по убыванию, затем старые первыми.
 */
export function listQueue(q: TicketQuery = {}): Promise<Page<TicketSummary>> {
  return apiRequest<Page<TicketSummary>>("GET", "/support/queue", {
    params: { page: q.page, size: q.size, priority: q.priority, category: q.category, unassigned: q.unassigned, sort: q.sort },
  });
}

export function getTicket(id: string): Promise<Ticket> {
  return apiRequest<Ticket>("GET", `/tickets/${encodeURIComponent(id)}`);
}

/** POST /tickets: клиент передаёт только title и description (BR-003, SEC-005). */
export function createTicket(input: { title: string; description: string }): Promise<Ticket> {
  return apiRequest<Ticket>("POST", "/tickets", { body: input });
}
