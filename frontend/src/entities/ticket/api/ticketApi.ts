import { apiRequest } from "@/shared/api";
import type { Ticket } from "../model/types";

// Пути заявок собраны по ТЗ; сверьте с docs/HelpDesk_System_API_Documentation.md.
export async function listTickets(): Promise<Ticket[]> {
  const res = await apiRequest<Ticket[] | { items: Ticket[] }>("GET", "/tickets");
  return Array.isArray(res) ? res : res.items;
}

export function getTicket(id: string): Promise<Ticket> {
  return apiRequest<Ticket>("GET", `/tickets/${encodeURIComponent(id)}`);
}

export function createTicket(input: { title: string; description: string }): Promise<Ticket> {
  return apiRequest<Ticket>("POST", "/tickets", input);
}
