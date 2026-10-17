import type {
  Category, HistoryEvent, Page, Priority, Role, Status, Ticket, TicketComment, TicketQuery, User,
} from "../types";

export class ApiError extends Error {
  status: number;
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

/** Контракт между UI и данными. Реализации: http.ts (backend) и mock.ts (без backend). */
export interface Api {
  register(email: string, password: string, displayName: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  me(): Promise<User>;
  updateMe(displayName: string): Promise<User>;

  listCategories(includeInactive?: boolean): Promise<Category[]>;

  listTickets(q: TicketQuery): Promise<Page<Ticket>>;
  supportQueue(q: TicketQuery): Promise<Page<Ticket>>;
  myTickets(q: TicketQuery): Promise<Page<Ticket>>;
  createTicket(input: { title: string; description: string }): Promise<Ticket>;
  getTicket(id: string): Promise<Ticket>;
  takeTicket(id: string, version: number): Promise<Ticket>;
  assignTicket(id: string, assigneeId: string, version: number): Promise<Ticket>;
  changeStatus(id: string, status: Status, version: number): Promise<Ticket>;
  updateTicket(id: string, patch: { categoryId?: string; priority?: Priority }, version: number): Promise<Ticket>;

  listComments(id: string): Promise<TicketComment[]>;
  addComment(id: string, body: string, internal: boolean): Promise<TicketComment>;
  listHistory(id: string): Promise<HistoryEvent[]>;

  listUsers(q: { page?: number; size?: number }): Promise<Page<User>>;
  updateUser(id: string, patch: { role?: Role; enabled?: boolean }): Promise<User>;
  createCategory(input: { code: string; name: string; description?: string }): Promise<Category>;
  updateCategory(id: string, patch: { name?: string; description?: string; active?: boolean }): Promise<Category>;
}
