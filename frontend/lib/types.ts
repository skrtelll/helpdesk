export type Role = "USER" | "SUPPORT" | "ADMIN";
export type Status = "NEW" | "IN_PROGRESS" | "WAITING_FOR_USER" | "RESOLVED" | "CLOSED" | "CANCELLED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const STATUSES: Status[] = ["NEW", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED", "CANCELLED"];
export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const TERMINAL: Status[] = ["CLOSED", "CANCELLED"];
export const ACTIVE: Status[] = ["NEW", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED"];

export interface UserRef {
  id: string;
  displayName: string;
}

export interface User extends UserRef {
  email: string;
  role: Role;
  enabled: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface Ticket {
  id: string;
  number: string; // HD-1000
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  category: Category;
  author: UserRef;
  assignee: UserRef | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  author: UserRef;
  authorRole: Role;
  body: string;
  internal: boolean;
  createdAt: string;
}

export type HistoryEventType =
  | "TICKET_CREATED"
  | "STATUS_CHANGED"
  | "PRIORITY_CHANGED"
  | "CATEGORY_CHANGED"
  | "ASSIGNEE_CHANGED"
  | "COMMENT_ADDED"
  | "TICKET_RESOLVED"
  | "TICKET_REOPENED"
  | "TICKET_CLOSED"
  | "TICKET_CANCELLED";

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  actor: UserRef;
  oldValue: string | null;
  newValue: string | null;
  internal: boolean;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  page: number; // с 0
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface TicketQuery {
  page?: number;
  size?: number;
  status?: Status;
  priority?: Priority;
  categoryId?: string;
  unassigned?: boolean;
}
