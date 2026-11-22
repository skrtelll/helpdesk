import type { TicketSummary } from "@/entities/ticket";
import { isStaff, type User } from "@/entities/user";

/** Кнопка «Взять» показывается сотруднику для новой заявки без исполнителя. Только UX: проверка на backend. */
export function canTake(user: User, ticket: TicketSummary): boolean {
  return isStaff(user.role) && ticket.status === "NEW" && ticket.assignee === null;
}
